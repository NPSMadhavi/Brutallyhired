import os
import platform
from typing import Optional
from ..utils import clean_text
from .base import BaseMonitor
from .display import get_wmi_connection

def get_windows_high_speed_bus_devices() -> Optional[dict[str, str]]:
    try:
        connection = get_wmi_connection()
        result: dict[str, str] = {}
        prefixes = ("USB4\\", "THUNDERBOLT\\", "1394\\")
        for device in connection.Win32_PnPEntity():
            device_id = str(getattr(device, "PNPDeviceID", "") or "").upper()
            if not device_id.startswith(prefixes):
                continue
            present = getattr(device, "Present", None)
            if present is False:
                continue
            name = clean_text(getattr(device, "Name", None), "External device")
            result[device_id] = name
        return result
    except Exception:
        return None

def get_linux_thunderbolt_devices() -> Optional[dict[str, str]]:
    root = "/sys/bus/thunderbolt/devices"
    if not os.path.isdir(root):
        return None
    result: dict[str, str] = {}
    try:
        for entry in os.listdir(root):
            if entry.startswith("domain") or "-" not in entry:
                continue
            device_path = os.path.join(root, entry)
            name = ""
            for attribute in ("device_name", "vendor_name", "product_name"):
                try:
                    value = open(os.path.join(device_path, attribute), encoding="utf-8").read().strip()
                except OSError:
                    value = ""
                if value:
                    name = f"{name} {value}".strip()
            result[entry] = name or f"Thunderbolt device {entry}"
        return result
    except OSError:
        return None

def get_high_speed_bus_state() -> Optional[dict[str, str]]:
    system = platform.system()
    if system == "Windows":
        return get_windows_high_speed_bus_devices()
    if system == "Linux":
        return get_linux_thunderbolt_devices()
    return None

class HighSpeedBusMonitor(BaseMonitor):
    def start(self) -> bool:
        return True

    def stop(self) -> None:
        pass

    def get_state(self) -> Optional[dict[str, str]]:
        return get_high_speed_bus_state()
