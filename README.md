# CaseFlow — Urban Planning Knowledge Graph Platform<br><small>城市规划知识图谱平台</small>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React 19">
  <img src="https://img.shields.io/badge/Express-5-000000?logo=express" alt="Express 5">
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT License">
</p>

**CaseFlow** is an open-source platform that helps urban planners, researchers, and analysts build interactive knowledge graphs from unstructured city planning documents. It combines visual graph exploration with AI-powered entity extraction to turn PDF reports, policy documents, and case studies into structured, queryable knowledge networks.

**CaseFlow** 是一个开源的城市规划知识图谱平台。帮助规划师、研究人员和分析师从非结构化的规划文档中提取实体与关系，构建可交互、可查询的知识网络。支持 PDF/DOCX/TXT 文档的 AI 智能解析，以及多案例对比分析。

---

## Why CaseFlow? ｜ 为什么选择 CaseFlow？

Urban planning involves navigating complex webs of relationships — zoning regulations affect housing projects, transit lines shape neighborhood development, environmental policies constrain industrial zones. Traditional document-based workflows make it hard to see these connections.

城市规划涉及错综复杂的关系网络——用地规划影响住房项目，交通线路塑造片区发展，环保政策制约产业园区。传统的文档式工作流难以洞察这些联系。

CaseFlow transforms how planners work with planning knowledge:
CaseFlow 从根本上改变了规划知识的组织方式：

- **Extract** entities (developments, policies, zones, stakeholders, infrastructure) from planning documents
  **提取** — 从规划文档中自动提取实体（开发项目、政策、用地、利益相关方、基础设施）
- **Structure** them into typed knowledge graphs with configurable schemas
  **结构化** — 将实体组织为带类型的知识图谱，支持自定义 Schema
- **Visualize** relationships through interactive force-directed graphs
  **可视化** — 通过交互式力导向图直观呈现关系网络
- **Query** across cases to discover patterns and precedents
  **查询** — 跨案例搜索，发现模式与先例
- **Analyze** with built-in GraphRAG for semantic search
  **分析** — 内置 GraphRAG 语义检索引擎，用自然语言提问

---

## Features ｜ 核心功能

### Schema Architect ｜ Schema 架构设计器

Define your urban planning domain model. Create entity types (*Zoning District*, *Transit Corridor*, *Development Project*, *Environmental Constraint*) with custom properties and relationship types. Visualize your schema as an interactive diagram before applying it to real data.

定义城市规划领域模型。创建实体类型（如*用地分区*、*交通廊道*、*开发项目*、*环境约束*），配置自定义属性和关系类型。通过交互式图表可视化 Schema 结构。

### AI-Powered Case Extraction ｜ AI 案例提取

Upload planning documents (PDF, DOCX, TXT) and let AI extract entities and relationships according to your schema. Supports multi-round extraction pipelines with human-in-the-loop review.

上传规划文档（PDF、DOCX、TXT），AI 根据你的 Schema 自动提取实体与关系。支持多轮提取管道，人工审核把关。

- 📄 Parse planning reports, environmental impact assessments, master plans / 解析规划报告、环评报告、总体规划
- 🤖 AI extracts entities aligned to your custom schema / AI 按自定义 Schema 提取实体
- ✅ Review and approve extracted results before saving / 保存前审核确认提取结果
- 🔄 Iterative refinement — adjust extraction prompts and re-run / 支持迭代优化，调整提示词重新提取

### Interactive Knowledge Graph ｜ 交互式知识图谱

Explore urban relationships through an interactive force-directed graph.
通过交互式力导向图探索城市关系。

- 🔍 Full-text search across all entities / 全实体全文搜索
- 🛤️ Path analysis — find connections between any two entities / 路径分析 — 发现任意两个实体间的连接路径
- 🎯 Focus mode — drill into specific cases or entities / 聚焦模式 — 深入特定案例或实体
- 📊 Filter by entity type, case, or relationship / 按实体类型、案例、关系筛选
- 💾 Export to GraphML, CSV, or JSON for GIS integration / 导出 GraphML/CSV/JSON，支持 GIS 集成

### Multi-Case Analysis ｜ 多案例对比分析

Compare planning cases side by side. Identify patterns across projects, reuse successful strategies, and spot emerging issues.
并排对比多个规划案例，识别跨项目模式，复用成功经验，发现潜在问题。

### GraphRAG Semantic Search ｜ GraphRAG 语义搜索

