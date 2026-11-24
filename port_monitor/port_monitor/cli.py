from __future__ import annotations

import argparse
import sys
import time
from typing import Any, Optional

from .config import MonitorConfig
from .monitors.bus import get_high_speed_bus_state
from .monitors.display import get_display_state
from .monitors.network import get_ethernet_state
from .monitors.power import get_power_state
from .monitors.storage import get_removable_media_state
from .monitors.usb import USBMonitorService, usb_device_label
from .proctoring.telemetry import ProctoringTelemetryEngine
from .server.app import ProctoringApiServer
from .utils import alert, info, warn

def print_startup_inventory(
    usb_devices: Optional[dict[str, dict[str, Any]]],
    power_state: Optional[bool],
    display_state: Optional[dict[str, str]],
    ethernet_state: Optional[dict[str, tuple[bool, str]]],
    high_speed_bus_state: Optional[dict[str, str]],
    media_state: Optional[dict[str, str]],
) -> None:
    print("\nCURRENTLY CONNECTED EXTERNAL DEVICES")
    print("=" * 52)

    known_connected = 0

    def section(title: str, items: Optional[list[str]]) -> None:
        nonlocal known_connected
        if items is None:
            print(f"  {title}: status unavailable on this system/driver")
        elif items:
            print(f"  {title}:")
            for item in sorted(items, key=str.casefold):
                print(f"    - {item}")
                known_connected += 1
        else:
            print(f"  {title}: none detected")

    if power_state is True:
        print("  External power / charger: CONNECTED")
        known_connected += 1
    elif power_state is False:
        print("  External power / charger: NOT CONNECTED (running on battery)")
    else:
        print("  External power / charger: status unavailable")

    usb_items = (
        [f"{usb_device_label(v)} [{k}]" for k, v in usb_devices.items()]
        if usb_devices is not None else None
    )
    section("USB devices", usb_items)

    display_items = (
        [f"{v} display (monitor: {k})" for k, v in display_state.items()]
        if display_state is not None else None
    )
    section("External displays", display_items)

    ethernet_items = (
        [f"Ethernet link active — {name}" for connected, name in ethernet_state.values() if connected]
        if ethernet_state is not None else None
    )
    section("Wired Ethernet", ethernet_items)

    high_speed_items = list(high_speed_bus_state.values()) if high_speed_bus_state is not None else None
    section("Thunderbolt / USB4 / FireWire", high_speed_items)

    media_items = list(media_state.values()) if media_state is not None else None
    section("Removable storage", media_items)

    print("=" * 52)
    print("Live monitoring is now active. Hardware changes will trigger telemetry.")
    print("=" * 52 + "\n")

def run_cli() -> None:
    parser = argparse.ArgumentParser(description="Live External Connection & Port Monitor for BrutallyHired")
    parser.add_argument("--interval", type=float, default=1.0, help="Poll interval in seconds")
    parser.add_argument("--port", type=int, default=4899, help="Telemetry API server port (default: 4899)")
    parser.add_argument("--no-server", action="store_true", help="Disable embedded HTTP API server")
    parser.add_argument("--candidate-id", type=str, default="cmwssnj7e0003vnvsanhlfhqg", help="Active Candidate ID")
    args = parser.parse_args()

    config = MonitorConfig(
        poll_interval_seconds=args.interval,
        api_server_port=args.port,
    )

    engine = ProctoringTelemetryEngine(
        candidate_id=args.candidate_id,
        max_violations=config.max_violations_before_reject,
    )

    def on_usb_change(action: str, label: str, info: dict[str, Any]) -> None:
        if action == "connected":
            engine.record_violation(
                event_type="usb_device_connected",
                description=f"External USB device connected during examination: {label}",
                evidence=info,
                severity="HIGH",
            )

    usb_service = USBMonitorService(on_change=on_usb_change)
    usb_service.start()

    # Start local HTTP proctoring daemon
    api_server = None
    if not args.no_server:
        api_server = ProctoringApiServer(
            engine=engine,
            usb_monitor=usb_service,
            port=config.api_server_port,
        )
        api_server.start()

    # Initial snapshot
    power = get_power_state()
    displays = get_display_state()
    ethernet = get_ethernet_state()
    bus = get_high_speed_bus_state()
    media = get_removable_media_state()

    print_startup_inventory(
        usb_devices=usb_service.initial_devices,
        power_state=power,
        display_state=displays,
        ethernet_state=ethernet,
        high_speed_bus_state=bus,
        media_state=media,
    )

    last_power = power
    last_displays = displays
    last_ethernet = ethernet
    last_media = media

    try:
        while True:
            time.sleep(config.poll_interval_seconds)

            # Check Power
            curr_power = get_power_state()
            if curr_power is not None and curr_power != last_power:
                action = "connected" if curr_power else "disconnected"
                alert(f"Charger {action}")
                last_power = curr_power

            # Check Displays
            curr_displays = get_display_state()
            if curr_displays is not None and last_displays is not None:
                new_displays = curr_displays.keys() - last_displays.keys()
                if new_displays:
                    for d_key in new_displays:
                        d_name = curr_displays[d_key]
                        alert(f"External display connected — {d_name}")
                        engine.record_violation(
                            event_type="external_display_connected",
                            description=f"Secondary display connected during exam: {d_name}",
                            evidence={"display": d_name, "instance": d_key},
                            severity="CRITICAL",
                        )
                removed_displays = last_displays.keys() - curr_displays.keys()
                for d_key in removed_displays:
                    alert(f"External display disconnected — {last_displays[d_key]}")
                last_displays = curr_displays

            # Check Removable Storage
            curr_media = get_removable_media_state()
            if curr_media is not None and last_media is not None:
                new_media = curr_media.keys() - last_media.keys()
                if new_media:
                    for m_key in new_media:
                        m_name = curr_media[m_key]
                        alert(f"Removable storage connected — {m_name}")
                        engine.record_violation(
                            event_type="removable_storage_connected",
                            description=f"External storage media inserted during exam: {m_name}",
                            evidence={"media": m_name, "key": m_key},
                            severity="CRITICAL",
                        )
                last_media = curr_media

    except KeyboardInterrupt:
        info("Stopping port monitor...")
    finally:
        usb_service.stop()
        if api_server:
            api_server.stop()
        info("Port monitor stopped cleanly.")

if __name__ == "__main__":
    run_cli()
