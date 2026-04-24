# 子项目 E 设计文档 · 后端工程化 + 媒体服务

> 版本：**v1.0（Opus 定稿）**
> 日期：2026-04-24
> 分支：`Codex-coding`（子项目主导 = GPT-5.3 Codex）
> 规格定调：Claude 4.7 Opus（A 轨）— 本文档为 E 子项目 spec 阶段的收官版本
> 规格上游：`.cursor/rules/mtc-refactor-roadmap.mdc` v1.4 + § 五.1 产品语言决议
> 执行下游：Codex 从本文档直接进入 `writing-plans` → `executing-plans`（§ 四 六步流程的第 5–6 步）
>
> **本文档为执行级规格**——所有 milestone / 字段 / 错误码 / 配置项 / DoD 都已锁到实施粒度。Codex 在 writing-plans / executing-plans 阶段**原则上不应回头修改本文档**；确实发现无法按文档执行的边缘情况，暂停并与用户对齐后再回写本文档。

---

## 1. 目标与范围

### 1.1 E 子项目要做什么

| # | 模块 | 一句话 |
|---|---|---|
| 1 | members 字段语义迁移 | `is_alive/death_year` → `status/end_year`，影子兼容一个 release 周期 |
| 2 | 数据库生命周期统一 | Alembic 为 schema 唯一入口；移除 `create_all`；backend 启动时 `alembic upgrade head` |
| 3 | 全局异常与 envelope | 所有错误响应 `{error_code, message, fields?, request_id?}`；异常类层级 `MTCDomainError` |
| 4 | 结构化日志基座 | JSON 格式；9 个必选字段；PII 脱敏 baseline；分层命名空间 |
| 5 | MinIO 两阶段上传 | `init` + `complete` + 私有桶预签名 GET；object_key 服务端生成；complete 幂等 |
| 6 | TTS 工程化基座（仅 TTS） | CosyVoice 同步调用 + 超时 / 重试 / 限流 / 长度上限；克隆只预留抽象 |
| 7 | Celery 基建 | Redis broker；两个占位任务（healthcheck / voice_clone）；worker 不跑 migration |
| 8 | 工程收尾 | compose 路径修复 + healthcheck 链 + 前端 types PR + E 完成文档 + 归属 tag |

### 1.2 明确不做（E 不碰）

| 不做项 | 归属 | 理由 |
|---|---|---|
| 前端 UI 文案 / JSX 结构 / CSS class 改动 | B / C 子项目 | E 末期前端 PR 严格限定在 `types/*.ts` + 必要编译修复 |
| LandingPage / ArchiveDetailPage / MemberDetailPage 文案重写（"已故"等） | B / C | 见 § 五.1 表格；E 只提供 schema / enum，UI 层后办 |
| 声音克隆真实训练 / 指纹 / 产物管理 | D 子项目 | Q6=A 决策；E 只做 TTS 基座 + `VoiceProvider.clone()` 抽象占位 |
| D 子项目的业务整合（对话 / 故事书 / 胶囊） | D | 与 M6 的 TTS 不是同一回事，E 只把 TTS 调通 |
| `members.is_alive / death_year` 的物理 drop | "members 字段 Phase 2"（B brainstorm 前） | 见 § 3.5 影子列契约 |
| 旧 `POST /media/upload` 直传接口的物理删除 | "media 接口退役"（B / C 前端切换完成后） | 见 § 7.9；**不与** members Phase 2 绑定 |
| CI 基础设施（若当前未建） | E 顺手做最小版本 **或** 记 backlog 留给后续 PR | 见 § 9.5 |
| Prod 部署（docker-compose.prod.yml） | 未来独立工单 | E 只确保 dev 参数化，`--reload` 不写死 |

### 1.3 本设计的"硬约束"（违反即需回 brainstorming）

1. **产品语言零假设**：不在代码 / 文档 / 错误消息里引入"逝者 / 缅怀 / 墓志铭"等单向预设词；§ 五.1 的"关系档案 / 生命故事档案"立场贯穿 E
2. **schema 单一入口**：Alembic 是唯一 schema 来源，任何地方出现 `Base.metadata.create_all()` 都视为违规
3. **response envelope 一致性**：所有 4xx / 5xx 错误响应必须走 § 6 定义的 envelope；FastAPI 默认 `{"detail": "..."}` 格式不允许原样返出
4. **子项目边界**：任何超出 § 1.2 范围的改动进 backlog，不当场修
5. **v1.4 推送节奏**：每完成一个 milestone 必须 commit + push；首次推送用 `git push -u origin Codex-coding`
6. **归属留痕**：本 spec 由 Opus 定稿（E 内部临时交棒），已按 § 六 打 git notes + `mtc-E/spec-opus` tag；Codex 开工后自己的 commit 不强制加 notes，但 M7 归属锚点 `mtc-E/m7-codex` 必须打

---

## 2. 执行顺序（定稿）

```
M2a (Alembic 骨架 + init_db 退役) 
  ↓
M2b (members 字段迁移 + ORM 同步)
  ↓
M1  (Pydantic 三态校验 + 冲突检测)
  ↓
M3  (全局异常 + envelope + request_id + JSON 日志)
  ↓
M4  (HTTPException 批量替换为领域异常)
  ↓
M5  (MinIO 两阶段上传 + 私有下载)
  ↓
M6  (TTS 工程化 + Celery 基建 + 克隆占位)
  ↓
M7  (compose 收尾 + 前端 types PR + E 完成文档)
```

**关键顺序锁**：
- **M2a 必须先于 M1**：schema 单一入口要先建立
- **M2b 必须先于 M1**（已由第 3 节讨论反转；防 M1 改 model 后 DB 没列导致 `UndefinedColumnError`）
- **M3 必须先于 M4**：全局 handler 桥接先到位，M4 才能逐步替换不 break
- **M5 可与 M6 并行**（不建议，顺序更清）；M7 必须最后

| Milestone | 典型工时估 | 阻塞依赖 |
|---|---|---|
| M2a | 0.5 day | 无 |
| M2b | 1 day | M2a |
| M1 | 1 day | M2b |
| M3 | 1 day | M2a |
| M4 | 0.5 day | M3 |
| M5 | 1.5 day | M3（error envelope）|
| M6 | 1.5 day | M3 |
| M7 | 1 day | 以上全部 |

工时仅供 Codex writing-plans 参考，不作 DoD。

---

## 3. 数据模型与 API 兼容契约

### 3.1 Members 新旧字段策略

**新字段（长期）**：
- `status: Literal["active", "passed", "distant", "pet", "other"]`
- `end_year: int | None`（可选；语义 = 这段关系 / 人生章节的节点年份）

**旧字段（影子，保留一个 release 周期）**：
- `is_alive: bool`（原 NOT NULL，M2b 必须 DROP NOT NULL）
- `death_year: int | None`

**单一真相**：
- 业务语义以新字段为准
- 旧字段 = 兼容输出（响应派生）+ 历史输入归一化（请求降级）
- **不允许双写漂移**；所有写入路径只写新字段；影子列 M2b 回填后永不更新
- 响应里的 `is_alive / death_year` 由 Pydantic `@computed_field` 或 `model_serializer` 从 `status / end_year` 派生

### 3.2 请求侧归一化规则

按以下优先级处理：

1. **新字段优先**：请求带 `status / end_year` 时直接使用
2. **旧字段降级**（仅当新字段 key 不存在或值为 `null`）：
   - `is_alive=true` → `status='active'`
   - `is_alive=false AND death_year is null` → `status='passed'`
   - `is_alive=false AND death_year is not null` → `status='passed'`，且若 `end_year` 未提供则 `end_year=death_year`
3. **冲突即 422**（详见 § 5.2 冲突规则）

### 3.3 三态判定（key 不存在 / null / 空串）

对 `status` / `end_year` / `is_alive` / `death_year` 四个字段统一处理：

| 输入状态 | 判定 | 行为 |
|---|---|---|
| key 不存在（`'status' not in raw`） | 缺失 | 走旧字段降级路径 |
| 显式 `null`（`raw.get('status') is None` 且 key 存在） | 等同缺失 | 走旧字段降级路径（不引入"清空意图"第三语义） |
| 空字符串 `""`（含全空白） | 验证错误 | 直接 422，`VALIDATION_EMPTY_<FIELD>` |

**int 字段（`end_year` / `death_year`）**：前端传字符串 `""` 时 Pydantic v2 `mode="before"` validator 能拦到，按空串规则处理；`null` 按缺失；数字越界（比如年份 < 0 或 > 当前年 + 1）由普通 Pydantic 约束处理，`VALIDATION_*` 族错误码。

### 3.4 Create / Update 双模式

同一 normalize validator 被两个 schema 复用，但行为不同：

| 模式 | 适用 schema | 规则 |
|---|---|---|
| **Create** | `MemberCreate` | 归一化后 `status` 仍缺失 → 抛 `VALIDATION_REQUIRED_STATUS`（422）|
| **Update** | `MemberUpdate` / PATCH body | 若四个字段**都**未提供 → 跳过归一化与冲突检测，直接放行；若提供任一字段 → 照常跑归一化 + 冲突检测（可能要求前端一次性补齐相关字段以通过校验） |

Validator 实现：两个 schema 共享同一归一化函数，差异通过参数或子类属性区分（详见 § 5.4）。

### 3.5 影子列契约（DB 层生命周期）

