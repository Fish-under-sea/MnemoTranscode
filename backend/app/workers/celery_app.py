"""Celery app 配置。"""

from __future__ import annotations

from celery import Celery

from app.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "mtc",
    broker=getattr(settings, "celery_broker_url", "redis://localhost:6379/1"),
    backend=getattr(settings, "celery_result_backend", "redis://localhost:6379/2"),
)

celery_app.conf.update(
    task_always_eager=False,
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Asia/Shanghai",
    enable_utc=False,
)

celery_app.autodiscover_tasks(["app.workers.tasks"])

