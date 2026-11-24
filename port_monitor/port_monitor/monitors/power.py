import ctypes
import glob
import os
import platform
from typing import Optional
from ..utils import run_command
from .base import BaseMonitor

class SYSTEM_POWER_STATUS(ctypes.Structure):
    _fields_ = [
        ("ACLineStatus", ctypes.c_byte),
        ("BatteryFlag", ctypes.c_byte),
        ("BatteryLifePercent", ctypes.c_byte),
        ("SystemStatusFlag", ctypes.c_byte),
        ("BatteryLifeTime", ctypes.c_ulong),
        ("BatteryFullLifeTime", ctypes.c_ulong),
    ]

def get_power_state() -> Optional[bool]:
    system = platform.system()
    if system == "Windows":
        try:
            status = SYSTEM_POWER_STATUS()
            ok = ctypes.windll.kernel32.GetSystemPowerStatus(ctypes.byref(status))
            if not ok:
                return None
            if status.ACLineStatus == 1:
                return True
            if status.ACLineStatus == 0:
                return False
            return None
        except Exception:
            return None

    if system == "Linux":
        candidates = []
        for path in glob.glob("/sys/class/power_supply/*"):
            try:
                supply_type = open(os.path.join(path, "type"), encoding="utf-8").read().strip().lower()
            except OSError:
                continue
            if supply_type in {"mains", "usb", "usb_c", "usb_pd", "usb_pd_drp"}:
                try:
                    online = open(os.path.join(path, "online"), encoding="utf-8").read().strip()
                    candidates.append(online == "1")
                except OSError:
                    continue
        if candidates:
            return any(candidates)
        return None

    if system == "Darwin":
        output = run_command(["/usr/bin/pmset", "-g", "batt"])
        if not output:
            return None
        if "AC Power" in output:
            return True
        if "Battery Power" in output:
            return False
        return None

    return None

class PowerMonitor(BaseMonitor):
    def __init__(self) -> None:
        self._last_state: Optional[bool] = None

    def start(self) -> bool:
        self._last_state = get_power_state()
        return True

    def stop(self) -> None:
        pass

    def get_state(self) -> Optional[bool]:
        return get_power_state()
