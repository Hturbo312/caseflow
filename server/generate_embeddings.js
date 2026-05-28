import pool from './db.js';
import { PORT, aiConfigCache } from './config.js';

async function generateEmbeddings() {
  console.log('开始生成实体嵌入...');

  // 获取所有未嵌入的实体
  const entities = await pool.query(
    'SELECT id, name, entity_type, properties FROM case_entities WHERE embedding IS NULL'
  );
  console.log(`待处理实体: ${entities.rows.length} 个`);

  for (let i = 0; i < entities.rows.length; i += 20) {
    const batch = entities.rows.slice(i, i + 20);
    const texts = batch.map(e => {
      const props = e.properties || {};
      const propText = Object.entries(props).map(([k, v]) => `${k}: ${v}`).join(', ');
      return `${e.name} (${e.entity_type})${propText ? '. ' + propText : ''}`;
    });

    try {
      const response = await fetch(`http://localhost:${PORT}/api/ai/embedding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts }),
      });
      const data = await response.json();
      if (data.error) {
        console.error(`Batch ${i} error:`, data.error);
        continue;
      }

      for (let j = 0; j < batch.length; j++) {
        const emb = data.data?.[j]?.embedding;
        if (emb) {
          await pool.query('UPDATE case_entities SET embedding = $1 WHERE id = $2',
            [`[${emb.join(',')}]`, batch[j].id]);
        }
      }
      console.log(`  已处理 ${Math.min(i + 20, entities.rows.length)}/${entities.rows.length}`);
    } catch (err) {
      console.error(`Batch ${i} failed:`, err.message);
    }

    // 避免速率限制
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('开始生成案例嵌入...');
  const cases = await pool.query(
    'SELECT id, name, description FROM cases WHERE embedding IS NULL'
  );
  console.log(`待处理案例: ${cases.rows.length} 个`);

  for (let i = 0; i < cases.rows.length; i += 10) {
    const batch = cases.rows.slice(i, i + 10);
    const texts = batch.map(c => `${c.name}. ${c.description || ''}`);

    try {
      const response = await fetch(`http://localhost:${PORT}/api/ai/embedding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts }),
      });
      const data = await response.json();
      if (data.error) {
        console.error(`Case batch ${i} error:`, data.error);
        continue;
      }

      for (let j = 0; j < batch.length; j++) {
        const emb = data.data?.[j]?.embedding;
        if (emb) {
          await pool.query('UPDATE cases SET embedding = $1 WHERE id = $2',
            [`[${emb.join(',')}]`, batch[j].id]);
        }
      }
      console.log(`  已处理 ${Math.min(i + 10, cases.rows.length)}/${cases.rows.length}`);
    } catch (err) {
      console.error(`Case batch ${i} failed:`, err.message);
    }

    await new Promise(r => setTimeout(r, 500));
  }

  // 统计
  const entityStats = await pool.query('SELECT COUNT(*) as embedded FROM case_entities WHERE embedding IS NOT NULL');
  const caseStats = await pool.query('SELECT COUNT(*) as embedded FROM cases WHERE embedding IS NOT NULL');
  console.log(`完成! 实体嵌入: ${entityStats.rows[0].embedded}, 案例嵌入: ${caseStats.rows[0].embedded}`);

  await pool.end();
}

generateEmbeddings();
