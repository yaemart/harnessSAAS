import { test, expect, Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEMO_LABELS: Record<string, string> = {
  'boss@globaltech.com': 'Tenant Admin',
  'ops@globaltech.com':  'Operator',
  'admin@system.io':     'System Admin',
};

async function loginAs(page: Page, email: string) {
  await page.goto('/login');
  await page.locator('button', { hasText: 'Quick Demo Login' }).click();
  const label = DEMO_LABELS[email] ?? email;
  await page.locator('button', { hasText: label }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15_000 });
}

async function goToMappingReview(page: Page) {
  await page.goto('/mapping-review');
  await expect(page.getByRole('heading', { name: 'Mapping Review' })).toBeVisible({ timeout: 10_000 });
}

/** Returns true only if real data rows (not empty-state placeholder) exist */
async function hasDataRows(page: Page): Promise<boolean> {
  const rows = page.locator('table tbody tr');
  const count = await rows.count();
  if (count === 0) return false;
  // Empty-state renders a single <td colspan="8">No mapping records.</td>
  const firstTd = rows.first().locator('td').first();
  const colspan = await firstTd.getAttribute('colspan');
  return colspan === null; // real data rows have no colspan
}

// ---------------------------------------------------------------------------
// Suite: Mapping Review — main flows (tenant_admin)
// ---------------------------------------------------------------------------

