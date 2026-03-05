# scheduler/market_update_scheduler.py
# 三层更新调度器

"""
职责分工：
  Layer 1 (每小时)  — exchange_rates     定时从 API 拉取
  Layer 2 (每季度)  — VAT/GST 税率       定时检查 + AI Agent 比对官网
  Layer 3 (每月)    — 禁运品/关税门槛    定时检查 + 人工确认

部署方式（本地开发）：
  python scheduler/market_update_scheduler.py

部署方式（生产）：
  K8s CronJob 或 Celery Beat
"""

import asyncio
import json
import httpx
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal, Union

try:
    from sqlalchemy import text as sa_text
except ImportError:
    sa_text = None

# ── 配置 ─────────────────────────────────────────────────────────────────────
EXCHANGE_RATE_API = "https://api.exchangerate-api.com/v4/latest/USD"
OPEN_EXCHANGE_URL = "https://openexchangerates.org/api/latest.json"
OPEN_EXCHANGE_KEY = os.environ.get("OPEN_EXCHANGE_API_KEY", "")

TARGET_CURRENCIES  = ["GBP", "EUR", "JPY", "AUD", "CAD", "SGD", "HKD", "CNY"]
MARKET_DATA_FILE   = Path(__file__).parent.parent / "markets_seed/seed/market_data.json"

# ── AI 模型配置（通过环境变量注入，不硬编码）────────────────────────────────
AI_PROVIDER = os.environ.get("AI_PROVIDER", "anthropic")   # anthropic | openai
AI_MODEL    = os.environ.get("AI_MODEL", "claude-sonnet-4-6")

UpdateLayer = Literal["exchange_rate", "tax_rate", "compliance"]


# ══════════════════════════════════════════════════════════════════════════════
# LAYER 1: 汇率更新（每小时）
# ══════════════════════════════════════════════════════════════════════════════

async def update_exchange_rates(db_session) -> dict:
    """
    从 ExchangeRate-API 拉取最新汇率并写入 ExchangeRateDailySnapshot 表。
    表结构对应 Prisma model ExchangeRateDailySnapshot（驼峰字段名）。
    Feature Store 的 Tecton/Feast 会从此表 materialise 实时特征。
    """
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(EXCHANGE_RATE_API)
        resp.raise_for_status()
        data = resp.json()

    rates = data["rates"]
    today = datetime.now(tz=timezone.utc).date()
    inserted = 0

    for currency in TARGET_CURRENCIES:
        if currency not in rates:
            continue
        await db_session.execute(
            sa_text("""
                INSERT INTO "ExchangeRateDailySnapshot"
                    (id, date, "baseCurrency", "targetCurrency", rate, source, "fetchedAt")
                VALUES (
                    gen_random_uuid()::text,
                    :date,
                    'USD',
                    :target,
                    :rate,
                    'exchangerate-api.com',
                    NOW()
                )
                ON CONFLICT (date, "baseCurrency", "targetCurrency") DO UPDATE SET
                    rate      = EXCLUDED.rate,
                    "fetchedAt" = EXCLUDED."fetchedAt"
            """),
            {"date": today, "target": currency, "rate": rates[currency]},
        )
        inserted += 1

    await db_session.commit()
    return {"layer": "exchange_rate", "inserted": inserted, "date": str(today)}


# ══════════════════════════════════════════════════════════════════════════════
# LAYER 2: 税率季度检查（每季度）
# 使用 Claude API 对比当前数据与官方来源，生成变更报告
# ══════════════════════════════════════════════════════════════════════════════

TAX_CHECK_SOURCES = {
    "US": "https://taxsummaries.pwc.com/united-states/individual/other-taxes",
    "GB": "https://www.gov.uk/guidance/rates-of-vat-on-different-goods-and-services",
    "DE": "https://www.bzst.de/EN/Businesses/VAT/vat_node.html",
    "JP": "https://www.customs.go.jp/english/summary/tariff.htm",
    "AU": "https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst",
    "CA": "https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate.html",
}

