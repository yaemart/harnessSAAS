import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pool = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5432/ai_ecom' });

const sql = readFileSync(resolve(__dirname, '../../../packages/database/migrations/0002_tenant_plan.sql'), 'utf8');
await pool.query(sql);
console.log('[OK] 0002_tenant_plan.sql applied');
await pool.end();
