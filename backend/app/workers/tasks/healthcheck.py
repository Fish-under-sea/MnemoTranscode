"""Worker 健康任务。"""

from __future__ import annotations

from datetime import datetime, timezone

from app.workers.celery_app import celery_app


@celery_app.task(name="mtc.tasks.healthcheck", time_limit=10, soft_time_limit=5)
def healthcheck_task() -> dict:
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}

