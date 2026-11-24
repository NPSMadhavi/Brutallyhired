from dataclasses import dataclass

@dataclass
class MonitorConfig:
    poll_interval_seconds: float = 1.0
    usb_poll_seconds: float = 0.5
    api_server_port: int = 4899
    api_server_host: str = "127.0.0.1"
    max_violations_before_reject: int = 5
    telemetry_backend_url: str = "http://localhost:5173/api/t/brutallyhired/proctoring/telemetry"