async def check_tax_rates_with_ai() -> dict:
    """
    让 AI Agent 对比 market_data.json 与官方网页，生成变更摘要。
    不自动写入数据库——需要人工确认后再运行 seed_markets.py。

    模型通过环境变量注入：
        AI_PROVIDER=anthropic  AI_MODEL=claude-sonnet-4-6
        AI_PROVIDER=openai     AI_MODEL=gpt-4o
    """
    current_data = json.loads(MARKET_DATA_FILE.read_text())
    current_rates = {m["country_code"]: m for m in current_data}

    prompt = f"""
你是一个跨境电商税务合规审计 Agent。

当前系统中的市场税率数据（来自 market_data.json）：
{json.dumps(current_rates, ensure_ascii=False, indent=2)}

请对以下官方数据源进行网页抓取和验证：
{json.dumps(TAX_CHECK_SOURCES, indent=2)}

任务：
1. 检查每个市场的 standard_tax_rate 是否与官方来源一致
2. 检查 import_duty_threshold_usd 是否有变化
3. 特别关注已知的 2026 年变化：
   - EU 2026-07 起对 €150 以下包裹征 €3 关税费
   - ViDA 数字发票要求
   - 美国各州销售税变化
4. 输出 JSON 格式报告，包含：
   - changed: [] (有变化的市场列表)
   - warnings: [] (需关注但未确认的变化)
   - no_change: [] (已验证无变化的市场)
   - checked_at: ISO timestamp

只输出 JSON，不要其他文字。
"""

    result_text = await _call_ai(prompt)

    # 兼容 AI 返回 ```json ... ``` 代码块包裹的情况
    code_block = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", result_text)
    json_str = code_block.group(1) if code_block else result_text.strip()

    try:
        report = json.loads(json_str)
    except json.JSONDecodeError:
        report = {"raw": result_text, "parse_error": True}

    return report


async def _call_ai(prompt: str) -> str:
    """
    统一 AI 调用入口。
    provider / model 完全由环境变量决定，业务代码不感知具体模型。
    使用各 SDK 的异步客户端，避免阻塞 asyncio 事件循环。
    """
    if AI_PROVIDER == "anthropic":
        import anthropic
        client = anthropic.AsyncAnthropic()
        response = await client.messages.create(
            model=AI_MODEL,
            max_tokens=2000,
            tools=[{"type": "web_search_20250305", "name": "web_search"}],
            messages=[{"role": "user", "content": prompt}],
        )
        return "".join(
            block.text for block in response.content
            if hasattr(block, "text")
        )

    elif AI_PROVIDER == "openai":
        import openai
        client = openai.AsyncOpenAI()
        response = await client.chat.completions.create(
            model=AI_MODEL,
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.choices[0].message.content or ""

    else:
        raise ValueError(f"不支持的 AI_PROVIDER: {AI_PROVIDER}，支持: anthropic, openai")


# ══════════════════════════════════════════════════════════════════════════════
# LAYER 3: next_review_date 到期检查（每月扫描）
# ══════════════════════════════════════════════════════════════════════════════

async def check_review_dates(db_session) -> list[dict]:
    """
    检查 next_review_date 在未来 30 天内到期的市场。
    到期前发出告警，由工程师触发季度检查流程。
    """
    result = await db_session.execute(
        sa_text("""
            SELECT country_code, country_name, next_review_date,
                   (next_review_date - CURRENT_DATE) AS days_until_review
            FROM markets
            WHERE next_review_date <= CURRENT_DATE + INTERVAL '30 days'
              AND is_active = TRUE
            ORDER BY next_review_date ASC
        """)
    )
    rows = result.mappings().all()

    alerts = []
    for row in rows:
        days = row["days_until_review"]
        level = "URGENT" if days <= 7 else "WARNING" if days <= 14 else "INFO"
        alerts.append({
            "country_code":   row["country_code"],
            "country_name":   row["country_name"],
            "review_date":    str(row["next_review_date"]),
            "days_remaining": days,
            "alert_level":    level,
        })
        print(f"  [{level}] {row['country_code']} — 复核日期：{row['next_review_date']} ({days} 天后)")

    return alerts


# ══════════════════════════════════════════════════════════════════════════════
# 通知发送（Slack / 邮件）
# ══════════════════════════════════════════════════════════════════════════════

async def send_alert(alert_type: str, payload: Union[dict, list]):
    """
    发送告警到 Slack。
    生产环境替换为真实 Webhook URL。
    """
    slack_webhook = os.environ.get("SLACK_WEBHOOK_URL")
    if not slack_webhook:
        print(f"  [告警未发送] SLACK_WEBHOOK_URL 未设置")
        print(f"  内容：{json.dumps(payload, ensure_ascii=False, indent=2)}")
        return

    if alert_type == "tax_rate_change":
        changed = payload.get("changed", [])
        text = f":rotating_light: *税率变更告警*\n以下市场检测到税率变化，需要人工确认并更新 market_data.json：\n"
        for item in changed:
            text += f"• `{item['country_code']}` — {item.get('description', '见详情')}\n"
        text += f"\n执行命令：`python seed/seed_markets.py` 确认更新后运行"

    elif alert_type == "review_due":
        text = f":calendar: *市场合规数据复核提醒*\n以下市场的税率数据即将到期：\n"
        for item in payload:
            emoji = ":red_circle:" if item["alert_level"] == "URGENT" else ":warning:"
            text += f"{emoji} `{item['country_code']}` — {item['review_date']} ({item['days_remaining']} 天后)\n"

    else:
        text = f":information_source: {alert_type}\n```{json.dumps(payload, ensure_ascii=False)}```"

    async with httpx.AsyncClient() as client:
        await client.post(slack_webhook, json={"text": text})
    print(f"  告警已发送至 Slack")
