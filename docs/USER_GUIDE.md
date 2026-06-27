# Urban CaseFlow — User Guide

## 1. Introduction

### Who This Guide Is For

This guide is for researchers, urban planning analysts, and students who will use Urban CaseFlow to structure, compare, and analyze planning case knowledge. It assumes familiarity with urban planning concepts but no prior experience with knowledge graphs or AI-assisted extraction.

### How Urban CaseFlow Works

Urban CaseFlow operates on a human-in-the-loop principle:

1. You define a **schema** — the entity types and relation types relevant to your research question.
2. You upload **planning documents** (cases) to be analyzed.
3. The system uses an LLM to propose candidate **entities** and **relations**, each linked to its source text.
4. You **review, correct, merge, and approve** every candidate.
5. Approved data forms a **knowledge graph** that you can search, explore visually, compare across cases, and query via the AI analysis assistant.

The system produces **candidates**. You produce **knowledge**.

### Key Concepts

| Term | Definition |
|------|------------|
| **Schema** | A domain model defining entity types (with properties) and relation types for a research project |
| **Case** | A planning document or project with associated metadata |
| **Entity** | A named thing extracted from case text — a policy, organization, location, event, etc. |
| **Relation** | A typed connection between two entities (e.g., *implements*, *affects*, *funds*) |
| **Candidate** | An AI-proposed entity or relation that has not yet been approved |
| **Evidence** | The source text segment(s) from which an entity or relation was derived |

---

## 2. Before You Start

### Starting the System

```bash
# Terminal 1: Backend
cd server && npm run dev

# Terminal 2: Frontend
npm run dev
```

Open `http://localhost:5173/caseflow`.

### AI Configuration

You need an OpenAI-compatible API key capable of both chat completions and embeddings. Configure it in the AI Copilot's **Settings** panel (gear icon, top-right of the AI panel), or set global config in `server/.env`.

The embedding model must produce **1536-dimensional** vectors. Tested configurations include:

| Provider | Chat Model | Embedding Model |
|----------|-----------|-----------------|
| OpenAI | gpt-4o | text-embedding-3-small |
| Zhipu (GLM) | GLM-4-Flash | embedding-2 |

### Supported Document Formats

- **PDF** — text-based PDFs (scanned PDFs without OCR produce empty results)
- **DOCX** — Microsoft Word documents
- **TXT** — Plain text files

Maximum file size: **10MB**.

### Which Steps Use AI / Incur Costs

| Step | Calls LLM? | Calls Embedding? |
|------|-----------|-----------------|
| AI Schema Builder agent | Yes | No |
| AI Case Extractor agent | Yes | No |
| Analysis Assistant agent | Yes | No |
| Extraction Pipeline (all phases) | Yes (multiple calls) | No |
| Entity/Relation save | No | Yes (auto-embedding) |
| GraphRAG search / Case recommendation | No | Yes (query embedding) |
| GraphRAG QA (ask) | Yes | Yes |

### Data Privacy

**Do not upload sensitive, confidential, or personally identifiable planning documents** unless you are running the system in an environment that meets your institutional data security requirements. LLM API calls send document text to external services.

---

## 3. Creating a Schema

### Purpose

A schema defines what the system will look for in your documents. It constrains extraction to entity types and relation types you care about.

### Prerequisites

- A research question or analysis goal
- Basic understanding of the domain concepts you want to capture

### Step-by-Step

1. Open the **Schema Architect** panel (left sidebar, Database icon).
2. Click **+** to create a new schema. Give it a name reflecting your research context.
3. Navigate to the **Entities** tab to define entity types:
   - Click **+** to add an entity type (e.g., *Land Use Policy*, *Developer*, *Community Organization*)
   - Set a color for visual identification
   - Add properties: name, type (text/number/date/boolean/enum), and enum options if applicable
4. Navigate to the **Relations** tab to define relation types:
   - Click **+** to add a relation (e.g., *implements*, *opposes*, *funds*)
   - Select source and target entity types
   - Set direction (directed/bidirectional/undirected)
   - Set line style (solid/dashed/dotted) and color
5. Use the **Visualization** tab to see your schema as a diagram.
6. To export your schema as JSON, use the Export button in the schema sidebar. To import, use the Import button.

### AI-Generated Schema (Alternative)

In the AI Copilot, select the **Schema Builder** agent and describe your domain in natural language. The AI will suggest entity types, properties, and relations. Review the suggestions, select the ones you want, and click **Create Schema** to save.

### Example Schema: Urban Renewal

This is an example, not a standard. Adapt to your research question.

**Entity Types:**
- *Policy* (properties: type, issuing_body, year)
- *Project* (properties: scale, status, budget)
- *Organization* (properties: type, role)
- *Location* (properties: district, area)
- *Event* (properties: date, type)

