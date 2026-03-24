import express from 'express';
import cors from 'cors';
import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL 连接池
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'knowledge_graph',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

// 中间件
app.use(cors());
app.use(express.json());

// ============================================
// Health Check
// ============================================
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ============================================
// Schema 管理 API
// ============================================

// 获取所有 Schema
app.get('/api/schemas', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM schemas ORDER BY created_at DESC');
    res.json({ schemas: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 创建 Schema
app.post('/api/schemas', async (req, res) => {
  const { name, description } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO schemas (name, description) VALUES ($1, $2) RETURNING *',
      [name, description]
    );
    res.json({ schema: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取单个 Schema 详情
app.get('/api/schemas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const schemaResult = await pool.query('SELECT * FROM schemas WHERE id = $1', [id]);
    const entityTypesResult = await pool.query('SELECT * FROM entity_types WHERE schema_id = $1', [id]);
    const relationsResult = await pool.query('SELECT * FROM relations WHERE schema_id = $1', [id]);

    res.json({
      schema: schemaResult.rows[0],
      entityTypes: entityTypesResult.rows,
      relations: relationsResult.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 添加实体类型
app.post('/api/schemas/:schemaId/entity-types', async (req, res) => {
  const { schemaId } = req.params;
  const { name, color, properties } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO entity_types (schema_id, name, color, properties) VALUES ($1, $2, $3, $4) RETURNING *',
      [schemaId, name, color, JSON.stringify(properties)]
    );
    res.json({ entityType: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 添加关系定义
app.post('/api/schemas/:schemaId/relations', async (req, res) => {
  const { schemaId } = req.params;
  const { name, fromEntityType, toEntityType } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO relations (schema_id, name, from_entity_type, to_entity_type) VALUES ($1, $2, $3, $4) RETURNING *',
      [schemaId, name, fromEntityType, toEntityType]
    );
    res.json({ relation: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// 案例管理 API
// ============================================

// 获取所有案例
app.get('/api/cases', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM cases ORDER BY created_at DESC');
    res.json({ cases: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 创建案例
app.post('/api/cases', async (req, res) => {
  const { name, schemaId, location, year, description, tags } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO cases (name, schema_id, location, year, description, tags) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name, schemaId, location, year, description, JSON.stringify(tags)]
    );
    res.json({ case: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取案例详情（包含实体和关系）
app.get('/api/cases/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const caseResult = await pool.query('SELECT * FROM cases WHERE id = $1', [id]);
    const entitiesResult = await pool.query('SELECT * FROM case_entities WHERE case_id = $1', [id]);
    const relationsResult = await pool.query('SELECT * FROM case_relations WHERE case_id = $1', [id]);

    res.json({
      case: caseResult.rows[0],
      entities: entitiesResult.rows,
      relations: relationsResult.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 添加案例实体
app.post('/api/cases/:caseId/entities', async (req, res) => {
  const { caseId } = req.params;
  const { name, entityType, properties } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO case_entities (case_id, name, entity_type, properties) VALUES ($1, $2, $3, $4) RETURNING *',
      [caseId, name, entityType, JSON.stringify(properties)]
    );
    res.json({ entity: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 添加案例关系
app.post('/api/cases/:caseId/relations', async (req, res) => {
  const { caseId } = req.params;
  const { sourceEntityId, targetEntityId, relationType } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO case_relations (case_id, source_entity_id, target_entity_id, relation_type) VALUES ($1, $2, $3, $4) RETURNING *',
      [caseId, sourceEntityId, targetEntityId, relationType]
    );
    res.json({ relation: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除案例实体
app.delete('/api/cases/:caseId/entities/:entityId', async (req, res) => {
  const { caseId, entityId } = req.params;
  try {
    await pool.query('DELETE FROM case_entities WHERE id = $1 AND case_id = $2', [entityId, caseId]);
    res.json({ message: 'Entity deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除案例
app.delete('/api/cases/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM cases WHERE id = $1', [id]);
    res.json({ message: 'Case deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// GraphRAG / AGE 图谱 API
// ============================================

// 获取所有图
app.get('/api/graphs', async (req, res) => {
  try {
    await pool.query(`LOAD 'age'`);
    await pool.query('SET search_path = ag_catalog, public');
    const result = await pool.query('SELECT * FROM ag_catalog.ag_graph');
    res.json({ graphs: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 创建图
app.post('/api/graphs', async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Graph name is required' });
  }
  try {
    await pool.query(`LOAD 'age'`);
    await pool.query('SET search_path = ag_catalog, public');
    await pool.query('SELECT create_graph($1)', [name]);
    res.json({ message: `Graph '${name}' created successfully` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 创建节点
app.post('/api/graphs/:graphName/nodes', async (req, res) => {
  const { graphName } = req.params;
  const { label, properties } = req.body;

  if (!label) {
    return res.status(400).json({ error: 'Node label is required' });
  }

  try {
    await pool.query(`LOAD 'age'`);
    await pool.query('SET search_path = ag_catalog, public');

    const propsJson = JSON.stringify(properties || {});
    const result = await pool.query(
      `SELECT * FROM cypher($1, $2) AS (v agtype)`,
      [graphName, `CREATE (n:${label} ${propsJson}) RETURN n`]
    );

    res.json({ node: result.rows[0]?.v });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 查询节点
app.get('/api/graphs/:graphName/nodes', async (req, res) => {
  const { graphName } = req.params;
  const { label } = req.query;

  try {
    await pool.query(`LOAD 'age'`);
    await pool.query('SET search_path = ag_catalog, public');

    const cypherQuery = label
      ? `MATCH (n:${label}) RETURN n`
      : `MATCH (n) RETURN n`;

    const result = await pool.query(
      `SELECT * FROM cypher($1, $2) AS (v agtype)`,
      [graphName, cypherQuery]
    );

    res.json({ nodes: result.rows.map(row => row.v) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 创建关系
app.post('/api/graphs/:graphName/edges', async (req, res) => {
  const { graphName } = req.params;
  const { fromId, toId, label, properties } = req.body;

  if (!fromId || !toId || !label) {
    return res.status(400).json({ error: 'fromId, toId, and label are required' });
  }

  try {
    await pool.query(`LOAD 'age'`);
    await pool.query('SET search_path = ag_catalog, public');

    const propsJson = JSON.stringify(properties || {});
    const result = await pool.query(
      `SELECT * FROM cypher($1, $2) AS (e agtype)`,
      [graphName, `MATCH (a), (b) WHERE id(a) = ${fromId} AND id(b) = ${toId} CREATE (a)-[r:${label} ${propsJson}]->(b) RETURN r`]
    );

    res.json({ edge: result.rows[0]?.e });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 查询关系
app.get('/api/graphs/:graphName/edges', async (req, res) => {
  const { graphName } = req.params;

  try {
    await pool.query(`LOAD 'age'`);
    await pool.query('SET search_path = ag_catalog, public');

    const result = await pool.query(
      `SELECT * FROM cypher($1, $2) AS (e agtype)`,
      [graphName, `MATCH (a)-[r]-(b) RETURN a, r, b`]
    );

    res.json({ edges: result.rows.map(row => row.e) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除图
app.delete('/api/graphs/:graphName', async (req, res) => {
  const { graphName } = req.params;

  try {
    await pool.query(`LOAD 'age'`);
    await pool.query('SET search_path = ag_catalog, public');
    await pool.query('SELECT drop_graph($1, true)', [graphName]);
    res.json({ message: `Graph '${graphName}' dropped successfully` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// AI 对话 API (Graph-RAG)
// ============================================
app.post('/api/ai/chat', async (req, res) => {
  const { message, context } = req.body;

  // TODO: 接入真实的 AI API (如 OpenAI/Claude)
  // 这里返回模拟响应
  res.json({
    response: `收到你的问题：${message}。\n\n这是 Graph-RAG 模拟响应。后续将接入真实的 AI API，结合知识图谱数据进行智能回答。`
  });
});

// ============================================
// 初始化数据库表
// ============================================
async function initializeDatabase() {
  try {
    // 创建 Schema 表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schemas (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建实体类型表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS entity_types (
        id SERIAL PRIMARY KEY,
        schema_id INTEGER REFERENCES schemas(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        color VARCHAR(50),
        properties JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建关系定义表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS relations (
        id SERIAL PRIMARY KEY,
        schema_id INTEGER REFERENCES schemas(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        from_entity_type VARCHAR(255),
        to_entity_type VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建案例表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cases (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        schema_id INTEGER REFERENCES schemas(id),
        location VARCHAR(255),
        year VARCHAR(50),
        description TEXT,
        tags JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建案例实体表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS case_entities (
        id SERIAL PRIMARY KEY,
        case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        entity_type VARCHAR(255),
        properties JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建案例关系表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS case_relations (
        id SERIAL PRIMARY KEY,
        case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
        source_entity_id INTEGER REFERENCES case_entities(id) ON DELETE CASCADE,
        target_entity_id INTEGER REFERENCES case_entities(id) ON DELETE CASCADE,
        relation_type VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Database tables initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error.message);
  }
}

// 启动服务器
app.listen(PORT, '0.0.0.0', async () => {
  await initializeDatabase();
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log(`Database: ${process.env.DB_NAME}`);
});