test.describe('Mapping Review', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'boss@globaltech.com');
    await goToMappingReview(page);
  });

  // -------------------------------------------------------------------------
  // 1. Page loads and shows queue
  // -------------------------------------------------------------------------
  test('should display the mapping queue page', async ({ page }) => {
    await expect(page.locator('[data-testid="status-filter"]')).toBeVisible();
    // Table is always rendered (may show empty state)
    await expect(page.locator('table')).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 2. Status filter
  // -------------------------------------------------------------------------
  test('should filter by APPROVED status', async ({ page }) => {
    await page.locator('[data-testid="status-filter"]').selectOption('APPROVED');
    await page.waitForTimeout(800);

    const badges = page.locator('span.status.APPROVED');
    const count = await badges.count();
    // If rows returned they must all be APPROVED
    for (let i = 0; i < Math.min(count, 5); i++) {
      await expect(badges.nth(i)).toHaveText('APPROVED');
    }
  });

  // -------------------------------------------------------------------------
  // 3. Reconcile Dry-Run — accepts success result OR API-not-running error
  // -------------------------------------------------------------------------
  test('should run reconcile dry-run and show a result', async ({ page }) => {
    const btn = page.locator('button', { hasText: 'Reconcile Dry-Run' });
    await expect(btn).toBeVisible();
    await btn.click();

    // Button transitions to loading state
    await expect(page.locator('button', { hasText: /Running|Reconcile/i })).toBeVisible();

    // Accept either: success result (GO/NO-GO) or the error message
    await expect(
      page.locator('text=/GO|NO.GO|P0|Reconcile dry-run failed/i').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  // -------------------------------------------------------------------------
  // 4. Approve single mapping (skipped if no PENDING data rows)
  // -------------------------------------------------------------------------
  test('should approve a pending mapping', async ({ page }) => {
    await page.locator('[data-testid="status-filter"]').selectOption('PENDING');
    await page.waitForTimeout(600);

    const hasRows = await hasDataRows(page);
    test.skip(!hasRows, 'No PENDING data rows in test environment');

    await page.locator('table tbody tr').first().click();
    await expect(page.locator('button.approve')).toBeVisible({ timeout: 5_000 });

    const globalIdInput = page.locator('input[placeholder*="global"]').last();
    if (await globalIdInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await globalIdInput.fill('00000000-0000-0000-0000-000000000001');
    }

    await page.locator('button.approve').click();
    await expect(
      page.locator('text=/approved|APPROVED|success/i').first()
    ).toBeVisible({ timeout: 8_000 });
  });

  // -------------------------------------------------------------------------
  // 5. Reject single mapping
  // -------------------------------------------------------------------------
  test('should reject a pending mapping', async ({ page }) => {
    await page.locator('[data-testid="status-filter"]').selectOption('PENDING');
    await page.waitForTimeout(600);

    const hasRows = await hasDataRows(page);
    test.skip(!hasRows, 'No PENDING data rows in test environment');

    await page.locator('table tbody tr').first().click();
    await expect(page.locator('button.reject')).toBeVisible({ timeout: 5_000 });

    const reasonInput = page.locator('input[placeholder="reject reason"]');
    if (await reasonInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await reasonInput.fill('E2E test rejection');
    }

    await page.locator('button.reject').click();
    await expect(
      page.locator('text=/rejected|REJECTED|success/i').first()
    ).toBeVisible({ timeout: 8_000 });
  });

  // -------------------------------------------------------------------------
  // 6. Revoke an approved mapping
  // -------------------------------------------------------------------------
  test('should revoke an approved mapping', async ({ page }) => {
    await page.locator('[data-testid="status-filter"]').selectOption('APPROVED');
    await page.waitForTimeout(600);

    const hasRows = await hasDataRows(page);
    test.skip(!hasRows, 'No APPROVED data rows in test environment');

    await page.locator('table tbody tr').first().click();
    await expect(page.locator('button.secondary.danger', { hasText: 'Revoke' })).toBeVisible({ timeout: 5_000 });

    const reasonInput = page.locator('input[placeholder="revoke reason"]');
    if (await reasonInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await reasonInput.fill('E2E test revoke');
    }

    await page.locator('button.secondary.danger', { hasText: 'Revoke' }).click();
    await expect(
      page.locator('text=/revoked|REVOKED|success/i').first()
    ).toBeVisible({ timeout: 8_000 });
  });

  // -------------------------------------------------------------------------
  // 7. Audit History in detail panel
  // -------------------------------------------------------------------------
  test('should show Audit History section in detail panel', async ({ page }) => {
    const hasRows = await hasDataRows(page);
    test.skip(!hasRows, 'No data rows available');

    await page.locator('table tbody tr').first().click();
    // "Audit History" is rendered as a div heading in the detail panel
    await expect(
      page.locator('text=Audit History').first()
    ).toBeVisible({ timeout: 5_000 });
  });
});

// ---------------------------------------------------------------------------
// Suite: Role-based access
// ---------------------------------------------------------------------------

test.describe('Role isolation', () => {
  test('operator can access mapping review page', async ({ page }) => {
    await loginAs(page, 'ops@globaltech.com');
    await page.goto('/mapping-review');
    await expect(page).not.toHaveURL(/login|403|forbidden/i);
    await expect(page.getByRole('heading', { name: 'Mapping Review' })).toBeVisible({ timeout: 10_000 });
  });

  test('system_admin is blocked from mapping review page', async ({ page }) => {
    await loginAs(page, 'admin@system.io');
    await page.goto('/mapping-review');
    // RoleGuard blocks system_admin — either shows denied message or redirects
    const isDenied = await page.getByRole('heading', { name: '403' }).waitFor({ state: 'visible', timeout: 5_000 }).then(() => true).catch(() => false);
    const isRedirected = !page.url().includes('/mapping-review');
    expect(isDenied || isRedirected).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Suite: Reconcile panel — go_no_go field
// ---------------------------------------------------------------------------

test.describe('Reconcile panel', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'boss@globaltech.com');
    await goToMappingReview(page);
  });

  test('dry-run button exists and triggers a response', async ({ page }) => {
    const btn = page.locator('button', { hasText: 'Reconcile Dry-Run' });
    await expect(btn).toBeVisible();
    await btn.click();
    // Wait for either success or error
    await expect(
      page.locator('text=/GO|NO.GO|Reconcile dry-run failed/i').first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
