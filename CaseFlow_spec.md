# CaseFlow 系统规格文档 v3.0

## 项目概述
**项目名称**: CaseFlow - 城市更新案例知识管理平台
**版本**: 3.0
**最后更新**: 2026-04-01

**项目目标**: 构建一个基于 Schema 驱动的城市更新案例知识管理平台，实现案例的结构化拆解、可视化展示及 AI 辅助分析。

---

## 1. Schema 管理模块 (Schema Architect)

该模块是系统的"大脑"，定义了数据的逻辑边界。

### 1.1 核心功能

#### 1.1.1 多模式管理
- 支持创建多个 Schema 方案（如：按"开发模式"拆解，或按"利益相关者"拆解）
- Schema 切换时，关联的案例和图谱视图自动联动

#### 1.1.2 本体定义 (Ontology Editor)
- **实体类型 (Entity Types)**: 自定义节点标签
  - 示例：项目主体、改造方式、地块属性、资金来源
  - 属性：名称、颜色、图标、描述

- **属性定义 (Properties)**: 为节点添加元数据字段
  - 示例：年份、面积、容积率、投资金额
  - 支持数据类型：文本、数字、日期、布尔值、枚举

- **关系定义 (Relations)**: 定义节点间的连接逻辑
  - 示例：[政府] 主导 [改造项目]
  - 支持关系属性：权重、方向、类型

#### 1.1.3 可视化建模
- 采用拖拽式界面编辑实体间的逻辑拓扑图（使用 @xyflow/react）
- 实时预览 Schema 结构
- 支持 Schema 导出/导入（JSON 格式）

### 1.2 技术实现
- 使用 Zustand 管理 Schema 全局状态
- 支持多 Schema 并行存在
- 实体类型颜色可自定义
- API 持久化到 PostgreSQL

---

## 2. 案例详情模块 (Case Detail & Mapping)

该模块负责将原始的城市更新案例映射到选定的 Schema 上。

### 2.1 核心功能

#### 2.1.1 Schema 联动加载
- 当用户选择 Schema A 时，案例输入/展示表单会自动根据 Schema A 定义的字段进行渲染
- 实体类型下拉选项自动同步自 Schema

#### 2.1.2 结构化数据卡片
- **多维展示**: 以选项卡或折叠面板形式展示案例的详细参数
  - 基本信息：名称、位置、年份、描述、标签
  - 实体列表：案例中包含的所有实体
  - 关系管理：实体间的关系连接
  - 映射编辑：文本段落与实体的关联

- **动态填充**: 显示已提取的实体列表及属性

#### 2.1.3 映射编辑器
- 允许用户手动或通过 AI 标注，将文本段落关联到具体的实体或关系上
- 支持高亮显示已映射的文本片段
- 一键取消映射

### 2.2 技术实现
- 多标签页切换（基本信息/实体列表/关系管理/映射编辑）
- 实体/关系的增删改查操作
- 与图谱画布数据联动
- API 持久化到 PostgreSQL

---

## 3. 图谱展示画布 (Knowledge Graph Canvas)

将抽象的关系转化为直观的空间拓扑。

### 3.1 核心功能

#### 3.1.1 力导向图 (Force-Directed Graph)
- 自动布局节点，支持缩放、拖拽
- 使用 `react-force-graph-2d` 进行渲染
- 节点颜色与 Schema 实体类型颜色保持一致

#### 3.1.2 交互联动
- 点击画布中的节点，【案例详情卡片】同步跳转至对应内容
- 悬停高亮相邻节点和关系
- 双击节点查看详情

#### 3.1.3 路径分析
- 高亮显示两个特定城市更新案例之间的共同点
- 示例：使用了相同的容积率奖励政策
- 支持最短路径计算和展示（BFS 算法已实现）

#### 3.1.4 过滤筛选
- 按实体种类过滤视图
- 按关系强度过滤视图
- 搜索框支持节点名称模糊搜索

### 3.2 技术实现
- 从案例数据动态生成图谱节点和链接
- 节点位置使用力导向布局
- 图例显示当前 Schema 的实体类型
- 支持实体/关系在图谱上直接创建

---

## 4. AI 对话助手 (Cognitive Copilot)

基于知识图谱的高级问答系统。

### 4.1 核心功能

