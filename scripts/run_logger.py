"""
run_logger.py — Log script runs to Supabase script_runs table.

Usage:
    from run_logger import RunLogger

    logger = RunLogger("fetch_media_mentions")
    logger.start()
    try:
        # ... script logic ...
        logger.success(summary="100 mentions fetched", records_count=7)
    except Exception as exc:
        logger.fail(str(exc))
        raise
"""

import json
import logging
import os
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

log = logging.getLogger(__name__)

ENV_PATH = Path(__file__).resolve().parent.parent / ".env"


def _load_dotenv() -> None:
    if not ENV_PATH.exists():
        return
    with open(ENV_PATH, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip())


_load_dotenv()

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")


class RunLogger:
    def __init__(self, script_name: str, trigger: str = "manual"):
        self.script_name = script_name
        self.trigger = trigger
        self.run_id: str | None = None
        self.started_at: str = ""

    def _configured(self) -> bool:
        return bool(SUPABASE_URL and SUPABASE_SERVICE_KEY)

    def _request(self, method: str, path: str, body: dict | None = None) -> dict | None:
        url = f"{SUPABASE_URL}/rest/v1/{path}"
        data = json.dumps(body, ensure_ascii=False).encode("utf-8") if body else None
        headers = {
            "Content-Type": "application/json",
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Prefer": "return=representation",
        }
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as exc:
            log.warning("RunLogger request failed: %s", exc)
            return None

    def start(self) -> None:
        if not self._configured():
            return
        self.started_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        row = {
            "script_name": self.script_name,
            "status": "running",
            "started_at": self.started_at,
            "trigger": self.trigger,
        }
        result = self._request("POST", "script_runs", row)
        if result and isinstance(result, list) and len(result) > 0:
            self.run_id = result[0].get("id")
            log.info("Run logged: %s (id=%s)", self.script_name, self.run_id)

    def success(self, summary: str = "", records_count: int | None = None) -> None:
        if not self.run_id:
            return
        patch: dict = {
            "status": "success",
            "summary": summary,
            "completed_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        }
        if records_count is not None:
            patch["records_count"] = records_count
        self._request("PATCH", f"script_runs?id=eq.{self.run_id}", patch)
        log.info("Run completed: %s — %s", self.script_name, summary)

    def fail(self, error_message: str) -> None:
        if not self.run_id:
            return
        patch = {
            "status": "error",
            "error_message": error_message[:500],
            "completed_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        }
        self._request("PATCH", f"script_runs?id=eq.{self.run_id}", patch)
        log.error("Run failed: %s — %s", self.script_name, error_message[:100])
