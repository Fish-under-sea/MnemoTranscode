# MTC API 接口文档

本文档描述 MTC（Memory To Code）后端 API 的接口规范。所有接口前缀为 `/api/v1`。

---

## 一、认证接口

### 1.1 用户注册

**POST** `/api/v1/auth/register`

创建新用户账号。

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| email | string | 是 | 邮箱地址 |
| username | string | 是 | 用户名（2-50 字符） |
| password | string | 是 | 密码（至少 6 位） |

**响应示例：**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "username": "张三",
    "is_active": true,
    "created_at": "2026-04-23T10:00:00Z"
  }
}
```

**错误码：**

| 状态码 | 说明 |
|--------|------|
| 400 | 邮箱已被注册 |

---

### 1.2 用户登录

**POST** `/api/v1/auth/login`

用户登录，返回 JWT 令牌。

**请求体（OAuth2 密码模式）：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| username | string | 是 | 邮箱地址（即 username 字段） |
| password | string | 是 | 密码 |

**响应示例：**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "username": "张三",
    "is_active": true,
    "created_at": "2026-04-23T10:00:00Z"
  }
}
```

---

### 1.3 获取当前用户

**GET** `/api/v1/auth/me`

获取已登录用户的信息。

**请求头：**

```
Authorization: Bearer <token>
```

**响应示例：**

```json
{
  "id": 1,
  "email": "user@example.com",
  "username": "张三",
  "is_active": true,
  "created_at": "2026-04-23T10:00:00Z"
}
```

---

### 1.4 更新当前用户

**PATCH** `/api/v1/auth/me`

更新用户信息。

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| username | string | 否 | 新的用户名 |

---

## 二、档案管理接口

### 2.1 创建档案

**POST** `/api/v1/archives`

创建新的记忆档案。

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 档案名称（1-100 字符） |
| description | string | 否 | 档案描述 |
| archive_type | string | 是 | 档案类型 |

**archive_type 可选值：**

| 值 | 说明 |
|----|------|
| `family` | 家族记忆 |
| `lover` | 恋人记忆 |
| `friend` | 挚友记忆 |
| `relative` | 至亲记忆 |
| `celebrity` | 伟人记忆 |
| `nation` | 国家历史 |

**响应示例：**

```json
{
  "id": 1,
  "name": "李家族谱",
  "description": "记录李家的历史",
  "archive_type": "family",
  "owner_id": 1,
  "created_at": "2026-04-23T10:00:00Z",
  "updated_at": "2026-04-23T10:00:00Z",
  "member_count": 0,
  "memory_count": 0
}
```

---

### 2.2 获取档案列表

**GET** `/api/v1/archives`

获取当前用户的档案列表。

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| archive_type | string | 否 | 按类型筛选 |

**响应示例：**

```json
[
  {
    "id": 1,
    "name": "李家族谱",
    "description": "记录李家的历史",
    "archive_type": "family",
    "owner_id": 1,
    "created_at": "2026-04-23T10:00:00Z",
    "updated_at": "2026-04-23T10:00:00Z",
    "member_count": 5,
    "memory_count": 42
  }
]
```

---

### 2.3 获取档案详情

**GET** `/api/v1/archives/{archive_id}`

获取指定档案的完整信息。

**响应示例：**

```json
{
  "id": 1,
  "name": "李家族谱",
  "description": "记录李家的历史",
  "archive_type": "family",
  "owner_id": 1,
  "created_at": "2026-04-23T10:00:00Z",
  "updated_at": "2026-04-23T10:00:00Z",
  "member_count": 5,
  "memory_count": 42
}
```

---

### 2.4 更新档案

**PATCH** `/api/v1/archives/{archive_id}`

更新档案信息。

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 否 | 档案名称 |
| description | string | 否 | 档案描述 |

---

### 2.5 删除档案

**DELETE** `/api/v1/archives/{archive_id}`

删除档案及其所有成员和记忆（级联删除）。

**响应：** 状态码 `204 No Content`

---

## 三、成员管理接口

### 3.1 创建成员

**POST** `/api/v1/archives/{archive_id}/members`

在指定档案下创建成员。

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 成员姓名 |
| relationship | string | 是 | 关系描述 |
| birth_year | int | 否 | 出生年份 |
| death_year | int | 否 | 去世年份 |
| bio | string | 否 | 人物简介 |

**响应示例：**

