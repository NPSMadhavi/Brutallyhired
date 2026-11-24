import platform
from typing import Any, Callable, Optional
from ..utils import alert, clean_text, warn
from .base import BaseMonitor

try:
    from usbmonitor import USBMonitor
except ImportError:
    USBMonitor = None

def usb_device_label(device_info: dict[str, Any]) -> str:
    model = clean_text(
        device_info.get("ID_MODEL_FROM_DATABASE")
        or device_info.get("ID_MODEL")
        or device_info.get("PRODUCT"),
    )
    vendor = clean_text(
        device_info.get("ID_VENDOR_FROM_DATABASE")
        or device_info.get("ID_VENDOR"),
        default="",
    )
    if vendor and vendor.lower() not in model.lower():
        label = f"{vendor} {model}"
    else:
        label = model

    vid = str(device_info.get("ID_VENDOR_ID") or "").strip()
    pid = str(device_info.get("ID_MODEL_ID") or "").strip()
    if vid and pid:
        label += f" (VID:PID {vid}:{pid})"

    location = str(
        device_info.get("ID_PATH")
        or device_info.get("DEVNAME")
        or ""
    ).strip()
    if location:
        label += f" — location {location}"
    return label

def is_internal_usb_infrastructure(device_info: dict[str, Any]) -> bool:
    fields = [
        device_info.get("ID_MODEL"),
        device_info.get("ID_MODEL_FROM_DATABASE"),
        device_info.get("DEVNAME"),
    ]
    text = " ".join(str(v or "") for v in fields).lower()
    blocked = (
        "root hub",
        "root_hub",
        "host controller",
        "host_controller",
        "xhci host",
        "ehci host",
        "ohci host",
    )
    return any(item in text for item in blocked)

class USBMonitorService(BaseMonitor):
    def __init__(self, on_change: Optional[Callable[[str, str, dict[str, Any]], None]] = None) -> None:
        self.monitor = None
        self.initial_devices: Optional[dict[str, dict[str, Any]]] = None
        self.on_change = on_change

    def start(self) -> bool:
        if USBMonitor is None:
            warn("USB monitoring unavailable. Install requirements first.")
            return False

        def on_connect(device_id: str, device_info: dict[str, Any]) -> None:
            try:
                if is_internal_usb_infrastructure(device_info):
                    return
                desc = usb_device_label(device_info)
                alert(f"USB connected — {desc}")
                if self.on_change:
                    self.on_change("connected", desc, device_info)
            except Exception as exc:
                warn(f"USB connect error: {exc}")

        def on_disconnect(device_id: str, device_info: dict[str, Any]) -> None:
            try:
                if is_internal_usb_infrastructure(device_info):
                    return
                desc = usb_device_label(device_info)
                alert(f"USB disconnected — {desc}")
                if self.on_change:
                    self.on_change("disconnected", desc, device_info)
            except Exception as exc:
                warn(f"USB disconnect error: {exc}")

        try:
            self.monitor = USBMonitor()
            available = self.monitor.get_available_devices()
            self.initial_devices = {
                str(device_id): device_info
                for device_id, device_info in available.items()
                if not is_internal_usb_infrastructure(device_info)
            }
            self.monitor.start_monitoring(
                on_connect=on_connect,
                on_disconnect=on_disconnect,
                check_every_seconds=0.5,
            )
            return True
        except Exception as exc:
            warn(f"USB monitor start failed: {exc}")
            self.monitor = None
            return False

    def stop(self) -> None:
        if self.monitor is not None:
            try:
                self.monitor.stop_monitoring(warn_if_was_stopped=False)
            except Exception:
                pass

    def get_state(self) -> dict[str, Any]:
        if self.monitor:
            try:
                devs = self.monitor.get_available_devices()
                return {
                    str(k): v for k, v in devs.items()
                    if not is_internal_usb_infrastructure(v)
                }
            except Exception:
                pass
        return self.initial_devices or {}