#### 4.1.1 多 Agent 架构
- **Schema Builder Agent**: 对话式创建知识结构
- **Case Extractor Agent**: 基于 Schema 智能提取实体和关系
- **Analysis Assistant Agent**: Graph-RAG 专业咨询

#### 4.1.2 Graph-RAG (检索增强生成)
- AI 不仅搜索文本，还会检索图谱中的关系逻辑
- 结合图谱结构数据生成回答
- 支持 RAG 混合检索 API

#### 4.1.3 上下文感知
- AI 知道用户当前正在查看哪个 Schema 或哪个案例
- 选中节点时，自动将该节点作为上下文
- 上下文信息在 UI 中显示

#### 4.1.4 自动提取建议
- AI 扫描案例原文，自动建议可加入图谱的新实体和关系
- 用户在画布中确认添加
- 支持批量添加

#### 4.1.5 会话历史管理
- 支持多会话并行
- 会话历史持久化到数据库
- 支持会话标题更新和删除

### 4.2 技术实现
- SSE 流式响应
- Agent 服务层抽象
- 支持自定义 AI 配置（endpoint、model、temperature）
- 会话历史 API 持久化

---

## 5. 技术架构 (Technical Stack)

### 5.1 前端技术栈
| 维度 | 方案 | 版本 |
|------|------|------|
| 前端框架 | React + Vite | React 19.2.0, Vite 7.3.1 |
| 状态管理 | Zustand | 5.0.12 |
| 图谱渲染 | react-force-graph-2d | 1.29.1 |
| 流程图编辑 | @xyflow/react | 12.10.2 |
| UI 样式 | Tailwind CSS | 3.4.17 |
| 动画效果 | Framer Motion | 12.35.2 |
| 图标库 | Lucide React | 0.577.0 |
| 路由管理 | React Router DOM | 7.13.1 |
| Markdown | react-markdown | 10.1.0 |

### 5.2 后端技术栈
| 维度 | 方案 | 版本 |
|------|------|------|
| 后端框架 | Express.js | 5.2.1 |
| 数据库 | PostgreSQL | 8.20.0 (pg driver) |
| 图形扩展 | Apache AGE | 规划中 |
| 认证 | JWT + bcryptjs | jsonwebtoken 9.0.3 |
| AI 接口 | OpenAI 兼容 API | 可配置 |

### 5.3 API 模块
| 路径 | 功能 |
|------|------|
| `/api/auth` | 用户认证（注册、登录、验证） |
| `/api/schemas` | Schema CRUD + 实体类型/关系管理 |
| `/api/cases` | 案例 CRUD + 实体/关系管理 |
| `/api/graphs` | 图谱管理（Apache AGE） |
| `/api/agents` | Agent 调用（同步/流式） |
| `/api/chat` | 会话历史管理 |
| `/api/ai` | AI 配置管理 |
| `/api/rag` | RAG 检索与问答 |

---

## 6. 核心交互流程 (User Flow)

### 6.1 完整流程
1. **用户登录**: 注册/登录获取 JWT Token
2. **定义 Schema**: 用户在 Schema 模块定义"城市更新"包含 [建筑]、[政策]、[资金] 三大类
3. **创建案例**: 选择"上海新天地"案例，系统根据 Schema 渲染出填写模板
4. **添加实体**: 在案例详情中添加项目相关的实体（如：项目公司、改造模式、地块信息）
5. **建立关系**: 在实体间建立关系连接（如：[锦江集团] 投资 [上海新天地]）
6. **生成图谱**: 点击"同步到图谱"，画布模块出现新节点
7. **探索分析**: 在 AI 助手提问："这个项目的资金来源与政策之间有什么逻辑关系？"
8. **AI 回答**: AI 结合图谱连线给出回答

### 6.2 状态联动
- Schema 变更 → 案例表单字段自动更新
- 案例实体变更 → 图谱画布实时更新
- 图谱节点选中 → AI 助手上下文自动设置

---

## 7. 目录结构

