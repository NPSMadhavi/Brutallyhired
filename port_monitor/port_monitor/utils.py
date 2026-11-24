import re
import subprocess
import threading
from datetime import datetime
from typing import Any, Optional

_PRINT_LOCK = threading.Lock()

def timestamp() -> str:
    return datetime.now().astimezone().strftime("%Y-%m-%d %H:%M:%S %Z")

def alert(message: str) -> None:
    with _PRINT_LOCK:
        print(f"[{timestamp()}] {message}", flush=True)

def info(message: str) -> None:
    with _PRINT_LOCK:
        print(f"[INFO] {message}", flush=True)

def warn(message: str) -> None:
    with _PRINT_LOCK:
        print(f"[WARNING] {message}", flush=True)

def clean_text(value: Any, default: str = "Unknown device") -> str:
    text = str(value or "").strip().replace("_", " ")
    text = re.sub(r"\s+", " ", text)
    return text or default

def run_command(args: list[str], timeout: float = 4.0) -> Optional[str]:
    try:
        completed = subprocess.run(
            args,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
        )
        return completed.stdout
    except (OSError, subprocess.SubprocessError):
        return None