Vector + full-text hybrid retrieval with graph expansion. Ask natural language questions and get answers grounded in your planning knowledge base.
向量 + 全文混合检索，支持图谱扩展。用自然语言提问，获取基于规划知识库的准确回答。

---

## Use Cases ｜ 应用场景

| Domain 领域 | Example 示例 |
|--------|---------|
| **Zoning & Land Use** 用地规划 | Map zoning changes → development projects → community feedback / 追踪用地变更→开发项目→社区反馈 |
| **Transit Planning** 交通规划 | Track transit lines → stations → ridership → adjacent land use / 梳理交通线路→站点→客流→周边用地 |
| **Environmental Review** 环评分析 | Link projects → environmental constraints → mitigation measures / 关联项目→环境约束→缓解措施 |
| **Housing Policy** 住房政策 | Connect policies → affordable housing projects → funding sources / 连接政策→保障房项目→资金来源 |
| **Stakeholder Analysis** 利益方分析 | Map organizations → positions → relationships on key issues / 梳理组织→立场→关键议题关系 |
| **Master Plan Tracking** 总体规划跟踪 | Monitor plan goals → implementation projects → outcomes / 跟踪规划目标→实施项目→成效评估 |

---

## Tech Stack ｜ 技术栈

| Layer 层级 | Technology 技术 |
|-------|-----------|
| **Frontend** 前端 | React 19, Framer Motion, Tailwind CSS |
| **Graph Viz** 图谱可视化 | react-force-graph-2d/3d, Three.js, d3-force |
| **Schema Viz** Schema 可视化 | @xyflow/react (React Flow) |
| **State** 状态管理 | Zustand |
| **Backend** 后端 | Express 5, PostgreSQL 16 |
| **AI** 人工智能 | OpenAI-compatible API (自备 API Key) |
| **Vector Search** 向量搜索 | pgvector + GraphRAG hybrid retrieval |
| **Document Parsing** 文档解析 | pdfjs-dist, mammoth (DOCX) |

---

## Getting Started ｜ 快速开始

### Prerequisites ｜ 环境要求

- Node.js 18+
- PostgreSQL 16+ (with pgvector extension / 需安装 pgvector 扩展)
- OpenAI-compatible API key (支持 `/v1/chat/completions` 的任何服务)

### Installation ｜ 安装

```bash
# Clone the repository ｜ 克隆仓库
git clone https://github.com/Hturbo312/caseflow.git
cd caseflow

# Install frontend dependencies ｜ 安装前端依赖
npm install

# Install server dependencies ｜ 安装后端依赖
cd server
npm install
cd ..
```

### Database Setup ｜ 数据库配置

```bash
# Create the database ｜ 创建数据库
createdb caseflow

# Enable pgvector ｜ 启用 pgvector 扩展
psql caseflow -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Run migrations ｜ 运行数据库迁移
psql caseflow -f server/migrations/001_initial.sql
```

### Configuration ｜ 环境配置

```bash
cp server/.env.example server/.env
# Edit server/.env with your database credentials and API keys
# 编辑 server/.env，填入数据库连接信息和 API Key
```

### Development ｜ 启动开发服务

```bash
npm run dev
```

The app runs at 访问地址: `http://localhost:5173`

---

## Architecture ｜ 系统架构

```
┌──────────────────────────────────────────────────────┐
│  CaseFlow Client (React SPA)                         │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Schema   │  │  Knowledge   │  │  AI Copilot   │  │
│  │ Architect│  │  Graph Canvas│  │  (3 Agents)   │  │
│  │ Schema   │  │  知识图谱    │  │   AI 助手     │  │
│  │ 架构设计  │  │  可视化画布  │  │  (3个Agent)   │  │
│  └──────────┘  └──────────────┘  └───────────────┘  │
├──────────────────────────────────────────────────────┤
│  Express API Server                                  │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ REST API │  │  SSE Stream  │  │  GraphRAG     │  │
│  │          │  │  (AI Calls)  │  │  Hybrid Search│  │
│  └──────────┘  └──────────────┘  └───────────────┘  │
├──────────────────────────────────────────────────────┤
│  PostgreSQL + pgvector                               │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Schemas  │  │  Cases +     │  │  Vector       │  │
│  │ + Types  │  │  Entities    │  │  Embeddings   │  │
│  └──────────┘  └──────────────┘  └───────────────┘  │
└──────────────────────────────────────────────────────┘
```

## Project Structure ｜ 项目结构

