/**
 * 分段执行 RLS hardening SQL 文件
 * 支持: 0001_week1_hardening.sql + 0003_rls_governance_tables.sql
 * RLS/Policy/Trigger 部分逐条执行，遇到错误记录但继续
 */
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pool = new Pool({
  connectionString: process.env.DATABASE_ADMIN_URL || 'postgresql://postgres:postgres@localhost:5432/ai_ecom',
});

const migrationFiles = [
  resolve(__dirname, '../../../packages/database/migrations/0001_week1_hardening.sql'),
  resolve(__dirname, '../../../packages/database/migrations/0003_rls_governance_tables.sql'),
];

let raw = '';
for (const f of migrationFiles) {
  try {
    raw += readFileSync(f, 'utf8') + '\n';
    console.log(`[LOAD] ${f.split('/').pop()}`);
  } catch {
    console.error(`[FATAL] migration file not found: ${f}`);
    console.error('RLS hardening requires all migration files. Aborting.');
    process.exit(1);
  }
}

// 按 ; 拆分（简单分割，$$块不跨语句）
// 先把 CREATE FUNCTION...LANGUAGE plpgsql 整块保留
const statements: string[] = [];
let current = '';
let inDollar = false;

for (const line of raw.split('\n')) {
  if (line.trim().startsWith('--')) continue; // 跳过注释行
  if (line.includes('$$')) inDollar = !inDollar;
  current += line + '\n';
  if (!inDollar && current.trim().endsWith(';')) {
    const stmt = current.trim().replace(/;$/, '').trim();
    if (stmt) statements.push(stmt);
    current = '';
  }
}

let ok = 0;
let skipped = 0;

for (const stmt of statements) {
  if (!stmt.trim()) continue;
  const preview = stmt.replace(/\s+/g, ' ').slice(0, 80);
  try {
    await pool.query(stmt);
    console.log(`[OK]   ${preview}`);
    ok++;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    // 只跳过索引创建失败（列不存在），其他错误要报警
    if (msg.includes('does not exist') && stmt.toUpperCase().includes('CREATE INDEX')) {
      console.log(`[SKIP] ${preview}`);
      console.log(`       → ${msg}`);
      skipped++;
    } else {
      console.error(`[ERR]  ${preview}`);
      console.error(`       → ${msg}`);
      process.exitCode = 1;
    }
  }
}

console.log(`\n完成：${ok} 成功 / ${skipped} 跳过`);
await pool.end();
