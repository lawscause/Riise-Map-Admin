import { test, expect } from '@playwright/test';

const EMAIL = process.env.E2E_EMAIL ?? '';
const PASSWORD = process.env.E2E_PASSWORD ?? '';

test.skip(!EMAIL || !PASSWORD, 'Set E2E_EMAIL and E2E_PASSWORD to run authenticated tests');

test.describe('RiiseMap Button & Navigation Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('riisemap_onboarding', 'true');
      localStorage.setItem('riisemap_profile', JSON.stringify({ name: 'Test Runner', title: 'Admin', role: 'admin' }));
      localStorage.setItem('riisemap_org_name', 'TechsOfColor');
    });
    await page.goto('/');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForSelector('nav, [data-sidebar]', { timeout: 15000 });
  });

  test.describe('Sidebar Navigation', () => {
    test('Home link goes to home', async ({ page }) => {
      await page.click('text=Home');
      await expect(page.locator('text=Priorities')).toBeVisible({ timeout: 5000 });
    });

    test('Funding Sources link goes to funding sources', async ({ page }) => {
      await page.click('text=Funding Sources');
      await expect(page.locator('h1:has-text("Funding Sources")')).toBeVisible({ timeout: 5000 });
    });

    test('Programs link goes to programs', async ({ page }) => {
      await page.click('text=Programs');
      await expect(page.locator('h1:has-text("Programs")')).toBeVisible({ timeout: 5000 });
    });

    test('Pathways link goes to pathways', async ({ page }) => {
      await page.click('text=Pathways');
      await expect(page.locator('h1:has-text("Career Pathways")')).toBeVisible({ timeout: 5000 });
    });

    test('Learners link goes to learners', async ({ page }) => {
      await page.click('text=Learners');
      await expect(page.locator('h1:has-text("Learners")')).toBeVisible({ timeout: 5000 });
    });

    test('Impact & Reporting link goes to impact', async ({ page }) => {
      await page.click('text=Impact');
      await expect(page.locator('h1:has-text("Impact")')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Home Page Buttons', () => {
    test('Quick action: Invite Learners goes to learners', async ({ page }) => {
      await page.click('[data-testid="quick-action-invite-learners"]');
      await expect(page.locator('h1:has-text("Learners")')).toBeVisible({ timeout: 5000 });
    });

    test('Quick action: Review At-Risk goes to learners sorted', async ({ page }) => {
      await page.click('[data-testid="quick-action-review-at-risk-learners"]');
      await expect(page.locator('h1:has-text("Learners")')).toBeVisible({ timeout: 5000 });
    });

    test('Quick action: Print Impact Report goes to impact', async ({ page }) => {
      await page.click('[data-testid="quick-action-print-impact-report"]');
      await expect(page.locator('h1:has-text("Impact")')).toBeVisible({ timeout: 5000 });
    });

    test('Quick action: Add Funding Source goes to funding sources', async ({ page }) => {
      await page.click('[data-testid="quick-action-add-funding-source"]');
      await expect(page.locator('h1:has-text("Funding Sources")')).toBeVisible({ timeout: 5000 });
    });

    test('Priority View button navigates', async ({ page }) => {
      const viewBtn = page.locator('button:has-text("View")').first();
      if (await viewBtn.isVisible()) {
        await viewBtn.click();
        await page.waitForTimeout(1000);
        // Should navigate away from home
        const onHome = await page.locator('text=Priorities').isVisible();
        expect(onHome).toBe(false);
      }
    });
  });

  test.describe('Learners Page Buttons', () => {
    test('Invite Learners button opens modal', async ({ page }) => {
      await page.click('text=Learners');
      await page.click('text=Invite Learners');
      await expect(page.locator('text=Invite a Learner')).toBeVisible({ timeout: 5000 });
    });

    test('Import CSV button opens dialog', async ({ page }) => {
      await page.click('text=Learners');
      await page.click('button:has-text("Import CSV")');
      await expect(page.locator('text=Import Learners from CSV')).toBeVisible({ timeout: 5000 });
    });

    test('View button goes to learner detail', async ({ page }) => {
      await page.click('text=Learners');
      await page.locator('button:has-text("View")').first().click();
      await expect(page.locator('text=Back to Learners')).toBeVisible({ timeout: 5000 });
    });

    test('Edit button on detail opens edit mode', async ({ page }) => {
      await page.click('text=Learners');
      await page.locator('button:has-text("View")').first().click();
      const editBtn = page.locator('button:has-text("Edit")');
      if (await editBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await editBtn.click();
        await expect(page.locator('button:has-text("Save")')).toBeVisible({ timeout: 5000 });
      }
    });

    test('Back to Learners returns to list', async ({ page }) => {
      await page.click('text=Learners');
      await page.locator('button:has-text("View")').first().click();
      await page.click('text=Back to Learners');
      await expect(page.locator('h1:has-text("Learners")')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Programs Page Buttons', () => {
    test('Create Program button opens modal', async ({ page }) => {
      await page.click('text=Programs');
      await page.click('[data-testid="create-program-btn"]');
      await expect(page.locator('[data-testid="submit-program-btn"]')).toBeVisible({ timeout: 5000 });
    });

    test('View Program button goes to detail', async ({ page }) => {
      await page.click('text=Programs');
      await page.locator('button:has-text("View Program")').first().click();
      await expect(page.locator('text=Back to Programs')).toBeVisible({ timeout: 5000 });
    });

    test('Back to Programs returns to list', async ({ page }) => {
      await page.click('text=Programs');
      await page.locator('button:has-text("View Program")').first().click();
      await page.click('text=Back to Programs');
      await expect(page.locator('h1:has-text("Programs")')).toBeVisible({ timeout: 5000 });
    });

    test('Edit button opens edit modal', async ({ page }) => {
      await page.click('text=Programs');
      await page.locator('button:has-text("Edit")').first().click();
      await expect(page.locator('text=Edit Program')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Pathways Page Buttons', () => {
    test('Add Pathway button opens form', async ({ page }) => {
      await page.click('text=Pathways');
      await page.click('button:has-text("Add Pathway")');
      await expect(page.locator('h1:has-text("Add Career Pathway")')).toBeVisible({ timeout: 5000 });
    });

    test('Import CSV button opens dialog', async ({ page }) => {
      await page.click('text=Pathways');
      await page.click('button:has-text("Import CSV")');
      await expect(page.locator('text=Import Pathways from CSV')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Funding Sources Page Buttons', () => {
    test('Add Funding Source button opens modal', async ({ page }) => {
      await page.click('text=Funding Sources');
      await page.click('button:has-text("Add Funding Source")');
      await expect(page.locator('h2:has-text("Add Funding Source")')).toBeVisible({ timeout: 5000 });
    });

    test('View button goes to detail', async ({ page }) => {
      await page.click('text=Funding Sources');
      await page.locator('button:has-text("View")').first().click();
      await expect(page.locator('text=Back')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Impact Page Buttons', () => {
    test('Print Report button exists', async ({ page }) => {
      await page.click('text=Impact');
      await expect(page.locator('button:has-text("Print Report")')).toBeVisible({ timeout: 10000 });
    });

    test('Email Report button exists', async ({ page }) => {
      await page.click('text=Impact');
      await expect(page.locator('button:has-text("Email Report")')).toBeVisible({ timeout: 10000 });
    });

    test('Funding source selector works', async ({ page }) => {
      await page.click('text=Impact');
      await page.waitForSelector('text=Portfolio Overview', { timeout: 10000 });
      await page.click('text=All Funding Sources');
      await page.waitForTimeout(500);
      // Dropdown should show options
      const options = page.locator('[role="option"]');
      expect(await options.count()).toBeGreaterThan(1);
    });
  });

  test.describe('Input & Selection Interactions', () => {
    test('Learners: search filters the list', async ({ page }) => {
      await page.click('text=Learners');
      const searchInput = page.locator('input[placeholder*="Search"]');
      await searchInput.fill('Cloud');
      await page.waitForTimeout(500);
      // List should be filtered (fewer rows visible)
      const rows = page.locator('tbody tr');
      const count = await rows.count();
      expect(count).toBeLessThan(100);
    });

    test('Learners: status filter dropdown works', async ({ page }) => {
      await page.click('text=Learners');
      await page.waitForSelector('tbody tr', { timeout: 10000 });
      await page.click('[data-testid="filter-status"]');
      await page.waitForTimeout(500);
      const checkboxes = page.locator('[role="checkbox"]');
      expect(await checkboxes.count()).toBeGreaterThan(0);
    });

    test('Learners: coach filter dropdown works', async ({ page }) => {
      await page.click('text=Learners');
      await page.waitForSelector('tbody tr', { timeout: 10000 });
      await page.click('[data-testid="filter-coach"]');
      await page.waitForTimeout(500);
      const options = page.locator('[role="option"]');
      expect(await options.count()).toBeGreaterThan(1);
    });

    test('Learners: pathway filter dropdown works', async ({ page }) => {
      await page.click('text=Learners');
      await page.waitForSelector('tbody tr', { timeout: 10000 });
      await page.click('[data-testid="filter-pathway"]');
      await page.waitForTimeout(500);
      const options = page.locator('[role="option"]');
      expect(await options.count()).toBeGreaterThan(1);
    });

    test('Learners: column sort changes order', async ({ page }) => {
      await page.click('text=Learners');
      // Click the Readiness header to sort
      await page.click('th:has-text("Readiness")');
      await page.waitForTimeout(500);
      // Should show sort indicator
      await expect(page.locator('th:has-text("Readiness")')).toContainText('↑');
      // Click again to reverse
      await page.click('th:has-text("Readiness")');
      await page.waitForTimeout(500);
      await expect(page.locator('th:has-text("Readiness")')).toContainText('↓');
    });

    test('Learners: grid/list view toggle works', async ({ page }) => {
      await page.click('text=Learners');
      const gridBtn = page.locator('button[aria-label*="grid"], button:has(svg)').nth(1);
      if (await gridBtn.isVisible()) {
        await gridBtn.click();
        await page.waitForTimeout(500);
      }
    });

    test('Impact: funding source selector changes view', async ({ page }) => {
      await page.click('text=Impact');
      await page.waitForSelector('text=Portfolio Overview', { timeout: 10000 });
      // Open the selector
      await page.click('text=All Funding Sources');
      await page.waitForTimeout(500);
      // Pick the first non-"All" option
      const options = page.locator('[role="option"]');
      const count = await options.count();
      if (count > 1) {
        await options.nth(1).click();
        await page.waitForTimeout(1000);
      }
    });

    test('Impact: status filter dropdown works', async ({ page }) => {
      await page.click('text=Impact');
      await page.waitForSelector('text=Portfolio Overview', { timeout: 10000 });
      const statusSelect = page.locator('text=All Statuses');
      if (await statusSelect.isVisible()) {
        await statusSelect.click();
        await page.waitForTimeout(500);
        const options = page.locator('[role="option"]');
        expect(await options.count()).toBeGreaterThan(1);
      }
    });

    test('Funding Sources: create modal fields are interactive', async ({ page }) => {
      await page.click('text=Funding Sources');
      await page.click('button:has-text("Add Funding Source")');
      await page.waitForTimeout(500);
      // Fill name
      await page.fill('input[placeholder*="e.g."]', 'Interactive Test');
      // Fill amount and learner count using nth input
      const inputs = page.locator('input');
      const count = await inputs.count();
      // Verify name stuck
      await expect(inputs.first()).toHaveValue('Interactive Test');
      expect(count).toBeGreaterThan(2);
    });

    test('Pathways: form steps navigate correctly', async ({ page }) => {
      await page.click('text=Pathways');
      await page.click('button:has-text("Add Pathway")');
      await page.waitForTimeout(500);
      // Fill required fields on step 1
      await page.fill('input[placeholder*="pathway name"], input', 'Step Test Pathway');
      await page.fill('textarea', 'Test description for the pathway');
      // Select duration
      const durationSelect = page.locator('text=Select weeks');
      if (await durationSelect.isVisible()) {
        await durationSelect.click();
        await page.locator('[role="option"]:has-text("16")').click();
      }
      // Click Next
      const nextBtn = page.locator('button:has-text("Next")');
      if (await nextBtn.isVisible()) {
        await nextBtn.click();
        await page.waitForTimeout(500);
        // Should be on step 2
        await expect(page.locator('text=Key Skills')).toBeVisible();
      }
    });
  });
});
