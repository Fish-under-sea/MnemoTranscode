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

## 全栈一键启动（与 Docker Desktop「infra」一致）

当你在 Desktop 里习惯看到 **`mtc-backend` / `mtc-frontend` / `mtc-celery-worker`** 等 **全部在 Compose 内 Running**（对应仓库根下 **`infra/docker-compose.yml`** 默认服务）时，在项目根目录 PowerShell：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-stable.ps1 -FullStack
```

- **等价别名**：`-All`
- **镜像有改动需重建**：`-FullStack -Build`
- **Make（Windows）**：`make stable-full`

脚本会 **`docker compose up -d`**（优先带 **`--wait`**，失败则自动改为不带 **`--wait`** 重试），轮询 **`http://127.0.0.1:8000/healthz`**，并在全栈模式下探测 **`http://127.0.0.1:5173/`**（容器内 Nginx，映射 **`5173:80`**）。**不会**再在本机新开 **`npm run dev`**，避免与本机进程争抢 **`5173`**。

**改 UI 后浏览器仍旧？** Compose 前端是**镜像构建时的静态包**，不是挂载源码。收口命令：仓库根 `powershell … -File .\scripts\rebuild-docker-frontend.ps1` 或 **`make docker-rebuild-frontend`**。开发期也可用 **`scripts\compose-watch-frontend.ps1`**（或 **`make docker-watch-frontend`**）常驻 **`docker compose watch frontend`**，保存即触发镜像重建。**Cursor**：相关改动交付前收尾见 **`.cursor/rules/mtc-docker-frontend-sync.mdc`**。

重建成功后，用 **http://localhost:5173** 验收时建议 **Ctrl+F5**（硬刷新），减少 `index.html` 或旧指纹脚本的浏览器缓存干扰。

**请勿**与 **`-KillPort8000` / `-KillPort5173`** 同时使用（脚本检测到后会自动忽略这两项），以免误结束 Docker 端口转发相关进程。

`start-stable.ps1` 参数补充：

- **`-DockerPipeWaitSeconds`**：等待 Docker Engine 就绪的上限秒数（默认 **90**，冷启动过短易误判）。
- **`-TryDockerContextDefaultFirst:$false`**：关闭脚本在首轮探测 daemon 失败时自动执行的 **`docker context use default`**（默认**开启**：用于缓解 `desktop-linux` 上下文下 `dockerDesktopLinuxEngine` 管道尚未就绪时 CLI 一直失败）。
- **`-SkipDockerReadyWait`**：跳过 daemon / 命名管道就绪轮询（你确认 Engine 已 running 却仍被脚本误判时使用）。

## 日常使用：要不要每次执行启动脚本？

- 若 Compose 栈**未被** **`docker compose down`** 拆掉，一般 **只需打开 Docker Desktop** 等到 **Engine running**；镜像内服务多为 **`restart: unless-stopped`**，容器会跟引擎一并恢复。**不必**每次都跑脚本。
- 若执行过 **`down`** / 换新环境 / **`docker ps` 里已无 mtc-* 容器**，再在 **`infra`** 下 **`docker compose up -d`**，或执行 **`start-stable.ps1`** / **`make stable-full`**。脚本价值在于 **`--wait`、`/healthz` 探测**，以及混合模式下自动开一个本机 **Vite** 窗口。
- **自检**：`docker ps` 能列出 **`mtc-backend`**（且状态正常）后再访问 http://127.0.0.1:8000/healthz 与前端端口。

## Docker CLI：`docker compose` / `docker ps` 报管道错误或 protocol

典型报错：`cannot find dockerDesktopLinuxEngine` / `docker_engine`、`Failed to initialize: protocol not available`。

处理顺序：

1. 确认 Docker Desktop **Engine running**，必要时 **Quit Docker Desktop** → **`wsl --shutdown`**（管理员 PowerShell）→ 重新打开 Desktop。
2. **`docker context use default`** → **`docker ps`**。若恢复正常，可先固定使用 **`default`** 上下文开发。
3. 若配置文件里混入 **`unix:///var/run/docker.sock`**（常见于从 WSL 拷配置）：运行仓库 **`scripts/fix-docker-desktop-windows-context.ps1`**（会备份 `~\.docker`），再重启 Docker Desktop。
4. 仍失败：Docker Desktop → **Troubleshoot**，或重装 / 修复安装；详见根目录 **README**「Windows：docker compose / docker ps …」小节。

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
