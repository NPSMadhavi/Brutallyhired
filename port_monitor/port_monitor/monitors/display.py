import glob
import os
import platform
from typing import Optional
from functools import lru_cache
from ..utils import run_command
from .base import BaseMonitor

@lru_cache(maxsize=4)
def get_wmi_connection(namespace: Optional[str] = None):
    import wmi  # type: ignore
    if namespace:
        return wmi.WMI(namespace=namespace)
    return wmi.WMI()

def get_windows_displays() -> Optional[dict[str, str]]:
    try:
        connection = get_wmi_connection(r"root\wmi")
        technology_names = {
            0: "VGA",
            1: "S-Video",
            2: "Composite",
            3: "Component",
            4: "DVI",
            5: "HDMI",
            8: "D connector",
            9: "SDI",
            10: "DisplayPort",
            12: "UDI",
            14: "SDTV dongle",
            15: "Miracast display",
            16: "Indirect wired display",
        }
        result: dict[str, str] = {}
        for monitor in connection.WmiMonitorConnectionParams():
            if not bool(getattr(monitor, "Active", False)):
                continue
            try:
                technology = int(monitor.VideoOutputTechnology)
            except (TypeError, ValueError, AttributeError):
                continue
            if technology in {6, 11, 13, 17}:
                continue
            name = technology_names.get(technology)
            if name:
                instance = str(getattr(monitor, "InstanceName", name))
                result[instance] = name
        return result
    except Exception:
        return None

def get_linux_displays() -> Optional[dict[str, str]]:
    root = "/sys/class/drm"
    if not os.path.isdir(root):
        return None
    result: dict[str, str] = {}
    try:
        for connector in glob.glob(os.path.join(root, "card*-*")):
            name = os.path.basename(connector)
            if any(token in name.lower() for token in ("-edp-", "-lvds-", "-dsi-", "-writeback-")):
                continue
            status_path = os.path.join(connector, "status")
            try:
                status = open(status_path, encoding="utf-8").read().strip().lower()
            except OSError:
                continue
            if status == "connected":
                result[name] = name.split("-", 1)[-1]
        return result
    except OSError:
        return None

def get_macos_displays() -> Optional[dict[str, str]]:
    try:
        import Quartz  # type: ignore
        result = Quartz.CGGetOnlineDisplayList(32, None, None)
        if not isinstance(result, tuple) or len(result) < 2:
            return None
        error_code, display_ids = result[0], result[1]
        if error_code != 0:
            return None
        displays: dict[str, str] = {}
        for display_id in display_ids:
            try:
                if not Quartz.CGDisplayIsBuiltin(display_id):
                    key = str(int(display_id))
                    displays[key] = f"External display (ID {key})"
            except Exception:
                continue
        return displays
    except Exception:
        return None

def get_display_state() -> Optional[dict[str, str]]:
    system = platform.system()
    if system == "Windows":
        return get_windows_displays()
    if system == "Linux":
        return get_linux_displays()
    if system == "Darwin":
        return get_macos_displays()
    return None

class DisplayMonitor(BaseMonitor):
    def start(self) -> bool:
        return True

    def stop(self) -> None:
        pass

    def get_state(self) -> Optional[dict[str, str]]:
        return get_display_state()
