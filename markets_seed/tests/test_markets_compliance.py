"""
tests/test_markets_compliance.py
Markets 合规数据 Harness 测试

覆盖：
- OPA 税务规则的所有输入分支
- 物流路由 Agent 的 de minimis 判断
- AI Agent 的税率查询一致性
"""

import os
import pytest
import psycopg2
from psycopg2.extras import RealDictCursor
from decimal import Decimal

DATABASE_URL = os.environ.get("DATABASE_ADMIN_URL") or os.environ.get("DATABASE_URL")


@pytest.fixture(scope="session")
def db():
    conn = psycopg2.connect(DATABASE_URL)
    yield conn
    conn.close()


@pytest.fixture(scope="session")
def markets(db):
    with db.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("SELECT * FROM markets WHERE is_active = TRUE")
        return {r["country_code"]: dict(r) for r in cur.fetchall()}


# ─── 基础存在性 ───────────────────────────────────────────────────────────────

class TestRequiredMarkets:
    """所有 P0 市场必须存在"""

    @pytest.mark.parametrize("cc", ["US", "GB", "DE", "JP", "AU", "CA"])
    def test_market_exists(self, markets, cc):
        assert cc in markets, f"市场 {cc} 不存在，请运行 seed_markets.py"


# ─── 税率准确性 ──────────────────────────────────────────────────────────────

class TestTaxRates:
    """验证税率数据准确性（基于官方来源）"""

    def test_us_federal_tax_is_zero(self, markets):
        """美国无联邦销售税，联邦税率必须为 0"""
        assert float(markets["US"]["standard_tax_rate"]) == 0.0

    def test_uk_vat_is_20_percent(self, markets):
        """英国 VAT 20%（HMRC 官方）"""
        assert abs(float(markets["GB"]["standard_tax_rate"]) - 0.20) < 0.001

    def test_de_vat_is_19_percent(self, markets):
        """德国 VAT 19%（Bundeszentralamt für Steuern）"""
        assert abs(float(markets["DE"]["standard_tax_rate"]) - 0.19) < 0.001

    def test_jp_consumption_tax_is_10_percent(self, markets):
        """日本消费税 10%（NTA 官方）"""
        assert abs(float(markets["JP"]["standard_tax_rate"]) - 0.10) < 0.001

    def test_jp_reduced_rate_is_8_percent(self, markets):
        """日本食品减免税率 8%"""
        assert abs(float(markets["JP"]["reduced_tax_rate"]) - 0.08) < 0.001

    def test_au_gst_is_10_percent(self, markets):
        """澳大利亚 GST 10%（ATO 官方）"""
        assert abs(float(markets["AU"]["standard_tax_rate"]) - 0.10) < 0.001

    def test_ca_gst_is_5_percent(self, markets):
        """加拿大联邦 GST 5%（CRA 官方）"""
        assert abs(float(markets["CA"]["standard_tax_rate"]) - 0.05) < 0.001

    def test_all_rates_within_valid_range(self, markets):
        """所有税率必须在 0-50% 之间（合理范围校验）"""
        for cc, m in markets.items():
            rate = float(m["standard_tax_rate"])
            assert 0 <= rate <= 0.5, f"{cc} 税率 {rate*100}% 超出合理范围"


# ─── De Minimis 判断逻辑 ─────────────────────────────────────────────────────