| 时点 | 影子列状态 | 备注 |
|---|---|---|
| **M2b migration 执行时** | 从旧数据**一次性回填**，得到历史快照 | `is_alive=TRUE` / `death_year` 原值保留 |
| **M2b 完成后所有 INSERT** | ORM **不写**影子列 | 影子列对新 record 落为 `NULL`（必须 DROP NOT NULL） |
| **M2b 完成后所有 UPDATE** | ORM **不写**影子列 | 影子列永远停留在 M2b 回填那一刻 |
| **响应里的 `is_alive / death_year`** | 从 `status / end_year` **派生** | **不读** DB 影子列 |
| **Phase 2**（B brainstorm 前的 cleanup PR） | 随 cleanup migration 一起 `DROP COLUMN` | 配套删除响应派生字段 |

**影子列的唯一价值**：Phase 2 前若决定回滚或延后，它是数据安全的 basis；日常没人读它。

**M2b migration 的 NOT NULL 处理**（硬要求）：

```sql
-- M2b migration 必须包含
ALTER TABLE members ALTER COLUMN is_alive DROP NOT NULL;
-- death_year 若原本就 NULLABLE 则无需处理
```

### 3.6 Media 子域数据模型

M5 引入两张新表（若 `media_assets` 已有，只扩补缺失字段；若无则新建）：

#### 3.6.1 `media_upload_sessions`

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `upload_id` | UUID | PK | 业务主键，一次会话一个 UUID；前端持有此值直到 complete |
| `owner_id` | UUID | FK → users, NOT NULL | 归属用户；init 时从 JWT 取 |
| `archive_id` | UUID? | FK → archives, NULLABLE | 可选业务关联 |
| `member_id` | UUID? | FK → members, NULLABLE | 可选业务关联 |
| `purpose` | VARCHAR(32) | NOT NULL + CHECK | 见 § 7.2 枚举 |
| `object_key` | VARCHAR(512) | NOT NULL, UNIQUE | MinIO 对象键；服务端生成 |
| `content_type` | VARCHAR(128) | NOT NULL | 从 init 请求带入 |
| `declared_size` | BIGINT | NOT NULL + CHECK(>0) | init 入参；pre-flight 校验用 |
| `status` | VARCHAR(16) | NOT NULL + CHECK, DEFAULT 'initiated' | `initiated` / `uploaded` / `expired` / `aborted` |
| `expires_at` | TIMESTAMPTZ | NOT NULL | init 时 + TTL；超过即 expired |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| `completed_at` | TIMESTAMPTZ | NULLABLE | complete 成功时写入 |

**索引**：
- `owner_id`（查询"我的上传"）
- `expires_at`（清理过期 session 用）
- `status` + `expires_at` 联合（后台清理任务走）

#### 3.6.2 `media_assets`

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | UUID | PK | 业务主键 `media_id` |
| `owner_id` | UUID | FK → users, NOT NULL | |
| `source_upload_session_id` | UUID | FK → media_upload_sessions, NULLABLE | 反向关联 |
| `object_key` | VARCHAR(512) | NOT NULL, UNIQUE | 与 session 的 object_key 一致 |
| `bucket` | VARCHAR(64) | NOT NULL | 默认取 config `MINIO_DEFAULT_BUCKET` |
| `content_type` | VARCHAR(128) | NOT NULL | |
| `size` | BIGINT | NOT NULL + CHECK(>0) | 从 head_object 或 declared |
| `sha256` | VARCHAR(64) | NULLABLE | 可选；E 阶段 backlog（不阻塞 M5 DoD）|
| `purpose` | VARCHAR(32) | NOT NULL + CHECK | 继承 session |
| `visibility` | VARCHAR(16) | NOT NULL, DEFAULT 'private' | 全部私有；预留字段 |
| `archive_id` | UUID? | FK → archives, NULLABLE | |
| `member_id` | UUID? | FK → members, NULLABLE | |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

**索引**：
- `owner_id`（"我的素材"）
- `object_key`（UNIQUE 已隐含，但显式加便于反查）
- `archive_id`（"此档案的所有素材"）
- `member_id`（"此人物的所有素材"）

---

## 4. 数据库生命周期与迁移策略

### 4.1 单一 schema 入口（硬约束）

- `app/main.py` 的 `lifespan` 里**删除** `init_db()` 与 `create_all()` 的定义及所有调用点
- lifespan 保留真正的运行期职责（连接池初始化、后台 task 注册、httpx client 准备等）
- 测试 fixture（`conftest.py`）改为 `alembic upgrade head`，不走 `create_all`
- grep 断言：`rg 'create_all|metadata.create' backend/` 在 M2a 完成后应无业务代码命中（测试文件除外，且测试也不允许用它建表）

### 4.2 M2a · Alembic 工程骨架

**目录结构**：

```
backend/
  alembic.ini
  alembic/
    env.py
    script.py.mako
    versions/
      <hash>_baseline_existing_schema.py
  app/
    main.py
    models/
      __init__.py   ← 所有 model re-export 集中地
      ...
```

**`env.py` 关键约束**：

```python
from app.database import Base
from app import models  # 触发所有 model 模块导入；见 models/__init__.py

target_metadata = Base.metadata
# 不要写 target_metadata = None
```

`app/models/__init__.py` 必须 `from .user import *; from .member import *; from .archive import *; ...` 或等价做法，确保 `Base.metadata` 覆盖所有业务表。**验收断言**：M2a baseline migration 生成后，grep 所有业务表名在 migration 文件里都出现。

**Baseline migration 策略**：

- 生成"**完整建表**"版本（不是空 stamp）
- 新环境：`alembic upgrade head` 一步建库
- 已有 DB（你本地现在就是）：先 `alembic stamp <baseline_revision>` 标记 baseline 已应用，再 `alembic upgrade head`
- 后续拉新 migration：幂等 `alembic upgrade head`

**开发文档（`backend/README.md`）必须写清**：

```
# 首次启动（空库）
cd backend
alembic upgrade head
uvicorn app.main:app --reload

# 已有 DB（第一次接入 alembic）
cd backend
alembic stamp <baseline_revision>
alembic upgrade head
uvicorn app.main:app --reload

# 拉新 migration 后
cd backend
alembic upgrade head

# 禁止
python -c "from app.database import Base; Base.metadata.create_all(engine)"  # ← 违规
```

**backend compose command 落地**（与 M7 compose 修复衔接，但 command 本身在 M2a 就要改）：

```yaml
backend:
  command: >
    sh -c "alembic upgrade head && 
           uvicorn app.main:app --host 0.0.0.0 --port 8000 ${UVICORN_EXTRA_ARGS:---reload}"
```

或抽 `backend/entrypoint.sh`（推荐）：

```bash
#!/usr/bin/env sh
set -e
alembic upgrade head
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 ${UVICORN_EXTRA_ARGS:---reload}
```

并在 `infra/docker-compose.yml` 里 `command: ["/app/entrypoint.sh"]`。

### 4.3 M2b · Members 字段迁移

**Migration 主体骨架**（供 writing-plans 细化）：

```python
# alembic/versions/<hash>_members_status_end_year.py

def upgrade() -> None:
    # 1. 新增列
    op.add_column('members', sa.Column('status', sa.String(16), nullable=True))
    op.add_column('members', sa.Column('end_year', sa.Integer(), nullable=True))

    # 2. 回填数据
    op.execute("""
        UPDATE members
        SET status = CASE
            WHEN is_alive = TRUE THEN 'active'
            WHEN is_alive = FALSE THEN 'passed'
            ELSE 'other'
        END,
        end_year = CASE
            WHEN death_year IS NOT NULL THEN death_year
            ELSE end_year
        END;
    """)

    # 3. 新列约束
    op.alter_column('members', 'status', nullable=False)
    op.create_check_constraint(
        'ck_members_status_enum',
        'members',
        "status IN ('active','passed','distant','pet','other')"
    )

    # 4. 影子列 DROP NOT NULL（关键）
    op.alter_column('members', 'is_alive', nullable=True)

    # 5. 索引（新字段可能参与查询）
    op.create_index('ix_members_status', 'members', ['status'])

def downgrade() -> None:
    op.drop_index('ix_members_status', table_name='members')
    op.alter_column('members', 'is_alive', nullable=False)  # 若存在 NULL record，此步会失败——属预期
    op.drop_constraint('ck_members_status_enum', 'members', type_='check')
    op.drop_column('members', 'end_year')
    op.drop_column('members', 'status')
```

**ORM 同步（M2b 内必须）**：

```python
# app/models/member.py
class Member(Base):
    __tablename__ = 'members'
    # ... 原有字段 ...
    is_alive: Mapped[bool | None] = mapped_column(Boolean, nullable=True)  # ← DROP NOT NULL 后
    death_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # 新增
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    end_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
```

**M2b 验收**：
- `alembic upgrade head` 执行成功
- `SELECT status, is_alive, end_year, death_year FROM members LIMIT 5;` 能看到回填结果
- 新 INSERT 不写 `is_alive / death_year` 不报错
- ORM 读 Member 能同时访问新旧 4 列

### 4.4 downgrade 策略

- **原则**：能写 downgrade 必须写
- **不可逆的 migration** 显式：
  ```python
  def downgrade() -> None:
      raise NotImplementedError(
          "此 migration 删除了历史列；恢复路径：从 pg_dump 快照恢复。"
          "相关脚本：scripts/pg_dump_snapshot.sh"
      )
  ```