```
/opt/node-apps/hturbo-react/
├── src/
│   ├── components/               # (未使用，组件在 pages 下)
│   ├── pages/
│   │   ├── Home/
│   │   │   ├── Home.jsx          # 主页入口
│   │   │   └── Home.css
│   │   └── CaseFlow/
│   │   │   ├── CaseFlow.jsx      # 主页面布局
│   │   │   ├── CaseFlow.css
│   │   │   └── components/
│   │   │       ├── SchemaArchitect.jsx    # Schema 管理模块 (~400行)
│   │   │       ├── KnowledgeGraphCanvas.jsx # 知识图谱画布 (~500行)
│   │   │       ├── AICopilot.jsx          # AI 对话助手 (~600行)
│   │   │       ├── CaseDetail.jsx         # 案例详情模块
│   │   │       └── LoginModal.jsx         # 登录弹窗
│   ├── services/
│   │   └── api.js                # API 服务层封装
│   ├── store/
│   │   └── index.js              # Zustand 状态管理 (~1000行)
│   ├── assets/
│   ├── App.jsx                   # 路由配置
│   ├── main.jsx                  # 入口文件
│   └── index.css                 # 全局样式
├── server/
│   ├── index.js                  # Express 入口
│   ├── config.js                 # 配置管理
│   ├── db.js                     # 数据库连接
│   ├── init.js                   # 数据库初始化
│   ├── middleware/
│   │   └── auth.js               # JWT 认证中间件
│   ├── routes/
│   │   ├── auth.js               # 认证路由
│   │   ├── schemas.js            # Schema 路由
│   │   ├── cases.js              # 案例路由
│   │   ├── graphs.js             # 图谱路由
│   │   ├── agents.js             # Agent 路由
│   │   ├── chat.js               # 会话历史路由
│   │   ├── ai.js                 # AI 配置路由
│   │   └ rag.js                  # RAG 路由
│   ├── services/
│   │   └── agent.js              # Agent 服务实现
│   ├── package.json
│   └── .env
├── public/
├── dist/                         # 构建输出
├── package.json
├── vite.config.js
├── tailwind.config.js
├── eslint.config.js
├── CaseFlow_spec.md              # 本文档
└── README.md
```

---

## 8. 当前实现状态

### 8.1 已完成模块
| 模块 | 状态 | 备注 |
|------|------|------|
| Schema 管理模块 | ✅ 完成 | 支持可视化编辑、API 持久化 |
| 案例详情模块 | ✅ 完成 | 实体/关系 CRUD |
| 知识图谱画布 | ✅ 完成 | 力导向图、路径分析 |
| AI 对话助手 | ✅ 完成 | 多 Agent、SSE 流式响应 |
| 用户认证系统 | ✅ 完成 | JWT + bcrypt |
| 后端 API | ✅ 完成 | 8 个路由模块 |
| 全局状态管理 | ✅ 完成 | 6 个 Zustand Store |

### 8.2 待完善功能
| 功能 | 优先级 | 状态 |
|------|--------|------|
| 案例数据同步到图谱的自动联动 | P1 | 需完善 |
| 映射编辑器完整实现 | P2 | 未完成 |
| Apache AGE 图数据库集成 | P2 | 规划中 |
| 数据导入/导出（Markdown、PDF） | P3 | 未完成 |
| 多用户协作功能 | P3 | 规划中 |
| 高级图谱分析（社区发现、中心性） | P3 | 规划中 |

---

## 9. 代码审查报告

### 9.1 ESLint 检测结果
**总问题数**: 65 个（61 errors, 4 warnings）

### 9.2 严重问题 (P0 - 必须立即修复)

#### 9.2.1 变量未定义错误
| 文件 | 行号 | 问题 | 影响 |
|------|------|------|------|
| `SchemaArchitect.jsx` | 169-170 | `editFormData` 未定义 | 运行时崩溃 |

```js
// 当前代码 (有bug)
const handleSaveSchemaEdit = () => {
  if (editFormData.name.trim()) { // editFormData 未声明
    ...
  }
};
```

#### 9.2.2 Hook 规则违规
| 文件 | 行号 | 问题 | 影响 |
|------|------|------|------|
| `AICopilot.jsx` | 159 | `loadConfigStatus` 在声明前被调用 | 函数引用不稳定 |
| `CaseDetail.jsx` | 176, 189 | `Date.now()` 在渲染阶段调用 | React 纯函数违规 |

```js
// AICopilot.jsx 问题代码
useEffect(() => {
  loadConfigStatus(); // ❌ 此时 loadConfigStatus 未定义
}, []);
const loadConfigStatus = async () => {...}; // 后面才定义

// CaseDetail.jsx 问题代码
id: `e-${Date.now()}` // ❌ 在事件处理函数中调用可以，但不应在渲染逻辑中
```

