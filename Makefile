# ============================================================
# MTC (Memory To Code) - 常用命令集合
# ============================================================

.PHONY: help install dev backend frontend test lint clean docker-up docker-down docker-logs docker-restart start-services stable-backend stable-full

# 默认目标
help:
	@echo "MTC 常用命令"
	@echo ""
	@echo "  make install       安装所有依赖（后端 + 前端）"
	@echo "  make dev          启动开发服务器（后端 + 前端）"
	@echo "  make backend      仅启动后端开发服务器"
	@echo "  make frontend      仅启动前端开发服务器"
	@echo "  make test          运行测试"
	@echo "  make lint          代码检查"
	@echo "  make clean         清理缓存和构建产物"
	@echo "  make docker-up     启动 Docker 容器"
	@echo "  make docker-down   停止 Docker 容器"
	@echo "  make docker-logs   查看容器日志"
	@echo "  make docker-restart 重启所有 compose 服务（cd infra && compose restart）"
	@echo "  make stable-backend 仅用 Docker 拉起 DB+Redis+Qdrant+MinIO+backend（稳定开发拓扑，详见 docs/stable-dev-windows.md）"
	@echo "  make stable-full     Windows：PowerShell 一键全栈 Compose（frontend 容器 + celery + 依赖），见 scripts/start-stable.ps1 -FullStack"
	@echo "  make start-services 一键启动 Docker 栈（bash scripts/start-services.sh）"
	@echo "  make db-migrate    运行数据库迁移"
	@echo "  make db-reset      重置数据库"

# ========== 安装 ==========

install:
	@echo "安装后端依赖..."
	cd backend && pip install -r requirements.txt
	@echo "安装前端依赖..."
	cd frontend && npm install

# ========== 开发 ==========

dev: docker-up
	@echo "启动开发服务器..."
	@echo "后端: http://localhost:8000"
	@echo "前端: http://localhost:5173"
	@echo "API 文档: http://localhost:8000/docs"
	@echo "Qdrant 控制台: http://localhost:6333/dashboard"
	@echo "MinIO 控制台: http://localhost:9001"
	@echo ""
	@echo "按 Ctrl+C 停止"
	make backend &
	make frontend
	wait

backend:
	@echo "启动后端服务器..."
	cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir app

frontend:
	@echo "启动前端开发服务器..."
	cd frontend && npm run dev

# ========== 测试 ==========

test:
	@echo "运行测试..."
	cd backend && pytest tests/ -v

test-watch:
	cd backend && pytest tests/ -v --watch

# ========== 代码检查 ==========

lint:
	@echo "检查后端代码..."
	cd backend && python -m flake8 app --max-line-length=120 --ignore=E501,W503
	@echo "检查前端代码..."
	cd frontend && npm run lint

# ========== 清理 ==========

clean:
	@echo "清理缓存..."
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "node_modules" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".venv" -exec rm -rf {} + 2>/dev/null || true
	rm -rf frontend/dist 2>/dev/null || true
	rm -rf backend/dist 2>/dev/null || true
	@echo "清理完成"

# ========== Docker ==========

docker-up:
	cd infra && docker compose up -d
	@echo "等待服务启动..."
	sleep 5
	@echo "所有服务已启动"

docker-down:
	cd infra && docker compose down

docker-logs:
	cd infra && docker compose logs -f

docker-restart:
	cd infra && docker compose restart

# 与 scripts/start-services.sh 一致：infra 下 compose up -d（完整栈）
start-services:
	bash scripts/start-services.sh

# 后端运行在 Compose 容器内，与 Postgres 同属 Docker 网络（避免 Win 宿主连 localhost:5432 断连）。
# Windows 建议：powershell -ExecutionPolicy Bypass -File .\scripts\start-stable.ps1（脚本会轮询 /healthz 至 DB 就绪）
stable-backend:
	cd infra && docker compose up -d postgres redis qdrant minio backend

# Windows（Docker Desktop）：与 infra/docker-compose.yml 默认服务一致（含 frontend / celery-worker）
stable-full:
	powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-stable.ps1 -FullStack

# ========== 数据库 ==========

db-migrate:
	cd backend && alembic upgrade head

db-reset:
	cd infra && docker compose exec postgres psql -U mtc -d mtc_db -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
	cd backend && alembic upgrade head

db-shell:
	cd infra && docker compose exec postgres psql -U mtc -d mtc_db

# ========== 工具 ==========

qdrant-init:
	@echo "初始化 Qdrant 集合..."
	curl -X PUT "http://localhost:6333/collections/mtc_memories" \
		-H "Content-Type: application/json" \
		--data '{
			"vectors": {
				"size": 1536,
				"distance": "Cosine"
			}
		}'

# ========== 构建 ==========

build-backend:
	cd backend && pip install -r requirements.txt

build-frontend:
	cd frontend && npm install && npm run build

build: docker-up
	@echo "构建完成"

# ========== 生产部署 ==========

deploy:
	cd infra && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
