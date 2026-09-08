import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { caseflowToolDefinitions, executeCaseflowTool } from '../services/caseflowTools.js';
const router = express.Router();
router.use(authMiddleware);
router.get('/', (_req, res) => res.json({ tools: caseflowToolDefinitions }));
router.post('/:name', async (req, res) => {
  try { res.json(await executeCaseflowTool(req.params.name, req.user.id, req.body || {})); }
  catch (error) { res.status(error.message.includes('无权') || error.message.includes('不存在') ? 403 : 400).json({ error: error.message }); }
});
export default router;