#### 9.2.3 ESLint 配置缺失
| 文件 | 问题 |
|------|------|
| `eslint.config.js` | 未配置 Node.js globals，server 目录报 `process` not defined |
| `tailwind.config.js` | 使用 `require` 但未配置 Node 环境 |

### 9.3 代码质量问题 (P1 - 尽快修复)

#### 9.3.1 大量未使用的变量/导入
| 文件 | 问题变量 | 建议 |
|------|----------|------|
| `CaseFlow.jsx` | `motion`, `currentCaseId`, `casesLoading`, `schemasLoading` | 移除 |
| `AICopilot.jsx` | `motion`, `agents`, `addEntityToCase`, `addRelationToCase`, `expandedEntities` | 移除 |
| `CaseDetail.jsx` | `useRef`, `motion`, `updateCase`, `setHighlightedNodes`, `sendToAI`, `messages` | 移除 |
| `KnowledgeGraphCanvas.jsx` | `motion`, `focusCaseId`, `setCurrentCase`, `accentColor` | 移除 |
| `SchemaArchitect.jsx` | `useCallback`, `motion`, `updateProperty`, `handleSaveSchemaEdit` | 移除 |
| `LoginModal.jsx` | `motion` | 移除 |
| `store/index.js` | `get`, `error`, `nodeIndex`, `caseExtractionPrompt` | 移除 |

#### 9.3.2 React Hook 依赖缺失
| 文件 | Hook | 缺失依赖 |
|------|------|----------|
| `CaseFlow.jsx:56` | `useEffect` | `initializeGraph`, `loadCases`, `loadSchemas`, `verifyAuth` |
| `CaseFlow.jsx:61` | `useEffect` | `loadAllCasesToGraph` |
| `AICopilot.jsx:163` | `useEffect` | `currentAgentName`, `isAuthenticated`, `loadAgents`, `loadSessionHistory` |
| `AICopilot.jsx:170` | `useEffect` | `loadSessionHistory` |

**风险**: 可能导致 stale closure，数据不更新。

#### 9.3.3 Server 端代码问题
| 文件 | 行号 | 问题 |
|------|------|------|
| `server/middleware/auth.js` | 15 | `error` 定义但未使用 |
| `server/routes/agents.js` | 57 | `context` 定义但未使用 |
| `server/services/agent.js` | 69-102 | case block 中使用 lexical declaration |
| `server/services/agent.js` | 299, 356, 396 | 未使用的 catch 变量 |

### 9.4 模块过大问题 (P2)

| 文件 | Token 数 | 建议 |
|------|----------|------|
| `AICopilot.jsx` | 16630 | 拆分为 AgentSelector, ChatPanel, SettingsPanel, ExtractorPanel |
| `KnowledgeGraphCanvas.jsx` | 14727 | 拆分为 GraphRenderer, PathAnalysis, EntityDrawer, FilterPanel |
| `SchemaArchitect.jsx` | 10966 | 拆分为 EntityEditor, RelationEditor, SchemaVisualizer |
| `store/index.js` | 10671 | 拆分为独立文件: auth.js, schema.js, case.js, graph.js, ai.js, agent.js |

### 9.5 安全问题 (P2)

| 问题 | 文件 | 建议 |
|------|------|------|
| XSS 风险 | `AICopilot.jsx` (react-markdown) | 禁用危险 HTML 元素 |
| Token 存储 | `api.js` (localStorage) | 考虑 httpOnly cookie |
| 输入验证 | `LoginModal.jsx` | 添加用户名格式和密码复杂度验证 |

---

## 10. 修复计划

### 10.1 Phase 1: 紧急修复 (P0)

**目标**: 修复会导致运行时崩溃的问题

| 任务 | 文件 | 修复方案 | 预估时间 |
|------|------|----------|----------|
| 1.1 修复 `editFormData` 未定义 | `SchemaArchitect.jsx` | 添加状态声明或删除未使用函数 | 10 min |
| 1.2 修复 `loadConfigStatus` 声明顺序 | `AICopilot.jsx` | 将函数声明移到 useEffect 之前 | 10 min |
| 1.3 修复 `Date.now()` in render | `CaseDetail.jsx` | 将 ID 生成移到事件处理函数 | 15 min |
| 1.4 修复 ESLint 配置 | `eslint.config.js` | 添加 Node.js globals 配置 | 10 min |

### 10.2 Phase 2: 代码清理 (P1)

