# MTC — Memory To Code

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Python: 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/)
[![React: 18](https://img.shields.io/badge/react-18-blue.svg)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/fastapi-0.109-green.svg)](https://fastapi.tiangolo.com/)

> 人的记忆是一种不讲道理的存储介质。这个项目存在的意义，就是把这些失衡的记忆碎片提取出来，完成从生物硬盘到数字硬盘的格式转换。

---

## 项目简介

MTC（MnemoTranscode — Memory To Code）是一个通用的 **AI 记忆传承平台**。它不只服务于家族记忆，可以承载恋人、挚友、至亲、伟人乃至一个国家/民族的历史记忆。

用 AI 技术将记忆（声音、照片、文字、情感）进行数字化存档、智能化整理和多模态还原。

---

## 核心特性

- **多类型档案**：支持家族、恋人、挚友、至亲、伟人、国家历史等多种记忆档案
- **多渠道对话**：原生应用内对话、微信聊天转接、QQ 聊天转接（待开发）
- **AI 记忆整理**：LLM 自动总结、归类、时间线重建
- **情感识别**：NLP 情绪标注与情感分析
- **声音克隆**：TTS + 声纹迁移，还原亲人声音
- **记忆胶囊**：定时解封，实现跨代传承
- **家族故事书**：AI 自动生成生命故事，支持多种风格
- **语义检索**：向量数据库支撑的自然语言记忆搜索

---

## 系统架构

```
输入层 ──► AI 核心层 ──► 存储层 ──► 输出层
  │            │           │          │
  ├── 语音对话  ├── 记忆整理  ├── 向量库   ├── 故事书
  ├── 照片/视频 ├── 情感识别  ├── PostgreSQL├── 对话
  ├── 文字录入  ├── 声音克隆  ├── MinIO    ├── 时间线
  └── 声纹采集                   └── 加密档案  └── 记忆胶囊
```

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS |
| 后端 | FastAPI + Python 3.11 + SQLAlchemy 2.0 |
| 数据库 | PostgreSQL 16 |
| 向量数据库 | Qdrant |
| 对象存储 | MinIO |
| 缓存/队列 | Redis + Celery |
| AI | OpenAI API / Qwen / Whisper / CosyVoice |
| 容器化 | Docker + Docker Compose |
| CI/CD | GitHub Actions |

---

## 快速开始

### 环境要求

- Python 3.11+
- Node.js 18+
- Docker 和 Docker Compose
- Git

### 1. 克隆项目

```bash
git clone https://github.com/your-repo/MTC.git
cd MTC
```

### 2. 配置环境变量

```bash
cp backend/.env.example backend/.env
# 编辑 backend/.env 填入你的 API 密钥
```

### 3. 启动开发环境

```bash
# 一键启动（推荐）
make docker-up

# 或分别启动
make backend   # 启动后端（http://localhost:8000）
make frontend  # 启动前端（http://localhost:5173）
```

### 4. 访问应用

| 服务 | 地址 |
|------|------|
| 前端应用 | http://localhost:5173 |
| 后端 API | http://localhost:8000 |
| API 文档 | http://localhost:8000/docs |
| Qdrant 控制台 | http://localhost:6333/dashboard |
| MinIO 控制台 | http://localhost:9001 |

### 5. 初始化向量数据库

```bash
make qdrant-init
```

---

## 项目结构

```
MTC/
├── backend/                # FastAPI 后端
│   ├── app/
│   │   ├── api/          # API 路由
│   │   ├── core/         # 核心配置
│   │   ├── models/       # ORM 模型
│   │   ├── schemas/      # Pydantic Schema
│   │   └── services/     # 业务服务
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/              # React 前端
│   ├── src/
│   │   ├── components/   # 组件
│   │   ├── pages/        # 页面
│   │   ├── services/     # API 调用
│   │   └── stores/       # 状态管理
│   ├── package.json
│   └── Dockerfile
│
├── infra/                # 基础设施
│   └── docker-compose.yml
│
├── docs/                 # 项目文档
│   ├── SPEC.md          # 详细规格说明书
│   ├── API.md           # 接口文档
│   └── ARCHITECTURE.md  # 架构说明
│
├── Makefile             # 常用命令
├── README.md
└── .gitignore
```

---

## 常用命令

```bash
make help           # 查看所有可用命令
make docker-up      # 启动所有 Docker 服务
make docker-down    # 停止所有服务
make docker-logs    # 查看服务日志
make test           # 运行测试
make lint           # 代码检查
make clean          # 清理缓存
```

详细命令见 [Makefile](./Makefile)。

---

## 开发指南

### 后端开发

```bash
cd backend

# 安装依赖
pip install -r requirements.txt

# 启动开发服务器
uvicorn app.main:app --reload

# 运行测试
pytest tests/ -v
```

### 前端开发

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 类型检查
npm run type-check
```

### 数据库迁移

```bash
cd backend

# 创建迁移
alembic revision --autogenerate -m "add memory table"

# 执行迁移
alembic upgrade head
```

---

## API 文档

启动服务后访问：

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

详细接口说明见 [docs/API.md](./docs/API.md)。

---

## 多渠道接入

### 微信接入（KouriChat 集成）

项目整合了 KouriChat 的微信消息处理能力，实现微信聊天与 MTC 的无缝对接。

**配置步骤：**

1. 在 Windows 环境下运行
2. 安装 wxautox4：`pip install wxautox4`
3. 配置微信监听列表
4. 消息自动转发到 MTC 对话 API

### QQ 接入（待开发）

基于 NoneBot2 / go-cqhttp 的 QQ 群聊接入，规划中。

---

## 数据模型

```
用户 (User)
 └── 档案 (Archive)
      ├── 成员 (Member)
      │    ├── 记忆 (Memory)
      │    └── 记忆胶囊 (MemoryCapsule)
      └── 访问控制 (AccessControl)
```

详细数据模型见 [docs/SPEC.md](./docs/SPEC.md)。

---

## 贡献指南

欢迎提交 Issue 和 Pull Request。

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/xxx`
3. 提交改动：`git commit -m 'feat: 添加新功能'`
4. 推送分支：`git push origin feature/xxx`
5. 创建 Pull Request

---

## 许可证

本项目采用 MIT 许可证，详见 [LICENSE](./LICENSE) 文件。

---

## 致谢

- [KouriChat](https://kourichat.com) — 微信 AI 聊天机器人的参考实现
- [FastAPI](https://fastapi.tiangolo.com/) — 现代 Python Web 框架
- [React](https://react.dev/) — 用于构建用户界面的 JavaScript 库
- 所有开源项目的贡献者

---

*MTC — 用 AI 守护每一段珍贵的记忆*
