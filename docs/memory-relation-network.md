# 记忆关系网（Mnemo Engram）技术说明

> **定位**：阐述成员详情页「记忆网络」可视化与 Mnemo Engram 图数据之间的契约、前端实现要点及与聊天记录 AI 导入的衔接。运维与端到端拓扑仍以 [ARCHITECTURE.md](./ARCHITECTURE.md)、[README](../README.md) 为准。

**版本**：2026-05-01

---

## 1. 功能范围

- **数据来源**：PostgreSQL 中按计划过滤后的 `EngramNode` / `EngramEdge`（成员维度，属当前登录用户）。
- **展示载体**：前端 `MemoryRelationGraph`（`react-force-graph-2d` 画布 + 简易预布局种子）。
- **典型场景**：导入聊天记录（开启 AI 构图）、对话后提炼记忆、链路 enrich 后生成分叉边；单结点时亦为合法状态（常为 **Person** 人物锚点）。

---

## 2. 业务与数据概念

### 2.1 节点类型（`node_type`）

后端将 Engram ORM 投影为图谱结点；前端按类型上色（可读性）：常见含 **Person**（人物锚点）、**Event**（事件）、**Emotion**（情感）等。具体取值以后端 Mnemo 同步逻辑为准。

**人物锚点（记忆母结点）**：与 `app/mnemo/sync_memories.py` 中 **确保成员对应 Person 结点存在** 的设计一致——无记忆时亦可作为拓扑锚点。**前端视图回正**以此类结点为优先对齐目标（见第 5 节）。

### 2.2 边类型（`edge_type`，图例）

| `edge_type`（常量） | 图例中文 |
|--------------------|----------|
| `TEMPORAL_NEXT` | 时间先后 |
| `CAUSED_BY` | 因果归因 |
| `RELATED_TO` | 主题相关 |
| `EMOTIONALLY_LINKED` | 情感关联 |
| `SUPPORTS` | 支撑印证 |
| `COACTIVATED_WITH` | 共现关联 |

边颜色映射见前端 `EDGE_COLORS` / `EDGE_TYPE_LABEL_ZH`（与 UI 保持一致即可）。

---

## 3. 后端接口与过滤规则

### 3.1 获取图谱

**GET** `/api/v1/memories/mnemo-graph`

| 查询参数 | 说明 |
|---------|------|
| `member_id` | 必填，成员 ID |

**响应概要**：`member_id`、`nodes[]`（`id`, `node_type`, `label`, `memory_id?`）、`edges[]`（`from_id`, `to_id`, `edge_type`, `weight`）。

**过滤要点**（路由内实现摘要）：

- 仅保留 `member_id`、`user_id` 匹配且 `is_deprecated=false` 的结点。
- 对仍绑定 **`memory_id` 的业务记忆结点**：对应 `Memory` 必须仍存在，否则不参与返回（避免脏结点）。
- 对 **`memory_id` 为空**的结点：**Event** 且无记忆支撑则剔除（历史上删记忆可能造成孤儿 Event）；Person / Emotion 等可依规则保留。

实现参考：`backend/app/api/v1/memory.py` · `get_mnemo_graph`。

### 3.2 构图与数据来源（延伸阅读）

结点与边的写入散落在 Mnemo / 导入 / 对话提炼等链路（如 `ensure_memory_engram`、`enrich_after_memories_created`、`chain_enricher`）。**本文件不替代**各服务的内部设计文档；若以「图谱为何为空／为何只有一人」排查，需结合对应业务流水线日志与数据库行。

---

## 4. 前端实现清单

### 4.1 组件与静态资源

| 路径 | 职责 |
|------|------|
| `frontend/src/components/memory/MemoryRelationGraph.tsx` | 查询图谱、画布、工具栏（适配画布 / 全屏 / 力导向开关 / 清除高亮） |
| `frontend/src/lib/mnemoGraphLayout.ts` | `computeForceLayout`：进入 `react-force-graph-2d` 前的环形种子坐标，减小首帧炸裂感 |
| `frontend/src/lib/mnemoGraphHighlight.ts` | 点击结点时高亮链路：边键与时间链传播 |

依赖：**`react-force-graph-2d`**（封装 `force-graph`/d3-force）；画布内自定义 `nodeCanvasObject` 绘制圆点与缩略标签。

### 4.2 数据来源

`useQuery`，`queryKey: ['mnemo-graph', memberId]`，请求 `memoryApi.mnemoGraph(memberId)`（即上述 GET）。

### 4.3 无障碍与偏好

尊重 **`prefers-reduced-motion`**：削弱粒子动画、缩短 `cooldownTicks` 等与动效相关的参数（见组件内状态）。

---

## 5. 交互与视图行为（已实现约定）

### 5.1 拖拽与固定

