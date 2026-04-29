# Windows 下开发稳定性说明（常驻可用 / 数据库不断连）

## 现象：`localhost` 上跑一会儿就挂

常见于 **后端跑在 Windows 本机**，`DATABASE_URL` 指向 **`localhost:5432`**，而 **PostgreSQL 实际在 Docker（经 WSL2）里**。宿主与虚拟机之间的 **端口转发、`localhost` NAT、WSL 休眠** 都会导致「刚才还能连库，几秒或几分钟后又失效」——这不是应用业务逻辑不可靠，而是**开发拓扑**问题。

Compose 内的 `backend` 镜像已改用 **`postgresql+asyncpg://...@postgres:5432/...`**，流量在 **Docker 内网**，不依赖 Windows ↔ 容器的 5432 转发，稳定性明显更好。

## 推荐拓扑（日常使用）

| 组件 | 跑在哪 | 说明 |
|------|--------|------|
| Postgres / Redis / Qdrant / MinIO | `docker compose` | 与原项目示例一致 |
| **FastAPI 后端** | **同一 Compose 内的 `backend` 容器**（端口映射 **8000:8000**） | 数据库走服务名 `postgres`，规避宿主断连 |
| 前端 Vite | Windows 或 WSL：**`npm run dev`**（5173） | `vite.config` 已将 `/api` 代理到 `localhost:8000`，即宿主访问容器后端 |

❌ **不要**再单独执行本机 **`uvicorn ... --port 8000`**（会与容器争抢 8000，且仍会连宿主 `localhost:5432`）。

## 一键启动（后端 Docker + `/healthz` + 前端 Vite）

在项目根目录 PowerShell（**建议使用 `-NoProfile`**，避免配置文件里把 `docker` 重定向到 `wsl` 时与 `docker compose` 冲突）：

```powershell
# 在项目根目录执行
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-stable.ps1 -KillPort8000
```

若仍遇到 WSL/`localhost` 告警：脚本只调用 **`docker.exe` 的文件路径**（不依赖 `$PROFILE` 里把 `docker` 指到 WSL 的函数）。

脚本会尽量自动发现 **`docker.exe`**（常见安装目录、PATH、`where`、注册表、在 `%ProgramFiles%\Docker` 下有限深度搜索）。

若提示 **docker.exe not found**：

1. 安装 **Docker Desktop for Windows**（会在 Windows 侧提供 **`docker.exe`**；若只在 WSL/Ubuntu 里装了 Docker CLI、从未装过 Desktop，宿主可能没有 `docker.exe`）。
2. 若已知 **`docker.exe` 路径**，可手写参数：`-DockerExePath "C:\完整路径\docker.exe"`（**`-DockerExe`** 为同名别名）。
3. 或在用户/系统环境中设置 **`MTC_DOCKER_EXE`** 为 **`docker.exe` 的完整路径**，再不带参数运行脚本。

若在 `Microsoft.PowerShell_profile.ps1` 中为方便写了 `wsl ... docker`，可保留交互使用；宿主仍须存在 **`docker.exe`** 或按上面 2/3 指定路径。

若 8000 被本机误启动的 **uvicorn** 占用，请使用 **`-KillPort8000`**（务必加 **`-NoProfile`** 可避免 profile 副作用）：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-stable.ps1 -KillPort8000
```

脚本会拉起 postgres / redis / qdrant / minio 与 **`backend`** 容器，并轮询 **`/healthz`** 直至 **`status=ok`**。健康检查后：

1. **自动在本机起一个前端**：在新 PowerShell 窗口中，`frontend/` 目录下执行 **`npm run dev`**（Vite **5173**）。若尚无 **`node_modules`**，会先在当前终端执行一次 **`npm install`**。
2. **仅需 Docker**、要自己开终端跑前端：加 **`-NoFrontend`**。
3. **5173** 被旧进程占用：加 **`-KillPort5173`**（与 `-KillPort8000` 可同用）。

首次 **`docker compose build backend`** 可能较慢属正常。

## 降低「WSL 睡死」导致 Docker 全挂的概率

在用户目录 **`%USERPROFILE%\.wslconfig`**（没有则新建）中增加或减少休眠，例如：

```ini
[wsl2]
memory=8GB
processors=4
```

若 Docker/WSL 在闲置后整块「假死」，可查阅微软文档酌情设置 **`vmIdleTimeout`** 等选项（版本不同键名请以官方为准），避免虚拟机长时间休眠。

同时建议 **Docker Desktop 保持运行**，不要休眠整台主机前未确认容器策略。

## 仍无法达到「百分之百」的现实边界

单次进程**物理上不能保证**永远不挂（OOM、杀毒、断电、磁盘满、Docker Desktop 重启等）。运维上追求的是：

- **可预期**：失败时健康检查可读、Compose `restart:` 拉起、日志可查；
- **可恢复**：本仓库脚本 + 文档可把「环境类」失败从玄学变成可重复步骤。

生产环境请将数据库与网关放在 SLA 可查的托管资源，再配合探针与告警；本仓库主要解决 **单机开发**下的稳定性痛点。
