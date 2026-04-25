#!/usr/bin/env sh
set -e

alembic upgrade head

# compose 中 celery-worker 会传入: celery -A app.workers.celery_app worker ...
if [ "$1" = "celery" ]; then
  exec "$@"
fi

# 不默认加 --reload（Windows 挂载 + WatchFiles 易风暴重启）。需要时在 compose / .env: UVICORN_EXTRA_ARGS=--reload
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 $UVICORN_EXTRA_ARGS