```
caseflow/
├── src/
│   ├── pages/CaseFlow/              # 主应用页面
│   │   └── components/
│   │       ├── SchemaArchitect/     # 领域模型设计器 (7 组件)
│   │       ├── KnowledgeGraphCanvas/ # 知识图谱可视化
│   │       ├── AICopilot/           # AI 助手 + 提取流水线
│   │       └── CaseManagement/      # 案例管理与详情
│   ├── store/                       # Zustand 状态管理
│   ├── services/                    # API 客户端层
│   ├── hooks/                       # 共享 React Hooks
│   ├── utils/                       # 工具函数
│   └── i18n/                        # 国际化 (中/英)
├── server/
│   ├── routes/                      # API 路由
│   ├── services/                    # 业务逻辑
│   │   ├── agent.js                 # AI Agent 引擎
│   │   ├── extractionPipeline.js    # 多轮提取流水线
│   │   └── graphRag.js              # GraphRAG 混合搜索
│   ├── middleware/                   # 认证中间件
│   └── migrations/                  # 数据库迁移
└── public/                          # 静态资源
```

---

## AI Agent System ｜ AI 智能体系统

CaseFlow includes three built-in AI agents that work with any OpenAI-compatible API:
CaseFlow 内置三个 AI 智能体，兼容任何 OpenAI 接口的服务：

| Agent 智能体 | Role 职责 |
|-------|------|
| **Schema Builder** 架构构建 | Generate urban planning domain models from natural language / 从自然语言生成城市规划领域模型 |
| **Case Extractor** 案例提取 | Extract entities and relationships from planning documents / 从规划文档中提取实体与关系 |
| **Analysis Assistant** 分析助手 | Answer questions using GraphRAG over your knowledge base / 基于知识库的 GraphRAG 问答 |

### Extraction Pipeline ｜ 提取流水线

1. **Parse** / **解析** — Segment documents into logical chunks / 将文档切分为逻辑段落
2. **Plan** / **规划** — Generate extraction plan per entity type / 按实体类型生成提取计划
3. **Extract** / **提取** — Parallel entity extraction with chunked re-read for long texts / 并行实体提取，长文本自动分块回读
4. **Check** / **校验** — AI-powered consistency checking and deduplication / AI 一致性校验与去重
5. **Infer** / **推断** — Relationship inference across extracted entities / 跨实体关系推断
6. **Finalize** / **入库** — Batch save with automatic embedding generation / 批量保存并自动生成向量嵌入

---

## AI Provider Setup ｜ AI 服务配置

CaseFlow works with any OpenAI-compatible API. Tested providers include OpenAI, Anthropic (via proxy), DashScope (Alibaba), ZhipuAI (GLM series), and Ollama with compatible proxy.
CaseFlow 兼容任何 OpenAI 接口的服务。已测试的提供商包括：OpenAI、Anthropic（通过代理）、阿里云 DashScope、智谱 GLM 系列、Ollama（通过兼容代理）。

Configure in-app or via environment ｜ 在应用设置中配置或通过环境变量：

```env
AI_API_KEY=your-api-key
AI_ENDPOINT=https://api.openai.com/v1/chat/completions
AI_MODEL=gpt-4o
```

---

## Contributing ｜ 参与贡献

Contributions welcome! Areas where we'd especially love help:
欢迎贡献！以下方向尤其需要帮助：

- 🗺️ GIS data import/export (GeoJSON, Shapefile) / GIS 数据导入导出
- 🏗️ Additional urban planning domain templates / 更多城市规划领域模板
- 🌐 More language translations / 更多语言翻译
- 📊 Timeline and geospatial views / 时间线和地理空间视图
- 🧩 Plugin system for custom entity extractors / 自定义实体提取器插件系统

1. Fork the repo / Fork 本仓库
2. Create a feature branch / 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. Commit your changes / 提交修改 (`git commit -m 'Add amazing feature'`)
4. Push to the branch / 推送到分支 (`git push origin feature/amazing-feature`)
5. Open a Pull Request / 发起 Pull Request

---

## License ｜ 许可证

MIT © 2026 CaseFlow Contributors

---

## Acknowledgments ｜ 致谢

- [React Flow](https://reactflow.dev/) for schema visualization / Schema 可视化
- [react-force-graph](https://github.com/vasturiano/react-force-graph) for graph rendering / 知识图谱渲染
- [Zustand](https://github.com/pmndrs/zustand) for state management / 状态管理
- [Framer Motion](https://www.framer.com/motion/) for animations / 动画效果
- [pgvector](https://github.com/pgvector/pgvector) for vector search / 向量搜索

---

<p align="center">
  <sub>Built for urban planners, by urban planners<br>为规划师而生，由规划师打造</sub>
</p>
