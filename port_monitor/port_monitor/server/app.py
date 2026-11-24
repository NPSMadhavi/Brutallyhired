from __future__ import annotations

import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, Optional
from ..monitors.bus import get_high_speed_bus_state
from ..monitors.display import get_display_state
from ..monitors.network import get_ethernet_state
from ..monitors.power import get_power_state
from ..monitors.storage import get_removable_media_state
from ..monitors.usb import USBMonitorService, usb_device_label
from ..proctoring.telemetry import ProctoringTelemetryEngine
from ..utils import info, warn

class ProctoringRequestHandler(BaseHTTPRequestHandler):
    engine: ProctoringTelemetryEngine
    usb_monitor: Optional[USBMonitorService]

    def _send_cors_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, x-verity-csrf")

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self) -> None:
        if self.path.startswith("/status"):
            self._handle_status()
        elif self.path.startswith("/violations"):
            self._handle_violations()
        else:
            self.send_response(404)
            self._send_cors_headers()
            self.end_headers()

    def do_POST(self) -> None:
        if self.path.startswith("/simulate-violation"):
            self._handle_simulate_violation()
        elif self.path.startswith("/reset"):
            self.engine.reset()
            self.send_response(200)
            self._send_cors_headers()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"ok": true, "message": "Proctoring violations reset"}')
        else:
            self.send_response(404)
            self._send_cors_headers()
            self.end_headers()

    def _handle_status(self) -> None:
        usb_devices = self.usb_monitor.get_state() if self.usb_monitor else {}
        formatted_usb = [
            {"id": k, "label": usb_device_label(v)}
            for k, v in (usb_devices or {}).items()
        ]
        displays = get_display_state() or {}
        formatted_displays = [{"instance": k, "type": v} for k, v in displays.items()]
        ethernet = get_ethernet_state() or {}
        formatted_ethernet = [{"interface": k, "connected": v[0], "name": v[1]} for k, v in ethernet.items()]

        payload = {
            "status": "ONLINE",
            "proctoringMode": "HIGH_ASSURANCE",
            "power": {
                "connected": get_power_state(),
                "label": "AC Power Connected" if get_power_state() else "Battery",
            },
            "usb": {
                "count": len(formatted_usb),
                "devices": formatted_usb,
            },
            "displays": {
                "count": len(formatted_displays),
                "externalDisplays": formatted_displays,
                "multiDisplayDetected": len(formatted_displays) > 0,
            },
            "ethernet": formatted_ethernet,
            "removableStorage": get_removable_media_state() or {},
            "highSpeedBus": get_high_speed_bus_state() or {},
            "violations": self.engine.get_summary(),
        }

        data = json.dumps(payload).encode("utf-8")
        self.send_response(200)
        self._send_cors_headers()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _handle_violations(self) -> None:
        summary = self.engine.get_summary()
        data = json.dumps(summary).encode("utf-8")
        self.send_response(200)
        self._send_cors_headers()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _handle_simulate_violation(self) -> None:
        content_len = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_len).decode("utf-8") if content_len > 0 else "{}"
        try:
            parsed = json.loads(body)
        except Exception:
            parsed = {}

        event_type = parsed.get("event_type", "unauthorized_peripheral")
        desc = parsed.get("description", "Unauthorized external hardware detected during examination")
        severity = parsed.get("severity", "HIGH")
        count, disqualified, report = self.engine.record_violation(event_type, desc, parsed, severity)

        response_payload = {
            "ok": True,
            "violationCount": count,
            "isDisqualified": disqualified,
            "maxAllowed": self.engine.max_violations,
            "report": {
                "reportId": report.report_id,
                "incidentNumber": report.incident_number,
                "eventType": report.event_type,
                "description": report.description,
                "timestamp": report.timestamp,
                "severity": report.severity,
            },
        }
        data = json.dumps(response_payload).encode("utf-8")
        self.send_response(200)
        self._send_cors_headers()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, format: str, *args: Any) -> None:
        pass  # Quiet HTTP logs to keep proctoring console clean

class ProctoringApiServer:
    def __init__(
        self,
        engine: ProctoringTelemetryEngine,
        usb_monitor: Optional[USBMonitorService] = None,
        host: str = "127.0.0.1",
        port: int = 4899,
    ) -> None:
        self.engine = engine
        self.usb_monitor = usb_monitor
        self.host = host
        self.port = port
        self.server: Optional[HTTPServer] = None
        self.thread: Optional[threading.Thread] = None

    def start(self) -> bool:
        handler = ProctoringRequestHandler
        handler.engine = self.engine
        handler.usb_monitor = self.usb_monitor

        try:
            self.server = HTTPServer((self.host, self.port), handler)
            self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
            self.thread.start()
            info(f"Port Monitor & Proctoring API server active at http://{self.host}:{self.port}")
            return True
        except Exception as e:
            warn(f"Could not bind Proctoring API server on {self.host}:{self.port}: {e}")
            return False

    def stop(self) -> None:
        if self.server:
            self.server.shutdown()
            self.server.server_close()
