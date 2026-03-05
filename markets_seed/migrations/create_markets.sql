-- migrations/create_markets.sql
-- 市场合规主表 + RLS 策略
-- 执行账号：postgres (superuser)

-- ─── 1. 主表 DDL ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS markets (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 基础标识
    country_code                CHAR(2) NOT NULL UNIQUE,   -- ISO 3166-1 alpha-2
    country_name                VARCHAR(100) NOT NULL,
    region                      VARCHAR(50) NOT NULL,       -- AP / EU / NA / OCE

    -- 货币
    currency_code               CHAR(3) NOT NULL,          -- ISO 4217
    currency_symbol             VARCHAR(5) NOT NULL,

    -- ── 税务核心字段 ─────────────────────────────────────────────────────────
    tax_type                    VARCHAR(20) NOT NULL,
    -- VAT  = Value Added Tax (UK, EU)
    -- GST  = Goods and Services Tax (AU, CA, NZ)
    -- CT   = Consumption Tax (JP)
    -- ST   = Sales Tax, state-level only (US)

    standard_tax_rate           NUMERIC(5,4) NOT NULL,
    -- 标准税率，小数形式：0.20 = 20%
    -- US 为联邦层面 0（州级在 tax_notes 中说明）

    reduced_tax_rate            NUMERIC(5,4),
    -- 减免税率（如 JP 食品 8%，UK 儿童服装 0%）
    -- NULL 表示无减免档次

    -- ── 进口关税 De Minimis ───────────────────────────────────────────────────
    import_duty_threshold_local NUMERIC(12,2),
    -- 免税门槛（本地货币）
    -- AU: 1000 AUD, JP: 10000 JPY, UK: 135 GBP, US: 已取消(0)

    import_duty_threshold_usd   NUMERIC(12,2),
    -- 美元等值（供 Agent 跨市场比较用）

    vat_threshold_local         NUMERIC(12,2),
    -- 卖家需注册 VAT/GST 的年营业额门槛（本地货币）
    -- UK: 90000 GBP, AU: 75000 AUD, CA: 30000 CAD 等

    -- ── 平台合规字段 ─────────────────────────────────────────────────────────
    marketplace_collects_tax    BOOLEAN NOT NULL DEFAULT FALSE,
    -- TRUE = 平台（Amazon/Shopify）代收代缴，卖家无需独立处理
    -- US/AU/CA/UK 的主要平台均已实现 Marketplace Facilitator

    ioss_supported              BOOLEAN NOT NULL DEFAULT FALSE,
    -- 欧盟 IOSS（Import One-Stop Shop）是否适用，仅 EU 成员国为 TRUE

    -- ── 物流合规 ────────────────────────────────────────────────────────────
    prohibited_categories       TEXT[],
    -- 常见禁运/受限品类，供 OPA 物流路由拦截用
    -- 示例：'{lithium_battery_standalone, drone, replica_weapon}'

    requires_ce_mark            BOOLEAN NOT NULL DEFAULT FALSE,
    -- 产品是否需要 CE 认证（EU 强制）

    -- ── 元数据 ──────────────────────────────────────────────────────────────
    tax_notes                   TEXT,
    -- 补充说明，如美国州税差异、加拿大省税结构等

    data_source_url             TEXT,
    -- 官方数据来源链接，便于审计

    effective_date              DATE NOT NULL,
    -- 当前税率生效日期

    next_review_date            DATE,
    -- 建议下次复核日期（税率变动频繁，建议每季度检查）

    is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 2. 索引 ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_markets_country_code ON markets(country_code);
CREATE INDEX IF NOT EXISTS idx_markets_region        ON markets(region);
CREATE INDEX IF NOT EXISTS idx_markets_active        ON markets(is_active);
CREATE INDEX IF NOT EXISTS idx_markets_tax_type      ON markets(tax_type);

-- ─── 3. 自动更新 updated_at ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_markets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_markets_updated_at ON markets;
CREATE TRIGGER trg_markets_updated_at
    BEFORE UPDATE ON markets
    FOR EACH ROW EXECUTE FUNCTION update_markets_updated_at();

-- ─── 4. 注意：markets 是系统级别的全局参考数据 ──────────────────────────────
-- 不启用 RLS（所有租户共享同一份市场合规数据）
-- 但通过 app_user 只授予 SELECT 权限，禁止业务代码修改
REVOKE INSERT, UPDATE, DELETE ON markets FROM app_user;
GRANT SELECT ON markets TO app_user;
-- 更新由后台管理脚本通过 admin 账号执行

COMMENT ON TABLE markets IS
'系统级市场合规参考数据。税率由工程团队维护，业务代码只读。
 数据来源：各国官方税务局公开数据。每季度或税率变更时更新。';