- **配套工具**：`scripts/pg_dump_snapshot.sh` 或等价 Makefile target `make db-snapshot`，供开发者在跑重要 migration 前手动备份
- **M2b 本身有 downgrade**（上文示例）；**Phase 2 的 cleanup migration**（drop 影子列）**必须标注不可逆**

### 4.5 索引与约束建议

Baseline 完成后如发现历史 schema 缺以下索引，在 M2b 或后续顺手加（不超出 E 范围的前提）：

| 表 | 索引 | 理由 |
|---|---|---|
| `members` | `owner_id` | "我的 members" 列表 |
| `members` | `status` | 按状态过滤（M2b 新增）|
| `archives` | `owner_id` | 同上 |
| `media_upload_sessions` | `owner_id`, `expires_at`, `(status, expires_at)` | § 3.6.1 已列 |
| `media_assets` | `owner_id`, `archive_id`, `member_id` | § 3.6.2 已列 |

---

## 5. M1 · 请求校验与冲突检测

### 5.1 异常类型层级

```python
# app/core/exceptions.py

class MTCDomainError(Exception):
    """MTC 所有领域异常的共同基类；见 § 6.2。"""
    error_code: str
    message: str
    fields: list[str] | None = None
    http_status: int = 500

    def __init__(
        self,
        error_code: str,
        message: str,
        fields: list[str] | None = None,
    ) -> None:
        self.error_code = error_code
        self.message = message
        self.fields = fields
        super().__init__(message)


class DomainInputError(MTCDomainError):
    http_status = 422


class FieldValidationError(DomainInputError):
    """单字段验证失败：空串 / 格式不合法 / 长度越界等。error_code 前缀 VALIDATION_*"""


class FieldConflictError(DomainInputError):
    """跨字段语义冲突：新字段 vs 旧字段矛盾。error_code 前缀 FIELD_CONFLICT_*"""
```

### 5.2 关键 error_code（M1 范围）

| error_code | HTTP | 触发条件 |
|---|---|---|
| `VALIDATION_EMPTY_STATUS` | 422 | `status == ""` 或全空白 |
| `VALIDATION_EMPTY_END_YEAR` | 422 | `end_year == ""` |
| `VALIDATION_EMPTY_DEATH_YEAR` | 422 | `death_year == ""` |
| `VALIDATION_REQUIRED_STATUS` | 422 | Create 模式下归一化后 `status` 仍缺失 |
| `VALIDATION_INVALID_STATUS_VALUE` | 422 | `status` 值不在 5 枚举内 |
| `VALIDATION_INVALID_YEAR_RANGE` | 422 | `end_year / death_year` 数值越界（< 1900 或 > 当前年 + 1 作为参考；阈值由 M1 定）|
| `FIELD_CONFLICT_STATUS_IS_ALIVE` | 422 | `status='active' AND is_alive=false` |
| `FIELD_CONFLICT_STATUS_DEATH_YEAR` | 422 | `status != 'passed' AND death_year is not None` |
| `FIELD_CONFLICT_END_YEAR_DEATH_YEAR` | 422 | `end_year is not None AND death_year is not None AND end_year != death_year` |

### 5.3 Validator 职责边界

| 层 | 职责 | 禁止 |
|---|---|---|
| **Pydantic validator**（M1 本体） | 请求 payload **内部**一致性；归一化；三态判定；冲突检测 | **禁止**查 DB；**禁止**调用 service |
| **Service 层**（M1 内附带落实） | 对 merged record（DB 原值 + patch 更新后）再做一致性检查；发现问题抛**同样的** `FieldConflictError` | DB 写入前的最后一道闸 |
| **Database 层 CHECK constraint**（M2b） | 兜底数据正确性（例：status 必在枚举内） | 不替代 validator |

### 5.4 Validator 伪代码（Create / Update 双模式）

```python
# app/api/schemas/member.py

from pydantic import BaseModel, model_validator
from typing import Literal, ClassVar
from app.core.exceptions import FieldValidationError, FieldConflictError

StatusValue = Literal["active", "passed", "distant", "pet", "other"]


def _normalize_member_payload(raw: dict, *, mode: Literal["create", "update"]) -> dict:
    """归一化 + 冲突检测。mode='create' 要求归一化后 status 必须存在。"""
    data = dict(raw or {})

    # ---- 1. 空字符串预处理（三态判定第三态）----
    for field in ("status", "end_year", "death_year"):
        v = data.get(field, _MISSING)
        if isinstance(v, str) and v.strip() == "":
            raise FieldValidationError(
                error_code=f"VALIDATION_EMPTY_{field.upper()}",
                message=f"{field} 不能为空字符串",
                fields=[field],
            )

    # ---- 2. 三态统一化：缺失 / 显式 null → 视为未提供 ----
    def provided(field: str) -> bool:
        """field 既存在于 raw 且值非 None；其他情况视为未提供。"""
        return field in data and data[field] is not None

    # ---- 3. Update 模式：四个字段全未提供则跳过 ----
    state_fields = ("status", "end_year", "is_alive", "death_year")
    if mode == "update" and not any(provided(f) for f in state_fields):
        return data

    # ---- 4. 新字段缺失时的旧字段降级 ----
    if not provided("status"):
        if data.get("is_alive") is True:
            data["status"] = "active"
        elif data.get("is_alive") is False:
            data["status"] = "passed"
            if not provided("end_year") and provided("death_year"):
                data["end_year"] = data["death_year"]

    # ---- 5. Create 模式：归一化后仍缺 status → 必填错误 ----
    if mode == "create" and not provided("status"):
        raise FieldValidationError(
            error_code="VALIDATION_REQUIRED_STATUS",
            message="创建 member 必须提供 status（或可推导的 is_alive）",
            fields=["status", "is_alive"],
        )

    # ---- 6. 冲突检测 ----
    status = data.get("status")
    is_alive = data.get("is_alive")
    death_year = data.get("death_year")
    end_year = data.get("end_year")

    if status == "active" and is_alive is False:
        raise FieldConflictError(
            error_code="FIELD_CONFLICT_STATUS_IS_ALIVE",
            message="status='active' 与 is_alive=false 语义矛盾",
            fields=["status", "is_alive"],
        )

    if status is not None and status != "passed" and death_year is not None:
        raise FieldConflictError(
            error_code="FIELD_CONFLICT_STATUS_DEATH_YEAR",
            message=f"status='{status}' 与 death_year 有值矛盾；死亡年份应配合 status='passed'",
            fields=["status", "death_year"],
        )

    if end_year is not None and death_year is not None and end_year != death_year:
        raise FieldConflictError(
            error_code="FIELD_CONFLICT_END_YEAR_DEATH_YEAR",
            message=f"end_year={end_year} 与 death_year={death_year} 数值不一致",
            fields=["end_year", "death_year"],
        )

    return data


class MemberCreate(BaseModel):
    name: str
    status: StatusValue | None = None
    end_year: int | None = None
    is_alive: bool | None = None
    death_year: int | None = None
    # ... 其他字段 ...

    @model_validator(mode="before")
    @classmethod
    def _normalize(cls, raw):
        return _normalize_member_payload(raw, mode="create")


class MemberUpdate(BaseModel):
    name: str | None = None
    status: StatusValue | None = None
    end_year: int | None = None
    is_alive: bool | None = None
    death_year: int | None = None
    # ... 其他字段 ...

    @model_validator(mode="before")
    @classmethod
    def _normalize(cls, raw):
        return _normalize_member_payload(raw, mode="update")


_MISSING = object()  # sentinel
```

### 5.5 最小测试矩阵（M1 DoD 必测）

| # | Case | 期望 |
|---|---|---|
| 1 | Create：`status="active"` 单独 | 通过 |
| 2 | Create：`is_alive=true` 单独 | 通过，内部 `status='active'` |
| 3 | Create：仅 `name` | 422 `VALIDATION_REQUIRED_STATUS` |
| 4 | Create：`status=""` | 422 `VALIDATION_EMPTY_STATUS` |
| 5 | Create：`status=null` + `is_alive=true` | 通过，null 视为缺失 |
| 6 | Create：`status="active"` + `is_alive=false` | 422 `FIELD_CONFLICT_STATUS_IS_ALIVE` |
| 7 | Create：`status="distant"` + `death_year=2020` | 422 `FIELD_CONFLICT_STATUS_DEATH_YEAR` |
| 8 | Create：`is_alive=false` + `death_year=2020` | 通过，`status='passed'`, `end_year=2020` |
| 9 | Create：`end_year=2019` + `death_year=2020` | 422 `FIELD_CONFLICT_END_YEAR_DEATH_YEAR` |
| 10 | Create：`status="passed"` + `is_alive=false` + `end_year=2020` + `death_year=2020` | 通过（一致情形）|
| 11 | Update：仅 `name` | 通过，状态字段不动 |
| 12 | Update：`end_year=""` | 422 `VALIDATION_EMPTY_END_YEAR` |
| 13 | Update：`status="distant"`（且 DB 原 `status='active'`）| 通过；若原有 `death_year` 则由 Service 层检测冲突 |
| 14 | Update：所有四字段显式 `null` | 等同全未提供 → 通过，不动 |

测试框架：`pytest` + FastAPI `TestClient`；直接 POST / PATCH 到路由；断言 HTTP status + response `error_code`。

---

## 6. M3 / M4 · 全局异常与结构化日志