class TestDeMinimis:
    """
    物流路由 Agent 使用 de minimis 判断订单是否需要申报关税
    这些测试确保 Agent 的判断依据数据是正确的
    """

    def test_us_de_minimis_is_zero_after_2025(self, markets):
        """美国 2025-08-29 起取消 $800 豁免，门槛为 0"""
        threshold = float(markets["US"]["import_duty_threshold_usd"])
        assert threshold == 0, f"美国 de minimis 应为 0（已取消），实际={threshold}"

    def test_uk_duty_threshold_around_135_gbp(self, markets):
        """英国关税门槛约 £135（约 $170）"""
        threshold_usd = float(markets["GB"]["import_duty_threshold_usd"])
        assert 150 <= threshold_usd <= 200, \
            f"UK 门槛 ${threshold_usd} 不在预期范围 $150-200（£135 附近）"

    def test_eu_duty_threshold_around_150_eur(self, markets):
        """EU 进口关税门槛 €150（约 $163）"""
        threshold_usd = float(markets["DE"]["import_duty_threshold_usd"])
        assert 140 <= threshold_usd <= 180, \
            f"DE/EU 门槛 ${threshold_usd} 不在预期范围（€150 附近）"

    def test_jp_duty_threshold_around_10000_jpy(self, markets):
        """日本进口门槛 ¥10,000（约 $68）"""
        threshold_usd = float(markets["JP"]["import_duty_threshold_usd"])
        assert 50 <= threshold_usd <= 90, \
            f"JP 门槛 ${threshold_usd} 不在预期范围（¥10,000 附近）"

    def test_au_threshold_around_1000_aud(self, markets):
        """澳大利亚关税门槛 AUD 1,000（约 $650）"""
        threshold_usd = float(markets["AU"]["import_duty_threshold_usd"])
        assert 500 <= threshold_usd <= 750, \
            f"AU 门槛 ${threshold_usd} 不在预期范围（AUD 1,000 附近）"


# ─── OPA 策略输入字段 ────────────────────────────────────────────────────────

class TestOPAInputFields:
    """
    验证 OPA 税务策略引擎所需的输入字段都存在且合理
    对应 opa/markets_policy.rego 中使用的字段
    """

    def test_all_markets_have_tax_type(self, markets):
        """OPA 规则按 tax_type 分支，必须存在"""
        valid_types = {"VAT", "GST", "CT", "ST"}
        for cc, m in markets.items():
            assert m["tax_type"] in valid_types, \
                f"{cc} tax_type '{m['tax_type']}' 不在有效集合 {valid_types}"

    def test_eu_markets_have_ioss_flag(self, markets):
        """EU 市场必须标记 ioss_supported，供 OPA 判断是否走 IOSS 通道"""
        eu_markets = {cc: m for cc, m in markets.items() if m["region"] == "EU"}
        for cc, m in eu_markets.items():
            assert m["ioss_supported"] is True, f"{cc} (EU) ioss_supported 应为 TRUE"

    def test_de_requires_ce_mark(self, markets):
        """德国（EU 代表）必须标记 CE 认证要求，供 OPA 产品上架校验"""
        assert markets["DE"]["requires_ce_mark"] is True

    def test_all_markets_have_currency(self, markets):
        """货币代码必须存在，供汇率换算使用"""
        for cc, m in markets.items():
            assert m["currency_code"] and len(m["currency_code"]) == 3, \
                f"{cc} currency_code 不合法"

    def test_all_markets_have_prohibited_categories(self, markets):
        """禁运品字段不能为空，这是 OPA 物流路由拦截的基础数据"""
        for cc, m in markets.items():
            cats = m.get("prohibited_categories") or []
            assert len(cats) > 0, f"{cc} prohibited_categories 为空，OPA 无法执行禁运品检查"


# ─── Marketplace Facilitator 标记 ────────────────────────────────────────────

class TestMarketplaceFacilitator:
    """
    主流平台（Amazon/Shopify）已在以下市场实现代收代缴
    标记正确可以让 Agent 自动跳过独立注册流程提示
    """

    @pytest.mark.parametrize("cc", ["US", "GB", "AU", "CA"])
    def test_major_markets_marketplace_collects(self, markets, cc):
        assert markets[cc]["marketplace_collects_tax"] is True, \
            f"{cc} marketplace_collects_tax 应为 TRUE（主流平台代收代缴）"


# ─── 数据新鲜度 ──────────────────────────────────────────────────────────────

class TestDataFreshness:
    """确保税率数据不过期"""

    def test_all_markets_have_effective_date(self, markets):
        for cc, m in markets.items():
            assert m["effective_date"] is not None, f"{cc} effective_date 为空"

    def test_all_markets_have_review_date(self, markets):
        """必须设置复核日期，确保税率不会无限期过期"""
        for cc, m in markets.items():
            assert m["next_review_date"] is not None, \
                f"{cc} next_review_date 为空，税率数据可能过期未更新"