**目标**: 清理未使用代码，修复 Hook 依赖

| 任务 | 文件 | 修复方案 | 预估时间 |
|------|------|----------|----------|
| 2.1 清理未使用导入 | 所有前端文件 | 移除未使用的 import | 30 min |
| 2.2 清理未使用变量 | 所有前端文件 | 移除未使用的解构变量 | 30 min |
| 2.3 修复 Hook 依赖 | `CaseFlow.jsx`, `AICopilot.jsx` | 添加缺失依赖或使用 useCallback | 20 min |
| 2.4 清理 Server 端代码 | `server/` | 修复 no-unused-vars 和 case block 问题 | 20 min |

### 10.3 Phase 3: 模块拆分 (P2)

**目标**: 提升代码可维护性

| 任务 | 当前文件 | 目标结构 | 预估时间 |
|------|----------|----------|----------|
| 3.1 Store 拆分 | `store/index.js` | `store/auth.js`, `store/schema.js`, `store/case.js`, `store/graph.js`, `store/ai.js`, `store/agent.js` | 1 hour |
| 3.2 AICopilot 拆分 | `AICopilot.jsx` | `components/AgentSelector.jsx`, `components/ChatPanel.jsx`, `components/SettingsPanel.jsx` | 1 hour |
| 3.3 KnowledgeGraphCanvas 拆分 | `KnowledgeGraphCanvas.jsx` | `components/GraphRenderer.jsx`, `components/PathAnalysis.jsx`, `components/EntityDrawer.jsx` | 1 hour |
| 3.4 SchemaArchitect 择分 | `SchemaArchitect.jsx` | `components/EntityEditor.jsx`, `components/RelationEditor.jsx`, `components/SchemaVisualizer.jsx` | 1 hour |

### 10.4 Phase 4: 安全加固 (P2)

**目标**: 提升安全性

| 任务 | 文件 | 修复方案 | 预估时间 |
|------|------|----------|----------|
| 4.1 Markdown XSS | `AICopilot.jsx` | 配置 disallowedElements | 15 min |
| 4.2 输入验证 | `LoginModal.jsx` | 添加正则验证 | 20 min |
| 4.3 Server 输入验证 | `routes/auth.js` | 添加 express-validator | 30 min |

### 10.5 Phase 5: 功能完善 (P3)

**目标**: 完善待实现功能

| 任务 | 描述 | 预估时间 |
|------|------|----------|
| 5.1 案例图谱联动 | 实现案例实体变更自动同步到图谱 | 2 hours |
| 5.2 映射编辑器 | 实现文本段落与实体的关联标注 | 3 hours |
| 5.3 Apache AGE 集成 | 替换模拟图谱为真实图数据库 | 4 hours |

---

## 11. 修复验收标准

### 11.1 Phase 1 验收
- `npm run lint` 无 P0 级错误
- 所有页面正常渲染，无运行时崩溃

### 11.2 Phase 2 验收
- `npm run lint` 无 errors（允许 warnings）
- ESLint 检测问题数 ≤ 5

### 11.3 Phase 3 验收
- 所有核心组件 ≤ 200 行代码
- 所有 store 文件 ≤ 200 行代码

### 11.4 Phase 4 验收
- XSS 测试通过（无脚本注入）
- 输入验证覆盖所有用户输入入口

---

## 12. 未来扩展路线图

### 12.1 短期目标 (Q2 2026)
1. 完善图谱与案例的数据联动
2. 实现映射编辑器
3. Apache AGE 图数据库集成
4. 接入真实 AI 接口（已完成框架）

### 12.2 中期目标 (Q3 2026)
1. 多用户协作功能
2. 案例导入/导出（支持 Markdown、PDF）
3. 高级图谱分析（社区发现、中心性分析）

### 12.3 长期目标 (Q4 2026)
1. 数据可视化仪表板
2. 移动端适配
3. 国际化支持

---

## 附录 A: ESLint 详细报告

