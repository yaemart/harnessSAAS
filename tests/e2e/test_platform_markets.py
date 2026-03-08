import pytest
import httpx
from playwright.sync_api import Page, expect

BASE_URL = "http://localhost:3001"
API_URL = "http://localhost:3300"

@pytest.fixture(scope="session")
def auth_token():
    r = httpx.post(f"{API_URL}/auth/login", json={"email": "admin@system.io", "password": "harness123"})
    assert r.status_code == 200
    return r.json()["accessToken"]

@pytest.fixture
def logged_in_page(page: Page):
    page.goto(f"{BASE_URL}/login")
    page.wait_for_load_state("networkidle")
    quick_demo = page.get_by_text("Quick Demo Login")
    quick_demo.click()
    page.wait_for_timeout(500)
    system_admin_btn = page.get_by_text("System Admin").first
    system_admin_btn.click()
    page.wait_for_url("**/", timeout=15000)
    page.wait_for_load_state("networkidle")
    page.goto(f"{BASE_URL}/registry")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(3000)
    return page


def test_api_platform_market_update(auth_token):
    """Test: PUT /system/platforms/:id can update supportedMarketCodes"""
    headers = {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
    r = httpx.get(f"{API_URL}/system/platforms", headers=headers)
    assert r.status_code == 200
    platforms = r.json()["items"]
    wayfair = next(p for p in platforms if p["code"] == "wayfair")
    original = wayfair["supportedMarketCodes"]

    r2 = httpx.put(f"{API_URL}/system/platforms/{wayfair['id']}", headers=headers,
                   json={"supportedMarketCodes": original + ["de"]})
    assert r2.status_code == 200
    assert "de" in r2.json()["item"]["supportedMarketCodes"]

    r3 = httpx.put(f"{API_URL}/system/platforms/{wayfair['id']}", headers=headers,
                   json={"supportedMarketCodes": original})
    assert r3.status_code == 200
    assert r3.json()["item"]["supportedMarketCodes"] == original


def test_api_platform_toggle(auth_token):
    """Test: PATCH /system/platforms/:id/toggle works"""
    headers = {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
    r = httpx.get(f"{API_URL}/system/platforms", headers=headers)
    platforms = r.json()["items"]
    target = next(p for p in platforms if p["code"] == "wayfair")
    orig_enabled = target["enabled"]

    r2 = httpx.patch(f"{API_URL}/system/platforms/{target['id']}/toggle", headers=headers, json={})
    assert r2.status_code == 200
    assert r2.json()["item"]["enabled"] != orig_enabled

    httpx.patch(f"{API_URL}/system/platforms/{target['id']}/toggle", headers=headers, json={})


def test_registry_page_loads(logged_in_page: Page):
    """Test: /registry page loads with Platforms & Markets tab"""
    expect(logged_in_page.get_by_text("Platforms & Markets")).to_be_visible()
    expect(logged_in_page.get_by_text("Save Configuration")).to_be_visible()


def test_platform_expand_shows_markets(logged_in_page: Page):
    """Test: First enabled platform auto-expands OR click to expand shows market chips"""
    select_markets = logged_in_page.get_by_text("Select enabled markets")
    if not select_markets.is_visible():
        logged_in_page.locator("text=Amazon").first.click()
        logged_in_page.wait_for_timeout(500)
    if not select_markets.is_visible():
        logged_in_page.locator("text=Amazon").first.click()
        logged_in_page.wait_for_timeout(500)
    expect(select_markets).to_be_visible()
    expect(logged_in_page.get_by_text("Select All").first).to_be_visible()
    expect(logged_in_page.get_by_text("Clear").last).to_be_visible()


def test_market_chips_are_clickable(logged_in_page: Page):
    """Test: Market chips can be toggled on/off"""
    select_markets = logged_in_page.get_by_text("Select enabled markets")
    if not select_markets.is_visible():
        logged_in_page.locator("text=eBay").first.click()
        logged_in_page.wait_for_timeout(500)
    if not select_markets.is_visible():
        logged_in_page.locator("text=Amazon").first.click()
        logged_in_page.wait_for_timeout(500)

    us_chip = logged_in_page.locator("text=United States").first
    expect(us_chip).to_be_visible()
    us_chip.click()
    logged_in_page.wait_for_timeout(300)
    us_chip.click()
    logged_in_page.wait_for_timeout(300)


def test_select_all_and_clear(logged_in_page: Page):
    """Test: Select All and Clear buttons work"""
    wayfair_row = logged_in_page.locator("text=Wayfair").first
    wayfair_row.click()
    logged_in_page.wait_for_timeout(500)

    market_section = logged_in_page.get_by_text("Select enabled markets")
    expect(market_section).to_be_visible()

    clear_btn = logged_in_page.get_by_text("Clear").last
    clear_btn.click()
    logged_in_page.wait_for_timeout(500)

    select_all_btn = logged_in_page.get_by_text("Select All").last
    select_all_btn.click()
    logged_in_page.wait_for_timeout(500)
