import json
import os
import platform
import plistlib
from typing import Any, Optional
from ..utils import clean_text, run_command
from .base import BaseMonitor
from .display import get_wmi_connection

def get_windows_removable_media() -> Optional[dict[str, str]]:
    try:
        connection = get_wmi_connection()
        result: dict[str, str] = {}
        for disk in connection.Win32_LogicalDisk():
            try:
                if int(disk.DriveType) != 2:
                    continue
            except (TypeError, ValueError, AttributeError):
                continue
            drive = str(getattr(disk, "DeviceID", "") or "").strip()
            if drive:
                label = clean_text(getattr(disk, "VolumeName", None), "Removable volume")
                result[drive] = f"{drive} ({label})"
        return result
    except Exception:
        return None

def get_linux_removable_media() -> Optional[dict[str, str]]:
    output = run_command([
        "lsblk", "--json", "--output", "NAME,RM,TRAN,TYPE,LABEL,MOUNTPOINTS"
    ])
    if output is None:
        return None
    try:
        data = json.loads(output)
        result: dict[str, str] = {}

        def visit(devices: list[dict[str, Any]]) -> None:
            for device in devices:
                if device.get("type") == "disk":
                    removable = bool(device.get("rm")) or str(device.get("tran") or "").lower() == "usb"
                    if removable:
                        name = str(device.get("name") or "external disk")
                        label = clean_text(device.get("label"), name)
                        result[name] = f"{label} (/dev/{name})"
                children = device.get("children")
                if isinstance(children, list):
                    visit(children)

        visit(data.get("blockdevices", []))
        return result
    except (ValueError, TypeError):
        return None

def get_macos_removable_media() -> Optional[dict[str, str]]:
    output = run_command(["/usr/sbin/diskutil", "list", "external", "physical", "-plist"], timeout=6.0)
    if output is None:
        return None
    try:
        data = plistlib.loads(output.encode("utf-8"))
        result: dict[str, str] = {}
        for disk in data.get("AllDisksAndPartitions", []):
            identifier = str(disk.get("DeviceIdentifier") or "")
            if identifier:
                result[identifier] = f"External storage ({identifier})"
        return result
    except Exception:
        return None

def get_removable_media_state() -> Optional[dict[str, str]]:
    system = platform.system()
    if system == "Windows":
        return get_windows_removable_media()
    if system == "Linux":
        return get_linux_removable_media()
    if system == "Darwin":
        return get_macos_removable_media()
    return None

class StorageMonitor(BaseMonitor):
    def start(self) -> bool:
        return True

    def stop(self) -> None:
        pass

    def get_state(self) -> Optional[dict[str, str]]:
        return get_removable_media_state()