```
/opt/node-apps/hturbo-react/server/config.js
   5:27  error  'process' is not defined  no-undef
   6:21  error  'process' is not defined  no-undef
  10:13  error  'process' is not defined  no-undef
  11:11  error  'process' is not defined  no-undef
  12:10  error  'process' is not defined  no-undef
  17:22  error  'process' is not defined  no-undef
  18:19  error  'process' is not defined  no-undef

/opt/node-apps/hturbo-react/server/index.js
  40:28  error  'process' is not defined  no-undef

/opt/node-apps/hturbo-react/server/middleware/auth.js
  15:12  error  'error' is defined but never used  no-unused-vars

/opt/node-apps/hturbo-react/server/routes/agents.js
  57:20  error  'context' is assigned a value but never used  no-unused-vars

/opt/node-apps/hturbo-react/server/services/agent.js
   69:7   error  Unexpected lexical declaration in case block  no-case-declarations
   70:7   error  Unexpected lexical declaration in case block  no-case-declarations
   73:7   error  Unexpected lexical declaration in case block  no-case-declarations
  102:7   error  Unexpected lexical declaration in case block  no-case-declarations
  299:18  error  'e' is defined but never used  no-unused-vars
  356:46  error  'k' is defined but never used  no-unused-vars
  396:46  error  'k' is defined but never used  no-unused-vars

/opt/node-apps/hturbo-react/src/pages/CaseFlow/CaseFlow.jsx
   2:10  error    'motion' is defined but never used
  31:18  error    'currentCaseId' is assigned a value but never used
  31:71  error    'casesLoading' is assigned a value but never used
  32:61  error    'schemasLoading' is assigned a value but never used
  56:6   warning  React Hook useEffect has missing dependencies
  61:6   warning  React Hook useEffect has a missing dependency

/opt/node-apps/hturbo-react/src/pages/CaseFlow/components/AICopilot.jsx
    2:27  error  'motion' is defined but never used
   73:5   error  'agents' is assigned a value but never used
   89:34  error  'addEntityToCase' is assigned a value but never used
   89:51  error  'addRelationToCase' is assigned a value but never used
  106:10  error  'expandedEntities' is assigned a value but never used
  138:10  error  'isLoadingConfig' is assigned a value but never used
  153:9   error  'currentCase' is assigned a value but never used
  159:5   error  Cannot access variable before it is declared
  396:9   error  'toggleEntityExpand' is assigned a value but never used
  404:9   error  'handleSelectCase' is assigned a value but never used

/opt/node-apps/hturbo-react/src/pages/CaseFlow/components/CaseDetail.jsx
    1:27  error  'useRef' is defined but never used
    2:10  error  'motion' is defined but never used
   37:5   error  'updateCase' is assigned a value but never used
   45:5   error  'setHighlightedNodes' is assigned a value but never used
   48:11  error  'sendToAI' is assigned a value but never used
   48:45  error  'messages' is assigned a value but never used
   94:11  error  'schemaPrompt' is assigned a value but never used
  176:18  error  Cannot call impure function during render (Date.now)
  189:18  error  Cannot call impure function during render (Date.now)

/opt/node-apps/hturbo-react/src/pages/CaseFlow/components/KnowledgeGraphCanvas.jsx
     2:10  error  'motion' is defined but never used
    36:28  error  'focusCaseId' is assigned a value but never used
    38:33  error  'setCurrentCase' is assigned a value but never used
   519:9   error  'accentColor' is assigned a value but never used
  1177:43  error  'globalScale' is defined but never used

/opt/node-apps/hturbo-react/src/pages/CaseFlow/components/LoginModal.jsx
  2:10  error  'motion' is defined but never used

/opt/node-apps/hturbo-react/src/pages/CaseFlow/components/SchemaArchitect.jsx
     1:35  error  'useCallback' is defined but never used
     2:10  error  'motion' is defined but never used
    92:5   error  'updateProperty' is assigned a value but never used
   167:9   error  'handleSaveSchemaEdit' is assigned a value but never used
   169:13  error  'editFormData' is not defined
   170:20  error  'editFormData' is not defined
   188:18  error  'err' is defined but never used
  1170:3   error  'isOpen' is defined but never used
  1400:3   error  'isOpen' is defined but never used

/opt/node-apps/hturbo-react/src/services/api.js
  293:22  error  'e' is defined but never used

/opt/node-apps/hturbo-react/src/store/index.js
     7:42  error  'get' is defined but never used
    82:14  error  'error' is defined but never used
   819:9   error  'nodeIndex' is assigned a value but never used
  1003:38  error  'caseExtractionPrompt' is assigned a value but never used

/opt/node-apps/hturbo-react/tailwind.config.js
  11:5  error  'require' is not defined
```

---

**文档维护者**: Claude Code Agent
**审核日期**: 2026-04-01