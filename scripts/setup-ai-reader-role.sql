-- =========================================
-- AI Feature Reader Role 强隔离设置
-- 目标：AI 仓储层只能读 approved_entity_mapping / approved_cost_version
-- 执行前提：migration 20260303164000 已应用（View 已存在）
--
-- 用法（传入密码，避免硬编码）：
--   psql "$DATABASE_ADMIN_URL" \
--     -v ai_user_password="$AI_APP_USER_PASSWORD" \
--     -f scripts/setup-ai-reader-role.sql
-- =========================================

-- 1) 创建只读角色（无登录权限，通过 SET ROLE 或连接字符串使用）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ai_feature_reader') THEN
    CREATE ROLE ai_feature_reader NOLOGIN;
  END IF;
END$$;

-- 2) 赋予连接与 schema 使用权（使用 current_database() 避免硬编码数据库名）
DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO ai_feature_reader', current_database());
END$$;
GRANT USAGE ON SCHEMA public TO ai_feature_reader;

-- 3) 明确撤销对原始基表的所有权限
REVOKE ALL ON TABLE external_id_mapping FROM ai_feature_reader;
REVOKE ALL ON TABLE cost_version FROM ai_feature_reader;

-- 如果存在其他 AI 不应直读的表，在此继续 REVOKE：
-- REVOKE ALL ON TABLE listing FROM ai_feature_reader;
-- REVOKE ALL ON TABLE external_sku_mapping FROM ai_feature_reader;

-- 4) 仅授权读 View（强隔离入口）
GRANT SELECT ON approved_entity_mapping TO ai_feature_reader;
GRANT SELECT ON approved_cost_version TO ai_feature_reader;

-- 5) 如有 feature store / 产品特征表，单独授权（按需取消注释）
-- GRANT SELECT ON product_feature_daily TO ai_feature_reader;

-- 6) 创建可登录的 AI 应用账号，密码通过 psql -v 传入（禁止硬编码）
--    执行时必须提供 :ai_user_password 变量，否则报错
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ai_app_user') THEN
    EXECUTE format(
      'CREATE ROLE ai_app_user WITH LOGIN PASSWORD %L',
      current_setting('app.ai_user_password', false)
    );
  END IF;
END$$;

GRANT ai_feature_reader TO ai_app_user;

-- 7) 验证（手动检查）
-- SELECT rolname, rolsuper, rolcanlogin FROM pg_roles WHERE rolname IN ('ai_feature_reader','ai_app_user');
-- SET ROLE ai_app_user;
-- SELECT * FROM approved_entity_mapping LIMIT 1;   -- 应成功
-- SELECT * FROM external_id_mapping LIMIT 1;       -- 应报权限错误