### 6.1 统一错误响应 envelope

**所有** 4xx / 5xx 响应：

```json
{
  "error_code": "FIELD_CONFLICT_STATUS_IS_ALIVE",
  "message": "status='active' 与 is_alive=false 语义矛盾",
  "fields": ["status", "is_alive"],
  "request_id": "b3f1c2e0-8a4d-4e7a-9c1b-6e2d5f3a8b90"
}
```

- 覆盖范围：业务异常 + FastAPI `HTTPException` + Pydantic `RequestValidationError` + 未捕获 `Exception`（500）
- `fields` 仅当异常带了才有；省略字段合法
- `request_id` 始终存在（见 § 6.4）
- **成功响应暂不强制统一 envelope**（避免 E 改动面过大；维持现有业务返回形态）

### 6.2 顶层异常类层级

```python
# app/core/exceptions.py

class MTCDomainError(Exception):
    error_code: str
    message: str
    fields: list[str] | None = None
    http_status: int = 500

    def __init__(self, error_code, message, fields=None):
        self.error_code = error_code
        self.message = message
        self.fields = fields
        super().__init__(message)


class DomainInputError(MTCDomainError):     # 422
    http_status = 422

class FieldValidationError(DomainInputError):  # VALIDATION_*
    pass

class FieldConflictError(DomainInputError):    # FIELD_CONFLICT_*
    pass


class DomainAuthError(MTCDomainError):      # 401 / 403
    http_status = 401   # 子类覆盖；AUTH_* 族

class DomainResourceError(MTCDomainError):  # 404 / 409
    http_status = 404   # RESOURCE_*

class DomainMediaError(MTCDomainError):     # media 专用
    http_status = 422   # MEDIA_*，子类可覆盖到 404/409/503 等

class DomainInternalError(MTCDomainError):  # 500
    http_status = 500   # INTERNAL_*
```

**全局 handler 注册**（只需要一个）：

```python
# app/api/middleware/exception_handler.py

@app.exception_handler(MTCDomainError)
async def handle_domain_error(request: Request, exc: MTCDomainError):
    return JSONResponse(
        status_code=exc.http_status,
        content={
            "error_code": exc.error_code,
            "message": exc.message,
            "fields": exc.fields,
            "request_id": request.state.request_id,
        },
        headers={"X-Request-ID": request.state.request_id},
    )
```

### 6.3 HTTPException 桥接策略（M3 桥 + M4 替换）

**M3 桥接**（一次性搭好，保留现有 `raise HTTPException(...)` 不改业务）：

```python
STATUS_TO_CODE_FALLBACK: dict[int, str] = {
    401: "AUTH_UNAUTHORIZED",
    403: "AUTH_FORBIDDEN",
    404: "RESOURCE_NOT_FOUND",
    405: "VALIDATION_METHOD_NOT_ALLOWED",
    409: "RESOURCE_CONFLICT",
    422: "VALIDATION_FAILED",
    429: "RATE_LIMIT_EXCEEDED",
    500: "INTERNAL_SERVER_ERROR",
    503: "SERVICE_UNAVAILABLE",
}

@app.exception_handler(HTTPException)
async def handle_http_exception(request, exc: HTTPException):
    code = STATUS_TO_CODE_FALLBACK.get(
        exc.status_code,
        f"HTTP_{exc.status_code}",
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error_code": code,
            "message": str(exc.detail),
            "request_id": request.state.request_id,
        },
        headers={"X-Request-ID": request.state.request_id},
    )


@app.exception_handler(RequestValidationError)
async def handle_pydantic_validation(request, exc: RequestValidationError):
    # Pydantic 字段级 422；提炼 fields 列表
    fields = list({str(err["loc"][-1]) for err in exc.errors()})
    return JSONResponse(
        status_code=422,
        content={
            "error_code": "VALIDATION_FAILED",
            "message": "请求参数校验失败",
            "fields": fields,
            "request_id": request.state.request_id,
        },
        headers={"X-Request-ID": request.state.request_id},
    )


@app.exception_handler(Exception)
async def handle_unhandled(request, exc: Exception):
    # 500 兜底，log 完整堆栈但 response 不暴露
    logger.error("unhandled_exception", exc_info=exc, extra={"request_id": request.state.request_id})
    return JSONResponse(
        status_code=500,
        content={
            "error_code": "INTERNAL_SERVER_ERROR",
            "message": "服务内部错误",
            "request_id": request.state.request_id,
        },
        headers={"X-Request-ID": request.state.request_id},
    )
```

**M4 替换**：
- `grep 'raise HTTPException' backend/app/api/` 找出所有散落点
- 按业务语义替换为 `DomainAuthError / DomainResourceError / DomainInputError` 子类
- M4 DoD：grep 命中数从 M3 末期的 N 降到 0（或合理小于 N，剩余的标注理由）

### 6.4 request_id 规范

**Middleware**（M3 首件事）：

```python
# app/api/middleware/request_id.py

class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        rid = request.headers.get("X-Request-ID") or str(uuid4())
        request.state.request_id = rid
        response = await call_next(request)
        response.headers["X-Request-ID"] = rid
        return response
```

- 前端传 `X-Request-ID` 则沿用（链路追踪场景）
- 未传则后端生成 UUID4
- **所有** error response body 必须含 `request_id`
- **所有** response header 必须回显 `X-Request-ID`（不只是错误场景）

### 6.5 JSON 结构化日志字段与脱敏

**必选字段**（9 个，所有访问日志统一）：

| 字段 | 类型 | 来源 |
|---|---|---|
| `request_id` | str | middleware |
| `user_id` | str? | JWT / session（未登录为 null）|
| `path` | str | request.url.path |
| `method` | str | request.method |
| `status_code` | int | response.status_code |
| `error_code` | str? | 错误时填充；成功为 null |
| `latency_ms` | int | middleware 计时 |
| `client_ip` | str | request.client.host（注意 X-Forwarded-For 代理情况）|
| `user_agent` | str? | request.headers.get("User-Agent") |

**实现**：`python-json-logger` 或 `loguru` 任选；关键是输出为一行 JSON，可被 Loki / ES / CloudWatch 直接 ingest。

**PII 脱敏 baseline**：

| 范畴 | 默认行为 |
|---|---|
| 请求 body | **不记录**（除非 env `LOG_REQUEST_BODY=true`，仅 dev / debug）|
| 响应 body | **不记录** |
| 错误 `fields` 列表 | **只记字段名**，不记字段值（例：记 `["status", "is_alive"]`，不记 `{"status":"passed","is_alive":true}`）|
| Request headers | 白名单通过：`X-Request-ID`, `User-Agent`, `Content-Type`；其他默认不记录 |
| 敏感 header | **永不记录**：`Authorization`, `Cookie`, `X-API-Key`, `X-Auth-Token` |

### 6.6 日志级别分层

| 异常族 / 场景 | level | 备注 |
|---|---|---|
| `FieldValidationError` / `FieldConflictError`（422）| `warning` | 频繁但非系统问题 |
| `DomainAuthError`（401 / 403）| `warning` | 未登录合理；403 连续发生可升 `error` |
| `DomainResourceError`（404 / 409）| `info` | 404 太频繁可降 `debug` |
| `DomainMediaError` 含 `MEDIA_TTS_PROVIDER_UNAVAILABLE` / 超时 | `warning` | |
| `DomainInternalError` / 未捕获 `Exception`（500）| `error` | 必须附 `exc_info` 完整堆栈 |
| 成功请求 | `info` | 可通过 env 降噪（例 `LOG_SUCCESS=false`）|

### 6.7 Logger 命名空间

按 FastAPI 模块分层，便于过滤与聚合：

```
mtc.api.members         # app/api/routes/members.py
mtc.api.archives        # app/api/routes/archives.py
mtc.api.media           # app/api/routes/media.py
mtc.api.auth            # app/api/routes/auth.py
mtc.services.voice      # app/services/voice.py
mtc.services.media      # app/services/media.py
mtc.workers.celery      # celery worker 进程
mtc.workers.tasks.*     # 具体 celery task
mtc.middleware          # middleware 全局
mtc.db                  # ORM / alembic 运行期日志
```

每个模块文件顶部：

```python
import logging
logger = logging.getLogger(__name__.replace("app.", "mtc."))
```

或按约定统一用 `logging.getLogger("mtc.api.members")`。

### 6.8 M3 / M4 集成测试要求

每个 error_code 族至少一条集成测试（FastAPI `TestClient` 真走 handler；不 mock 中间层）：

| 族 | 最少 case 数 | 必覆盖 |
|---|---|---|
| `VALIDATION_*` | 3 | `VALIDATION_EMPTY_STATUS`, `VALIDATION_REQUIRED_STATUS`, `VALIDATION_FAILED`（Pydantic 自动触发）|
| `FIELD_CONFLICT_*` | 3 | 三条冲突规则各一 |
| `AUTH_*` | 1 | `AUTH_UNAUTHORIZED`（401 桥接验证）|
| `RESOURCE_*` | 1 | `RESOURCE_NOT_FOUND`（404 桥接验证）|
| `INTERNAL_*` | 1 | 主动 `raise DomainInternalError(...)`，断言 500 + envelope + 堆栈进 log |

断言项：HTTP status / response JSON 的 `error_code` / `fields`（如有） / response header `X-Request-ID` 非空 / response body 的 `request_id` 与 header 一致。

---

