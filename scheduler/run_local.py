"""
scheduler/run_local.py
本地开发用 APScheduler 替代 K8s CronJob

用法：
    pip install apscheduler
    python scheduler/run_local.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    from apscheduler.triggers.cron import CronTrigger
except ImportError:
    print("❌ 缺少依赖：pip install apscheduler")
    sys.exit(1)

import asyncio
from scheduler.market_update_scheduler import check_tax_rates_with_ai, check_review_dates


async def main():
    scheduler = AsyncIOScheduler()

    # Layer 2: 每季度（本地测试改为每天，验证流程）
    scheduler.add_job(
        check_tax_rates_with_ai,
        CronTrigger(month="1,4,7,10", day=1, hour=9),
        id="tax_rate_quarterly",
        replace_existing=True,
    )

    # Layer 3: 每月扫描（需要 db_session，本地仅打印提示）
    scheduler.add_job(
        lambda: print("[Layer 3] 复核日期扫描 — 需要数据库连接，生产环境通过 K8s 运行"),
        CronTrigger(day=1, hour=10),
        id="review_scanner",
        replace_existing=True,
    )

    scheduler.start()
    print("调度器已启动。Ctrl+C 停止。")
    print("  - Layer 2 (税率检查): 每年 1/4/7/10 月 1 日 09:00")
    print("  - Layer 3 (复核扫描): 每月 1 日 10:00")
    print("  - Layer 1 (汇率更新): 需要数据库，通过 K8s CronJob 每小时运行")

    try:
        await asyncio.Event().wait()
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown()
        print("\n调度器已停止")


if __name__ == "__main__":
    asyncio.run(main())
