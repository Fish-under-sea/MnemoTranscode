#!/usr/bin/env bash
# MTC — 一键启动 Docker 编排服务（后台 -d）
# 需在已安装 Docker / Compose 的环境执行（WSL2、Linux、macOS、Git Bash）。

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
INFRA_DIR="$REPO_ROOT/infra"

show_help() {
  cat <<'EOF'
MTC 一键启动（docker compose up -d）

用法:
  ./scripts/start-services.sh                    启动完整栈（backend / frontend / postgres / redis / qdrant / minio / celery-worker）
  ./scripts/start-services.sh --infra-only       仅启动 postgres / redis / qdrant / minio（本机再执行 make backend + make frontend 时用）
  ./scripts/start-services.sh --build            启动前重建镜像（compose up --build）
  ./scripts/start-services.sh --recreate         先 compose down 再 up -d（数据卷保留，容器重建）
  参数可组合，例如: ./scripts/start-services.sh --infra-only --build

  ./scripts/start-services.sh --help             显示本说明

启动后常用地址（完整栈）:
  后端 API     http://localhost:8000
  API 文档     http://localhost:8000/docs
  前端（容器） http://localhost:5173
  Qdrant       http://localhost:6333/dashboard
  MinIO 控制台 http://localhost:9001
EOF
}

DO_INFRA=0
DO_BUILD=0
DO_RECREATE=0

for arg in "$@"; do
  case "$arg" in
    --help|-h)
      show_help
      exit 0
      ;;
    --infra-only|-i)
      DO_INFRA=1
      ;;
    --build|-b)
      DO_BUILD=1
      ;;
    --recreate|--full)
      DO_RECREATE=1
      ;;
    *)
      echo "未知参数: $arg" >&2
      show_help >&2
      exit 1
      ;;
  esac
done

cd "$INFRA_DIR"

BUILD_ARGS=()
if [ "$DO_BUILD" = 1 ]; then
  BUILD_ARGS+=(--build)
fi

if [ "$DO_RECREATE" = 1 ]; then
  echo "[MTC] 停止现有栈（compose down，不删卷）..."
  docker compose down
fi

if [ "$DO_INFRA" = 1 ]; then
  echo "[MTC] 启动基础服务: postgres redis qdrant minio ..."
  docker compose up -d "${BUILD_ARGS[@]}" postgres redis qdrant minio
  echo ""
  echo "[MTC] 基础服务已后台启动。"
  echo "  PostgreSQL :5432  Redis :6379  Qdrant :6333  MinIO :9000 / 控制台 :9001"
  echo "  本机开发请另开终端: make backend  与  make frontend"
else
  echo "[MTC] 启动完整 Docker 栈 ..."
  docker compose up -d "${BUILD_ARGS[@]}"
  echo ""
  echo "[MTC] 等待容器就绪..."
  sleep 5
  echo ""
  echo "[MTC] 已启动。访问:"
  echo "  后端 http://localhost:8000  文档 http://localhost:8000/docs"
  echo "  前端 http://localhost:5173  Qdrant http://localhost:6333/dashboard  MinIO http://localhost:9001"
fi

echo "[MTC] 完成。"
