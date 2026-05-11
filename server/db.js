import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
  user: 'postgres',
  database: 'knowledge_graph',
  host: '/var/run/postgresql',
  port: 5433,
});

export default pool;