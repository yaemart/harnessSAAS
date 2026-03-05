import { Pool } from 'pg';

// 用超级用户检查 RLS 状态
const pool = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5432/ai_ecom' });

const result = await pool.query(`
  SELECT
    t.tablename,
    c.relrowsecurity    AS rls_enabled,
    c.relforcerowsecurity AS force_rls,
    COUNT(p.policyname) AS policy_count
  FROM pg_tables t
  JOIN pg_class c ON c.relname = t.tablename AND c.relnamespace = 'public'::regnamespace
  LEFT JOIN pg_policies p
    ON p.schemaname = t.schemaname AND p.tablename = t.tablename
  WHERE t.schemaname = 'public'
  GROUP BY t.tablename, c.relrowsecurity, c.relforcerowsecurity
  ORDER BY t.tablename
`);

console.log('\n--- RLS 状态一览 ---');
console.log(
  'tablename'.padEnd(35) +
  'rls_on'.padEnd(10) +
  'force'.padEnd(10) +
  'policies',
);
console.log('-'.repeat(65));
for (const row of result.rows) {
  const warn = row.rls_enabled === false ? ' ⚠ RLS OFF' : '';
  const noPolicy = row.rls_enabled && parseInt(row.policy_count) === 0 ? ' ⚠ NO POLICY' : '';
  console.log(
    row.tablename.padEnd(35) +
    String(row.rls_enabled).padEnd(10) +
    String(row.force_rls).padEnd(10) +
    row.policy_count +
    warn + noPolicy,
  );
}

await pool.end();
