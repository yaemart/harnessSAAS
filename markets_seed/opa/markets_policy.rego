# opa/markets_policy.rego
# OPA 税务策略 — 基于 markets 表数据
# 
# 输入格式：
#   input.market        — 市场数据（来自 markets 表）
#   input.order         — 订单数据
#   input.product       — 产品数据
#
# 使用方式：
#   opa eval -d opa/markets_policy.rego -i input.json "data.markets.tax_applicable"

package markets

import rego.v1

# ── 税率计算 ──────────────────────────────────────────────────────────────────

# 计算适用税率
applicable_tax_rate := rate if {
    input.market.tax_type == "ST"
    rate := 0  # 美国：联邦层面为 0，实际税率由 Avalara/TaxJar 提供
}

applicable_tax_rate := rate if {
    input.market.tax_type in {"VAT", "GST", "CT"}
    input.order.product_category in food_categories
    input.market.reduced_tax_rate != null
    rate := input.market.reduced_tax_rate
}

# 食品分类命中但该市场无减免档次（reduced_tax_rate 为 null），降级使用标准税率
applicable_tax_rate := rate if {
    input.market.tax_type in {"VAT", "GST", "CT"}
    input.order.product_category in food_categories
    input.market.reduced_tax_rate == null
    rate := input.market.standard_tax_rate
}

applicable_tax_rate := rate if {
    input.market.tax_type in {"VAT", "GST", "CT"}
    not input.order.product_category in food_categories
    rate := input.market.standard_tax_rate
}

food_categories := {"food", "grocery", "beverage", "fresh_produce"}

# ── De Minimis 判断 ───────────────────────────────────────────────────────────

default duty_applicable          := false
default use_ioss                 := false
default seller_tax_responsibility := false
default order_compliant          := false

# 是否超过进口关税门槛
duty_applicable if {
    input.market.import_duty_threshold_usd == 0
    # 美国：门槛已取消，所有订单均需申报
}

duty_applicable if {
    input.market.import_duty_threshold_usd > 0
    input.order.value_usd > input.market.import_duty_threshold_usd
}

# ── IOSS 通道判断 ──────────────────────────────────────────────────────────────

use_ioss if {
    input.market.ioss_supported == true
    input.order.value_usd <= 150  # EU IOSS 适用于 €150 以下订单
}

# ── 禁运品拦截 ────────────────────────────────────────────────────────────────

# 订单包含禁运品时拒绝
deny contains reason if {
    some category in input.order.product_categories
    some prohibited in input.market.prohibited_categories
    category == prohibited
    reason := sprintf("产品类别 '%v' 在 %v 市场被禁止", [category, input.market.country_code])
}

# ── CE 认证检查 ────────────────────────────────────────────────────────────────

# EU 市场需要 CE 认证的产品类别
ce_required_categories := {
    "electronics", "toys", "machinery", "medical_devices",
    "personal_protective_equipment", "pressure_equipment"
}

deny contains reason if {
    input.market.requires_ce_mark == true
    some category in input.order.product_categories
    category in ce_required_categories
    not input.product.has_ce_mark
    reason := sprintf("产品类别 '%v' 在 %v 市场需要 CE 认证", [category, input.market.country_code])
}

# ── Marketplace Facilitator ───────────────────────────────────────────────────

# 平台代收代缴时，卖家无需独立处理税务
seller_tax_responsibility if {
    not input.market.marketplace_collects_tax
}

# ── 综合合规检查 ──────────────────────────────────────────────────────────────

# 订单合规：无拒绝原因
order_compliant if {
    count(deny) == 0
}

# 完整的合规报告
compliance_report := {
    "compliant":              order_compliant,
    "deny_reasons":           deny,
    "applicable_tax_rate":    applicable_tax_rate,
    "duty_applicable":        duty_applicable,
    "use_ioss":               use_ioss,
    "seller_handles_tax":     seller_tax_responsibility,
    "market":                 input.market.country_code,
}
