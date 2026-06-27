# Urban CaseFlow — Reproducibility Guide

## 1. Scope

This document describes how to reproduce the experiments in the Urban CaseFlow paper. It covers:

- The software version and environment used
- Dataset composition and provenance
- Schema design and rationale
- AI model configurations and system prompts
- The complete extraction and review procedure
- Human review protocol
- Retrieval and recommendation configuration
- Evaluation methodology
- Known reproducibility limitations

This document does **not** provide an introduction to the system. For operational guidance, see [`USER_GUIDE.md`](USER_GUIDE.md).

**Paper status:** The associated paper is under development. The information below is based on the current codebase and data. Fields marked [TODO] will be completed upon paper submission.

---

## 2. Repository Version

| Field | Value |
|-------|-------|
| Repository | `https://github.com/Hturbo312/caseflow` |
| Branch | `main` |
| Release tag | [TODO: create release tag] |
| Commit hash | [TODO: update at release time] |
| Date | 2026-06-27 |
| Node.js | 18+ |
| PostgreSQL | 16+ |
| pgvector | [version from deployment] |
| Apache AGE | [version from deployment] |
| Operating System | Ubuntu Linux (development) |

---

## 3. Dataset

### Composition

The paper's experiments use an urban renewal domain dataset consisting of:

- **Number of cases:** 51
- **Schema:** Schema 3 (two-layer urban renewal analysis model)
- **Total entities:** ~553
- **Total relations:** ~1,432

### Data Sources

Cases were drawn from published urban planning documents, policy papers, and academic case studies covering urban renewal and redevelopment projects. The dataset spans multiple cities and governance contexts, including Chinese urban renewal projects and international comparative cases.

### Data Availability

The full dataset is **not publicly available** due to copyright restrictions on the source planning documents. The `testdata/` directory contains two sample files for testing the system:

- `10.1080_00420980701507787.pdf` — an academic journal article (example)
- `曼哈顿沿海项目.docx` — a Chinese DOCX file about a Manhattan coastal project (example)

These are demonstration files only and do **not** represent the full experimental dataset.

### Alternative Data

To reproduce the methodology without access to the original dataset:

1. Use the `testdata/` files as input to verify the extraction pipeline functions.
2. Run `node server/generateTestData.js` to generate synthetic test data (10 cases, ~500 entities, 6 entity types, 8 relation types).
3. Apply your own planning documents following the same schema and procedure.

### Data Selection Criteria

[TODO: describe the criteria used to select cases for the experimental dataset]

### Data Cleaning

Documents were used as-is after PDF text extraction. No manual text cleaning or normalization was performed before entity extraction. This reflects the real-world condition of planning documents.

---

## 4. Schema

### Schema Name and Version

The experimental schema is named **"双层城市更新分析模型"** (Two-Layer Urban Renewal Analysis Model), corresponding to `schema_id = 3` in the database.

[TODO: confirm schema version and save to `reproducibility/schema/urban-renewal-schema.json`]

### Entity Types

The schema defines entity types at two conceptual levels:

**Macro / Concept Layer (case_id = 0):**
- Physical Change (物理空间改变)
- Development (建设/开发)
- Participation Mechanism (参与机制)
- Governance Mechanism (治理机制/模式)
- Planning/Spatial Policy (规划/空间政策)
- Other Event (其他事件)

**Micro / Case Layer:**
- Actor (行动者)
- Organization (组织)
- Policy (政策)
- Project (项目)
- Location (地点)
- Event (事件)

[TODO: complete entity type list with properties]

### Relation Types

[TODO: list all relation types from the experimental schema]

### Schema Design Rationale

The two-layer design separates **cross-case concepts** (abstract analytical categories that apply across cases) from **case-specific entities** (concrete instances within individual cases). This enables:
- Systematic cross-case comparison via shared concept-layer neighbors
- Case recommendation via Jaccard similarity over concept-layer graph topology
- Controlled AI extraction constrained to concrete entity types while preserving conceptual categories

