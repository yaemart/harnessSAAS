"""
scheduler/run_layer.py
CLI 入口，供 K8s CronJob 调用

用法：
    python scheduler/run_layer.py --layer exchange_rate
    python scheduler/run_layer.py --layer tax_rate --once
    python scheduler/run_layer.py --layer compliance
"""

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from scheduler.market_update_scheduler import (
    update_exchange_rates,
    check_tax_rates_with_ai,
    check_review_dates,
    send_alert,
)

DATABASE_URL = os.environ.get("DATABASE_ADMIN_URL") or os.environ.get("DATABASE_URL")


def _get_db_session():
    """
    返回 SQLAlchemy async session。
    生产环境通过 DATABASE_ADMIN_URL 连接超级用户。
    """
    try:
        from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
        from sqlalchemy.orm import sessionmaker

        db_url = DATABASE_URL
        if db_url and db_url.startswith("postgresql://"):
            db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
        elif db_url and db_url.startswith("postgres://"):
            db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)

        engine = create_async_engine(db_url, echo=False)
        return sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)()
    except ImportError:
        print("❌ 缺少依赖：pip install sqlalchemy asyncpg")
        sys.exit(1)


async def run_exchange_rate():
    print("=== Layer 1: 汇率更新 ===")
    if not DATABASE_URL:
        print("❌ 请设置 DATABASE_ADMIN_URL 环境变量")
        sys.exit(1)

    async with _get_db_session() as session:
        result = await update_exchange_rates(session)

    print(json.dumps(result, ensure_ascii=False, indent=2))
    print(f"\n[OK] 汇率更新完成，写入 {result['inserted']} 条记录")


async def run_tax_rate_check():
    print("=== Layer 2: 税率季度检查 ===")
    report = await check_tax_rates_with_ai()
    print(json.dumps(report, ensure_ascii=False, indent=2))

    if report.get("changed"):
        await send_alert("tax_rate_change", report)
        print(f"\n[WARN] 检测到 {len(report['changed'])} 个市场税率变化，已发送告警")
        print("请人工确认后更新 market_data.json 并运行 seed_markets.py")
    elif report.get("parse_error"):
        print("\n[ERROR] AI 返回内容解析失败，请检查 raw 字段")
        sys.exit(1)
    else:
        print("\n[OK] 所有市场税率未发现变化")

    return report


async def run_compliance_check():
    print("=== Layer 3: 复核日期扫描 ===")
    if not DATABASE_URL:
        print("❌ 请设置 DATABASE_ADMIN_URL 环境变量")
        sys.exit(1)

    async with _get_db_session() as session:
        alerts = await check_review_dates(session)

    if alerts:
        await send_alert("review_due", alerts)
        urgent = [a for a in alerts if a["alert_level"] == "URGENT"]
        if urgent:
            print(f"\n[URGENT] {len(urgent)} 个市场复核已紧急到期，告警已发送")
            sys.exit(2)
        print(f"\n[WARN] {len(alerts)} 个市场即将到期，告警已发送")
    else:
        print("\n[OK] 无即将到期的市场复核")


def main():
    parser = argparse.ArgumentParser(description="Market Update Layer Runner")
    parser.add_argument(
        "--layer",
        choices=["exchange_rate", "tax_rate", "compliance"],
        required=True,
        help="要运行的更新层",
    )
    parser.add_argument("--once", action="store_true", help="运行一次后退出（默认行为）")
    args = parser.parse_args()

    if args.layer == "exchange_rate":
        asyncio.run(run_exchange_rate())
    elif args.layer == "tax_rate":
        asyncio.run(run_tax_rate_check())
    elif args.layer == "compliance":
        asyncio.run(run_compliance_check())


if __name__ == "__main__":
    main()
