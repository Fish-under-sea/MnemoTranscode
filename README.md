> **⏸️ 暂停维护** · 最近提交：2026-05-21（约 4 个月前）
>
> 技能节参赛作品，赛事结束后冻结功能迭代；代码与文档保留作展示与参考。

<div align="center">

# MTC — Memory To Code

**把「记忆碎片」从生物硬盘转码到数字硬盘**

记忆数字化存档 · 智能整理 · 多模态还原

![Status](https://img.shields.io/badge/status-已停止维护-lightgrey.svg) ![Python](https://img.shields.io/badge/python-3.11+-3776AB.svg) ![React](https://img.shields.io/badge/react-18-61dafb.svg) ![FastAPI](https://img.shields.io/badge/fastapi-0.109+-009688.svg)

</div>

---

> 人的记忆是一种不讲道理的存储介质。这个项目存在的意义，就是把这些失衡的记忆碎片提取出来，完成从生物硬盘到数字硬盘的格式转换。
>
> —— 项目宣言全文见 [`docs/MnemoTranscode.txt`](docs/MnemoTranscode.txt)

---

## 📌 这是什么

MTC（**M**nemo**T**ranscode — Memory To Code）是一个**通用 AI 关系档案与生命故事平台**：把声音、照片、文字、情感等记忆做**数字化存档、智能整理与多模态还原**。

### 六种档案类型

```
family（家人）  ·  lover（恋人）  ·  friend（朋友）
relative（亲属） ·  celebrity（公众人物） ·  nation（家国记忆）
```

## ✨ 功能清单

> 下表区分**已实现**与**规划中** —— 规划项保留标注，请勿当作现有能力。

### 已实现

| 功能 | 说明 |
|------|------|
| **关系档案库** | 档案与成员管理，支持上述 6 种类型 |
| **记忆条目** | 时间 / 地点 + **普卢奇克 32 项情感标签**（后端 `normalize_emotion_label` 归一化） |
| **普卢奇克情绪轮** | 8 族 × 3 强度 + 8 复合，SVG 热区标定（参考图 `frontend/public/emotion-wheel.png`） |
| **媒体上传** | **两阶段预签名上传**至 MinIO 私有桶 |
| **Mnemo 记忆图谱** | 对话巩固 / Engram / conscious recall，Celery 异步（`GET /api/v1/memories/mnemo-graph`） |
| **记忆关系网画布** | `react-force-graph-2d` 力导向布局，`onEngineStop` 锚点对齐 |
| **同源流式回源** | 成员头像 / 国家记忆封面，走 `exp+sig` 签名 |
| **AI 角色对话** | 服务端一次返回完整 reply，**打字机效果为前端模拟（非 SSE）** |
| **故事书生成** | 4 种风格，可导出 PDF |
| **交互时间线** | 情感 / 成员 / 时间三维筛选 |
| **记忆胶囊** | 定时解封 + 加密 |
| **语义检索** | 基于 Qdrant 向量库 |
| **聊天记录导入** | 同步接口 + `/stream` SSE 流式 |
| **模型设置** | 厂商预设 / API Key / `llm-probe` 连通性探测 |
| **订阅与用量** | 档位 `free/lite/pro/max`、用量统计 `GET /usage/stats`、存储配额 |
| **微信接入** | KouriChat 只读挂载进容器（`kourichat/` + `/api/v1/kourichat`） |

### 规划中（未实现）

| 功能 | 状态 |
|------|------|
| 还原 Ta 的声音 | 📋 规划 |
| QQ 渠道 | 📋 待开发（架构文档标注） |

## 🏗️ 架构与服务拓扑

```
┌──────────┐    ┌───────────────┐    ┌──────────────────────────────┐
│  浏览器   │───►│  Nginx(front) │───►│  FastAPI (backend)           │
│          │    │  :5173 → :80  │    │  :8000                       │
└──────────┘    └───────────────┘    └───────┬──────────────────────┘
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    ▼                         ▼                         ▼
            ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
            │ PostgreSQL16 │         │  Redis 7     │         │  Qdrant      │
            │   :5432      │         │   :6379      │         │  :6333/6334  │
            └──────────────┘         └──────┬───────┘         └──────────────┘
                                            │
                                    ┌───────▼────────┐        ┌──────────────┐
                                    │ Celery Worker  │        │   MinIO      │
                                    │  (concurrency  │        │ :9000/:9001  │
                                    │      4)        │        └──────────────┘
                                    └────────────────┘
```

**七个容器（逐字来自 `infra/docker-compose.yml`）**：

| 服务 | 端口映射 | 说明 |
|------|---------|------|
| `mtc-backend` | `8000:8000` | FastAPI，healthcheck `/healthz`；挂载 `../backend` 与只读的 `../kourichat` |
| `mtc-frontend` | `5173:80` | Nginx 托管前端构建产物，`API_UPSTREAM=backend:8000` |
| `postgres` | `5432` | `postgres:16-alpine`，库 `mtc_db` |
| `redis` | `6379` | `redis:7-alpine`，broker db1 / result db2 |
| `qdrant` | `6333` / `6334` | 集合 `mtc_memories`，size 1536 / Cosine |
| `minio` | `9000` / `9001` | 对象存储 + 控制台 |
| `celery-worker` | — | `--concurrency=4`，消费 Redis 队列 |
| `pgadmin` | `5050:80` | `profiles: dev`，仅开发时启用 |

**访问入口**：前端 `5173` · API `8000` · Swagger `/docs` · ReDoc `/redoc` · MinIO 控制台 `9001` · Qdrant Dashboard `6333`

## 🛠️ 技术栈

| 层 | 实现 |
|----|------|
| **前端** | React 18 · TypeScript 5.4 · Vite 5 · Tailwind 3.4 · Zustand 4.5 · TanStack Query 5 · Radix UI 原语 · `react-force-graph-2d` · `@dnd-kit` |
| **后端** | Python **3.11** · FastAPI ≥0.109 · Uvicorn · SQLAlchemy 2（async） · asyncpg · Alembic · Celery 5 · Pydantic Settings |
| **存储** | PostgreSQL 16 · Redis 7 · Qdrant · MinIO |
| **鉴权** | `python-jose[cryptography]` · `passlib[bcrypt]` · `bcrypt==3.2.2` |
| **LLM** | OpenAI 兼容多厂商预设（`openai>=1.12`），支持探测与动态切换 |
| **容器** | Docker Compose（7 服务，`restart: unless-stopped`） |

> 架构文档 §3.2 推荐 `GPT-4o` / `Qwen3` 作对话模型、`text-embedding-3-small` / `BGE` 作向量、`Whisper` / `SenseVoice` 作语音、`CosyVoice` / `ElevenLabs` 作合成 —— 属**建议选型**，未全部落地。

## 🚀 快速开始

### 一键启动（推荐）

```bash
cp backend/.env.example backend/.env     # 先按需填写环境变量
make start-services                      # = bash scripts/start-services.sh
```

Windows 一键脚本：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-stable.ps1 -KillPort8000
# 或全栈：-FullStack
```

### 手动启动

```bash
cd infra && docker compose up -d
```

### 本地开发（不用容器）

```bash
make install          # 装依赖
make backend          # cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
make frontend         # 前端开发服务器
```

### 数据库

```bash
make db-migrate          # cd backend && alembic upgrade head
make db-migrate-docker   # 容器内执行迁移
make db-shell            # docker compose exec postgres psql -U mtc -d mtc_db
make qdrant-init         # 初始化 Qdrant 集合
```

## 📋 常用命令（Makefile）

> 共 30 个 target。`make help` 只列出其中 20 个，下表为**完整清单**。

| 分类 | 命令 |
|------|------|
| **环境** | `install` · `clean` |
| **开发** | `dev` · `backend` · `frontend` · `dev-hot` · `dev-hot-rebuild` |
| **测试检查** | `test` · `test-watch` · `lint` |
| **容器** | `docker-up` · `docker-down` · `docker-logs` · `docker-restart` · `docker-rebuild-frontend` · `docker-rebuild-backend` · `docker-watch-frontend` |
| **启动** | `start-services` · `stable-backend` · `stable-full` |
| **数据库** | `db-migrate` · `db-migrate-docker` · `db-reset` · `db-shell` · `qdrant-init` |
| **构建** | `build-backend` · `build-frontend` · `build` |
| **部署** | `deploy` |

> ⚠️ **两个已知坑**：
> 1. `make clean` / `dev` / `start-services` **依赖 bash** —— Windows 上需 Git Bash 或 WSL
> 2. `make deploy` 引用的 `docker-compose.prod.yml` **不在 `infra/` 中**，属悬空引用

## 📁 目录结构

```text
MnemoTranscode/
├── backend/                  FastAPI 应用
│   ├── app/                  业务代码（workers/ 由 compose 引用）
│   ├── alembic/              数据库迁移
│   ├── tests/                pytest 测试
│   ├── Dockerfile  entrypoint.sh  requirements.txt  pytest.ini
├── frontend/                 React + Vite 应用
│   ├── src/  public/         源码与静态资源（含 emotion-wheel.png）
│   ├── nginx-snippets/       Nginx 配置片段
│   ├── Dockerfile  default.conf.template
├── infra/                    Docker Compose 编排
│   ├── docker-compose.yml
│   ├── docker-compose.hybrid-frontend.example.yml
│   └── postgres/
├── scripts/                  20 个运维脚本
│   ├── start-services.sh  start-stable.ps1  dev-vite-hybrid.ps1
│   ├── rebuild-*.ps1  alembic-upgrade.ps1
│   ├── fix-docker-desktop-windows-context.ps1
│   ├── pg_dump_snapshot.sh  calibrate_emotion_wheel_public.py
├── kourichat/                微信接入（只读挂载进容器）
├── docs/                     设计与接口文档
│   ├── ARCHITECTURE.md  SPEC.md  API.md  USAGE_AND_SUBSCRIPTION.md
│   ├── design-system.md  memory-relation-network.md  stable-dev-windows.md
│   └── MnemoTranscode.txt     项目宣言
└── Makefile
```

## 📚 文档索引

| 文档 | 内容 |
|------|------|
| [`docs/SPEC.md`](docs/SPEC.md) | 产品规格与档案类型定义 |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | 系统架构 |
| [`docs/API.md`](docs/API.md) | 接口清单 |
| [`docs/USAGE_AND_SUBSCRIPTION.md`](docs/USAGE_AND_SUBSCRIPTION.md) | 使用方式与订阅档位 |
| [`docs/design-system.md`](docs/design-system.md) | 设计系统 |
| [`docs/memory-relation-network.md`](docs/memory-relation-network.md) | 记忆关系网设计 |
| [`docs/stable-dev-windows.md`](docs/stable-dev-windows.md) | Windows 稳定开发环境 |
| [`docs/MnemoTranscode.txt`](docs/MnemoTranscode.txt) | 项目宣言全文 |

## ⚠️ 已知限制

| 项 | 说明 |
|----|------|
| **无 License 文件** | 根目录**没有** `LICENSE`。请勿视为开源可自由使用/分发 |
| **文档内部有矛盾** | 组件库（「自研 A 基座」vs「shadcn/ui」，实测用 Radix 原语）、后端目录（`app/workers/` vs `app/tasks/`）在不同文档中说法不一 —— **以代码实测为准** |
| **`make deploy` 悬空** | 引用的 `docker-compose.prod.yml` 不存在 |
| **明文弱密码** | compose 中的数据库/对象存储密码为开发用弱口令，`CORS_ALLOW_PRIVATE_LAN=true` —— **仅限本地开发，勿直接用于公网** |
| **`docs/superpowers/` 引用** | 文档中引用的部分路径在仓库中不存在（`.cursor/rules/*.mdc` 等） |

## 🙏 致谢

本项目为[技能节](https://github.com/magymeng/skill-festival-submissions)参赛作品（小组 **MnemoTranscode**）。官方作品收集仓库：[magymeng/skill-festival-submissions](https://github.com/magymeng/skill-festival-submissions)（`MnemoTranscode/` 目录）。

---

<sub>MTC — 用 AI 守护每一段值得的关系 · 技能节参赛作品 · 代码与文档保留作展示与参考</sub>