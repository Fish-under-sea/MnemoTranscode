"""Voice 相关任务占位。"""

from __future__ import annotations

from app.workers.celery_app import celery_app


@celery_app.task(name="mtc.tasks.voice_clone", time_limit=600, soft_time_limit=540)
def voice_clone_task(sample_media_id: str, **kwargs):
    raise NotImplementedError("voice_clone_task 将在 D 子项目实现")