### Schema Adjustments During Experiments

[TODO: document whether the schema was refined during the experiment, and how changes were recorded]

---

## 5. Models and APIs

### LLM Configuration

| Parameter | Value |
|-----------|-------|
| Provider | Zhipu (BigModel) |
| Endpoint | `https://open.bigmodel.cn/api/paas/v4/chat/completions` |
| Model | GLM-5V-Turbo (development) / [TODO: final model] |
| Temperature | 0.7 (default agents), 0.3 (case_extractor) |
| Max Tokens | 16,384 |
| Request dates | [TODO: date range of experimental runs] |

### Embedding Configuration

| Parameter | Value |
|-----------|-------|
| Provider | Zhipu (BigModel) |
| Endpoint | `https://open.bigmodel.cn/api/paas/v4/embeddings` |
| Model | embedding-2 |
| Dimension | **1536** |
| Similarity metric | Cosine |

### Model Drift Note

LLM and embedding models may produce different results over time as providers update model versions. The specific model versions used in experiments are recorded above. Reproduction with the same model name may yield different results if the provider has updated the model.

---

## 6. Prompts

### Prompt Storage Location

All system prompts are defined in `server/init.js` within the `AGENTS_DATA` array. The relevant agents are:

- `schema_builder` — schema generation prompt (lines ~8-66)
- `case_extractor` — entity extraction prompt (lines ~72-122)
- `analysis_assistant` — analysis and QA prompt (lines ~145-195)
- `schema_analyzer` — schema analysis prompt (lines ~200-232)
- `text_parser` — text parsing prompt (lines ~237-279)
- `extraction_planner` — extraction planning prompt (lines ~284-321)
- `consistency_checker` — consistency checking prompt (lines ~326-365)
- `relation_inferrer` — relation inference prompt (lines ~370-409)

### Self-Reflection (Agent Loop) Prompts

Three agents (`schema_builder`, `case_extractor`, `analysis_assistant`) have self-reflection loops enabled with:
- **Max iterations:** 2
- **Pass threshold:** 7/10
- **Evaluation prompt:** Defined inline in `AGENTS_DATA.loop_config.evaluationPrompt`

### Current Limitation

Prompts are embedded in code (`server/init.js`) rather than stored as versioned prompt files. This means prompt changes are tracked only through git history of `init.js`. [TODO: extract prompts to `reproducibility/prompts/` directory]

---

## 7. Extraction Procedure

### Complete Pipeline

