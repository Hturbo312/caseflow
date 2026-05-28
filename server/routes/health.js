import express from 'express';
import pool from '../db.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = express.Router();

/**
 * Health Check — verifies database connectivity.
 * Mounted at /api/health in the main server.
 */
router.get('/', asyncHandler(async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok', database: 'connected' });
}));

export default router;
