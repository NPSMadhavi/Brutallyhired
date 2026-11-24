# Live External Connection Monitor

A visible terminal-only monitor for Windows 10/11, Linux desktops, and macOS.
At startup it prints a one-time summary of external connections already detected.
After that, it prints only short alerts when a monitored connection changes; it
does not repeatedly print the hardware inventory.

## Monitored signals

- USB peripherals: connected/disconnected, friendly name and VID:PID when available.
- External power/charger state.
- External display presence (HDMI/DisplayPort/VGA connector details where exposed).
- Wired Ethernet link state (Wi-Fi is excluded).
- Thunderbolt / USB4 / FireWire PnP devices where exposed (Windows/Linux).
- Removable storage presence (USB disks / removable volumes / SD media where exposed).

## Install

Use Python 3.10 or newer. From this folder:

```bash
python -m venv .venv
```

Windows PowerShell:

```powershell
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python live_external_port_monitor.py
```

Linux / macOS:

```bash
source .venv/bin/activate
python -m pip install -r requirements.txt
python live_external_port_monitor.py
```

Optional polling interval (non-USB signals):

```bash
python live_external_port_monitor.py --interval 1.0
```

USB hot-plug checks use a 0.5-second interval through `usb-monitor`.

## Example output

```text
LIVE EXTERNAL CONNECTION MONITOR
Platform: Windows-...

CURRENTLY CONNECTED EXTERNAL DEVICES
================================================
  External power / charger: CONNECTED
  USB devices:
    - Logitech HD Webcam (VID:PID 046d:08e5)
    - USB Optical Mouse (VID:PID 046d:c077)
  External displays:
    - HDMI display
  Wired Ethernet: none detected
  Thunderbolt / USB4 / FireWire: none detected
  Removable storage:
    - E: (USB Drive)
================================================
Live monitoring is now active. Only changes will be printed.
Watching for connection changes. Press Ctrl+C to stop.

[2026-11-16 09:15:01 IST] USB connected — USB Audio Adapter (VID:PID 1234:5678)
[2026-11-16 09:16:22 IST] Charger connected
[2026-11-16 09:17:10 IST] External display connected — HDMI
[2026-11-16 09:18:05 IST] Ethernet cable connected — Realtek PCIe GbE Family Controller
```

## Accuracy and limitations

Operating systems report device connections, not a universal map of every
physical socket. This monitor cannot reliably:

- enumerate empty ports;
- distinguish USB-A from USB-C in a portable way;
- identify the exact HDMI/USB-C socket on every graphics driver;
- detect every 3.5 mm audio-jack insertion (many audio drivers do not publish it);
- tell whether a USB-C cable is data-only, charging-only, or carrying video unless
  the OS exposes those functions as separate device/power/display events.

Some USB devices may appear through docks, hubs, or internal controllers. The
USB library filters host controllers/root hubs, but unusual vendor drivers can
still produce incomplete or duplicate events. Thunderbolt/USB4 discovery is
implemented for Windows and Linux; on macOS only USB devices exposed by the USB
monitor are tracked. The script does not collect USB serial numbers, inspect
files, capture screens, or record keystrokes.

## Proctoring integration note

This is a local visible monitor, not a tamper-proof security control. For a
proctoring product, disclose hardware monitoring to candidates, obtain the
required consent, test each supported OS/device model, and treat monitor failure
or unsupported sensor APIs as `unknown` rather than as proof that no device is
connected. Do not use a missing event as evidence that a port was unused.
