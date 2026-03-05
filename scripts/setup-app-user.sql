-- 创建受限应用角色（非超级用户），使 RLS 生效
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user WITH LOGIN PASSWORD 'app_user_password';
  END IF;
END
$$;

-- 授权数据库连接
GRANT CONNECT ON DATABASE ai_ecom TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;

-- 授权当前所有表
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- 未来新建的表自动继承权限
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO app_user;

-- 验证：rolsuper 必须是 f
SELECT rolname, rolsuper, rolcanlogin FROM pg_roles WHERE rolname = 'app_user';
