"""
tests/test_phase1_harness.py
Phase 1 — 12 项 Harness 门禁
语言无关黑盒验证层：纯 Python + psycopg2 + redis + boto3
"""
import os
import subprocess
import uuid
import pytest
from psycopg2.extras import RealDictCursor

TENANT_A = "11111111-1111-1111-1111-111111111111"
TENANT_B = "22222222-2222-2222-2222-222222222222"

CORE_TABLES = [
    "Tenant", "Brand", "Product", "Commodity", "Listing",
    "PerformanceSnapshot", "AgentExecutionLog", "ApprovalQueue",
    "PolicyConfig", "PolicySnapshot", "RuleSet",
    "RuleConflictRecord", "RuleSuggestionRecord",
    "RequestNonce", "SecurityAuditEvent",
    "KnowledgeEntry", "FeedbackSignal", "ConfidenceLedger", "TenantMaturity",
]

RLS_TABLES_WITH_POLICY = CORE_TABLES


# ═══════════════════════════════════════════════════════════════════════
# Schema 验证（4 项）
# ═══════════════════════════════════════════════════════════════════════

class TestSchemaValidation:

    def test_01_all_core_tables_exist(self, admin_conn):
        """所有核心多租户表存在于 information_schema"""
        with admin_conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            """)
            existing = {r["table_name"] for r in cur.fetchall()}
        for tbl in CORE_TABLES:
            assert tbl in existing, f"表 {tbl} 不存在"

    def test_02_tenant_id_columns_exist(self, admin_conn):
        """所有多租户表含 tenantId 列（Tenant 表用 id 自身）"""
        with admin_conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT table_name, column_name
                FROM information_schema.columns
                WHERE table_schema = 'public' AND column_name = 'tenantId'
            """)
            tables_with_tenant_id = {r["table_name"] for r in cur.fetchall()}
        for tbl in CORE_TABLES:
            if tbl == "Tenant":
                continue
            assert tbl in tables_with_tenant_id, f"表 {tbl} 缺少 tenantId 列"

    def test_03_rls_enabled(self, admin_conn):
        """19 张核心表 RLS 已启用 (relrowsecurity = True)"""
        with admin_conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT relname, relrowsecurity, relforcerowsecurity
                FROM pg_class
                WHERE relnamespace = 'public'::regnamespace
                  AND relkind = 'r'
            """)
            rls_map = {r["relname"]: r for r in cur.fetchall()}
        for tbl in RLS_TABLES_WITH_POLICY:
            info = rls_map.get(tbl)
            assert info is not None, f"表 {tbl} 在 pg_class 中不存在"
            assert info["relrowsecurity"], f"表 {tbl} ENABLE ROW LEVEL SECURITY 未设置"
            assert info["relforcerowsecurity"], f"表 {tbl} FORCE ROW LEVEL SECURITY 未设置"

    def test_04_tenant_isolation_policy_exists(self, admin_conn):
        """19 张核心表均有 tenant_isolation_* policy"""
        with admin_conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT tablename, policyname
                FROM pg_policies
                WHERE schemaname = 'public'
                  AND policyname LIKE 'tenant_isolation_%'
            """)
            policy_tables = {r["tablename"] for r in cur.fetchall()}
        for tbl in RLS_TABLES_WITH_POLICY:
            if tbl == "Tenant":
                continue
            assert tbl in policy_tables, f"表 {tbl} 缺少 tenant_isolation policy"


# ═══════════════════════════════════════════════════════════════════════
# RLS 隔离（3 项）
# ═══════════════════════════════════════════════════════════════════════

class TestRLSIsolation:

    def _setup_test_brand(self, admin_conn, tenant_id, code):
        brand_id = str(uuid.uuid4())
        with admin_conn.cursor() as cur:
            cur.execute(
                """INSERT INTO "Brand"(id, "tenantId", name, code, "updatedAt")
                   VALUES (%s, %s, %s, %s, now()) ON CONFLICT DO NOTHING""",
                [brand_id, tenant_id, f"Test-{code}", code],
            )
        return brand_id

    def _cleanup_brand(self, admin_conn, code):
        with admin_conn.cursor() as cur:
            cur.execute("""DELETE FROM "Brand" WHERE code = %s""", [code])

    def test_05_cross_tenant_blocked(self, admin_conn, app_conn):
        """app_user 以 tenant A 身份查不到 tenant B 的 Brand"""
        code = f"RLS-CROSS-{uuid.uuid4().hex[:8]}"
        self._setup_test_brand(admin_conn, TENANT_B, code)
        try:
            app_conn.autocommit = False
            with app_conn.cursor() as cur:
                cur.execute(f"SET LOCAL app.tenant_id = '{TENANT_A}'")
                cur.execute(
                    """SELECT COUNT(*) AS cnt FROM "Brand" WHERE code = %s""",
                    [code],
                )
                cnt = cur.fetchone()[0]
            app_conn.rollback()
            assert cnt == 0, f"跨租户泄露：tenant A 查到了 {cnt} 条 tenant B 的 Brand"
        finally:
            self._cleanup_brand(admin_conn, code)

    def test_06_inventory_isolation(self, admin_conn, app_conn):
        """WITH CHECK: app_user 以 tenant A 身份无法写入 tenant B 的 Brand（写隔离）"""
        code = f"RLS-WRITE-{uuid.uuid4().hex[:8]}"
        brand_id = str(uuid.uuid4())
        import psycopg2
        app_conn.autocommit = False
        try:
            with app_conn.cursor() as cur:
                cur.execute(f"SET LOCAL app.tenant_id = '{TENANT_A}'")
                cur.execute(
                    """INSERT INTO "Brand"(id, "tenantId", name, code, "updatedAt")
                       VALUES (%s, %s, 'HarnessWrite', %s, now())""",
                    [brand_id, TENANT_B, code],
                )
            app_conn.commit()
            pytest.fail("RLS WITH CHECK 未阻断跨租户写入，数据泄露风险")
        except psycopg2.errors.InsufficientPrivilege:
            app_conn.rollback()
        except Exception as e:
            app_conn.rollback()
            if "row-level security" in str(e).lower() or "violates" in str(e).lower():
                pass
            else:
                pytest.fail(f"预期 RLS 错误，实际异常: {e}")


    def test_07_admin_sees_all(self, admin_conn):
        """superuser 无 SET LOCAL 可查所有租户"""
        with admin_conn.cursor() as cur:
            cur.execute("""SELECT COUNT(DISTINCT "id") FROM "Tenant" """)
            cnt = cur.fetchone()[0]
        assert cnt >= 2, f"admin 只看到 {cnt} 个租户，预期 >= 2"