## 7. M5 · 媒体上传与私有下载

### 7.1 接口定义

| Method + Path | 鉴权 | 用途 |
|---|---|---|
| `POST /api/v1/media/uploads/init` | 必须（JWT）| 申请上传凭证 |
| `POST /api/v1/media/uploads/complete` | 必须 | 回执上传成功并落 media_asset |
| `GET /api/v1/media/{media_id}/download-url` | 必须 | 获取私有桶预签名 GET URL |

#### POST /api/v1/media/uploads/init

**Request**：
```json
{
  "filename": "grandma_voice.wav",
  "content_type": "audio/wav",
  "size": 5242880,
  "purpose": "voice_sample",
  "archive_id": "...",   // optional
  "member_id": "..."     // optional
}
```

**Response 200**：
```json
{
  "upload_id": "<uuid>",
  "object_key": "<user_id>/2026/04/<uuid>-grandma_voice.wav",
  "put_url": "https://minio.../...?X-Amz-Signature=...",
  "expires_in": 3600,
  "required_headers": {
    "Content-Type": "audio/wav"
  }
}
```

#### POST /api/v1/media/uploads/complete

**Request**：
```json
{
  "upload_id": "<uuid>",
  "object_key": "...",        // 必须与 init 返回的一致
  "etag": "\"...\"",          // optional，比对用
  "size": 5242880             // optional，比对用
}
```

**Response 200**（首次成功 / 幂等重放同 body）：
```json
{
  "media_id": "<uuid>",
  "object_key": "...",
  "status": "uploaded"
}
```

#### GET /api/v1/media/{media_id}/download-url

**Response 200**：
```json
{
  "get_url": "https://minio.../...?X-Amz-Signature=...",
  "expires_in": 3600
}
```

### 7.2 `purpose` 枚举与 content_type 白名单

```python
class UploadPurpose(str, Enum):
    AVATAR = "avatar"
    VOICE_SAMPLE = "voice_sample"
    ARCHIVE_PHOTO = "archive_photo"
    ARCHIVE_VIDEO = "archive_video"
    ARCHIVE_AUDIO = "archive_audio"
    OTHER = "other"
```

**purpose × content_type 白名单**（init 时校验）：

| purpose | 允许的 content_type |
|---|---|
| `avatar` | `image/jpeg`, `image/png`, `image/webp` |
| `archive_photo` | `image/jpeg`, `image/png`, `image/webp`, `image/heic` |
| `archive_audio` / `voice_sample` | `audio/mpeg`, `audio/wav`, `audio/ogg`, `audio/mp4`, `audio/webm` |
| `archive_video` | `video/mp4`, `video/webm`, `video/quicktime` |
| `other` | 任何 `image/* \| audio/* \| video/*`；不允许 `application/*` 等非媒体 |

不在白名单 → `MEDIA_UPLOAD_INIT_INVALID_TYPE`。

### 7.3 大小上限（配置化）

| purpose | 默认上限 | env 变量 |
|---|---|---|
| `avatar` | 5 MB | `MEDIA_MAX_SIZE_AVATAR_MB=5` |
| `archive_photo` | 20 MB | `MEDIA_MAX_SIZE_PHOTO_MB=20` |
| `archive_audio` / `voice_sample` | 100 MB | `MEDIA_MAX_SIZE_AUDIO_MB=100` |
| `archive_video` | 500 MB | `MEDIA_MAX_SIZE_VIDEO_MB=500` |

超限 → `MEDIA_UPLOAD_INIT_FILE_TOO_LARGE`。

### 7.4 `object_key` 生成规则

**格式**：`{user_id}/{yyyy}/{mm}/{uuid}-{sanitized_filename}`

`sanitized_filename` 规则：
- 去除路径分隔符（`/`, `\`）
- 空白字符替换为 `_`
- 保留：ASCII 字母数字、`-`、`.`、`_`、中日韩字符
- 其他字符（含 emoji）替换为 `_`
- 长度截断 100 字符（避免 MinIO 限制）
- 全空（如前端只传空格）→ 回退到 `file-{uuid_short}`

**硬约束**：`object_key` **必须由后端生成**；前端传 `filename` 只用于 sanitize 后拼进 key。前端**禁止**传完整 `object_key`。

### 7.5 complete 幂等与校验

**必做步骤**（按顺序）：

1. 查 `media_upload_sessions` by `upload_id`
   - 不存在 → `MEDIA_UPLOAD_COMPLETE_NOT_FOUND`（404）
2. 检查 `owner_id == current_user.id`
   - 不等 → `MEDIA_UPLOAD_COMPLETE_OWNERSHIP_MISMATCH`（403）
3. 检查 `object_key` 入参与 session 记录一致
   - 不等 → `MEDIA_UPLOAD_COMPLETE_OWNERSHIP_MISMATCH`（403，统一归到归属错）
4. 检查 `status`
   - `uploaded`：**幂等返回**——查 `media_assets` by session 返回既有 `media_id`（200 + 同 body）
   - `expired`：`MEDIA_UPLOAD_COMPLETE_EXPIRED`（410 或 422；建议 422 与家族一致）
   - `aborted`：同 expired 语义返回
5. 检查 `expires_at <= now()`
   - 已过 → 更新 session.status='expired'，返 `MEDIA_UPLOAD_COMPLETE_EXPIRED`
6. **强制** `MinIO.head_object(bucket, object_key)`
   - 404 → `MEDIA_UPLOAD_COMPLETE_OBJECT_MISSING`（422）
7. 若入参带 `etag / size`，比对 head_object 返回值
   - 不等 → `MEDIA_UPLOAD_COMPLETE_CHECKSUM_MISMATCH`（422）
8. 事务：
   - 写 `media_assets` 记录
   - 更新 `session.status='uploaded', completed_at=now()`
9. 返 200 + `{media_id, object_key, status:'uploaded'}`

### 7.6 MinIO 安全与 bucket policy

**TTL**：
- 预签名 PUT URL：3600s（1 小时）
- 预签名 GET URL：3600s（1 小时）

**签名条件**（MinIO SDK 的 `presigned_put_object` policy）：
- 签名中锁定 `bucket` + `object_key` 精确匹配（不允许 URL 被篡改后写到其他 key）
- 如 SDK 支持 content-type condition 一并锁

**Bucket policy**（初始化脚本 `scripts/minio_init.py` 或 M5 内一次性 MC 命令）：
- **默认私有**；无匿名读；无匿名写
- 应用层用 MinIO root / service account 凭证生成预签名 URL

**应用层兜底校验**（防 MinIO policy 疏漏）：
- complete 时 `object_key` 必须以 `{user_id}/` 开头（service 层验证）
- 不匹配 → `MEDIA_UPLOAD_COMPLETE_OWNERSHIP_MISMATCH`

### 7.7 数据模型

见 § 3.6.1 / § 3.6.2，M5 期间在 M2b 后续的 migration 中一起创建（新表，不涉及向下兼容）。

### 7.8 错误码族（M5）

| error_code | HTTP | 触发 |
|---|---|---|
| `MEDIA_UPLOAD_INIT_INVALID_TYPE` | 422 | content_type 不在 purpose 白名单 |
| `MEDIA_UPLOAD_INIT_INVALID_SIZE` | 422 | size ≤ 0 |
| `MEDIA_UPLOAD_INIT_FILE_TOO_LARGE` | 422 | size > purpose 上限 |
| `MEDIA_UPLOAD_INIT_INVALID_FILENAME` | 422 | filename 空 / sanitize 后仍非法 |
| `MEDIA_UPLOAD_INIT_INVALID_PURPOSE` | 422 | purpose 不在枚举 |
| `MEDIA_UPLOAD_COMPLETE_NOT_FOUND` | 404 | upload_id 不存在 |
| `MEDIA_UPLOAD_COMPLETE_OWNERSHIP_MISMATCH` | 403 | owner 不匹配 / object_key 与 session 不一致 |
| `MEDIA_UPLOAD_COMPLETE_EXPIRED` | 422 | session 已过期或 aborted |
| `MEDIA_UPLOAD_COMPLETE_OBJECT_MISSING` | 422 | head_object 404 |
| `MEDIA_UPLOAD_COMPLETE_CHECKSUM_MISMATCH` | 422 | etag / size 不匹配 |
| `MEDIA_PRESIGN_GET_NOT_FOUND` | 404 | media_id 不存在 |
| `MEDIA_PRESIGN_GET_FORBIDDEN` | 403 | media_id 归属他人 |

**注**：幂等的 complete 重复提交**不**作为错误码；200 + 同 body 返回。

### 7.9 老接口退役（命名空间隔离）

- **旧 `POST /media/upload`** 在 E 全程保留，仅添加 deprecation warning（response header `Deprecation: true` + log 告警）
- **物理删除时机**：**不**绑定 "members 字段 Phase 2"；独立称作 **"media 接口退役"**，触发条件 = B / C 子项目完成前端上传调用切换后的一次独立 cleanup PR
- **路线图跟踪**：建议在 `mtc-refactor-roadmap.mdc` § 五 下扩一个"基础设施弃用跟踪"小节，与 members 字段 Phase 0/1/2 分离管理；E 末期在收尾文档记一条 backlog 指向它

---

## 8. M6 · Voice（TTS 调通 + 克隆抽象 + Celery 占位）

### 8.1 范围边界

**做**：
- CosyVoice TTS 同步调用可用
- 超时 / 重试 / 限流 / 字符长度前置校验
- 结构化日志 + 错误码族齐全
- `VoiceProvider` 抽象接口（含 `synthesize` + `clone` 两个抽象方法）
- Celery 基建：broker / result backend / worker / 两个占位任务

**不做**：
- 真实 clone 训练链路（归 D）
- 克隆产物管理 / 状态轮询（归 D）
- 与对话业务的整合（归 D）

### 8.2 `VoiceProvider` 抽象

```python
# app/services/voice/provider.py

