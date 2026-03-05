import { Pool } from 'pg';

const pool = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5432/ai_ecom' });

async function run(label: string, sql: string) {
  try {
    const r = await pool.query(sql);
    if (r.rows?.length) console.log(`[${label}]`, JSON.stringify(r.rows));
    else console.log(`[OK] ${label}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    // 忽略"already exists"类错误
    if (msg.includes('already exists') || msg.includes('duplicate')) {
      console.log(`[SKIP] ${label}: ${msg}`);
    } else {
      console.error(`[ERROR] ${label}: ${msg}`);
    }
  }
}

// 1. 创建角色（DO block 作为整体执行）
await run(
  '创建 app_user',
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
       CREATE ROLE app_user WITH LOGIN PASSWORD 'app_user_password';
     END IF;
   END $$`,
);

// 2. 授权
await run('GRANT CONNECT', `GRANT CONNECT ON DATABASE ai_ecom TO app_user`);
await run('GRANT USAGE SCHEMA', `GRANT USAGE ON SCHEMA public TO app_user`);
await run('GRANT TABLE OPS', `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user`);
await run('GRANT SEQUENCES', `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user`);
await run('DEFAULT PRIVILEGES TABLES', `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user`);
await run('DEFAULT PRIVILEGES SEQ', `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user`);

// 3. 验证
await run('验证角色', `SELECT rolname, rolsuper, rolcanlogin FROM pg_roles WHERE rolname = 'app_user'`);

await pool.end();
