import os
import platform
import re
from typing import Optional
from ..utils import clean_text, run_command
from .base import BaseMonitor
from .display import get_wmi_connection

def get_windows_ethernet() -> Optional[dict[str, tuple[bool, str]]]:
    try:
        connection = get_wmi_connection(r"root\StandardCimv2")
        result: dict[str, tuple[bool, str]] = {}
        for adapter in connection.MSFT_NetAdapter():
            if not bool(getattr(adapter, "HardwareInterface", False)):
                continue
            if bool(getattr(adapter, "Virtual", False)) or bool(getattr(adapter, "EndPointInterface", False)):
                continue
            try:
                link_technology = int(adapter.LinkTechnology)
                media_state = int(adapter.MediaConnectState)
            except (TypeError, ValueError, AttributeError):
                continue
            if link_technology != 2:
                continue
            connected = media_state == 1
            name = clean_text(
                getattr(adapter, "InterfaceDescription", None)
                or getattr(adapter, "Name", None),
                "Ethernet adapter",
            )
            key = str(
                getattr(adapter, "InterfaceGuid", None)
                or getattr(adapter, "PnPDeviceID", None)
                or name
            )
            result[key] = (connected, name)
        return result
    except Exception:
        try:
            connection = get_wmi_connection()
            result = {}
            for adapter in connection.Win32_NetworkAdapter():
                if not bool(getattr(adapter, "PhysicalAdapter", False)):
                    continue
                try:
                    adapter_type = int(adapter.AdapterTypeID)
                    status = int(adapter.NetConnectionStatus)
                except (TypeError, ValueError, AttributeError):
                    continue
                if adapter_type != 0:
                    continue
                connected = status == 2
                name = clean_text(getattr(adapter, "Name", None), "Ethernet adapter")
                key = str(
                    getattr(adapter, "PNPDeviceID", None)
                    or getattr(adapter, "GUID", None)
                    or name
                )
                result[key] = (connected, name)
            return result
        except Exception:
            return None

def get_linux_ethernet() -> Optional[dict[str, tuple[bool, str]]]:
    root = "/sys/class/net"
    if not os.path.isdir(root):
        return None
    result: dict[str, tuple[bool, str]] = {}
    virtual_prefixes = (
        "lo", "wl", "wlan", "wwan", "wwp", "docker", "veth", "virbr",
        "br-", "tun", "tap", "wg", "tailscale", "zt", "ham"
    )
    try:
        for name in os.listdir(root):
            if name.startswith(virtual_prefixes):
                continue
            base = os.path.join(root, name)
            if os.path.exists(os.path.join(base, "wireless")):
                continue
            if not os.path.exists(os.path.join(base, "device")):
                continue
            try:
                link_type = open(os.path.join(base, "type"), encoding="utf-8").read().strip()
                if link_type != "1":
                    continue
                carrier_text = open(os.path.join(base, "carrier"), encoding="utf-8").read().strip()
            except OSError:
                continue
            result[name] = (carrier_text == "1", name)
        return result
    except OSError:
        return None

def get_macos_ethernet() -> Optional[dict[str, tuple[bool, str]]]:
    output = run_command(["/usr/sbin/networksetup", "-listallhardwareports"])
    if output is None:
        return None
    ports: list[tuple[str, str]] = []
    current_name: Optional[str] = None
    for line in output.splitlines():
        if line.startswith("Hardware Port:"):
            current_name = line.split(":", 1)[1].strip()
        elif line.startswith("Device:") and current_name:
            interface = line.split(":", 1)[1].strip()
            label = current_name
            low_label = label.lower()
            if "ethernet" in low_label or ("usb" in low_label and "lan" in low_label):
                ports.append((interface, label))
            current_name = None
    result: dict[str, tuple[bool, str]] = {}
    for interface, label in ports:
        detail = run_command(["/sbin/ifconfig", interface], timeout=2.0)
        if detail is None:
            continue
        active = bool(re.search(r"\bstatus:\s*active\b", detail, flags=re.IGNORECASE))
        result[interface] = (active, label)
    return result

def get_ethernet_state() -> Optional[dict[str, tuple[bool, str]]]:
    system = platform.system()
    if system == "Windows":
        return get_windows_ethernet()
    if system == "Linux":
        return get_linux_ethernet()
    if system == "Darwin":
        return get_macos_ethernet()
    return None

class EthernetMonitor(BaseMonitor):
    def start(self) -> bool:
        return True

    def stop(self) -> None:
        pass

    def get_state(self) -> Optional[dict[str, tuple[bool, str]]]:
        return get_ethernet_state()
