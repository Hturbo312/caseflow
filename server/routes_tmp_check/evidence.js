import express from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// 获取实体或关系的证据链：逐字引文 + 原文分段定位 + 文档出处
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { entity_id, relation_id } = req.query;
    if (!entity_id && !relation_id) {
      return res.status(400).json({ error: 'entity_id 或 relation_id 必填其一' });
    }
    const cond = entity_id ? 'e.entity_id = $1' : 'e.relation_id = $1';
    const { rows } = await pool.query(
      `SELECT e.id, e.quote, e.char_start, e.char_end, e.confidence, e.source, e.status, e.metadata, e.created_at,
              s.id AS segment_id, s.content AS segment_content, s.page, s.segment_index,
              d.id AS document_id, d.title AS document_title, d.source_type, d.uri
       FROM evidence e
       LEFT JOIN text_segments s ON e.segment_id = s.id
       LEFT JOIN documents d ON s.document_id = d.id
       WHERE ${cond}
       ORDER BY e.created_at DESC`,
      [entity_id || relation_id]
    );
    res.json({ evidence: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