1. **Schema loading:** The experimental schema (schema_id = 3) is loaded from the database.
2. **Document parsing** (no LLM): Documents are split into paragraphs. Text is hashed (MD5) for deduplication.
3. **Extraction planning** (LLM): The `extraction_planner` agent determines entity type priority based on text content and schema definitions.
4. **Entity extraction** (LLM): The `case_extractor` agent extracts entities per type. All entity types are processed in parallel (`extractAllEntities`). For entity types without text hints, a chunked re-read scans the full text in 4,000-character blocks.
5. **Entity review** (human): See [Human Review Protocol](#8-human-review-protocol).
6. **Consistency check** (rules + LLM): Name-based deduplication. For entity types with >5 candidates, the `consistency_checker` agent suggests additional merges.
7. **Relation inference** (LLM): The `relation_inferrer` agent proposes relations based on approved entities and schema relation definitions.
8. **Relation review** (human): See [Human Review Protocol](#8-human-review-protocol).
9. **Knowledge graph write:** Approved entities and relations are batch-saved to the database.
10. **Embedding generation:** `triggerAutoEmbed` is called automatically after finalization, generating 1536-dimensional vectors for all saved entities and cases via the `/api/ai/embedding` endpoint.

### Agent Loop (Self-Reflection)

For the `case_extractor` agent, each extraction iteration:
1. Generates output → evaluates against criteria → if score < 7, regenerates with improvement feedback
2. Maximum 2 iterations per extraction
3. The final (highest-scoring) iteration is presented for human review
4. Previous iterations are preserved and viewable as expandable "old versions"

---

## 8. Human Review Protocol

### Reviewer Information

[TODO: number of reviewers, their professional backgrounds, inter-rater reliability if calculated]

### Entity Review Criteria

| Criterion | Rule |
|-----------|------|
| Name accuracy | Entity name must correctly identify the entity as described in source text |
| Type correctness | Entity type must match the schema definition |
| Property accuracy | Property values must be extractable from source text, not inferred |
| Existence | The entity must actually be mentioned in the source document |

### Entity Retention Rules

- **Approve:** Entity meets all four criteria above
- **Skip:** Entity fails one or more criteria, or is a duplicate
- **Merge:** Two or more candidates clearly refer to the same real-world entity

### Relation Confirmation Criteria

| Criterion | Rule |
|-----------|------|
| Source/target existence | Both entities exist in the approved entity set |
| Relation type match | The relation must be defined in the schema for this entity type pair |
| Direction correctness | Source→target direction must be correct per schema and context |
| Evidence sufficiency | The evidence text must reasonably support the relation |

### Evidence Requirements

- Each entity records `source_segment_ids` linking to the text segments from which it was extracted.
- Each relation candidate includes an `evidence` field with a brief textual justification.
- Reviewers are expected to verify evidence by expanding the evidence panel in the review interface and reading the source text.

### Conflict Resolution

[TODO: describe how reviewer disagreements were resolved]

### Review Record

Review decisions (approve/skip/edit status for each candidate) are stored in the extraction progress metadata within `case_memory` table. [TODO: confirm whether detailed per-reviewer records exist]

---

## 9. Retrieval Configuration

### GraphRAG Hybrid Retrieval

| Parameter | Value | Location |
|-----------|-------|----------|
| Vector search threshold | 0.3 | `server/services/graphRag.js` |
| Vector search limit | 20 | `server/services/graphRag.js` |
| Full-text search limit | 20 | `server/services/graphRag.js` |
| RRF rank constant (k) | 60 | `server/services/graphRag.js` |
| Graph expansion depth | 1 | `server/services/graphRag.js` |
| Graph expansion limit | 15 entities per hop | `server/services/graphRag.js` |
| Entity context limit (for LLM) | 10 entities | `server/services/agent.js` L414 |
| Relation context limit (for LLM) | 15 relations | `server/services/agent.js` L420 |
| Case context limit (for LLM) | 5 cases | `server/services/agent.js` L426 |

### Case Recommendation

| Parameter | Weight | Location |
|-----------|--------|----------|
| Graph-structure (Jaccard) | 0.5 | `server/services/graphRag.js` L386 |
| Case vector similarity | 0.3 | `server/services/graphRag.js` L390 |
| Entity-type distribution | 0.2 | `server/services/graphRag.js` L394 |
| Concept-layer graph | `case_id = 0` in AGE | `server/services/graphRag.js` L320 |

### Retrieval in AI Analysis Assistant Context

When the `analysis_assistant` agent is invoked:
1. GraphRAG retrieval is performed using the user's question as the query.
2. Retrieved entities, relations, cases, and subgraph metadata are injected into the system prompt.
3. The LLM generates a response grounded in this retrieved context.

---

## 10. Evaluation

### Research Questions

[TODO: formal research questions from the paper]

### Evaluation Dimensions

[TODO: evaluation dimensions being assessed]

### Metrics

[TODO: specific metrics — entity extraction precision/recall, relation extraction accuracy, retrieval precision/recall, etc.]

### Baseline

[TODO: baseline methods for comparison, if any]

### Qualitative Analysis

[TODO: case studies, expert evaluation methodology]

### Quantitative Results

[TODO: results tables, statistical tests]

### Output File Locations

[TODO: paths to evaluation outputs, figures, tables]

### Current Status

The codebase does **not** currently contain automated evaluation scripts. Evaluation was conducted through a combination of:
- Manual entity/relation review during the extraction pipeline
- Expert assessment of case recommendation relevance
- Qualitative analysis of GraphRAG responses

Adding automated evaluation benchmarks is a roadmap item.

---

## 11. Running the Reproduction

### Step-by-Step Commands

```bash
# 1. Clone and install
git clone https://github.com/Hturbo312/caseflow.git
cd caseflow
git checkout [TODO: release tag or commit hash]
npm install
cd server && npm install && cd ..

# 2. Database setup
createdb knowledge_graph
psql knowledge_graph -c "CREATE EXTENSION IF NOT EXISTS vector;"
psql knowledge_graph -c "CREATE EXTENSION IF NOT EXISTS age;"

# 3. Configure AI
cp server/.env.example server/.env
# Edit server/.env with your API key and endpoint

# 4. Start backend (auto-initializes DB tables and agents)
cd server && npm run dev &

# 5. If using test data:
node server/generateTestData.js

# 6. Start frontend
cd .. && npm run dev

# 7. Access at http://localhost:5173/caseflow
```

### Manual Steps Required

- Schema creation (or import from exported JSON)
- Case creation and document upload
- Initiating the extraction pipeline for each case
- Human review of all entity and relation candidates
- Recording review decisions

### Steps Requiring External API Access

- All entity extraction, relation inference, and consistency checking steps
- Embedding generation for entities and cases
- GraphRAG queries and analysis assistant questions

### Expected Variability Across Runs

- **LLM output** will vary due to model stochasticity, even with temperature=0
- **Model updates** by the API provider may change output quality
- **Human review decisions** will differ between reviewers
- **Embedding vectors** may change if the embedding model is updated

---

## 12. Expected Outputs

### Entity Data

Approved entities with:
- ID, name, entity_type, properties, case_id
- Source text segments
- 1536-dimension embedding vector

### Relation Data

Approved relations with:
- ID, source_entity_id, target_entity_id, relation_type, case_id

### Graph Data

- AGE graph with vertices (entities) and edges (relations)
- Available through `/api/graphs/` endpoints

### Embeddings

- `case_entities.embedding`: pgvector(1536) for all entities
- `cases.embedding`: pgvector(1536) for all cases

### Query Results

- GraphRAG search results (entities, cases, relations, subgraph)
- Case recommendation rankings with per-signal scores

### Logs and Records

- Agent session history in `chat_history` and `chat_sessions` tables
- Extraction progress in `case_memory` table
- Schema analysis records in `schema_memory` table

---

## 13. Reproducibility Limitations

1. **Closed-source model updates.** The LLM and embedding models used are proprietary. The same API call made at different times may produce different outputs due to model updates.

2. **Stochastic generation.** Even with temperature=0, LLM outputs are non-deterministic due to floating-point operations and provider-side sampling.

3. **Human review variability.** Entity and relation approval decisions are made by human reviewers. Different reviewers, or the same reviewer at different times, may make different judgments. Inter-rater reliability was [TODO: calculated / not calculated].

4. **Non-public dataset.** The full experimental dataset cannot be shared due to copyright restrictions on source documents. Only a subset of example documents is available in `testdata/`.

5. **API dependency.** The extraction pipeline, relation inference, and GraphRAG QA all require external API access. Reproducing results requires API credentials for a compatible provider.

6. **Prompt evolution.** System prompts were refined during development. While the final prompts are stored in `server/init.js`, intermediate prompt versions are only available through git history.

7. **Schema specificity.** The experimental schema was designed for urban renewal analysis. Results may not generalize to other planning domains without schema adaptation.

8. **Language coverage.** The system has been tested with Chinese and English planning documents. Extraction quality for other languages is unverified.

9. **Embedding dimension lock-in.** The dimension 1536 is hardcoded. Switching to a model with a different embedding dimension requires database schema changes and re-embedding all existing data.

10. **No automated evaluation pipeline.** Evaluation currently relies on manual review. Automated benchmarks and evaluation scripts are planned but not yet implemented.
