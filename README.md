# CaseFlow — Urban Planning Knowledge Graph Platform

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React 19">
  <img src="https://img.shields.io/badge/Express-5-000000?logo=express" alt="Express 5">
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT License">
</p>

**CaseFlow** is an open-source platform that helps urban planners, researchers, and analysts build interactive knowledge graphs from unstructured city planning documents. It combines visual graph exploration with AI-powered entity extraction to turn PDF reports, policy documents, and case studies into structured, queryable knowledge networks.

---

## Why CaseFlow?

Urban planning involves navigating complex webs of relationships — zoning regulations affect housing projects, transit lines shape neighborhood development, environmental policies constrain industrial zones. Traditional document-based workflows make it hard to see these connections.

CaseFlow transforms how planners work with planning knowledge:

- **Extract** entities (developments, policies, zones, stakeholders, infrastructure) from planning documents
- **Structure** them into typed knowledge graphs with configurable schemas
- **Visualize** relationships through interactive force-directed graphs
- **Query** across cases to discover patterns and precedents
- **Analyze** with built-in GraphRAG for semantic search

---

## Features

### Schema Architect
Define your urban planning domain model. Create entity types (*Zoning District*, *Transit Corridor*, *Development Project*, *Environmental Constraint*) with custom properties and relationship types. Visualize your schema as an interactive diagram before applying it to real data.

### AI-Powered Case Extraction
Upload planning documents (PDF, DOCX, TXT) and let AI extract entities and relationships according to your schema. Supports multi-round extraction pipelines with human-in-the-loop review.

- 📄 Parse planning reports, environmental impact assessments, master plans
- 🤖 AI extracts entities aligned to your custom schema
- ✅ Review and approve extracted results before saving
- 🔄 Iterative refinement — adjust extraction prompts and re-run

### Interactive Knowledge Graph
Explore urban relationships through an interactive force-directed graph.

- 🔍 Full-text search across all entities
- 🛤️ Path analysis — find connections between any two entities
- 🎯 Focus mode — drill into specific cases or entities
- 📊 Filter by entity type, case, or relationship
- 💾 Export to GraphML, CSV, or JSON for GIS integration

### Multi-Case Analysis
Compare planning cases side by side. Identify patterns across projects, reuse successful strategies, and spot emerging issues.

### GraphRAG Semantic Search
Vector + full-text hybrid retrieval with graph expansion. Ask natural language questions and get answers grounded in your planning knowledge base.

---

## Use Cases

| Domain | Example |
|--------|---------|
| **Zoning & Land Use** | Map zoning changes → development projects → community feedback |
| **Transit Planning** | Track transit lines → stations → ridership → adjacent land use |
| **Environmental Review** | Link projects → environmental constraints → mitigation measures |
| **Housing Policy** | Connect policies → affordable housing projects → funding sources |
| **Stakeholder Analysis** | Map organizations → positions → relationships on key issues |
| **Master Plan Tracking** | Monitor plan goals → implementation projects → outcomes |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, Framer Motion, Tailwind CSS |
| **Graph Viz** | react-force-graph-2d/3d, Three.js, d3-force |
| **Schema Viz** | @xyflow/react (React Flow) |
| **State** | Zustand |
| **Backend** | Express 5, PostgreSQL 16 |
| **AI** | OpenAI-compatible API (bring your own key) |
| **Vector Search** | pgvector + GraphRAG hybrid retrieval |
| **Document Parsing** | pdfjs-dist, mammoth (DOCX) |

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 16+ with pgvector extension
- An OpenAI-compatible API key (any provider with `/v1/chat/completions`)

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/caseflow.git
cd caseflow

# Install frontend dependencies
npm install

# Install server dependencies
cd server
npm install
cd ..
```

### Database Setup

```bash
# Create the database
createdb caseflow

# Enable pgvector
psql caseflow -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Run migrations
psql caseflow -f server/migrations/001_initial.sql
```

### Configuration

```bash
cp server/.env.example server/.env
# Edit server/.env with your database credentials and API keys
```

### Development

```bash
npm run dev
```

The app runs at `http://localhost:5173`.

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│  CaseFlow Client (React SPA)                         │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Schema   │  │  Knowledge   │  │  AI Copilot   │  │
│  │ Architect│  │  Graph Canvas│  │  (3 Agents)   │  │
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

## Project Structure

```
caseflow/
├── src/
│   ├── pages/CaseFlow/           # Main application
│   │   └── components/
│   │       ├── SchemaArchitect/  # Domain model designer
│   │       ├── KnowledgeGraphCanvas/  # Graph visualization
│   │       ├── AICopilot/        # AI assistant + extraction
│   │       └── CaseManagement/   # Case browser & details
│   ├── store/                    # Zustand state
│   ├── services/                 # API client layer
│   ├── hooks/                    # Shared React hooks
│   ├── utils/                    # Utility functions
│   └── i18n/                     # i18n (EN/ZH)
├── server/
│   ├── routes/                   # API routes
│   ├── services/                 # Business logic
│   │   ├── agent.js              # AI agent engine
│   │   ├── extractionPipeline.js # Multi-round extraction
│   │   └── graphRag.js           # GraphRAG search
│   ├── middleware/                # Auth middleware
│   └── migrations/               # DB migrations
└── public/                       # Static assets
```

---

## AI Agent System

CaseFlow includes three built-in AI agents that work with any OpenAI-compatible API:

| Agent | Role |
|-------|------|
| **Schema Builder** | Generate urban planning domain models from natural language |
| **Case Extractor** | Extract entities and relationships from planning documents |
| **Analysis Assistant** | Answer questions using GraphRAG over your knowledge base |

Configure your endpoint and API key in Settings.

### Extraction Pipeline

1. **Parse** — Segment documents into logical chunks
2. **Plan** — Generate extraction plan per entity type
3. **Extract** — Parallel entity extraction with chunked re-read for long texts
4. **Check** — AI-powered consistency checking and deduplication
5. **Infer** — Relationship inference across extracted entities
6. **Finalize** — Batch save with automatic embedding generation

---

## Configuration

### AI Provider Setup

CaseFlow works with any OpenAI-compatible API. Tested providers include OpenAI, Anthropic (via proxy), DashScope, ZhipuAI (GLM), and Ollama with compatible proxy.

Configure in-app or via environment:

```env
AI_API_KEY=your-api-key
AI_ENDPOINT=https://api.openai.com/v1/chat/completions
AI_MODEL=gpt-4o
```

---

## Contributing

Contributions welcome! Areas where we'd especially love help:

- 🗺️ GIS data import/export (GeoJSON, Shapefile)
- 🏗️ Additional urban planning domain templates
- 🌐 More language translations
- 📊 Timeline and geospatial views
- 🧩 Plugin system for custom entity extractors

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

MIT © 2026 CaseFlow Contributors

---

## Acknowledgments

- [React Flow](https://reactflow.dev/) for schema visualization
- [react-force-graph](https://github.com/vasturiano/react-force-graph) for graph rendering
- [Zustand](https://github.com/pmndrs/zustand) for state management
- [Framer Motion](https://www.framer.com/motion/) for animations
- [pgvector](https://github.com/pgvector/pgvector) for vector search

---

<p align="center">
  <sub>Built for urban planners, by urban planners</sub>
</p>