from abc import ABC, abstractmethod

class VoiceProvider(ABC):
    @abstractmethod
    def synthesize(
        self,
        text: str,
        voice_id: str | None = None,
        **options,
    ) -> bytes:
        """文本转语音，返回音频二进制。"""

    @abstractmethod
    def clone(
        self,
        sample: bytes,
        **options,
    ) -> str:
        """声音克隆，返回 voice_id。E 阶段所有实现都应 raise NotImplementedError。"""


# app/services/voice/cosyvoice.py

class CosyVoiceProvider(VoiceProvider):
    def __init__(self, config: CosyVoiceConfig):
        self.config = config
        self.client = build_httpx_client(config)

    def synthesize(self, text, voice_id=None, **options) -> bytes:
        # 真实实现；含超时 / 重试 / 限流见 § 8.3
        ...

    def clone(self, sample, **options) -> str:
        raise NotImplementedError(
            "CosyVoice clone 由 D 子项目实现；"
            "当前仅 TTS 基座可用。见 mtc-refactor-roadmap § 二·D"
        )
```

### 8.3 同步 TTS 路径（超时 / 重试 / 限流 / 长度）

**前置校验**：
- `text` 长度（含中文字符按字符数，不按字节）`> VOICE_MAX_TEXT_LENGTH` → `MEDIA_TTS_TEXT_TOO_LONG`（422）
- `text` 为空 / 仅空白 → `VALIDATION_EMPTY_TEXT`（422）
- `voice_id` 提供但不在已知 voice 列表 → `MEDIA_TTS_VOICE_NOT_FOUND`（404）

**并发限流**：
```python
# VoiceService 层，使用 asyncio.Semaphore
_tts_semaphore = asyncio.Semaphore(settings.VOICE_MAX_CONCURRENT_TTS)

async def synthesize(text, voice_id=None):
    try:
        await asyncio.wait_for(
            _tts_semaphore.acquire(),
            timeout=0.1,  # 立即判断是否超并发
        )
    except asyncio.TimeoutError:
        raise DomainMediaError(
            "MEDIA_TTS_QUOTA_EXCEEDED",
            "TTS 并发超过限制，请稍后重试",
        )
    try:
        return await provider.synthesize(text, voice_id)
    finally:
        _tts_semaphore.release()
```

**HTTPX client 配置**：
```python
httpx.AsyncClient(
    timeout=httpx.Timeout(
        connect=settings.COSYVOICE_CONNECT_TIMEOUT_SECONDS,
        read=settings.COSYVOICE_READ_TIMEOUT_SECONDS,
        write=10.0,
        pool=5.0,
    ),
    limits=httpx.Limits(max_connections=20),
)
```

**重试策略**（用 `tenacity` 或手写）：
- 触发条件：网络超时 / `5xx` 响应
- 次数：`COSYVOICE_RETRY_COUNT=2`
- 退避：指数退避，基数 `COSYVOICE_RETRY_BACKOFF_BASE_MS=200`，因子 2（200ms → 400ms），叠加 `±50ms` jitter
- `4xx` 不重试

### 8.4 Celery 基建

**选型**：
- Broker：**Redis**（MTC 已有；url: `redis://redis:6379/1`）
- Result backend：**Redis**（`redis://redis:6379/2`）
- Worker 进程：独立 docker service，**不跑 alembic upgrade**（见 § 3 / § 9）
- `task_always_eager=False`（即使 dev 也走真 broker）

**占位任务**（`app/workers/tasks/`）：

```python
# app/workers/tasks/healthcheck.py

@celery_app.task(name="mtc.tasks.healthcheck", time_limit=10, soft_time_limit=5)
def healthcheck_task() -> dict:
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


# app/workers/tasks/voice.py

@celery_app.task(
    name="mtc.tasks.voice_clone",
    time_limit=600,
    soft_time_limit=540,
    autoretry_for=(ProviderUnavailable,),
    max_retries=2,
    default_retry_delay=5,
)
def voice_clone_task(sample_media_id: str, **kwargs) -> dict:
    """E 阶段占位；D 子项目实现真实克隆。"""
    raise NotImplementedError(
        "voice_clone_task 由 D 子项目实现；"
        "E 阶段仅作为任务系统占位。"
    )
```

**任务超时**：
- `time_limit`（硬超时）：worker 强制杀进程
- `soft_time_limit`（软超时）：任务内可 catch `SoftTimeLimitExceeded` 做清理

**Worker 启动命令**：

```yaml
# infra/docker-compose.yml
celery-worker:
  command: celery -A app.workers.celery_app worker --loglevel=info --concurrency=4
  depends_on:
    backend:
      condition: service_healthy
    redis:
      condition: service_healthy
```

### 8.5 错误码族（M6）

| error_code | HTTP | 触发 |
|---|---|---|
| `MEDIA_TTS_PROVIDER_UNAVAILABLE` | 503 | CosyVoice 连接失败 / 5xx |
| `MEDIA_TTS_TIMEOUT` | 504 | read timeout 触发且重试耗尽 |
| `MEDIA_TTS_BAD_REQUEST` | 400 | CosyVoice 返回 4xx（例如无效 voice_id 参数）|
| `MEDIA_TTS_RESPONSE_INVALID` | 502 | CosyVoice 返回非音频 / 校验失败 |
| `MEDIA_TTS_TEXT_TOO_LONG` | 422 | text 长度超配置 |
| `MEDIA_TTS_VOICE_NOT_FOUND` | 404 | voice_id 不在已知 voice |
| `MEDIA_TTS_QUOTA_EXCEEDED` | 429 | 并发超限 |
| `MEDIA_VOICE_CLONE_NOT_IMPLEMENTED` | 501 | `NotImplementedError` 映射 |

---

## 9. M7 · 工程收尾

### 9.1 compose 路径与启动链

**build context 路径修复**（`infra/docker-compose.yml` 相对自身位置）：

```yaml
services:
  backend:
    build:
      context: ../backend       # 原 ./backend
      dockerfile: Dockerfile
    env_file: ../backend/.env
    volumes:
      - ../backend:/app

  frontend:
    build:
      context: ../frontend      # 原 ./frontend
      dockerfile: Dockerfile
    volumes:
      - ../frontend:/app
      - /app/node_modules

  celery-worker:
    build:
      context: ../backend       # 原 ./backend
    command: celery -A app.workers.celery_app worker --loglevel=info
    env_file: ../backend/.env
    volumes:
      - ../backend:/app
```

所有 `env_file` / `volumes` 路径同步检查为 `../backend/...` / `../frontend/...`。

### 9.2 backend entrypoint（dev / prod 参数化）

`backend/entrypoint.sh`：

```bash
#!/usr/bin/env sh
set -e

# 1. 运行 migration（幂等）
alembic upgrade head

# 2. 启动 uvicorn；dev 默认含 --reload，prod 置 UVICORN_EXTRA_ARGS=""
exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  ${UVICORN_EXTRA_ARGS:---reload}
```

Dockerfile 最后加 `RUN chmod +x entrypoint.sh && ENTRYPOINT ["/app/entrypoint.sh"]`。

dev 环境 docker-compose 不传 `UVICORN_EXTRA_ARGS` → 自动带 `--reload`；
prod override（未来独立工单）传 `UVICORN_EXTRA_ARGS="--workers 4"` 之类。

### 9.3 健康检查规范

**backend：** 实现 `GET /healthz`（不加 `/api/v1` 前缀；k8s 约定）：

```python
@router.get("/healthz", tags=["infra"])
async def healthz(db: AsyncSession = Depends(get_db)):
    checks = {}
    try:
        await db.execute(text("SELECT 1"))
        checks["db"] = "ok"
    except Exception as e:
        checks["db"] = f"fail: {e.__class__.__name__}"

    checks["config"] = "ok"  # 可扩展检查
    ok = all(v == "ok" for v in checks.values())
    status_code = 200 if ok else 503
    return JSONResponse(
        status_code=status_code,
        content={"status": "ok" if ok else "degraded", "checks": checks},
    )
```

**compose healthcheck 配置**：

```yaml
services:
  backend:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/healthz"]
      interval: 10s
      timeout: 3s
      retries: 10
      start_period: 60s   # 给 alembic upgrade 足够时间

  postgres:
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER"]
      interval: 5s
      timeout: 3s
      retries: 10

  redis:
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10

  celery-worker:
    depends_on:
      backend:
        condition: service_healthy
      redis:
        condition: service_healthy
```

**worker 自身健康**：通过 `celery -A app.workers.celery_app inspect ping` 或 `healthcheck_task.delay().get(timeout=5)` 验证。

### 9.4 前端类型适配 PR 边界

**第一步：判断类型维护方式**
- `cd frontend && cat package.json | grep -E 'openapi-typescript|orval|swagger-typescript-api'`
- 若有 codegen：第一动作是**重新生成 API client types**，再基于此 cascade 业务类型
- 若手写：直接改 `frontend/src/types/*.ts`