- 结点可拖拽；**松手后将写入 `fx`/`fy`**，在该位置约束结点，便于人工整理。
- **力导向开关关闭**：将已有有效坐标的结点全部 **`fx`/`fy` 钉在当前位置**（并清零速度），整图近似冻结；组件向 force-graph 传入 **最小 `cooldownTicks`（避免传 0 导致首帧即停表 + 默认 `autoPauseRedraw` 漏绘白屏）**，并设 **`autoPauseRedraw={false}`** 持续重绘。仍可拖拽单个结点微调，松手后再次写入 `fx`/`fy`。
- **力导向开关开启**：清除全部结点的 **`fx`/`fy`（及速度）**，调用 **`d3ReheatSimulation`**，回到「链路 / 电荷等力」主导的动态平衡；停表后的锚点对齐见下一小节。

### 5.2 重新布局后对齐「记忆锚点」（人物母结点）

**问题**：仅 `reheat` 时画布 **平移 / 缩放状态不变**；且 `cooldownTicks` 截断仿真时结点坐标仍可能有惯性漂移——只做一次 **`centerAt`** 容易偏移。

**约定**：**开启力导向**（由关 → 开）后置 `centerAnchorAfterSimRef`；在 **`onEngineStop`**（力引擎按 `cooldownTicks`/`cooldownTime`/`alphaMin` 停表）后清除标志并触发 **`scheduleAnchorAlignmentBurst`**：

- **锚点 ID**：优先 **首个 `node_type === 'Person'`**，否则 **第一个结点**；坐标读取使用 **`graphNodesRef`**（与送入 `ForceGraph` 的结点 **同一引用**，仿真原地更新 `x`/`y`）。
- **多结点图**：pass 0 先 **`zoomToFit` → 短时延迟 → `centerAt(锚点)`**，再在约 95ms / 280ms / 520ms 重复 **`centerAt`**，追上冷却结束后仍在微移的锚点。
- **单结点图**：以 **`centerAt`** 为主，必要时抬升过小缩放，末拍再做校准。

卸载或新一轮对齐前用 **`burstCancelRef`** 取消 RAF 与定时器。

实现入口：`MemoryRelationGraph` · `runAnchorAlignmentPass`、`scheduleAnchorAlignmentBurst`、`onEngineStop`。

### 5.3 其余工具栏

- **适配画布**：`zoomToFit`（短时动画 + padding）。
- **全屏**：`requestFullscreen` 容器，`ResizeObserver` 补测尺寸避免画布未及时撑满。
- **点击结点**：点亮相关边与时间链；仅在 **力导向开启** 时调用 `d3ReheatSimulation` 与选中状态联动以增强局部排斥（库行为 + 微弱再平衡）。

---

## 6. 相关：聊天记录 AI 导入（`client_llm` 与用户模型设置）

本节与「图谱数据从哪来」弱相关：**流式导入**在 AI 精炼阶段会批量调用 LLM，并最终将记忆与（可选）关系边写入后端；图谱随后由本节接口读出。

### 6.1 浏览器端网关与密钥

- 前端在 **模型设置**（`localStorage`，键 `mtc-llm-user-config`）中保存厂商预设 / 自定义 Base / Ollama 等；经 `buildClientLlmPayload` 转为后端 **`ClientLlmOverride`**（`base_url`、`model`、`api_key` 可为 `null`，如本地无密钥网关）。
- **流式导入**（`frontend/src/lib/chatImportStream.ts`）：POST 时在 **`ai_refine !== false`** 的前提下，**每次请求重新 `readStoredLlmUserConfig` 并重建 payload**，并 **优先于 job 快照**（`fresh ?? snapshot`），降低「快照早于用户保存 Key」导致的 401。
- **成员页跳转进度前**（若开启 AI 精炼且非 Ollama、且浏览器侧无有效 Key）：**Toast 提示**依赖服务端 `LLM_*` 环境变量及 401 风险，参见 `MemberDetailPage` · `startChatImportOnProgressPage`。

### 6.2 后端流式路由（别名）

同一路由注册两个路径，前端会依次尝试直至非 404：

- `POST` `/api/v1/memories/import-chat/stream`
- `POST` `/api/v1/memories/chat-import/stream`

正文字段含 `member_id`、`raw_text`、`source`、`build_graph`、`ai_refine`、`client_llm?`（可选）。详情见 [API.md](./API.md)。

---

## 7. 排错速查

| 现象 | 可能原因 |
|------|----------|
| 图谱空 | 该成员尚无 Engram 结点，或均被过滤规则剔除 |
| 仅 1 个 Person、0 边 | 正常现象（锚点存在、尚未构图） |
| 重新力导图「飘走」仍偶发未对齐 | 先试「适配画布」；若仍漂移可上报（对齐依赖多拍 `centerAt`，与 `cooldownTicks` 停表时机相关） |
| 导入报 LLM 401 | 浏览器未传 Key + 服务端 `LLM_*` 未配置；检查模型设置与 `backend/.env` |

---

## 8. 维护说明

扩展新 `edge_type` 时：**后端写入常量** ⇄ **前端 `EDGE_COLORS` / `EDGE_TYPE_LABEL_ZH`** 应保持同步；图例截取前 N 项时注意不要静默丢弃新类型（必要时改为配置驱动）。

若变更 Person 锚点判定规则（多人物档案），需同时调整 **本节第 5.2 节** 与前端的 **锚点择优策略**，避免与用户心智中的「主角」错位。