# ═══════════════════════════════════════════════════════════════════════
# Seed 幂等（3 项）
# ═══════════════════════════════════════════════════════════════════════

class TestSeedIdempotency:

    def test_08_seed_twice_same_result(self, admin_conn):
        """seed 数据使用 upsert，执行两次 Tenant count 不变"""
        with admin_conn.cursor() as cur:
            cur.execute("""SELECT COUNT(*) FROM "Tenant" """)
            count_before = cur.fetchone()[0]
        assert count_before >= 2, f"Tenant count 过少: {count_before}，seed 可能未执行"

        db_url = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/ai_ecom")
        result = subprocess.run(
            ["pnpm", "--filter", "@apps/api", "seed:harness"],
            capture_output=True,
            text=True,
            env={**os.environ, "DATABASE_URL": db_url},
        )
        assert result.returncode == 0, f"第二次 seed 失败:\n{result.stderr}"

        with admin_conn.cursor() as cur:
            cur.execute("""SELECT COUNT(*) FROM "Tenant" """)
            count_after = cur.fetchone()[0]
        assert count_before == count_after, (
            f"Tenant count 不幂等: 第一次={count_before}, 第二次={count_after}"
        )

    def test_09_boundary_value_exists(self, admin_conn):
        """边界值数据存在（多租户 plan 覆盖）"""
        with admin_conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT id, plan FROM "Tenant"
                WHERE id IN (%s, %s, %s)
                ORDER BY id
            """, [TENANT_A, TENANT_B, "33333333-3333-3333-3333-333333333333"])
            rows = cur.fetchall()
        tenant_ids = {r["id"] for r in rows}
        assert TENANT_A in tenant_ids, "Tenant A (enterprise) UUID 不存在"
        assert TENANT_B in tenant_ids, "Tenant B (pro) UUID 不存在"

    def test_10_fixed_uuid_stable(self, admin_conn):
        """固定 UUID 11111111-* 和 22222222-* 存在且稳定"""
        with admin_conn.cursor() as cur:
            cur.execute(
                """SELECT id FROM "Tenant" WHERE id IN (%s, %s)""",
                [TENANT_A, TENANT_B],
            )
            found = {str(r[0]) for r in cur.fetchall()}
        assert TENANT_A in found, f"固定 UUID {TENANT_A} 不存在"
        assert TENANT_B in found, f"固定 UUID {TENANT_B} 不存在"


# ═══════════════════════════════════════════════════════════════════════
# 基础设施（2 项）
# ═══════════════════════════════════════════════════════════════════════

class TestInfrastructure:

    def test_11_redis_connectable(self):
        """Redis 可连接并响应 PING"""
        import redis
        redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379")
        r = redis.from_url(redis_url, socket_connect_timeout=5)
        assert r.ping(), "Redis PING 失败"

    def test_12_s3_minio_read_write(self):
        """MinIO S3 兼容接口可读写"""
        import boto3
        from botocore.config import Config as BotoConfig

        endpoint = os.environ.get("MINIO_ENDPOINT", "http://localhost:9000")
        access_key = os.environ.get("MINIO_ACCESS_KEY", "minioadmin")
        secret_key = os.environ.get("MINIO_SECRET_KEY", "minioadmin")

        s3 = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            config=BotoConfig(signature_version="s3v4"),
            region_name="us-east-1",
        )

        bucket = "harness-test"
        try:
            s3.create_bucket(Bucket=bucket)
        except s3.exceptions.BucketAlreadyOwnedByYou:
            pass

        test_key = f"phase1-harness/{uuid.uuid4().hex}"
        test_body = b"harness-connectivity-check"

        s3.put_object(Bucket=bucket, Key=test_key, Body=test_body)
        resp = s3.get_object(Bucket=bucket, Key=test_key)
        body = resp["Body"].read()
        assert body == test_body, f"S3 读写不一致: {body!r} != {test_body!r}"

        s3.delete_object(Bucket=bucket, Key=test_key)