**Relation Types:**
- *Policy → governs → Project*
- *Organization → implements → Project*
- *Organization → opposes → Policy*
- *Project → located_in → Location*
- *Event → affects → Project*

### Modifying a Schema After Data Exists

Schema changes do **not** automatically update existing entities or relations. If you add a new entity type, rerun extraction to capture entities of that type. If you delete a type, existing entities of that type remain but cannot be selected for new relations. Plan schema changes carefully before beginning extraction at scale.

---

## 4. Creating and Uploading a Case

### Purpose

A case represents one planning document or project with its associated entities and relations in the knowledge graph.

### Step-by-Step

1. In the right panel, click the **+** button to create a new case.
2. Fill in the case name and optional metadata (location, year, description).
3. Select the schema this case belongs to.
4. Click **Create**.
5. In the AI Copilot, switch to the **Case Extractor** agent.
6. Paste text directly into the case text area, or click **Upload** to select a file.
7. Optionally add extraction instructions in the "Extraction Requirements" field.
8. Click **Confirm Breakdown** to run single-pass extraction, or after the initial result, click **Start Pipeline** for multi-round extraction.

### Supported Formats

PDF, DOCX, TXT. Multiple files are not directly supported — upload them as separate cases or concatenate text manually.

### Document Parsing

The system parses documents into text segments (paragraphs). Parsing status is shown in the extraction pipeline's Progress tab. If a PDF produces empty text, the document is likely scanned or image-based; try OCR preprocessing.

### Deleting a Case

Delete from the case detail panel. This cascades to all associated entities, relations, text segments, and memory records. This action cannot be undone.

---

## 5. Entity Extraction

### Prerequisites

- An active schema with at least one entity type
- A case with uploaded text

### Chat Mode (Single-Pass)

1. In the AI Copilot, select the **Case Extractor** agent.
2. Enter case text and click **Confirm Breakdown**.
3. The system extracts entities and relations in a single LLM call.
4. Review results in the Extract Result panel. Click **Confirm Save** to save, or **Adjust Result** to refine.

### Pipeline Mode (Multi-Round)

1. After the initial chat result (or directly from the Extract Result panel), click **Start Pipeline**.
2. The pipeline progresses through phases:
   - **Parse Text** — Splits document into segments (no LLM)
   - **Generate Plan** — Determines extraction order by entity type (LLM)
   - **Extract Entities** — Extracts candidates per type, parallelizing where possible (LLM)
   - **Consistency Check** — Detects and suggests merging duplicates (ai + rules)
   - **Infer Relations** — Proposes relations between approved entities (LLM)
   - **Finalize** — Saves approved data and generates embeddings
3. Monitor progress in the **Progress** tab.
4. Switch to the **Entities** tab to review each entity type's candidates.
5. After approving entities, click **Next** to infer relations.
6. Switch to the **Relations** tab to review relation candidates.
7. Click **Confirm Save** to finalize.

### What to Expect

- The LLM may miss some entities (false negatives). You can add entities manually through the Case Detail panel.
- The LLM may incorrectly identify non-entities (false positives). Reject these during review.
- Entity names and types suggested by the AI are approximations. Rename and retype as needed during review.
- Confidence scores on entities and relations are AI estimates, not statistical probabilities.

---

## 6. Entity Review and Consolidation

### Purpose

AI-proposed entities are **candidates**. You must review each one before it enters the knowledge graph.

### Review Actions

| Action | When to Use |
|--------|------------|
| **Approve** | Entity name, type, and properties are correct |
| **Skip** | Entity is incorrect, duplicate, or not useful |
| **Edit** | Entity needs name/type/property correction (edit in the detail panel) |
| **Merge** | Two or more candidates represent the same real-world entity |

### Duplicate Detection

The consistency checker identifies candidates with the same or very similar names and suggests merges. Review merge suggestions carefully — same name does not always mean same entity (e.g., two different "Community Meeting" events).

### Quality Guidelines

- **Entity names** should be precise and consistent across cases. Prefer full names over abbreviations.
- **Entity types** must match the schema. If a candidate doesn't fit any type, consider whether the schema needs a new type.
- **Property values** should reflect what the source text states, not what you assume.
- Entities that appear in multiple cases should ideally use the same name to enable cross-case comparison. The consistency checker helps, but final naming decisions are yours.

### Unapproved Entities

Entities left in "pending" status when you finalize a case are **not** saved to the knowledge graph and **not** included in embeddings or search.

---

## 7. Relation Inference and Validation

### Prerequisites

- At least two approved entities exist in the case

### How to Start

After approving entities, click **Next** in the pipeline controls, or use the **Infer Relations** button. The system calls the relation inference agent.

### Reviewing Candidate Relations

