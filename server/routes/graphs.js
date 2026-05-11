import express from 'express';
import pool from '../db.js';

const router = express.Router();

// 获取所有图
router.get('/', async (req, res) => {
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
router.post('/', async (req, res) => {
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
router.post('/:graphName/nodes', async (req, res) => {
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
router.get('/:graphName/nodes', async (req, res) => {
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
router.post('/:graphName/edges', async (req, res) => {
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
router.get('/:graphName/edges', async (req, res) => {
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
router.delete('/:graphName', async (req, res) => {
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

export default router;