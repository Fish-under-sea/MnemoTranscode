# MTC — Memory To Code

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Python: 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/)
[![React: 18](https://img.shields.io/badge/react-18-61dafb.svg)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/fastapi-0.109-009688.svg)](https://fastapi.tiangolo.com/)

> 人的记忆是一种不讲道理的存储介质。这个项目存在的意义，就是把这些失衡的记忆碎片提取出来，完成从生物硬盘到数字硬盘的格式转换。  
> 项目宣言全文见 [docs/MnemoTranscode.txt](./docs/MnemoTranscode.txt)。

---

## 项目简介

MTC（MnemoTranscode — Memory To Code，仓库名 [MnemoTranscode](https://github.com/Fish-under-sea/MnemoTranscode)）是一个通用的 **AI 关系档案与生命故事平台**。它不只服务于某一类关系，可以承载恋人、挚友、至亲、伟人乃至一个国家/民族的历史记忆。

用 AI 技术将记忆（声音、照片、文字、情感）进行数字化存档、智能化整理和多模态还原，让每一段值得的关系都留有迹可循。

**当前阶段**：Web 全栈与基础设施已跑通；在档案 / 记忆 / 媒体 / 对话 / 时间线 / 故事书 / 胶囊之上，持续迭代 **Mnemo（Engram 记忆图谱、对话巩固与 Celery 异步任务）**、成员头像与受控上传等能力。**桌面级客户端应用** 列为下一步方向。成员详情 **记忆关系网**（画布、力导向、与 Engram API 对齐）详见专题文档 **[docs/memory-relation-network.md](./docs/memory-relation-network.md)**。

LLM 厂商预设与可探测模型列表见 [docs/LLM.txt](./docs/LLM.txt)；架构总览见 [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)、规格摘要见 [docs/SPEC.md](./docs/SPEC.md)、REST 摘录见 [docs/API.md](./docs/API.md)。**用量、订阅档位、对话页打字机与前端缓存** 的维护说明见 **[docs/USAGE_AND_SUBSCRIPTION.md](./docs/USAGE_AND_SUBSCRIPTION.md)**。

---

## 核心功能

| 功能模块 | 说明 |
|---------|------|
| **关系档案库** | 创建恋人、挚友、至亲、家族、伟人等多类型档案，管理档案内成员信息 |
| **记忆管理** | 为每位成员记录记忆条目，支持情感标签、时间、地点等元数据 |
| **媒体存档** | 照片、视频、音频两阶段预签名上传，私有桶安全存储（MinIO） |
| **Mnemo / 记忆图谱** | 后端 `app/mnemo/`：对话巩固、Engram 关系、有意识召回（conscious recall）等；前端成员详情 **记忆关系图**（`MemoryRelationGraph` + `react-force-graph-2d`）。**技术说明**： [docs/memory-relation-network.md](./docs/memory-relation-network.md)（含图谱 API、`client_llm` 流式导入衔接、力导向开启后停表锚点对齐） |
| **成员头像 / 国家记忆实体封面** | 成员图存 MinIO，库内为对象 URL；列表与 `GET` 响应中的 `avatar_url` 为**同源可展示地址**（`/api/v1/archives/.../members/.../avatar-file?exp&sig` 或 `APP_PUBLIC_ORIGIN` 前缀），由后端从 MinIO **流式回源**，浏览器无需直连对象存储。关系成员用设计系统 `Avatar`；**国家记忆**档案下实体列表与详情顶栏封面用原生 `<img>` + 失败回落（避免 Radix Avatar 与固定占位争层）。实现见 `backend/app/core/avatar_public_url.py` |
| **AI 对话** | 与档案成员角色对话；服务端一次返回完整 `reply`，前端打字机为本地模拟。**对话列表** `GET /dialogue/messages` 在窗口聚焦等场景会 refetch，与打字机状态需协调（见 **[USAGE_AND_SUBSCRIPTION.md](./docs/USAGE_AND_SUBSCRIPTION.md)**） |
| **故事书生成** | 基于记忆条目 AI 自动生成生命故事，支持怀旧温情、文学风格等四种写作风格，可导出 PDF |
| **交互时间线** | 按年份聚合的可视化记忆时间线，支持情感/成员/时间范围三维筛选 |
| **记忆胶囊** | 创建定时解封的加密信件，锁定期内内容加密保护，到期自动解封 |
| **还原 Ta 的声音（规划）** | TTS + 声纹迁移，基于 CosyVoice 重现 Ta 的声音 |
| **多渠道对话** | 原生 Web 应用内对话；微信侧通过 KouriChat 目录挂载与 API 转接（`kourichat/` + `/api/v1/kourichat`） |
| **语义检索** | 向量数据库支撑的自然语言记忆搜索（Qdrant） |
| **模型设置** | 登录后「模型设置」：厂商 Base URL 预设、API Key、模型名与列表探测；后端 `POST /api/v1/llm-probe/check` 校验连通性（详见 [docs/LLM.txt](./docs/LLM.txt)） |
| **个人中心** | 头像、资料、**订阅档位切换**、**本月 AI 用量**（订阅口径 + 自备 Key 分计）、**云存储用量**（与 `GET /usage/stats` 同源）、DIY 主题与偏好（含应用背景） |

---

## 系统架构

```
输入层              AI 核心层                  存储层              输出层
  │                    │                        │                   │
  ├── 文字录入         ├── LLM 对话 / Mnemo     ├── PostgreSQL       ├── 关系档案
  ├── 照片 / 视频      ├── 记忆整理 / Engram    ├── Qdrant（向量）   ├── 记忆时间线
  ├── 音频上传         ├── 故事书生成           ├── MinIO（媒体）    ├── AI 对话
  └── 声纹采集         └── 语音克隆             └── Redis（队列）    ├── 故事书
                                                                ├── 记忆胶囊
                                                                └── API / Webhook
```

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 · TypeScript · Vite · Tailwind CSS · Motion v12（`motion`）· `react-force-graph-2d`（记忆关系图）|
| 状态管理 | Zustand · TanStack Query v5 |
| 组件库 | 自研 A 基座设计系统（东方温润设计语言）|
| 后端 | FastAPI · Python 3.11 · SQLAlchemy 2.0 · Alembic |
| 数据库 | PostgreSQL 16 |
| 向量数据库 | Qdrant |
| 对象存储 | MinIO（预签名两阶段上传）|
| 缓存 / 队列 | Redis · Celery |
| AI | 多厂商 OpenAI 兼容与自有协议（见 `llmPresets` / 探测接口）；另可对接 Whisper、CosyVoice 等（语音相关能力以配置为准） |
| 容器化 | Docker · Docker Compose（含前端 Nginx 模板 + `API_UPSTREAM` 反代后端，见 `frontend/Dockerfile`、`default.conf.template`） |

---

## 快速开始

### 环境要求

- Python 3.11+
- Node.js 18+
- Docker 和 Docker Compose

### 1. 克隆项目

```bash
git clone https://github.com/Fish-under-sea/MnemoTranscode.git
cd MnemoTranscode
# 本地目录名可仍为 MTC，与远程仓库名不必一致
```

### 2. 配置环境变量

```bash
cp backend/.env.example backend/.env
# 编辑 backend/.env（键名与注释见示例文件；完整列表见 app/core/config.py 中 Settings）
# 常见必填/建议：DATABASE_URL、SECRET_KEY、REDIS_URL、MINIO_*、LLM_* 等（Docker 全栈下 compose 已注入部分连接串，仍建议维护 .env）
```

### 3. 启动服务（Docker）

#### Windows 上选哪个脚本？

| 场景 | 建议 |
|------|------|
| **日常开发（推荐）**：依赖与后端在 Docker，本机 **Vite 热重载**（`npm run dev`） | 在项目根 PowerShell：`powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-stable.ps1 -KillPort8000`（详见「#### Windows 稳定开发」）。 |
| **全栈都在容器里**：含 Nginx 前端、Celery 等 | PowerShell：`powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-stable.ps1 -FullStack`；或 `make stable-full`；或 **`infra`** 下 **`docker compose up -d`**；亦可用 Git Bash **`./scripts/start-services.sh`**。 |
| **只起基础设施**，再本机 `make backend` + `make frontend` | **`./scripts/start-services.sh --infra-only`**（需 Bash） |

详细原因与故障排查见 [docs/stable-dev-windows.md](./docs/stable-dev-windows.md)。

#### 一键启动（推荐）

默认会在 **Docker 中启动完整栈**：PostgreSQL、Redis、Qdrant、MinIO、**后端**、**前端**（容器内 Nginx 映射 **5173**）、Celery Worker 等。**执行成功后，前后端已在容器内运行**，一般无需再单独跑下方「本机后端 / 本机前端」——除非你希望用本机 `uvicorn` / Vite 做热重载开发。

| 方式 | 命令 |
|------|------|
| Bash（WSL / Linux / Git Bash；Windows 可装 Git for Windows 用 Git Bash） | `./scripts/start-services.sh` |
| Make（需本机有 `bash`） | `make start-services` |
| 无 Bash 时（任意环境） | `cd infra && docker compose up -d`（与上表「完整栈」等价，参数见下方「手动启动」） |

常用参数：

- **`--infra-only`** / **`-i`**（`start-services.sh`）：**只**启动 postgres / redis / qdrant / minio；**不会**在 Docker 里起应用前后端。此时请在仓库根目录另开终端执行 `make backend` 与 `make frontend`（须先完成依赖安装与 `alembic upgrade head`，见下方两节）。
- **`--build`** / **`-b`**（`start-services.sh`）：`docker compose up -d --build`，重建镜像后再启动。
- **`--recreate`** / **`--full`**（`start-services.sh`）：先 `docker compose down` 再 `up -d`（数据卷不删，容器重建）。

`./scripts/start-services.sh --help` 查看完整说明。

#### Windows 稳定开发（Docker 后端 + 本机 Vite 热重载）

在 **Windows** 上若希望 **PostgreSQL / Redis / Qdrant / MinIO 与后端均在 Docker**（数据库走服务名 `postgres`，避免宿主连 `localhost:5432` 断连），同时 **前端用本机 `npm run dev`**（默认 5173，`vite` 将 `/api` 代理到 `localhost:8000`），可在项目根目录执行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-stable.ps1 -KillPort8000
```

行为概要：`docker compose` 拉起四基础服务与 **backend** → 轮询 **`/healthz`** 至 `status=ok` → 在**新的 PowerShell 窗口**中于 `frontend/` 执行 **`npm run dev`**（若无 `node_modules` 会先在当前会话执行一次 **`npm install`**）。仅起 Docker、不自动开前端：加 **`-NoFrontend`**；若 5173 被占用可加 **`-KillPort5173`**。

**务必加 `-NoProfile`**，避免 `$PROFILE` 中将 `docker` 指到 WSL 导致 compose 找不到真实 **`docker.exe`**。更多说明见 [docs/stable-dev-windows.md](./docs/stable-dev-windows.md)。

> 与本节上方「Docker 一键全栈」（`start-services.sh` / `make start-services` / `infra` 下 `docker compose up`，容器内还带 Nginx 前端）是两条路径；任选其一即可，不要在同一台机器上同时为 **8000** 跑本机 **`uvicorn`** 与 Compose **`backend`**。

#### 手动启动（与一键默认行为等价）

```bash
docker compose -f infra/docker-compose.yml up -d
```

Compose 中 backend 会只读挂载仓库内 `kourichat/`，供微信/机器人相关能力使用；**若前端需连宿主机上的后端** 而非同 compose 中的 `backend` 服务，见 `infra/docker-compose.hybrid-frontend.example.yml`。

#### 日常：`docker compose down`、仅开 Docker Desktop 与是否要跑脚本

- `infra/docker-compose.yml` 中主要服务配置了 **`restart: unless-stopped`**。若你从**没有**执行过 **`docker compose down`**（或等价地拆掉整个栈），一般 **只打开 Docker Desktop 并等到 Engine running**，之前的容器会自动被拉起——**不一定要**每次再执行 `start-stable.ps1`。
- 若你执行过 **`docker compose down`**、在新机器克隆仓库、或容器已被删掉，则需重新起栈：在项目根 **`cd infra && docker compose up -d`**，或再跑上方的 **`start-stable.ps1`** / **`start-services.sh`**（脚本会顺带做 `/healthz` 等就绪检查）。
- 快速自检：**`docker ps`** 能看见 **`mtc-backend`** / **`mtc-frontend`** 等则说明栈已在跑。

#### Windows：`docker compose` / `docker ps` 报错「protocol not available」或「找不到 naming pipe」（如 `dockerDesktopLinuxEngine`）

多为 **Docker Desktop 的 CLI 上下文**与实际引擎管道不一致。可按顺序尝试：

1. **`docker context use default`**，再 **`docker ps`**（许多环境下 `default` 走 `docker_engine` 管道即可恢复）。
2. 运行 **`scripts/fix-docker-desktop-windows-context.ps1`**（会备份 `%USERPROFILE%\.docker` 并把错误的 `unix://...` 等改为 **`npipe://...`**），然后**完全退出并重开 Docker Desktop**。
3. **`start-stable.ps1`**：在检测到 daemon 暂未响应时会**默认自动执行一次** `docker context use default`；若你不想自动切换上下文，可加 **`-TryDockerContextDefaultFirst:$false`**。详见 [docs/stable-dev-windows.md](./docs/stable-dev-windows.md)。

### 4. 启动后端（本机开发，可选）

**若已通过一键启动、完整 compose 起全栈，或已通过 `start-stable.ps1`（Docker 内后端），可跳过本节。**

```bash
cd backend
pip install -r requirements.txt

# 执行数据库迁移
alembic upgrade head

# 启动开发服务器
uvicorn app.main:app --reload --port 8000
```

### 5. 启动前端（本机开发，可选）

**若已通过 `start-services.sh`、`make start-services`、或 `infra` 下完整 `docker compose` 起全栈**，或已通过 **`start-stable.ps1`**（未加 `-NoFrontend`），**可跳过本节。**

```bash
cd frontend
npm install
npm run dev
# 访问 http://localhost:5173
```

### 访问地址

| 服务 | 地址 |
|------|------|
| 前端应用 | http://localhost:5173 |
| 后端 API | http://localhost:8000 |
| API 文档（Swagger）| http://localhost:8000/docs |
| MinIO 控制台 | http://localhost:9001 |
| Qdrant 控制台 | http://localhost:6333/dashboard |

**部署注意**：改 `frontend/default.conf.template` 或 `nginx-snippets/*` 后需**重新构建**前端镜像；`502` 常见原因是 Nginx 上游 `API_UPSTREAM` 指向的 backend 未就绪。本地纯 npm 开发时仍用 Vite 默认端口，无需 Nginx。

**Compose 内的 `frontend` 服务**：镜像内为 `npm run build` 的静态产物，**不挂载**宿主 `frontend/`。若改动了 TypeScript/CSS 却未重建镜像，浏览器访问 **http://localhost:5173**（容器 Nginx）仍会看到旧包。请在仓库根执行 **`powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\rebuild-docker-frontend.ps1`**（或 `cd infra` 后 `docker compose build frontend && docker compose up -d --no-deps --force-recreate frontend`），交付规范见 **`.cursor/rules/mtc-docker-frontend-sync.mdc`**。验收后建议 **Ctrl+F5** 强刷，避免缓存旧 chunk。

---

## 运维：账号级 AI 对话与数据库迁移

**行为**：选定档案成员后的 Web 对话会写入 Postgres 表 `dialogue_chat_messages`（按用户 + 档案 + 成员），换浏览器/设备同一账号仍可看到。**首次上线或拉代码含新迁移**要让数据库追到最新 revision。

**相关迁移**：主链含 **`a1b2c3d4e5f7`**（表 `dialogue_chat_messages`）、**`f0a1b2c3d4e5`**（订阅档位数据修复）等；上述两线曾分叉，已用 **合并 revision `e3887247034b`** 收束为 **单 head**。若其它环境仍报 `Multiple head revisions`，在 `backend/` 执行 **`alembic heads`** 并按需 **`alembic merge`**。

**何时不必手动**：**Docker `backend`** 镜像入口 `backend/entrypoint.sh` 在每次容器启动时已执行 **`alembic upgrade head`**，Compose 拉起后端一般会自动建好表。

**何时需要手动**：

- 只用本机 **`uvicorn`** 指向同一数据库、且没有经过上述 entrypoint；
- 容器卡住、想确认迁移已套用；
- 本地开发仅用「基础设施 Compose + 本机后端」：`backend/.env` 里 **`DATABASE_URL`** 必须指向可连库，再在 `backend/` 执行迁移。

**一键（PowerShell，先试 Compose 容器内 alembic，失败再退化为本机）**：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\alembic-upgrade.ps1
```

只跑本机 Python（不切 Docker）可加 **`-LocalOnly`**。可选 **`-DockerExePath "..."`** 指定 `docker.exe`（与 **`scripts/rebuild-backend-docker.ps1`** 一致；该脚本为 **`backend` + `celery-worker`** 无缓存重建并 `up -d`，见脚本内说明）。

**冒烟建议**：同一账号在 A 浏览器发两条 → B 无痕打开同成员对话页应可见；清空会话后两端均为空。（若只开单标签，`useDialogue` 已开启 **`refetchOnWindowFocus`**，切回浏览器标签也会拉服务端列表。）

---

## 项目结构

```
MTC/
├── backend/                    # FastAPI 后端
│   ├── app/
│   │   ├── mnemo/             # Mnemo 管线（巩固、召回、Engram 同步等）
│   │   ├── api/v1/            # API 路由（auth / archive / memory / media /
│   │   │                      #           dialogue / storybook / capsule / ...）
│   │   ├── core/              # 配置、数据库、依赖注入
│   │   ├── models/            # SQLAlchemy ORM 模型
│   │   ├── schemas/           # Pydantic 请求 / 响应 Schema
│   │   ├── services/          # 业务服务（LLM / 向量 / 媒体 / 头像与受控上传等）
│   │   ├── workers/           # Celery 任务入口（含 Mnemo 异步）
│   │   └── main.py
│   ├── alembic/               # 数据库迁移
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/                  # React 前端
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/            # A 基座设计系统组件
│   │   │   ├── dialogue/      # 对话气泡 / 打字机
│   │   │   ├── member/        # 成员档案组件
│   │   │   ├── memory/        # 记忆卡片 / 详情抽屉 / 关系图谱
│   │   │   ├── media/         # 媒体上传 / 相册 / 灯箱
│   │   │   ├── timeline/      # 时间线可视化
│   │   │   ├── storybook/     # 故事书预览
│   │   │   └── capsule/       # 记忆胶囊卡片 / 弹窗
│   │   ├── pages/             # 页面（Landing、Dashboard、档案/成员/对话/时间线/
│   │   │                      #       故事书、记忆胶囊、模型设置、个人中心等）
│   │   ├── hooks/             # 认证、LLM 用户配置、业务 hooks 等
│   │   ├── services/          # API 客户端（axios + 统一错误处理）
│   │   ├── lib/               # 设计 token、时间线、LLM 预设、Mnemo 图谱布局与高亮等
│   │   └── providers/         # MotionProvider / ThemeProvider
│   ├── package.json
│   ├── Dockerfile
│   ├── default.conf.template  # 容器内 Nginx 主模板
│   └── nginx-snippets/        # 反代与 SPA 配置片段
│
├── kourichat/                 # 微信侧集成（被 compose 只读挂入容器）
│
├── infra/                     # 基础设施与编排
│   ├── docker-compose.yml     # 全栈 + PG / Qdrant / MinIO / Redis
│   └── docker-compose.hybrid-frontend.example.yml
│
├── scripts/                   # 运维脚本：`start-services.sh`、`start-stable.ps1`、`rebuild-backend-docker.ps1`、Docker 上下文修复等
│
└── docs/
    ├── MnemoTranscode.txt      # 项目文字宣言
    ├── LLM.txt                 # 厂商与模型参考
    ├── ARCHITECTURE.md         # 架构说明
    ├── SPEC.md                 # 规格摘要
    ├── API.md                  # 主要 REST 摘录
    ├── memory-relation-network.md  # 记忆关系网（Engram）前后端契约与交互
    ├── stable-dev-windows.md   # Windows + Docker 稳定性
    ├── USAGE_AND_SUBSCRIPTION.md  # 用量 / 订阅档位 / 前端缓存与对话打字机
    ├── design-system.md        # A 基座设计系统
    └── superpowers/
        ├── specs/             # 各子项目设计规格文档
        ├── plans/             # 各子项目实现计划
        └── completed/         # 各子项目完成记录
```

---

## 开发指南

### 仓库与换行约定

- **换行符**：业务源码在 Git 索引中以 **LF** 为主；**`.bat` / `.ps1` / `.cmd`** 在 Windows 上检出为 **CRLF**，便于系统脚本直接执行。规则见根目录 **`.gitattributes`**。
- **忽略文件**：`**/node_modules`**、构建产物、`__pycache__`、本地 **`.env`**、Vite 缓存 **`.vite`** 等均不应提交；完整列表见 **`.gitignore`**。

### 后端

```bash
cd backend

# 安装依赖
pip install -r requirements.txt

# 数据库迁移
alembic upgrade head                              # 执行迁移
alembic revision --autogenerate -m "描述"        # 生成新迁移

# 启动开发服务器（热重载）
uvicorn app.main:app --reload --port 8000
```

### 前端

```bash
cd frontend

npm install          # 安装依赖
npm run dev          # 启动开发服务器
npm run type-check   # TypeScript 类型检查
npm run build        # 生产构建
```

**补充**：`axios` 遇到 **401** 会 **`clearAuth()`** 并交由路由层跳转，**不**再强制 `window.location` 整页刷新。用量/存储卡片与 **`GET /usage/stats`** 对齐，TanStack Query 键为 **`['dashboard', 'usage']`**；详见 [docs/USAGE_AND_SUBSCRIPTION.md](./docs/USAGE_AND_SUBSCRIPTION.md)。

---

## API 文档

启动后端后访问：

- **Swagger UI**：http://localhost:8000/docs
- **ReDoc**：http://localhost:8000/redoc

### 主要 API 端点

| 模块 | 端点前缀 |
|------|---------|
| 认证 | `/api/v1/auth` |
| 档案 | `/api/v1/archives` |
| 成员 | `/api/v1/archives/{id}/members` |
| 记忆 | `/api/v1/memories` · 语义搜索 `/search` · 图谱 `GET …/mnemo-graph` · 导入 `POST …/import-chat` / `…/import-chat/stream` |
| 媒体 | `/api/v1/media` |
| AI 对话 | `/api/v1/dialogue` |
| 故事书 | `/api/v1/storybook` |
| 记忆胶囊 | `/api/v1/capsules` |
| 用量/限额 | `/api/v1/usage` 等（与订阅展示相关，以后端实现为准） |
| 用户偏好 | `/api/v1/preferences`（如应用背景） |
| KouriChat | `/api/v1/kourichat` |
| LLM 探测 | `/api/v1/llm-probe` |

---

## 数据模型

```
用户 (User)
 └── 档案 (Archive)  — 家族 / 恋人 / 挚友 / 至亲 / 伟人 / 历史
      └── 成员 (Member)
           ├── 成员状态：status（active / passed / distant / pet / other），可选 end_year（及旧版影子字段兼容）
           ├── 记忆 (Memory)          — 情感标签 / 时间 / 地点
           ├── 媒体资产 (MediaAsset)  — 照片 / 视频 / 音频
           ├── Engram（mnemo）       — 记忆关系 / 巩固图（随迁移与功能启用）
           └── 记忆胶囊 (MemoryCapsule) — 定时解封
```

前端展示与 API 以 `status` 为主；遗留 `is_alive` / `death_year` 仅兼容旧数据，新业务请使用 `status` / `end_year`。

---

## 多渠道接入

### 微信接入（KouriChat 集成）

项目整合了 KouriChat 的微信消息处理能力，实现微信聊天消息与 MTC AI 对话 API 的无缝转接。

配置路径：`backend/.env` → `KOURICHAT_*` 相关配置项。

---

## 许可证

本项目采用 MIT 许可证，详见 [LICENSE](./LICENSE) 文件。

---

## 致谢

- [KouriChat](https://kourichat.com) — 微信 AI 聊天机器人的参考实现
- [FastAPI](https://fastapi.tiangolo.com/) — 现代 Python Web 框架
- [React](https://react.dev/) — 用于构建用户界面的 JavaScript 库
- [TanStack Query](https://tanstack.com/query) — 异步状态管理
- [Motion](https://motion.dev/) — React 动效（`motion`）
- [ex-skill](https://github.com/perkfly/ex-skill) — perkfly：**聊天记录与个人叙事蒸馏为 Agent Skill**（Persona + Memories）、本地解析与版本管理的实践参考（MIT）
- 所有开源项目的贡献者

---

*MTC — 用 AI 守护每一段值得的关系*
