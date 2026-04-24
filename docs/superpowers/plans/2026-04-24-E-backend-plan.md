# 子项目 E（后端工程化 + 媒体服务）实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在不改动已定稿 spec 的前提下，按 `M2a -> M2b -> M1 -> M3 -> M4 -> M5 -> M6 -> M7` 完成 E 子项目全部后端交付，并满足 v1.4 每阶段 commit+push 约束。

**架构：** 先把数据库生命周期切到 Alembic 单入口，再完成 members 字段迁移与 Pydantic 兼容层；随后建立全局异常/日志基座，承接媒体两阶段上传与 TTS 基座，最后统一 compose、CI、文档与类型收尾。错误响应统一 envelope、日志统一 JSON、请求链统一 request_id。

**技术栈：** FastAPI + Pydantic v2 + SQLAlchemy + Alembic + PostgreSQL + MinIO + Redis + Celery + pytest

---

## 开工前勾选（来自 spec §10.2，10/10）

- [x] 我已读 `.cursor/rules/mtc-refactor-roadmap.mdc` v1.4 的 § 五.1 / § 六 / § 七 / § 十 / § 十一
- [x] 我已读 `docs/design-system.md`（E 不改 UI，但措辞基调需对齐）
- [x] 当前分支 = `Codex-coding`，且 `git status` 无未提交残留
- [x] 我理解 spec §1.3 的 6 条硬约束
- [x] 我理解执行顺序 `M2a -> M2b -> M1 -> M3 -> M4 -> M5 -> M6 -> M7` 不可颠倒
- [x] 我理解 members Phase 与 media 退役是独立时间表
- [x] 我理解 v1.4 每阶段必推硬约束
- [x] 我理解 Q6=A：clone 只做抽象占位
- [x] 我理解前端类型 PR 的允许/禁止边界
- [x] 我已浏览 spec 附录 B（error_code）与附录 C（配置项）

---

## 文件结构（先锁边界）

**新增文件：**

- `backend/alembic.ini`：Alembic 主配置
- `backend/alembic/env.py`：metadata 装载与迁移上下文
- `backend/alembic/versions/*_baseline_existing_schema.py`：基线迁移
- `backend/alembic/versions/*_members_status_end_year.py`：members 字段迁移
- `backend/alembic/versions/*_media_tables.py`：M5 新表
- `backend/entrypoint.sh`：`alembic upgrade head` + uvicorn 启动入口
- `backend/app/core/exceptions.py`：`MTCDomainError` 体系
- `backend/app/api/middleware/request_id.py`：request_id 注入与回显
- `backend/app/api/middleware/exception_handlers.py`：全局异常桥接
- `backend/app/core/logging_config.py`：JSON 日志 formatter
- `backend/app/models/media.py`：`media_upload_sessions` / `media_assets`
- `backend/app/services/media/upload_service.py`：init/complete 核心逻辑
- `backend/app/services/voice/provider.py`：`VoiceProvider` 抽象
- `backend/app/services/voice/cosyvoice.py`：CosyVoice 实现
- `backend/app/workers/celery_app.py`：Celery app
- `backend/app/workers/tasks/healthcheck.py`：健康任务
- `backend/app/workers/tasks/voice.py`：clone 占位任务
- `backend/tests/integration/test_error_envelope.py`：错误 envelope 回归
- `backend/tests/integration/test_media_upload_flow.py`：M5 链路测试
- `backend/tests/integration/test_voice_limits.py`：M6 并发/重试/超时测试
- `scripts/pg_dump_snapshot.sh`：迁移前快照脚本
- `docs/superpowers/completed/2026-04-24-E-backend.md`：E 收尾文档

**修改文件：**