```json
{
  "id": 1,
  "name": "李明",
  "relationship": "父亲",
  "archive_id": 1,
  "birth_year": 1960,
  "death_year": 2023,
  "bio": "一生勤恳的老农民",
  "is_alive": false,
  "voice_profile_id": null,
  "emotion_tags": [],
  "memory_count": 0,
  "created_at": "2026-04-23T10:00:00Z"
}
```

---

### 3.2 获取成员列表

**GET** `/api/v1/archives/{archive_id}/members`

获取档案下的所有成员。

**响应：** 成员对象数组，按出生年份排序。

---

### 3.3 获取成员详情

**GET** `/api/v1/archives/{archive_id}/members/{member_id}`

获取指定成员的详细信息。

---

### 3.4 更新成员

**PATCH** `/api/v1/archives/{archive_id}/members/{member_id}`

更新成员信息。

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 否 | 姓名 |
| relationship | string | 否 | 关系 |
| birth_year | int | 否 | 出生年份 |
| death_year | int | 否 | 去世年份 |
| bio | string | 否 | 简介 |
| is_alive | bool | 否 | 是否在世 |

---

### 3.5 删除成员

**DELETE** `/api/v1/archives/{archive_id}/members/{member_id}`

删除成员及其所有记忆（级联删除）。

---

## 四、记忆管理接口

### 4.1 创建记忆

**POST** `/api/v1/memories`

创建新的记忆条目。

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| member_id | int | 是 | 关联成员 ID |
| title | string | 是 | 记忆标题（1-200 字符） |
| content_text | string | 是 | 记忆正文（至少 1 字符） |
| timestamp | datetime | 否 | 记忆发生时间（ISO 8601） |
| location | string | 否 | 发生地点 |
| emotion_label | string | 否 | 情感标签 |

**情感标签可选值：**

`joy`、`love`、`anger`、`sadness`、`fear`、`surprise`、`nostalgia`、`gratitude`、`regret`、`peaceful`

---

### 4.2 获取记忆列表

**GET** `/api/v1/memories`

获取记忆列表（支持筛选和分页）。

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| archive_id | int | 否 | 按档案筛选 |
| member_id | int | 否 | 按成员筛选 |
| emotion_label | string | 否 | 按情感筛选 |
| skip | int | 否 | 跳过条数（默认 0） |
| limit | int | 否 | 返回条数（默认 20，最大 100） |

---

### 4.3 获取记忆详情

**GET** `/api/v1/memories/{memory_id}`

获取单条记忆的完整信息。

---

### 4.4 更新记忆

**PATCH** `/api/v1/memories/{memory_id}`

更新记忆条目。

---

### 4.5 删除记忆

**DELETE** `/api/v1/memories/{memory_id}`

删除记忆条目。

---

### 4.6 语义搜索记忆

**POST** `/api/v1/memories/search`

基于向量检索的语义搜索。

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| query | string | 是 | 搜索查询（至少 1 字符） |
| archive_id | int | 否 | 限定档案范围 |
| member_id | int | 否 | 限定成员范围 |
| limit | int | 否 | 返回条数（默认 10，最大 100） |

**响应示例：**

```json
{
  "results": [
    {
      "id": 5,
      "title": "父亲的第一次远行",
      "content_text": "那一年父亲去深圳打工...",
      "member_id": 1,
      "emotion_label": "nostalgia",
      "timestamp": "1998-03-15T00:00:00Z",
      "location": "深圳",
      "created_at": "2026-04-23T10:00:00Z"
    }
  ],
  "query": "父亲 打工 深圳",
  "total": 1
}
```

---

### 4.7 获取记忆关系图（Mnemo / Engram）

**GET** `/api/v1/memories/mnemo-graph`

返回指定成员的 Engram **结点与边**，供前端力导向画布使用。服务端会过滤不可用记忆绑定的结点等；响应字段含义与图例常量见 **[memory-relation-network.md](./memory-relation-network.md)**。

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| member_id | int | 是 | 成员 ID（≥ 1） |

**响应：** `member_id`、`nodes[]`（`id`, `node_type`, `label`, `memory_id?`）、`edges[]`（`from_id`, `to_id`, `edge_type`, `weight`）。

---

### 4.8 聊天记录导入（同步）

**POST** `/api/v1/memories/import-chat`

与别名 **POST** `/api/v1/memories/chat-import` 等价。