**允许改动**：
- `frontend/src/types/*.ts`（新字段接口定义；deprecated 旧字段标注）
- 少量 `frontend/src/services/*.ts` / `frontend/src/api/*.ts` 类型映射调整（**不改业务语义**）
- 为了 `tsc --noEmit` 通过的必要编译修复（例如字段可选性调整）

**禁止改动**：
- 任何 UI 文案（"已故" / "与逝者关系" / "缅怀" 等，保留原样交 B/C）
- 任何 JSX 结构 / 组件 props / children
- 任何 CSS class / tailwind class / 动画
- 借机重构页面逻辑（即使"看起来可以改"）

**不确定时**：留 `// TODO: opus-review` 注释，在 PR 描述列清冲突点，让用户 / Opus 拍板。

### 9.5 CI 同步

**判定**：
- `ls .github/workflows/ .gitlab-ci.yml 2>/dev/null` 看是否有 CI 配置

**若已有 CI**：
- 改 test job 的 DB 准备从 `create_all` → `alembic upgrade head`
- 添加 alembic check 的 job（autogenerate diff 为空验证 schema 一致）

**若无 CI**：
- **不强求 M7 内搭**；在 E 收尾文档 backlog 记一条"CI 基建未建，待独立工单"
- **或**顺手写 `.github/workflows/ci.yml` 最小版（lint + pytest + alembic check），工时控制在 2h 内

### 9.6 归属留痕 + E 收尾文档

**E 收尾文档**：`docs/superpowers/completed/2026-04-24-E-backend.md`，必含章节：

1. **一句话总结**
2. **做了什么**（按 milestone 列，含每个的 commit hash）
3. **用了哪些模型**（执行时间线表格，对应 A 子项目 § 十一 的格式）
4. **发现的非功能性问题**（bug / 坑 / 需要后续优化的点）
5. **关键产出**（供下游引用的文件 / 接口 / error_code 索引）
6. **Phase 1 执行说明**（前端 types PR 的边界、判断结果）
7. **遗留 backlog**（按归属标注：B / C / D / 独立工单）

**归属 tag**（按 § 六 v1.4 规则）：

- `mtc-E/spec-opus` → 本 spec commit（规格定调锚点，Opus 主导）← **已由 Opus 打**
- `mtc-E/m2a-codex` → M2a 完成点（可选；Codex 主导 milestone 建议打）
- `mtc-E/m2b-codex`（可选）
- `mtc-E/m1-codex`（可选）
- `mtc-E/m3-codex`、`mtc-E/m4-codex`、`mtc-E/m5-codex`、`mtc-E/m6-codex`（可选，按需）
- **`mtc-E/m7-codex`** → **必打**，E 收尾锚点

### 9.7 M7 DoD

1. `docker compose down -v && docker compose up` 从零起能跑通（backend migration + healthz 200 + frontend / worker 启动成功）
2. compose context 路径全部修正；`env_file` / `volumes` 同步
3. backend 启动自动 `alembic upgrade head`；worker 明确**不跑** migration
4. `GET /healthz` 200 + 结构正确；compose healthcheck 链 backend → worker 依赖生效
5. 前端 types PR 在边界内完成（`tsc --noEmit` 通过；无 UI 变更）
6. E 收尾文档落盘；7 个必含章节齐全
7. `mtc-E/m7-codex` tag 已打并 push
8. M3 / M5 / M6 所有 error_code 集成测试一次跑通，无 skipped
9. v1.4 推送节奏：每 milestone 都有独立 commit 且 push 到 `origin/Codex-coding`
10. **（可选）** 对声明可逆的 migration 演练一次 `upgrade → downgrade → upgrade`

---

## 10. 规格汇总与开工前确认清单

### 10.1 一句话规格

**先建 schema 单一入口（M2a）→ 再迁数据 / ORM（M2b）→ 再改 API 合约（M1）→ 再立异常与日志基座（M3 / M4）→ 再接媒体与语音（M5 / M6）→ 最后收尾（M7）。全程遵循 envelope 统一 + PII 脱敏 + 每阶段必推。**

### 10.2 开工前确认 checklist

Codex 进入 writing-plans 之前逐条勾选：

- [ ] 我已读 `.cursor/rules/mtc-refactor-roadmap.mdc` v1.4 的 § 五.1 / § 六 / § 七 / § 十 / § 十一
- [ ] 我已读 `docs/design-system.md`（即使 E 不改 UI，错误消息基调需与设计系统一致）
- [ ] 当前分支 = `Codex-coding`，从 `Opus-coding` 分叉；`git status` 无未提交残留
- [ ] 我理解 § 1.3 硬约束的全部 6 条
- [ ] 我理解执行顺序 M2a → M2b → M1 → M3 → M4 → M5 → M6 → M7 不可颠倒（除非暂停回 brainstorming）
- [ ] 我理解 members 字段 Phase 0/1/2 与 media 接口退役是**两套独立时间表**
- [ ] 我理解 v1.4 推送节奏硬约束（每阶段必推）
- [ ] 我理解 Q6=A 决策：克隆只做抽象预留，真实链路归 D
- [ ] 我理解前端类型 PR 的"允许 / 禁止"清单
- [ ] 附录 B error_code 索引、附录 C 配置项清单我都已浏览过

### 10.3 里程碑推送与 tag 规则

- 每个 milestone 完成：`git add ... && git commit -m "feat(E): <milestone> · <一句话>"` + `git push origin Codex-coding`
- 首次推送用 `-u`：`git push -u origin Codex-coding`（E 第一个有内容的 commit 之后）
- 关键锚点 tag（annotated）：
  - **必打**：`mtc-E/m7-codex`（E 收尾）
  - **已打**：`mtc-E/spec-opus`（本 spec 定稿，由 Opus 操作）
  - 其他 milestone tag 可选，按 Codex 判断

### 10.4 本文档冻结约束

- writing-plans 阶段：Codex 基于本文档展开细节计划，**不改本文档**
- executing-plans 阶段：实施时发现边缘情况 → 暂停并反馈给 Opus / 用户 → 决议后**同步更新本文档对应节**并在脚注写"v1.0 → v1.x：<修订原因>"
- 不允许无记录静默修改本文档

---

## 附录 A · Opus 一次性决策包答复（v1）

本文档中所有涉及以下主题的内容，均以 Opus 一次性答复 v1 为约束来源：

| 主题 | Opus 答复 |
|---|---|
| Q1 错误 envelope 范围 | **A** — 全部错误统一 envelope 覆盖 401/403/404/422/500 |
| Q2 HTTPException 改造策略 | **B** — M3 先桥接 + M4 批量替换 |
| Q3 日志最小字段集 | **B** — 9 字段（不含 trace_id/span_id 占位）+ JSON 格式 |
| Q4 MinIO 上传接口形态 | **B** — 两阶段 init + complete |
| Q5 文件访问策略 | **A** — 私有桶 + 预签名 GET 统一（不按类型分） |
| Q6 CosyVoice 克隆深度 | **A** — 仅 TTS + 克隆抽象预留（与 Codex 推荐不同，Opus 主动否决）|
| Q7 异步化边界 | **A** — TTS 同步（由 Q6 推导）+ Celery 基建就位 |
| Q8 前端类型 PR 粒度 | **C** — 允许少量编译修复 + 禁止改 UI 文案 |
| Q9 Phase 2 触发条件 | **A** — B 子项目 brainstorm 前强制（members 字段）|
| Q10 downgrade 策略 | **B** — 允许部分 migration 不可逆（显式 `NotImplementedError`）|

**Opus 额外默认约束**（未问但必须统一）：
- Pydantic `model_config`: `populate_by_name=True` + `str_strip_whitespace=True`
- logger 命名空间按 FastAPI 模块分层（`mtc.api.*` / `mtc.services.*` / `mtc.workers.*`）
- `request_id`：沿用前端 `X-Request-ID` 或生成 UUID4；响应头必须回显

---

## 附录 B · 完整 error_code 索引

按族分组，含 HTTP status 与一行说明。

### B.1 `VALIDATION_*`（单字段验证，422）

| error_code | 说明 |
|---|---|
| `VALIDATION_EMPTY_STATUS` | status 为空字符串 |
| `VALIDATION_EMPTY_END_YEAR` | end_year 为空字符串 |
| `VALIDATION_EMPTY_DEATH_YEAR` | death_year 为空字符串 |
| `VALIDATION_EMPTY_TEXT` | TTS text 为空字符串 |
| `VALIDATION_REQUIRED_STATUS` | Create 模式归一化后 status 仍缺失 |
| `VALIDATION_INVALID_STATUS_VALUE` | status 不在枚举内 |
| `VALIDATION_INVALID_YEAR_RANGE` | 年份字段越界 |
| `VALIDATION_METHOD_NOT_ALLOWED` | 405 桥接 |
| `VALIDATION_FAILED` | Pydantic 通用字段级失败（422 桥接）|

### B.2 `FIELD_CONFLICT_*`（跨字段冲突，422）

| error_code | 说明 |
|---|---|
| `FIELD_CONFLICT_STATUS_IS_ALIVE` | status='active' vs is_alive=false |
| `FIELD_CONFLICT_STATUS_DEATH_YEAR` | status ≠ 'passed' 但 death_year 有值 |
| `FIELD_CONFLICT_END_YEAR_DEATH_YEAR` | end_year 与 death_year 数值不等 |

