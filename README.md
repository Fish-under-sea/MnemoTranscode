# MTC — Memory To Code

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Python: 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/)
[![React: 18](https://img.shields.io/badge/react-18-61dafb.svg)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/fastapi-0.109-009688.svg)](https://fastapi.tiangolo.com/)

> 人的记忆是一种不讲道理的存储介质。这个项目存在的意义，就是把这些失衡的记忆碎片提取出来，完成从生物硬盘到数字硬盘的格式转换。

---

## 项目简介

MTC（MnemoTranscode — Memory To Code）是一个通用的 **AI 关系档案与生命故事平台**。它不只服务于某一类关系，可以承载恋人、挚友、至亲、伟人乃至一个国家/民族的历史记忆。

用 AI 技术将记忆（声音、照片、文字、情感）进行数字化存档、智能化整理和多模态还原，让每一段值得的关系都留有迹可循。

---

## 核心功能

| 功能模块 | 说明 |
|---------|------|
| **关系档案库** | 创建恋人、挚友、至亲、家族、伟人等多类型档案，管理档案内成员信息 |
| **记忆管理** | 为每位成员记录记忆条目，支持情感标签、时间、地点等元数据 |
| **媒体存档** | 照片、视频、音频两阶段预签名上传，私有桶安全存储（MinIO） |
| **AI 对话** | 与档案中的成员进行 AI 角色扮演对话，前端打字机效果，记忆上下文注入 |
| **故事书生成** | 基于记忆条目 AI 自动生成生命故事，支持怀旧温情、文学风格等四种写作风格，可导出 PDF |
| **交互时间线** | 按年份聚合的可视化记忆时间线，支持情感/成员/时间范围三维筛选 |
| **记忆胶囊** | 创建定时解封的加密信件，锁定期内内容加密保护，到期自动解封 |
| **还原 Ta 的声音（规划）** | TTS + 声纹迁移，基于 CosyVoice 重现 Ta 的声音 |
| **多渠道对话** | 原生 Web 应用内对话；微信消息转接（KouriChat 集成） |
| **语义检索** | 向量数据库支撑的自然语言记忆搜索（Qdrant） |

---

## 系统架构

```
输入层              AI 核心层           存储层              输出层
  │                    │                   │                   │
  ├── 文字录入         ├── LLM 对话引擎     ├── PostgreSQL       ├── 关系档案
  ├── 照片 / 视频      ├── 记忆整理         ├── Qdrant（向量）   ├── 记忆时间线
  ├── 音频上传         ├── 故事书生成       ├── MinIO（媒体）    ├── AI 对话
  └── 声纹采集         └── 语音克隆         └── Redis（队列）    ├── 故事书
                                                                ├── 记忆胶囊
                                                                └── API / Webhook
```

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 · TypeScript · Vite · Tailwind CSS · Framer Motion |
| 状态管理 | Zustand · TanStack Query v5 |
| 组件库 | 自研 A 基座设计系统（东方温润设计语言）|
| 后端 | FastAPI · Python 3.11 · SQLAlchemy 2.0 · Alembic |
| 数据库 | PostgreSQL 16 |
| 向量数据库 | Qdrant |
| 对象存储 | MinIO（预签名两阶段上传）|
| 缓存 / 队列 | Redis · Celery |
| AI | OpenAI API / Qwen / Whisper / CosyVoice |
| 容器化 | Docker · Docker Compose |

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
```

### 2. 配置环境变量

```bash
cp backend/.env.example backend/.env
# 编辑 backend/.env，填入以下关键配置：
# DATABASE_URL、SECRET_KEY、OPENAI_API_KEY、MINIO_* 等
```

### 3. 启动基础设施

```bash
# 启动 PostgreSQL / Qdrant / MinIO / Redis
docker compose -f infra/docker-compose.yml up -d
```

### 4. 启动后端

```bash
cd backend
pip install -r requirements.txt

# 执行数据库迁移
alembic upgrade head

# 启动开发服务器
uvicorn app.main:app --reload --port 8000
```

### 5. 启动前端

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

---

## 项目结构

```
MTC/
├── backend/                    # FastAPI 后端
│   ├── app/
│   │   ├── api/v1/            # API 路由（auth / archive / memory / media /
│   │   │                      #           dialogue / storybook / capsule / ...）
│   │   ├── core/              # 配置、数据库、依赖注入
│   │   ├── models/            # SQLAlchemy ORM 模型
│   │   ├── schemas/           # Pydantic 请求 / 响应 Schema
│   │   ├── services/          # 业务服务（LLM / 向量 / 媒体 / 语音）
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
│   │   │   ├── memory/        # 记忆卡片 / 详情抽屉
│   │   │   ├── media/         # 媒体上传 / 相册 / 灯箱
│   │   │   ├── timeline/      # 时间线可视化
│   │   │   ├── storybook/     # 故事书预览
│   │   │   └── capsule/       # 记忆胶囊卡片 / 弹窗
│   │   ├── pages/             # 页面（Landing / Dashboard / Archive /
│   │   │                      #       Member / Timeline / Dialogue /
│   │   │                      #       StoryBook / Capsule / Settings）
│   │   ├── hooks/             # 自定义 hooks（useDialogue / useCapsules / ...）
│   │   ├── services/          # API 客户端（axios + 统一错误处理）
│   │   ├── lib/               # 工具函数（motion / memberStatus / timelineUtils / ...）
│   │   └── providers/         # MotionProvider / ThemeProvider
│   ├── package.json
│   └── Dockerfile
│
├── infra/                     # 基础设施
│   └── docker-compose.yml     # PostgreSQL / Qdrant / MinIO / Redis
│
└── docs/
    ├── design-system.md       # A 基座设计系统规范
    └── superpowers/
        ├── specs/             # 各子项目设计规格文档
        ├── plans/             # 各子项目实现计划
        └── completed/         # 各子项目完成记录
```

---

## 开发指南

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
| 记忆 | `/api/v1/memories` |
| 媒体 | `/api/v1/media` |
| AI 对话 | `/api/v1/dialogue` |
| 故事书 | `/api/v1/storybook` |
| 记忆胶囊 | `/api/v1/capsules` |

---

## 数据模型

```
用户 (User)
 └── 档案 (Archive)  — 家族 / 恋人 / 挚友 / 至亲 / 伟人 / 历史
      └── 成员 (Member)
           ├── 记忆 (Memory)          — 情感标签 / 时间 / 地点
           ├── 媒体资产 (MediaAsset)  — 照片 / 视频 / 音频
           └── 记忆胶囊 (MemoryCapsule) — 定时解封
```

成员状态采用三值语义：`alive`（健在）· `deceased`（已离开）· `unknown`（未知）。

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
- [Framer Motion](https://www.framer.com/motion/) — React 动效库
- [TanStack Query](https://tanstack.com/query) — 异步状态管理
- 所有开源项目的贡献者

---

*MTC — 用 AI 守护每一段值得的关系*
