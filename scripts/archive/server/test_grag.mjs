import pool from './db.js';
import { graphRagSearch } from './services/graphRag.js';

const start = Date.now();
console.log(`[${Date.now()-start}ms] 开始 graphRagSearch`);

const result = await graphRagSearch("海珠湿地", { schemaId: 3, limit: 15, depth: 2 });

console.log(`[${Date.now()-start}ms] 完成 graphRagSearch`);
console.log(`实体: ${result.entities.length}, 案例: ${result.cases.length}, 关系: ${result.relations.length}, 子图节点: ${result.subgraph.nodes.length}`);

pool.end();