Each candidate shows:
- **Source entity → relation type → target entity** with entity type badges
- **Confidence** (0-1): green ≥0.8, amber ≥0.5, gray <0.5
- **Evidence** text (click to expand)
- **Approve / Skip** buttons

### Batch Operations

- **Select All** toggles all pending candidates
- **Smart Approve** approves all pending relations with confidence ≥ 0.8
- **Confirm All / Skip All** for bulk operations

### Important Cautions

1. **Relations are not causal.** A relation "Policy X → governs → Project Y" means the system found evidence that the policy governs the project, not that the policy *caused* the project's outcomes.
2. **Low-confidence relations** (<0.5) may reflect weak signals. Verify the evidence text carefully.
3. **Relations involving critical entities** (key policies, major projects) should receive particularly careful review.
4. **The AI may invert relation direction.** Check that the source→target direction matches your schema definition.
5. **Missing relations** (things that should be connected but aren't) must be added manually — the system cannot identify what it fails to infer.

---

## 8. Knowledge Graph Exploration

### Accessing the Graph

Switch to the **Graph** tab in the main view.

### Features

| Feature | How to Use |
|---------|-----------|
| **Search** | Type in the search bar and press Enter. Results appear in a dropdown. |
| **Filter** | Click the filter icon to show/hide entity types and cases. |
| **Path Analysis** | Click the route icon, then click two nodes to find the shortest path between them. |
| **Focus Mode** | Double-click a node to focus on a single entity; double-click again to exit. |
| **Neighbor Expansion** | Select depth (0-4) from the search depth dropdown to show N-hop neighbors. |
| **Node Details** | Click a node to open the detail drawer. |
| **Relation Details** | Click an edge to see the relation detail drawer. |
| **Zoom** | Use +/- buttons or scroll wheel. Click the fit button to center the graph. |
| **Legend** | Toggle from the toolbar to see entity type colors. |
| **Export** | Click the download button to export in JSON, CSV, or GraphML format. |

### Node Appearance

- Node color is determined by the entity type's schema color
- Filtered-out nodes are shown in gray
- Path analysis highlights path nodes

---

## 9. Cross-Case Comparison and Case Recommendation

### How It Works

Urban CaseFlow does not provide a dedicated side-by-side comparison UI. Cross-case comparison is supported through:

1. **Case Recommendation** — The `/api/graph-rag/recommend/:caseId` endpoint returns structurally similar cases. Similarity is computed from three weighted signals:
   - **Graph-structure similarity** (weight 0.5): Jaccard index over shared concept-layer neighbors in the AGE graph
   - **Case vector similarity** (weight 0.3): Cosine similarity of case-level embeddings
   - **Entity-type distribution similarity** (weight 0.2): Overlap in entity type profiles

2. **Analysis Assistant** — Ask the AI assistant questions like:
   - "Which cases involve multi-actor coordination in brownfield redevelopment?"
   - "What interventions appear in cases with fragmented land ownership?"
   - "Which cases are structurally similar to [Case Name]?"
   - "What evidence supports the relation between [Policy X] and [Measure Y]?"

### Interpreting Similarity Results

**Critical:** Structural similarity scores reflect **overlap in formally encoded entity and relation patterns**, not substantive equivalence. Two cases may have similar graph structures for entirely different reasons. Always:

1. Return to the original case documents to verify the context of shared entities and relations.
2. Consider whether the institutional, spatial, and temporal contexts of compared cases are comparable.
3. Treat high similarity scores as **hypotheses for further investigation**, not as evidence that interventions are transferable.

### Text Similarity vs. Structural Similarity

- **Text similarity** (vector) captures semantic proximity of case descriptions.
- **Structural similarity** (graph) captures overlap in the types and patterns of entities and relations.

Both are signals — neither is a judgment of planning quality or policy effectiveness.

---

## 10. GraphRAG and Question Answering

### Access

Use the **Analysis Assistant** agent in the AI Copilot. This agent has access to the full knowledge base through GraphRAG hybrid retrieval.

### How Retrieval Works

When you ask a question:
1. Your question is embedded as a vector.
2. **Vector search** finds semantically similar entities and cases.
3. **Full-text search** finds entities and cases with matching keywords.
4. Results are merged via Reciprocal Rank Fusion.
5. **Graph expansion** traverses 1-hop neighbors of top results in Apache AGE.
6. All retrieved content is assembled into the LLM context.
7. The LLM generates a response grounded in the retrieved evidence.

### What You Can Ask

- Entity-focused: "What organizations are involved in affordable housing in Shanghai?"
- Relation-focused: "How does Policy X relate to Project Y?"
- Case-focused: "What are the key differences between Case A and Case B in their governance mechanisms?"
- Pattern-focused: "Which cases show community opposition to redevelopment?"

### What You Cannot Ask

- Predictive: "Will this policy succeed?" — The system does not predict.
- Causal: "Did Policy X cause Outcome Y?" — The system identifies associations, not causal mechanisms.
- Normative: "Is this a good plan?" — The system does not evaluate planning quality.

### Handling Responses

- Always check the cited sources. If the answer lacks citations, treat it with skepticism.
- The LLM may produce plausible-sounding but incorrect information (hallucination). Verify against source documents.
- If the answer states insufficient evidence was found, this may be accurate — the knowledge graph may not contain relevant information for your question.

---

## 11. Export and Research Use

### Supported Formats

| Format | Content | Use Case |
|--------|---------|----------|
| **JSON** | Full case data with entities and relations | Further computational analysis |
| **CSV** | Entities and relations as flat tables | Spreadsheet analysis, GIS import |
| **GraphML** | Graph structure in standard XML format | Network analysis (Gephi, Cytoscape) |

### How to Export

- **Single case:** In the graph view, select a case, click the export button in the toolbar, choose format.
- **All cases:** Use the export-all option in the graph toolbar.
- **Schema:** Export schema as JSON from the Schema Architect sidebar.

### Tracking Schema Versions

The system does not currently support automated schema versioning. We recommend:
- Export your schema JSON before and after modifications
- Record schema versions in your research notes
- Note which schema version was used for each extraction run

### Recording AI Configuration

For research transparency, record:
- LLM provider and model name
- Embedding model and dimension
- Date of extraction runs (model behavior may change over time)
- Whether the agent self-reflection loop was enabled

### Citing System Output

When using system output in publications, we recommend citing:
- The software version (commit hash or release tag)
- The schema definition used
- The AI model configuration
- The date(s) of extraction

---

## 12. Troubleshooting

### Database Connection

| Symptom | Likely Cause | Solution |
|---------|-------------|----------|
| Server won't start | PostgreSQL not running | `sudo systemctl start postgresql` |
| "role 'postgres' does not exist" | Wrong DB user | Create a PostgreSQL user or modify `server/db.js` |
| "database 'knowledge_graph' does not exist" | DB not created | `createdb knowledge_graph` |
| "extension 'vector' not available" | pgvector not installed | Install pgvector extension |

**Note:** The database connection is hardcoded in `server/db.js`:
- User: `postgres`
- Database: `knowledge_graph`
- Host: `/var/run/postgresql` (Unix socket)

### AI / LLM Issues

| Symptom | Likely Cause | Solution |
|---------|-------------|----------|
| "AI API error: HTTP 401" | Invalid API key | Check `server/.env` AI_API_KEY |
| "AI API error: HTTP 404" | Wrong endpoint URL | Verify endpoint path includes `/v1/chat/completions` |
| AI calls timeout | LLM taking too long | System has 10-min timeout; check your LLM provider |
| Streaming idle timeout | No data from LLM for 2 min | Check network stability; retry |
| Extraction returns empty | Schema doesn't match document content | Review entity type definitions; try adding broader types |
| Embedding fails | Wrong dimension model | Must be 1536-dim; check your embedding model |
| "Embedding dimension mismatch" | Model changed mid-project | Re-embed all entities with `node server/generate_embeddings.js` |

### Document Parsing

| Symptom | Likely Cause | Solution |
|---------|-------------|----------|
| PDF parsing empty | Scanned/image PDF | OCR-preprocess the PDF before upload |
| DOCX parsing failure | Complex formatting | Try saving as plain text first |
| File upload fails | File > 10MB | Split into smaller files |
| Parse button does nothing | No schema selected | Select an active schema first |

### Graph / Visualization

| Symptom | Likely Cause | Solution |
|---------|-------------|----------|
| Graph is empty | No approved entities in the selected case | Return to extraction pipeline and approve entities |
| Graph not updating | Data not reloaded | Toggle focus mode or switch cases to trigger reload |
| Search returns no results | Spelling or language mismatch | Try partial names or entity type filtering |

### General

| Symptom | Likely Cause | Solution |
|---------|-------------|----------|
| Frontend loads but API fails | Backend not running on port 3000 | Start `cd server && npm run dev` |
| Port 5173 already in use | Another Vite instance | Kill the existing process |
| Page blank | JavaScript error | Open browser console (F12) for error details |
| Schema changes not reflected | Schema cached in UI | Refresh the page or switch schemas |
| GraphRAG: "No relevant information found" | No embeddings generated | Run entity extraction pipeline with autoEmbed enabled, or use `/api/rag/embed-entities` |

---

## Further Help

- See [`docs/REPRODUCIBILITY.md`](REPRODUCIBILITY.md) for experiment reproduction.
- See [`docs/case-recommendation-demo.md`](case-recommendation-demo.md) for an example analysis session.