**说明**：对已解析片段 **逐段直写入库**（不进行多批 LLM 精炼）；大批量可能暂缓向量写入。若需 SSE 进度与 AI 精炼，请使用 §4.9。

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| member_id | int | 是 | 成员 ID |
| raw_text | string | 是 | 导出正文（≤ 500000 字） |
| source | string | 否 | `auto` \| `wechat` \| `plain`，默认 `auto` |
| build_graph | bool | 否 | 是否在写入后构图，默认 `true` |

**响应：** `created_count`、`memory_ids`、`graph_temporal_edges`、`graph_llm_edges`、`vectors_deferred?`。

---

### 4.9 聊天记录导入（流式 SSE）

**POST** `/api/v1/memories/import-chat/stream`

与别名 **POST** `/api/v1/memories/chat-import/stream` 等价。

**媒体类型：** `text/event-stream`，帧形如 `data: {JSON}\\n\\n`。

**请求体：** 在 §4.8 基础上可增加：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| ai_refine | bool | 否 | 默认 `true`；`false` 时跳过多批 LLM 精炼 |
| client_llm | object | 否 | 与 **§5.1** `client_llm` 同形（`base_url`、`model`、`api_key?`）；流式流水线中用于精炼阶段。**前端应在每次 POST 前使用浏览器当前「模型设置」覆盖快照**，避免因 localStorage job 早于保存密钥而导致 401。 |

**SSE 帧类型概要**：`stage`、`parse_done`、`llm_batch`、`batch_done`、`persist_progress`、`note`、`done`（含统计）、`error`。

成员页在用户开启 AI 精炼且非 Ollama、且浏览器未保存 API Key 时，会先 **Toast** 提示可能依赖服务端 `LLM_*` 环境变量。详见 **[memory-relation-network.md](./memory-relation-network.md)** §6。

---

## 五、AI 对话接口

### 5.1 发送对话消息

**POST** `/api/v1/dialogue/chat`

与档案中的角色进行 AI 对话。

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| message | string | 是 | 用户消息（1-4000 字符） |
| archive_id | int | 否 | 档案 ID |
| member_id | int | 否 | 成员 ID |
| channel | string | 否 | 对话渠道：`app`/`wechat`/`qq`（默认 `app`） |
| session_id | string | 否 | 会话 ID（用于跨请求上下文） |
| history_limit | int | 否 | 携带服务端历史消息条数（默认 10，最大 50） |
| client_history | object[] | 否 | 浏览器恢复的 `user` / `assistant` 消息片段；存在时优先于服务端进程内会话 |
| client_llm | object | 否 | OpenAI 兼容网关覆盖：`base_url`（必填）、`model`（必填）、`api_key`（可空）；与「模型设置」一致 |
| extract_memories_after | bool | 否 | `true` 时在本轮对话写入会话后，用 LLM 提炼记忆并入链式图（增加耗时） |

**响应示例：**

```json
{
  "reply": "那是我第一次离开家乡去深圳打工，那时候...",
  "channel": "app",
  "member_id": 1,
  "member_name": "李明",
  "tts_audio_url": null,
  "session_id": "session_123456789"
}
```

---

### 5.2 获取对话历史

**POST** `/api/v1/dialogue/history`

获取指定会话的对话历史。

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| session_id | string | 是 | 会话 ID |
| archive_id | int | 否 | 限定档案范围 |
| member_id | int | 否 | 限定成员范围 |
| limit | int | 否 | 返回条数（默认 20，最大 100） |

**响应示例：**

```json
{
  "session_id": "session_123456789",
  "messages": [
    { "role": "user", "content": "给我讲讲你的故事" },
    { "role": "assistant", "content": "那是很久以前的事了..." }
  ]
}
```

---

### 5.3 清除对话历史

**DELETE** `/api/v1/dialogue/history/{session_id}`

清除指定会话的对话历史。

**响应：**

```json
{ "status": "ok" }
```

---

## 六、通用响应格式

### 成功响应

```json
{
  "id": 1,
  "name": "xxx",
  ...
}
```

### 错误响应

```json
{
  "detail": "错误描述信息"
}
```

### 常见 HTTP 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 201 | 资源创建成功 |
| 204 | 请求成功，无返回内容 |
| 400 | 请求参数错误 |
| 401 | 未认证或 Token 无效 |
| 403 | 无权限访问 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

---

## 七、认证说明

除注册和登录接口外，所有接口均需要认证。

在请求头中携带 JWT Token：

```
Authorization: Bearer <access_token>
```

Token 有效期为 24 小时，过期后需重新登录。

---

*文档版本：v0.1.0 · 最后更新：2026-04-23*