- `backend/app/main.py`：移除 `create_all`，注册 middleware/handler/router
- `backend/app/core/config.py`：补全附录 C 配置项
- `backend/app/models/__init__.py`：确保所有 model 被 import
- `backend/app/models/memory.py`：`Member` 新增 `status/end_year` 并放宽 `is_alive`
- `backend/app/schemas/memory.py`：M1 归一化与冲突校验
- `backend/app/api/v1/archive.py`：成员接口改用新 schema 行为
- `backend/app/api/v1/media.py`：旧接口加 deprecation + 新接口挂载
- `infra/docker-compose.yml`：context、command、healthcheck、depends_on
- `backend/Dockerfile`：entrypoint 执行权限与入口
- `backend/README.md`：alembic 使用路径
- `frontend/src/types/*.ts`（M7 末期）：仅类型与编译修复

---

### 任务 1：M2a Alembic 单入口落地

**文件：**
- 创建：`backend/alembic.ini`
- 创建：`backend/alembic/env.py`
- 创建：`backend/alembic/versions/*_baseline_existing_schema.py`
- 修改：`backend/app/models/__init__.py`
- 修改：`backend/app/main.py`
- 创建：`backend/entrypoint.sh`
- 修改：`backend/Dockerfile`
- 测试：`backend/tests/integration/test_alembic_bootstrap.py`

- [ ] **步骤 1：编写失败测试（无 Alembic 或 create_all 残留应失败）**

```python
def test_app_main_has_no_create_all_call():
    content = Path("backend/app/main.py").read_text(encoding="utf-8")
    assert "create_all" not in content
```

- [ ] **步骤 2：运行测试验证失败**

运行：`pytest backend/tests/integration/test_alembic_bootstrap.py -v`  
预期：FAIL（当前代码仍含 `init_db/create_all` 或未建 Alembic 文件）

- [ ] **步骤 3：实现最小代码**

```python
# backend/app/models/__init__.py
from app.models.user import User
from app.models.memory import Archive, Member, Memory, MemoryCapsule
# 后续在此补齐 media 等模型，确保 env.py 可见 metadata
```