### B.3 `AUTH_*`（认证 / 授权，401 / 403）

| error_code | HTTP | 说明 |
|---|---|---|
| `AUTH_UNAUTHORIZED` | 401 | 未登录 / token 缺失 |
| `AUTH_TOKEN_EXPIRED` | 401 | token 过期（M4 细分）|
| `AUTH_TOKEN_INVALID` | 401 | token 签名 / 格式错（M4 细分）|
| `AUTH_FORBIDDEN` | 403 | 已登录但无权限 |

### B.4 `RESOURCE_*`（资源相关，404 / 409）

| error_code | HTTP | 说明 |
|---|---|---|
| `RESOURCE_NOT_FOUND` | 404 | 通用 404 桥接 |
| `RESOURCE_CONFLICT` | 409 | 资源冲突（如重名）|

### B.5 `MEDIA_*`（媒体子域）

#### B.5.1 上传

| error_code | HTTP | 说明 |
|---|---|---|
| `MEDIA_UPLOAD_INIT_INVALID_TYPE` | 422 | content_type 不在白名单 |
| `MEDIA_UPLOAD_INIT_INVALID_SIZE` | 422 | size ≤ 0 |
| `MEDIA_UPLOAD_INIT_FILE_TOO_LARGE` | 422 | 超上限 |
| `MEDIA_UPLOAD_INIT_INVALID_FILENAME` | 422 | 空或非法 |
| `MEDIA_UPLOAD_INIT_INVALID_PURPOSE` | 422 | purpose 枚举外 |
| `MEDIA_UPLOAD_COMPLETE_NOT_FOUND` | 404 | upload_id 不存在 |
| `MEDIA_UPLOAD_COMPLETE_OWNERSHIP_MISMATCH` | 403 | 归属错或 object_key 不匹配 |
| `MEDIA_UPLOAD_COMPLETE_EXPIRED` | 422 | session 已过期 |
| `MEDIA_UPLOAD_COMPLETE_OBJECT_MISSING` | 422 | head_object 404 |
| `MEDIA_UPLOAD_COMPLETE_CHECKSUM_MISMATCH` | 422 | etag/size 不符 |
| `MEDIA_PRESIGN_GET_NOT_FOUND` | 404 | media_id 不存在 |
| `MEDIA_PRESIGN_GET_FORBIDDEN` | 403 | 归属他人 |

#### B.5.2 Voice / TTS

| error_code | HTTP | 说明 |
|---|---|---|
| `MEDIA_TTS_PROVIDER_UNAVAILABLE` | 503 | provider 连接失败 / 5xx |
| `MEDIA_TTS_TIMEOUT` | 504 | read timeout 且重试耗尽 |
| `MEDIA_TTS_BAD_REQUEST` | 400 | provider 返回 4xx |
| `MEDIA_TTS_RESPONSE_INVALID` | 502 | provider 返回非音频 / 校验失败 |
| `MEDIA_TTS_TEXT_TOO_LONG` | 422 | text 超长度限 |
| `MEDIA_TTS_VOICE_NOT_FOUND` | 404 | voice_id 不存在 |
| `MEDIA_TTS_QUOTA_EXCEEDED` | 429 | 并发超限 |
| `MEDIA_VOICE_CLONE_NOT_IMPLEMENTED` | 501 | E 阶段 clone 占位抛出 |

### B.6 `INTERNAL_*`（500 / 503）

| error_code | HTTP | 说明 |
|---|---|---|
| `INTERNAL_SERVER_ERROR` | 500 | 未捕获异常兜底 |
| `SERVICE_UNAVAILABLE` | 503 | 503 桥接 |
| `RATE_LIMIT_EXCEEDED` | 429 | 429 桥接 |

---

## 附录 C · 关键配置项（`.env` 模板）

以下为 E 子项目引入 / 必须显式的配置项，建议落 `backend/.env.example`：

```dotenv
# ===== 应用 =====
APP_ENV=development
LOG_LEVEL=info
LOG_SUCCESS=true
LOG_REQUEST_BODY=false             # PII 脱敏基线；仅 dev debug 临时开

# ===== 数据库 =====
DATABASE_URL=postgresql+asyncpg://mtc:mtc@postgres:5432/mtc
# Alembic 读取此 URL；与 app 使用同一连接字符串

# ===== Redis（Celery broker / result）=====
REDIS_URL=redis://redis:6379/0     # 应用缓存
CELERY_BROKER_URL=redis://redis:6379/1
CELERY_RESULT_BACKEND=redis://redis:6379/2

# ===== MinIO =====
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=changeme
MINIO_SECRET_KEY=changeme
MINIO_DEFAULT_BUCKET=mtc-media
MINIO_REGION=us-east-1
MINIO_SECURE=false                 # dev false，prod true
MINIO_PRESIGN_PUT_TTL_SECONDS=3600
MINIO_PRESIGN_GET_TTL_SECONDS=3600

# ===== 媒体上传上限（MB）=====
MEDIA_MAX_SIZE_AVATAR_MB=5
MEDIA_MAX_SIZE_PHOTO_MB=20
MEDIA_MAX_SIZE_AUDIO_MB=100
MEDIA_MAX_SIZE_VIDEO_MB=500

# ===== CosyVoice =====
COSYVOICE_BASE_URL=http://cosyvoice:8000
COSYVOICE_API_KEY=                 # 按实际部署填
COSYVOICE_CONNECT_TIMEOUT_SECONDS=3
COSYVOICE_READ_TIMEOUT_SECONDS=45
COSYVOICE_RETRY_COUNT=2
COSYVOICE_RETRY_BACKOFF_BASE_MS=200
COSYVOICE_RETRY_BACKOFF_FACTOR=2

# ===== Voice 业务约束 =====
VOICE_DEFAULT_PROVIDER=cosyvoice
VOICE_FEATURE_CLONE_ENABLED=false  # E 阶段默认关闭
VOICE_MAX_TEXT_LENGTH=2000
VOICE_MAX_CONCURRENT_TTS=10

# ===== Uvicorn（dev 默认）=====
# UVICORN_EXTRA_ARGS="--reload"    # 由 entrypoint.sh 默认值兜底，prod 清空或改 --workers N
```

---

## 附录 D · 关键路径文件清单（writing-plans 输入）

下表列出 E 子项目会新增或深度修改的文件，供 Codex writing-plans 参考（**不是** M 级别 DoD）：

### D.1 新增

```
backend/alembic.ini
backend/alembic/env.py
backend/alembic/script.py.mako
backend/alembic/versions/<baseline>_baseline_existing_schema.py
backend/alembic/versions/<hash>_members_status_end_year.py
backend/alembic/versions/<hash>_media_tables.py           # M5 的新表
backend/entrypoint.sh
backend/app/core/exceptions.py                           # MTCDomainError 层级
backend/app/api/middleware/request_id.py
backend/app/api/middleware/exception_handler.py
backend/app/api/middleware/structured_logging.py
backend/app/core/logging_config.py                       # JSON formatter
backend/app/services/voice/__init__.py
backend/app/services/voice/provider.py                   # ABC
backend/app/services/voice/cosyvoice.py
backend/app/services/voice/service.py                    # VoiceService + Semaphore
backend/app/services/media/__init__.py
backend/app/services/media/upload.py                     # init + complete 业务
backend/app/services/media/presign.py                    # get URL
backend/app/workers/__init__.py
backend/app/workers/celery_app.py
backend/app/workers/tasks/healthcheck.py
backend/app/workers/tasks/voice.py                       # clone 占位
backend/app/api/routes/media.py                          # 新 /media/uploads/* 路由（与旧路由并存）
backend/app/api/routes/healthz.py                        # 新 /healthz
backend/app/models/media.py                              # media_upload_sessions / media_assets
scripts/pg_dump_snapshot.sh                              # Q10 配套
docs/superpowers/completed/2026-04-24-E-backend.md       # M7 收尾文档
```

### D.2 修改

```
backend/app/main.py                          # 删 init_db / create_all
backend/app/models/__init__.py               # re-export 所有 model
backend/app/models/member.py                 # 加 status / end_year；is_alive DROP NOT NULL
backend/app/api/schemas/member.py            # MemberCreate / MemberUpdate 加 validator
backend/app/core/config.py                   # 附录 C 所有配置项
backend/requirements.txt or pyproject.toml   # 新增 alembic / python-json-logger / tenacity / httpx（若无）
backend/tests/conftest.py                    # fixture 改 alembic upgrade head
infra/docker-compose.yml                     # context 路径 + healthcheck + command
infra/postgres/init.sql                      # 确认仅 extension / timezone，无业务表
backend/Dockerfile                           # ENTRYPOINT entrypoint.sh
backend/README.md                            # 本地启动 / alembic 流程 / 禁止 create_all
frontend/src/types/*.ts                      # Phase 1，仅 E 末期
.github/workflows/ci.yml                     # 若存在，同步 alembic；若无，可选新增
```

### D.3 不得修改（本子项目内）

```
frontend/src/pages/**/*.tsx                  # 文案 / UI 禁区
frontend/src/components/**                   # 同上
frontend/src/styles/**                       # 同上
docs/design-system.md                        # A 子项目产出，锁定
.cursor/rules/mtc-refactor-roadmap.mdc       # 除非本 spec 冻结约束放开
docs/superpowers/completed/2026-04-24-A-design-system.md   # 历史归档
```

---

**文档结束。**
