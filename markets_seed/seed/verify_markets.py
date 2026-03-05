"""
seed/verify_markets.py
验证 markets 表数据是否符合 Harness 要求

退出码：
    0 = 全部通过
    1 = 有验证失败
"""

import os
import sys

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    print("❌ pip install psycopg2-binary")
    sys.exit(1)

DATABASE_URL = os.environ.get("DATABASE_ADMIN_URL") or os.environ.get("DATABASE_URL")
REQUIRED_MARKETS = ["US", "GB", "DE", "JP", "AU", "CA"]

checks = []

def check(name: str, passed: bool, detail: str = ""):
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"  {status}  {name}" + (f" — {detail}" if detail else ""))
    checks.append(passed)


def main():
    print("🔍 Markets Harness 验证\n")

    conn = psycopg2.connect(DATABASE_URL)
    with conn.cursor(cursor_factory=RealDictCursor) as cur:

        # ── 1. 必须存在的市场 ────────────────────────────────────────────────
        print("【必要市场覆盖】")
        cur.execute("SELECT country_code FROM markets WHERE is_active = TRUE")
        existing = {r["country_code"] for r in cur.fetchall()}
        for cc in REQUIRED_MARKETS:
            check(f"市场 {cc} 存在", cc in existing)

        # ── 2. 税率合理性 ────────────────────────────────────────────────────
        print("\n【税率合理性】")
        cur.execute("SELECT country_code, tax_type, standard_tax_rate FROM markets")
        for row in cur.fetchall():
            cc, tt, rate = row["country_code"], row["tax_type"], float(row["standard_tax_rate"])
            if cc == "US":
                check(f"US 联邦税率为 0（州级）", rate == 0.0,
                      f"实际值={rate}")
            elif cc in ("GB", "DE"):
                check(f"{cc} VAT ≥ 15%", rate >= 0.15,
                      f"实际值={rate*100:.0f}%")
            elif cc == "JP":
                check(f"JP 消费税 = 10%", abs(rate - 0.10) < 0.001,
                      f"实际值={rate*100:.0f}%")
            elif cc in ("AU",):
                check(f"AU GST = 10%", abs(rate - 0.10) < 0.001,
                      f"实际值={rate*100:.0f}%")
            elif cc == "CA":
                check(f"CA GST = 5%", abs(rate - 0.05) < 0.001,
                      f"实际值={rate*100:.0f}%")

        # ── 3. 进口门槛覆盖 ──────────────────────────────────────────────────
        print("\n【进口关税门槛】")
        cur.execute("""
            SELECT country_code, import_duty_threshold_usd
            FROM markets WHERE country_code IN ('GB', 'DE', 'JP', 'AU', 'CA', 'US')
        """)
        threshold_map = {r["country_code"]: r["import_duty_threshold_usd"] for r in cur.fetchall()}

        check("UK £135 门槛已记录",   threshold_map.get("GB", -1) > 0)
        check("EU €150 门槛已记录",   threshold_map.get("DE", -1) > 0)
        check("JP ¥10000 门槛已记录", threshold_map.get("JP", -1) > 0)
        check("AU AUD1000 门槛已记录", threshold_map.get("AU", -1) > 0)
        check("US 门槛已取消（=0）",  threshold_map.get("US", -1) == 0,
              f"实际值={threshold_map.get('US')}")

        # ── 4. OPA 策略所需字段完整性 ────────────────────────────────────────
        print("\n【OPA 字段完整性】")
        cur.execute("""
            SELECT country_code
            FROM markets
            WHERE standard_tax_rate IS NULL
               OR tax_type IS NULL
               OR currency_code IS NULL
        """)
        incomplete = [r["country_code"] for r in cur.fetchall()]
        check("无关键字段为 NULL", len(incomplete) == 0,
              f"不完整的市场：{incomplete}" if incomplete else "")

        # ── 5. CE 认证标记 ───────────────────────────────────────────────────
        print("\n【EU CE 认证标记】")
        cur.execute("SELECT country_code, requires_ce_mark FROM markets WHERE country_code = 'DE'")
        row = cur.fetchone()
        check("DE requires_ce_mark = TRUE", row and row["requires_ce_mark"])

        # ── 6. IOSS 支持标记 ─────────────────────────────────────────────────
        print("\n【EU IOSS 标记】")
        cur.execute("SELECT country_code, ioss_supported FROM markets WHERE region = 'EU'")
        eu_ioss = {r["country_code"]: r["ioss_supported"] for r in cur.fetchall()}
        for cc, supported in eu_ioss.items():
            check(f"{cc} ioss_supported = TRUE", supported)

        # ── 7. 禁运品字段非空 ────────────────────────────────────────────────
        print("\n【禁运品字段】")
        cur.execute("""
            SELECT country_code, prohibited_categories
            FROM markets
        """)
        for row in cur.fetchall():
            cats = row["prohibited_categories"] or []
            check(f"{row['country_code']} 禁运品字段已填写",
                  len(cats) > 0,
                  f"{len(cats)} 个类别")

    conn.close()

    # ── 汇总 ─────────────────────────────────────────────────────────────────
    passed = sum(checks)
    total  = len(checks)
    failed = total - passed

    print(f"\n{'─'*50}")
    print(f"  结果：{passed}/{total} 通过，{failed} 失败")

    if failed == 0:
        print("  🎉 所有验证通过！markets 表已准备就绪。")
        print("  下一步：运行 pytest tests/test_markets_compliance.py")
        sys.exit(0)
    else:
        print("  ⚠️  请修复失败项后重新运行 seed_markets.py 和本验证。")
        sys.exit(1)


if __name__ == "__main__":
    main()
