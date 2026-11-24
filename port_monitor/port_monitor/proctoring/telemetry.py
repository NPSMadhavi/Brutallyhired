from __future__ import annotations

import json
import threading
import urllib.request
from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Any, Callable, Optional
from ..utils import alert, timestamp, warn

@dataclass
class ViolationReport:
    report_id: str
    incident_number: int
    event_type: str
    description: str
    timestamp: str
    severity: str
    evidence_data: dict[str, Any]

class ProctoringTelemetryEngine:
    """BrutalAssessAI™ Hardware & Port Telemetry Engine.
    
    Tracks port, hardware, display and environment signals during proctored exams.
    Accumulates violation reports and enforces the 5-incident rejection limit.
    """

    def __init__(
        self,
        candidate_id: str = "cmwssnj7e0003vnvsanhlfhqg",
        max_violations: int = 5,
        backend_url: Optional[str] = None,
        on_reject: Optional[Callable[[list[ViolationReport]], None]] = None,
    ) -> None:
        self.candidate_id = candidate_id
        self.max_violations = max_violations
        self.backend_url = backend_url
        self.on_reject = on_reject
        self.violations: list[ViolationReport] = []
        self._lock = threading.Lock()
        self.is_disqualified: bool = False

    def record_violation(
        self,
        event_type: str,
        description: str,
        evidence: Optional[dict[str, Any]] = None,
        severity: str = "HIGH",
    ) -> tuple[int, bool, ViolationReport]:
        """Record an integrity incident. Returns (count, is_disqualified, report)."""
        with self._lock:
            incident_num = len(self.violations) + 1
            report = ViolationReport(
                report_id=f"rep-{incident_num}-{int(datetime.now().timestamp())}",
                incident_number=incident_num,
                event_type=event_type,
                description=description,
                timestamp=timestamp(),
                severity=severity,
                evidence_data=evidence or {},
            )
            self.violations.append(report)
            alert(
                f"[AI PROCTORING] Violation #{incident_num}/{self.max_violations}: "
                f"{event_type} - {description}"
            )

            if len(self.violations) >= self.max_violations:
                self.is_disqualified = True
                alert(
                    f"[AI PROCTORING REJECTION] Candidate {self.candidate_id} has exceeded {self.max_violations} "
                    f"critical integrity reports. Automatic disqualification enforced."
                )
                if self.on_reject:
                    try:
                        self.on_reject(self.violations)
                    except Exception as e:
                        warn(f"Rejection callback failed: {e}")

            # Notify backend asynchronously
            if self.backend_url:
                threading.Thread(
                    target=self._dispatch_backend,
                    args=(report, self.is_disqualified),
                    daemon=True,
                ).start()

            return len(self.violations), self.is_disqualified, report

    def _dispatch_backend(self, report: ViolationReport, is_disqualified: bool) -> None:
        try:
            payload = {
                "candidateId": self.candidate_id,
                "violationCount": len(self.violations),
                "isDisqualified": is_disqualified,
                "latestReport": asdict(report),
                "allReports": [asdict(r) for r in self.violations],
            }
            req = urllib.request.Request(
                self.backend_url,
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Content-Type": "application/json",
                    "x-verity-csrf": "1",
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=3.0) as resp:
                pass
        except Exception:
            pass  # Backend dispatch failure should never halt local proctoring

    def get_summary(self) -> dict[str, Any]:
        with self._lock:
            return {
                "candidateId": self.candidate_id,
                "violationCount": len(self.violations),
                "maxAllowed": self.max_violations,
                "isDisqualified": self.is_disqualified,
                "reports": [asdict(r) for r in self.violations],
            }

    def reset(self) -> None:
        with self._lock:
            self.violations.clear()
            self.is_disqualified = False
