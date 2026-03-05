"""
seed/seed_markets.py
幂等市场合规数据种子脚本

用法：
    python seed/seed_markets.py
    python seed/seed_markets.py --dry-run   # 只打印，不写入
    python seed/seed_markets.py --reset     # 先删后插（用于开发环境重置）

连接：使用 DATABASE_ADMIN_URL（superuser），绕过 RLS
"""

import argparse
import json
import os
import sys
from datetime import date
from urllib.parse import urlparse
from pathlib import Path

# ── 依赖检查 ──────────────────────────────────────────────────────────────────
try:
    import psycopg2
    from psycopg2.extras import RealDictCursor, execute_values
except ImportError:
    print("❌ 缺少依赖：pip install psycopg2-binary")
    sys.exit(1)

# ── 配置 ──────────────────────────────────────────────────────────────────────
DATA_FILE = Path(__file__).parent / "market_data.json"
DATABASE_URL = os.environ.get("DATABASE_ADMIN_URL") or os.environ.get("DATABASE_URL")

if not DATABASE_URL:
    print("❌ 请设置环境变量 DATABASE_ADMIN_URL（superuser 连接）")
    print("   export DATABASE_ADMIN_URL=postgresql://postgres:password@localhost:5432/ai_ecom")
    sys.exit(1)


# ── 主逻辑 ────────────────────────────────────────────────────────────────────
def load_data() -> list[dict]:
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def seed_markets(conn, records: list[dict], dry_run: bool = False, reset: bool = False):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:

        if reset:
            if dry_run:
                print("  [DRY-RUN] DELETE FROM markets")
            else:
                cur.execute("DELETE FROM markets")
                print(f"  🗑  已清空 markets 表")

        # 检查表是否存在
        cur.execute("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_name = 'markets'
            )
        """)
        if not cur.fetchone()["exists"]:
            print("❌ markets 表不存在，请先运行 migration：")
            print("   psql $DATABASE_ADMIN_URL -f migrations/create_markets.sql")
            sys.exit(1)

        inserted = 0
        updated = 0
        skipped = 0

        for rec in records:
            # 处理数组字段
            prohibited = rec.get("prohibited_categories") or []

            upsert_sql = """
                INSERT INTO markets (
                    id, country_code, country_name, region,
                    currency_code, currency_symbol,
                    tax_type, standard_tax_rate, reduced_tax_rate,
                    import_duty_threshold_local, import_duty_threshold_usd,
                    vat_threshold_local,
                    marketplace_collects_tax, ioss_supported,
                    prohibited_categories, requires_ce_mark,
                    tax_notes, data_source_url,
                    effective_date, next_review_date, is_active
                )
                VALUES (
                    %(id)s, %(country_code)s, %(country_name)s, %(region)s,
                    %(currency_code)s, %(currency_symbol)s,
                    %(tax_type)s, %(standard_tax_rate)s, %(reduced_tax_rate)s,
                    %(import_duty_threshold_local)s, %(import_duty_threshold_usd)s,
                    %(vat_threshold_local)s,
                    %(marketplace_collects_tax)s, %(ioss_supported)s,
                    %(prohibited_categories)s, %(requires_ce_mark)s,
                    %(tax_notes)s, %(data_source_url)s,
                    %(effective_date)s, %(next_review_date)s, %(is_active)s
                )
                ON CONFLICT (country_code) DO UPDATE SET
                    country_name                = EXCLUDED.country_name,
                    region                      = EXCLUDED.region,
                    currency_code               = EXCLUDED.currency_code,
                    currency_symbol             = EXCLUDED.currency_symbol,
                    tax_type                    = EXCLUDED.tax_type,
                    standard_tax_rate           = EXCLUDED.standard_tax_rate,
                    reduced_tax_rate            = EXCLUDED.reduced_tax_rate,
                    import_duty_threshold_local = EXCLUDED.import_duty_threshold_local,
                    import_duty_threshold_usd   = EXCLUDED.import_duty_threshold_usd,
                    vat_threshold_local         = EXCLUDED.vat_threshold_local,
                    marketplace_collects_tax    = EXCLUDED.marketplace_collects_tax,
                    ioss_supported              = EXCLUDED.ioss_supported,
                    prohibited_categories       = EXCLUDED.prohibited_categories,
                    requires_ce_mark            = EXCLUDED.requires_ce_mark,
                    is_active                   = EXCLUDED.is_active,
                    tax_notes                   = EXCLUDED.tax_notes,
                    data_source_url             = EXCLUDED.data_source_url,
                    effective_date              = EXCLUDED.effective_date,
                    next_review_date            = EXCLUDED.next_review_date,
                    updated_at                  = NOW()
                RETURNING xmax  -- xmax=0 表示 INSERT，>0 表示 UPDATE
            """

            params = {**rec, "prohibited_categories": prohibited}

            if dry_run:
                print(f"  [DRY-RUN] UPSERT {rec['country_code']} — {rec['country_name']}"
                      f"  tax={rec['standard_tax_rate']*100:.0f}% {rec['tax_type']}")
                skipped += 1
            else:
                cur.execute(upsert_sql, params)
                row = cur.fetchone()
                if row["xmax"] == 0:
                    inserted += 1
                    print(f"  ✅ INSERT  {rec['country_code']} ({rec['country_name']}) "
                          f"— {rec['tax_type']} {rec['standard_tax_rate']*100:.0f}%")
                else:
                    updated += 1
                    print(f"  🔄 UPDATE  {rec['country_code']} ({rec['country_name']}) "
                          f"— 税率已更新")

        if not dry_run:
            conn.commit()
            print(f"\n{'─'*50}")
            print(f"  📊 完成：{inserted} 条新增，{updated} 条更新，{skipped} 条跳过")
            print(f"  ⏱  建议下次复核日期：见各记录 next_review_date 字段")
        else:
            print(f"\n  [DRY-RUN] 共 {len(records)} 条记录待处理，未写入数据库")


def main():
    parser = argparse.ArgumentParser(description="Markets 合规数据 Seed Script")
    parser.add_argument("--dry-run", action="store_true", help="只打印，不写入数据库")
    parser.add_argument("--reset",   action="store_true", help="先清空 markets 表再插入（仅开发环境）")
    args = parser.parse_args()

    if args.reset and not args.dry_run:
        confirm = input("⚠️  --reset 将清空 markets 表，确认？(yes/no): ")
        if confirm.lower() != "yes":
            print("已取消")
            sys.exit(0)

    _parsed = urlparse(DATABASE_URL)
    _safe_db = f"{_parsed.hostname}:{_parsed.port}{_parsed.path}"
    print(f"🌍 Markets Seed Script")
    print(f"   数据文件: {DATA_FILE}")
    print(f"   数据库:   {_safe_db}")
    print(f"   模式:     {'DRY-RUN' if args.dry_run else 'WRITE'}")
    print(f"{'─'*50}")

    records = load_data()
    print(f"  📂 加载 {len(records)} 条市场数据")

    try:
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = False
        seed_markets(conn, records, dry_run=args.dry_run, reset=args.reset)
    except psycopg2.Error as e:
        print(f"\n❌ 数据库错误：{e}")
        sys.exit(1)
    finally:
        if 'conn' in locals():
            conn.close()


if __name__ == "__main__":
    main()
