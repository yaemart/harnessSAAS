"""
tests/conftest.py
Phase 1 Harness 共享 fixtures
"""
import os
import pytest
import psycopg2
from psycopg2.extras import RealDictCursor

ADMIN_URL = os.environ.get(
    "DATABASE_ADMIN_URL",
    "postgresql://postgres:postgres@localhost:5432/ai_ecom",
)
APP_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://app_user:app_user_password@localhost:5432/ai_ecom",
)


@pytest.fixture(scope="session")
def admin_conn():
    conn = psycopg2.connect(ADMIN_URL)
    conn.autocommit = True
    yield conn
    conn.close()


@pytest.fixture(scope="session")
def app_conn():
    conn = psycopg2.connect(APP_URL)
    conn.autocommit = False
    yield conn
    conn.close()