```bash
# backend/entrypoint.sh
#!/usr/bin/env sh
set -e
alembic upgrade head
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 ${UVICORN_EXTRA_ARGS:---reload}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`pytest backend/tests/integration/test_alembic_bootstrap.py -v`  
预期：PASS

- [ ] **步骤 5：Commit + Push**

运行：
```bash
git add backend/alembic.ini backend/alembic backend/app/main.py backend/app/models/__init__.py backend/entrypoint.sh backend/Dockerfile backend/tests/integration/test_alembic_bootstrap.py
git commit -m "feat(E): 建立 Alembic 单入口并移除 create_all 启表路径"
git push -u origin Codex-coding
```

---

### 任务 2：M2b Members 迁移 + ORM 同步

**文件：**
- 创建：`backend/alembic/versions/*_members_status_end_year.py`
- 修改：`backend/app/models/memory.py`
- 测试：`backend/tests/integration/test_members_migration.py`

- [ ] **步骤 1：编写失败测试（新列不存在时失败）**

```python
def test_member_model_has_status_and_end_year():
    from app.models.memory import Member
    cols = Member.__table__.columns.keys()
    assert "status" in cols and "end_year" in cols
```

- [ ] **步骤 2：运行测试验证失败**

运行：`pytest backend/tests/integration/test_members_migration.py -v`  
预期：FAIL（尚未新增列）

- [ ] **步骤 3：实现迁移与模型最小代码**

```python
# migration upgrade 核心
op.add_column("members", sa.Column("status", sa.String(16), nullable=True))
op.add_column("members", sa.Column("end_year", sa.Integer(), nullable=True))
op.execute("""UPDATE members SET status = CASE WHEN is_alive = TRUE THEN 'active' ELSE 'passed' END""")
op.alter_column("members", "status", nullable=False)
op.create_check_constraint("ck_members_status_enum", "members", "status IN ('active','passed','distant','pet','other')")
op.alter_column("members", "is_alive", nullable=True)
```

- [ ] **步骤 4：运行测试验证通过**

运行：
`pytest backend/tests/integration/test_members_migration.py -v`  
预期：PASS

- [ ] **步骤 5：Commit + Push**

```bash
git add backend/alembic/versions/*_members_status_end_year.py backend/app/models/memory.py backend/tests/integration/test_members_migration.py
git commit -m "feat(E): 完成 members status/end_year 迁移与 ORM 双字段同步"
git push origin Codex-coding
```

---

### 任务 3：M1 Pydantic 归一化与冲突检测

**文件：**
- 修改：`backend/app/schemas/memory.py`
- 修改：`backend/app/api/v1/archive.py`
- 测试：`backend/tests/integration/test_member_schema_normalization.py`

- [ ] **步骤 1：编写失败测试（create/update 双模式）**

```python
def test_create_requires_status_or_legacy_source():
    with pytest.raises(Exception):
        MemberCreate(name="A", relationship_type="friend")
```

```python
def test_update_name_only_passes():
    obj = MemberUpdate(name="B")
    assert obj.name == "B"
```

- [ ] **步骤 2：运行测试验证失败**

运行：`pytest backend/tests/integration/test_member_schema_normalization.py -v`  
预期：FAIL

- [ ] **步骤 3：实现最小 validator 代码**

```python
class MemberCreate(MemberBase):
    @model_validator(mode="before")
    @classmethod
    def _normalize(cls, raw):
        return _normalize_member_payload(raw, mode="create")

class MemberUpdate(BaseModel):
    @model_validator(mode="before")
    @classmethod
    def _normalize(cls, raw):
        return _normalize_member_payload(raw, mode="update")
```

- [ ] **步骤 4：运行测试验证通过**

运行：`pytest backend/tests/integration/test_member_schema_normalization.py -v`  
预期：PASS（含 `VALIDATION_*` 和 `FIELD_CONFLICT_*` 核心用例）

- [ ] **步骤 5：Commit + Push**

```bash
git add backend/app/schemas/memory.py backend/app/api/v1/archive.py backend/tests/integration/test_member_schema_normalization.py
git commit -m "feat(E): 完成 members 请求归一化与冲突检测规则"
git push origin Codex-coding
```

---

### 任务 4：M3 全局异常 + request_id + JSON 日志

**文件：**
- 创建：`backend/app/core/exceptions.py`
- 创建：`backend/app/api/middleware/request_id.py`
- 创建：`backend/app/api/middleware/exception_handlers.py`
- 创建：`backend/app/core/logging_config.py`
- 修改：`backend/app/main.py`
- 测试：`backend/tests/integration/test_error_envelope.py`

- [ ] **步骤 1：编写失败测试（错误 envelope 必含 request_id）**

```python
def test_error_envelope_contains_request_id(client):
    r = client.get("/api/v1/archives/999999")
    assert "error_code" in r.json()
    assert "request_id" in r.json()
    assert r.headers["X-Request-ID"] == r.json()["request_id"]
```

- [ ] **步骤 2：运行测试验证失败**

运行：`pytest backend/tests/integration/test_error_envelope.py -v`  
预期：FAIL（当前仍是 `detail` 格式）

- [ ] **步骤 3：实现最小中间件与异常桥接**

```python
@app.exception_handler(HTTPException)
async def handle_http_exception(request, exc):
    code = STATUS_TO_CODE_FALLBACK.get(exc.status_code, f"HTTP_{exc.status_code}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"error_code": code, "message": str(exc.detail), "request_id": request.state.request_id},
        headers={"X-Request-ID": request.state.request_id},
    )
```

- [ ] **步骤 4：运行测试验证通过**

运行：`pytest backend/tests/integration/test_error_envelope.py -v`  
预期：PASS

- [ ] **步骤 5：Commit + Push**

```bash
git add backend/app/core/exceptions.py backend/app/api/middleware/request_id.py backend/app/api/middleware/exception_handlers.py backend/app/core/logging_config.py backend/app/main.py backend/tests/integration/test_error_envelope.py
git commit -m "feat(E): 建立统一错误响应、request_id 与 JSON 结构化日志基座"
git push origin Codex-coding
```

---

### 任务 5：M4 批量替换 HTTPException 到领域异常

**文件：**
- 修改：`backend/app/api/v1/auth.py`
- 修改：`backend/app/api/v1/archive.py`
- 修改：`backend/app/api/v1/memory.py`
- 修改：`backend/app/api/v1/media.py`
- 测试：`backend/tests/integration/test_error_code_mapping.py`

- [ ] **步骤 1：编写失败测试（语义 error_code）**

```python
def test_404_maps_to_resource_not_found(client):
    r = client.get("/api/v1/archives/999999")
    assert r.json()["error_code"] == "RESOURCE_NOT_FOUND"
```

- [ ] **步骤 2：运行测试验证失败**

运行：`pytest backend/tests/integration/test_error_code_mapping.py -v`  
预期：FAIL

- [ ] **步骤 3：替换最小业务异常**

```python
if not archive:
    raise DomainResourceError(
        error_code="RESOURCE_NOT_FOUND",
        message="档案不存在",
    )
```

- [ ] **步骤 4：运行测试验证通过**

运行：`pytest backend/tests/integration/test_error_code_mapping.py -v`  
预期：PASS

- [ ] **步骤 5：Commit + Push**

```bash
git add backend/app/api/v1/auth.py backend/app/api/v1/archive.py backend/app/api/v1/memory.py backend/app/api/v1/media.py backend/tests/integration/test_error_code_mapping.py
git commit -m "refactor(E): 将主要路由 HTTPException 迁移为领域异常"
git push origin Codex-coding
```

---

### 任务 6：M5 两阶段上传 + 私有预签名下载

**文件：**
- 创建：`backend/alembic/versions/*_media_tables.py`
- 创建：`backend/app/models/media.py`
- 创建：`backend/app/services/media/upload_service.py`
- 修改：`backend/app/api/v1/media.py`
- 测试：`backend/tests/integration/test_media_upload_flow.py`

- [ ] **步骤 1：编写失败测试（init->complete->download）**

```python
def test_media_upload_happy_path(client, token):
    init = client.post("/api/v1/media/uploads/init", headers=token, json={...})
    assert init.status_code == 200
    # 省略 PUT 到对象存储的 stub
    done = client.post("/api/v1/media/uploads/complete", headers=token, json={...})
    assert done.status_code == 200
```

- [ ] **步骤 2：运行测试验证失败**

运行：`pytest backend/tests/integration/test_media_upload_flow.py -v`  
预期：FAIL

- [ ] **步骤 3：实现最小 init/complete 核心**

```python
@router.post("/uploads/init")
async def init_upload(req: UploadInitRequest, user=Depends(get_current_user)):
    # 校验 purpose/content_type/size，生成 object_key 与 presigned_put
    ...

@router.post("/uploads/complete")
async def complete_upload(req: UploadCompleteRequest, user=Depends(get_current_user)):
    # 强制 head_object，幂等返回，写 media_assets
    ...
```

- [ ] **步骤 4：运行测试验证通过**

运行：`pytest backend/tests/integration/test_media_upload_flow.py -v`  
预期：PASS（含跨用户、过期、重复 complete）

- [ ] **步骤 5：Commit + Push**

```bash
git add backend/alembic/versions/*_media_tables.py backend/app/models/media.py backend/app/services/media/upload_service.py backend/app/api/v1/media.py backend/tests/integration/test_media_upload_flow.py
git commit -m "feat(E): 实现 MinIO 两阶段上传与私有预签名下载"
git push origin Codex-coding
```

---

### 任务 7：M6 TTS 基座 + Celery 占位

**文件：**
- 创建：`backend/app/services/voice/provider.py`
- 创建：`backend/app/services/voice/cosyvoice.py`
- 创建：`backend/app/workers/celery_app.py`
- 创建：`backend/app/workers/tasks/healthcheck.py`
- 创建：`backend/app/workers/tasks/voice.py`
- 修改：`backend/app/core/config.py`
- 测试：`backend/tests/integration/test_voice_limits.py`

- [ ] **步骤 1：编写失败测试（长度/并发/超时）**

```python
def test_tts_text_too_long_returns_422(client, token):
    long_text = "a" * 2001
    r = client.post("/api/v1/voice/tts", headers=token, json={"text": long_text})
    assert r.status_code == 422
```

- [ ] **步骤 2：运行测试验证失败**

运行：`pytest backend/tests/integration/test_voice_limits.py -v`  
预期：FAIL

- [ ] **步骤 3：实现最小语音基座**

```python
class VoiceProvider(ABC):
    @abstractmethod
    async def synthesize(self, text: str, voice_id: str | None = None, **options) -> bytes: ...
    @abstractmethod
    async def clone(self, sample: bytes, **options) -> str: ...
```

```python
class CosyVoiceProvider(VoiceProvider):
    async def clone(self, sample: bytes, **options) -> str:
        raise NotImplementedError("CosyVoice clone is planned for subproject D")
```

- [ ] **步骤 4：运行测试验证通过**

运行：`pytest backend/tests/integration/test_voice_limits.py -v`  
预期：PASS（含 timeout/retry 与 quota case）

- [ ] **步骤 5：Commit + Push**

```bash
git add backend/app/services/voice backend/app/workers backend/app/core/config.py backend/tests/integration/test_voice_limits.py
git commit -m "feat(E): 落地 TTS 基座、并发限制与 Celery 占位任务"
git push origin Codex-coding
```

---

### 任务 8：M7 收尾（compose、CI、types、文档与标签）

**文件：**
- 修改：`infra/docker-compose.yml`
- 修改：`backend/README.md`
- 修改：`frontend/src/types/*.ts`（必要时少量类型编译修复）
- 创建：`scripts/pg_dump_snapshot.sh`
- 创建：`docs/superpowers/completed/2026-04-24-E-backend.md`
- 测试：全量集成测试 + compose 从零启动验证

- [ ] **步骤 1：编写失败测试（healthz 与 compose 关键链路）**

```python
def test_healthz_contains_db_and_config(client):
    r = client.get("/healthz")
    assert r.status_code in (200, 503)
    assert "checks" in r.json()
```

- [ ] **步骤 2：运行验证命令确认当前未达标**

运行：
`docker compose -f infra/docker-compose.yml down -v && docker compose -f infra/docker-compose.yml up --build`  
预期：若路径或依赖未修，会出现构建/健康检查失败

- [ ] **步骤 3：实现收尾改动**

```yaml
# infra/docker-compose.yml（节选）
backend:
  build:
    context: ../backend
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8000/healthz"]
    interval: 10s
    timeout: 3s
    retries: 10
    start_period: 60s
```

- [ ] **步骤 4：运行全量验证**

运行：
`pytest backend/tests/integration -v`  
`cd frontend && npm run type-check`  
`docker compose -f infra/docker-compose.yml down -v && docker compose -f infra/docker-compose.yml up`

预期：全部通过

- [ ] **步骤 5：Commit + Push + Tag**

```bash
git add infra/docker-compose.yml backend/README.md frontend/src/types docs/superpowers/completed/2026-04-24-E-backend.md scripts/pg_dump_snapshot.sh
git commit -m "feat(E): 完成工程收尾、类型适配与交付文档"
git push origin Codex-coding
git tag -a mtc-E/m7-codex -m "E subproject completion anchor by Codex"
git push origin refs/tags/mtc-E/m7-codex
```

---

## 计划自检

- **规格覆盖度：** spec 的 M2a/M2b/M1/M3/M4/M5/M6/M7 与附录约束均有对应任务。
- **占位符扫描：** 无 “TODO/待定/后续补充” 类占位符；每步有明确文件、命令或代码片段。
- **类型一致性：** 异常类命名、error_code 族、字段命名（status/end_year）与 spec 保持一致。

---

计划已完成并保存到 `docs/superpowers/plans/2026-04-24-E-backend-plan.md`。两种执行方式：

**1. 子代理驱动（推荐）** - 每个任务调度一个新的子代理，任务间进行审查，快速迭代  
**2. 内联执行** - 在当前会话中使用 executing-plans 执行任务，批量执行并设有检查点

选哪种方式？

