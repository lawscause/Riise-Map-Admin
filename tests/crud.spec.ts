import { test, expect } from '@playwright/test';

const EMAIL = process.env.E2E_EMAIL ?? '';
const PASSWORD = process.env.E2E_PASSWORD ?? '';
const TS = Date.now();

test.skip(!EMAIL || !PASSWORD, 'Set E2E_EMAIL and E2E_PASSWORD to run authenticated tests');

test.describe('RiiseMap CRUD Tests', () => {
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

  // ═══════════════════════════════════════════════════════════════
  // FUNDING SOURCES
  // ═══════════════════════════════════════════════════════════════
  test.describe('Funding Sources — Bulk Delete', () => {
    const name = `BulkFund_${TS}`;

    test('Create', async ({ page }) => {
      await page.click('text=Funding Sources');
      await page.click('button:has-text("Add Funding Source")');
      await page.waitForTimeout(500);
      await page.fill('input[placeholder*="e.g."]', name);
      await page.fill('input[placeholder*="250000"], input[placeholder*="e.g. 250000"]', '50000');
      await page.fill('input[placeholder*="50"], input[placeholder*="e.g. 50"]', '10');
      await page.click('button:has-text("Create")');
      await page.waitForTimeout(3000);
      await page.click('text=Funding Sources');
      await expect(page.locator(`text=${name}`).first()).toBeVisible({ timeout: 5000 });
    });

    test('Update', async ({ page }) => {
      await page.click('text=Funding Sources');
      await page.waitForTimeout(1000);
      await page.locator(`text=${name}`).first().click();
      await page.waitForTimeout(1000);
      await page.click('button:has-text("Edit")');
      await page.waitForTimeout(500);
      await page.locator('textarea').first().fill('Updated by bulk delete test');
      await page.click('button:has-text("Save")');
      await page.waitForTimeout(2000);
    });

    test('Delete via bulk', async ({ page }) => {
      await page.click('text=Funding Sources');
      await page.waitForTimeout(1000);
      const checkbox = page.locator(`text=${name}`).first().locator('..').locator('..').locator('[role="checkbox"]').first();
      if (await checkbox.isVisible()) {
        await checkbox.click();
        await page.waitForTimeout(500);
        await page.click('button:has-text("Delete Selected")');
        await page.waitForTimeout(500);
        await page.locator('button:has-text("Confirm Delete")').click({ timeout: 10000 });
        await page.waitForTimeout(2000);
      }
    });
  });

  test.describe('Funding Sources — Detail Delete', () => {
    const name = `DetailFund_${TS}`;

    test('Create', async ({ page }) => {
      await page.click('text=Funding Sources');
      await page.click('button:has-text("Add Funding Source")');
      await page.waitForTimeout(500);
      await page.fill('input[placeholder*="e.g."]', name);
      await page.click('button:has-text("Create")');
      await page.waitForTimeout(3000);
      await page.click('text=Funding Sources');
      await expect(page.locator(`text=${name}`).first()).toBeVisible({ timeout: 5000 });
    });

    test('Delete via detail page', async ({ page }) => {
      await page.click('text=Funding Sources');
      await page.waitForSelector('text=Add Funding Source', { timeout: 10000 });
      await page.waitForTimeout(2000);
      const card = page.locator('[class*="card"], [class*="Card"]').filter({ hasText: name }).first();
      await card.locator('button:has-text("View")').click();
      await page.waitForTimeout(2000);
      await page.click('button:has-text("Delete")');
      const confirmInput = page.locator('input[placeholder*="Type"]');
      await confirmInput.waitFor({ state: 'visible', timeout: 5000 });
      await confirmInput.fill(name);
      await page.locator('button:has-text("Delete")').last().click();
      await page.waitForTimeout(3000);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // PROGRAMS
  // ═══════════════════════════════════════════════════════════════
  test.describe('Programs — Bulk Delete', () => {
    const name = `BulkProg_${TS}`;

    test('Create', async ({ page }) => {
      await page.click('text=Programs');
      await page.click('[data-testid="create-program-btn"]');
      await page.waitForTimeout(500);
      await page.locator('input').first().fill(name);
      await page.fill('textarea', 'Bulk delete test program');
      await page.click('[data-testid="submit-program-btn"]');
      await page.waitForTimeout(3000);
    });

    test('Update', async ({ page }) => {
      await page.click('text=Programs');
      await page.waitForTimeout(1000);
      const editBtn = page.locator(`text=${name}`).first().locator('..').locator('..').locator('button:has-text("Edit")');
      if (await editBtn.isVisible()) {
        await editBtn.click();
        await page.waitForTimeout(500);
        await page.fill('textarea', 'Updated by bulk test');
        await page.locator('button:has-text("Save"), button:has-text("Update")').first().click();
        await page.waitForTimeout(2000);
      }
    });

    test('Delete via bulk', async ({ page }) => {
      await page.click('text=Programs');
      await page.waitForTimeout(1000);
      const checkbox = page.locator(`text=${name}`).first().locator('..').locator('..').locator('[role="checkbox"]').first();
      if (await checkbox.isVisible()) {
        await checkbox.click();
        await page.waitForTimeout(500);
        await page.click('button:has-text("Delete Selected")');
        await page.waitForTimeout(500);
        await page.click('button:has-text("Confirm")');
        await page.waitForTimeout(2000);
      }
    });
  });

  test.describe('Programs — Detail Delete', () => {
    const name = `DetailProg_${TS}`;

    test('Create', async ({ page }) => {
      await page.click('text=Programs');
      await page.click('[data-testid="create-program-btn"]');
      await page.waitForTimeout(500);
      await page.locator('input').first().fill(name);
      await page.fill('textarea', 'Detail delete test program');
      await page.click('[data-testid="submit-program-btn"]');
      await page.waitForTimeout(3000);
    });

    test('Delete via detail page', async ({ page }) => {
      await page.click('text=Programs');
      await page.waitForTimeout(1000);
      const viewBtn = page.locator(`text=${name}`).first().locator('..').locator('..').locator('button:has-text("View Program")');
      if (await viewBtn.isVisible()) {
        await viewBtn.click();
        await page.waitForTimeout(1000);
        await page.click('button:has-text("Delete")');
        await page.waitForTimeout(500);
        await page.click('button:has-text("Confirm"), button:has-text("Delete")');
        await page.waitForTimeout(2000);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // LEARNERS
  // ═══════════════════════════════════════════════════════════════
  test.describe('Learners — Bulk Delete', () => {
    const firstName = `BulkLrn${TS}`;
    const email = `bulklrn_${TS}@example.com`;

    test('Create', async ({ page }) => {
      await page.click('text=Learners');
      await page.click('text=Invite Learners');
      await page.waitForTimeout(500);
      await page.locator('input').nth(0).fill(firstName);
      await page.locator('input').nth(1).fill('TestUser');
      const emailInput = page.locator('input[type="email"], input[placeholder*="email"]').first();
      await emailInput.fill(email);
      const nextBtn = page.locator('button:has-text("Next")').first();
      if (await nextBtn.isVisible()) {
        await nextBtn.click();
        await page.waitForTimeout(1000);
        const sendBtn = page.locator('button:has-text("Send"), button:has-text("Invite")').first();
        if (await sendBtn.isVisible()) {
          await sendBtn.click();
          await page.waitForTimeout(3000);
        }
      }
    });

    test('Update', async ({ page }) => {
      await page.click('text=Learners');
      await page.waitForTimeout(1000);
      const viewBtn = page.locator(`text=${firstName}`).first().locator('..').locator('..').locator('button:has-text("View")');
      if (await viewBtn.isVisible()) {
        await viewBtn.click();
        await page.waitForTimeout(1000);
        await page.click('button:has-text("Edit")');
        await page.waitForTimeout(500);
        const coachInput = page.locator('input').nth(4);
        await coachInput.fill('Bulk Test Coach');
        await page.click('button:has-text("Save")');
        await page.waitForTimeout(2000);
      }
    });

    test('Delete via bulk', async ({ page }) => {
      await page.click('text=Learners');
      await page.waitForTimeout(1000);
      const checkbox = page.locator(`text=${firstName}`).first().locator('..').locator('..').locator('[role="checkbox"]').first();
      if (await checkbox.isVisible()) {
        await checkbox.click();
        await page.waitForTimeout(500);
        await page.click('button:has-text("Delete Selected")');
        await page.waitForTimeout(500);
        await page.click('button:has-text("Confirm Delete")');
        await page.waitForTimeout(2000);
      }
    });
  });

  test.describe('Learners — Detail Delete', () => {
    const firstName = `DtlLrn${TS}`;
    const email = `dtllrn_${TS}@example.com`;

    test('Create', async ({ page }) => {
      await page.click('text=Learners');
      await page.click('text=Invite Learners');
      await page.waitForTimeout(500);
      await page.locator('input').nth(0).fill(firstName);
      await page.locator('input').nth(1).fill('TestUser');
      const emailInput = page.locator('input[type="email"], input[placeholder*="email"]').first();
      await emailInput.fill(email);
      const nextBtn = page.locator('button:has-text("Next")').first();
      if (await nextBtn.isVisible()) {
        await nextBtn.click();
        await page.waitForTimeout(1000);
        const sendBtn = page.locator('button:has-text("Send"), button:has-text("Invite")').first();
        if (await sendBtn.isVisible()) {
          await sendBtn.click();
          await page.waitForTimeout(3000);
        }
      }
    });

    test('Delete via detail page', async ({ page }) => {
      await page.click('text=Learners');
      await page.waitForTimeout(1000);
      const viewBtn = page.locator(`text=${firstName}`).first().locator('..').locator('..').locator('button:has-text("View")');
      if (await viewBtn.isVisible()) {
        await viewBtn.click();
        await page.waitForTimeout(1000);
        const deleteBtn = page.locator('button:has-text("Delete")');
        if (await deleteBtn.isVisible()) {
          await deleteBtn.click();
          await page.waitForTimeout(500);
          await page.click('button:has-text("Confirm"), button:has-text("Delete")');
          await page.waitForTimeout(2000);
        }
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // PATHWAYS
  // ═══════════════════════════════════════════════════════════════
  test.describe('Pathways — Bulk Delete', () => {
    const name = `BulkPath_${TS}`;

    test('Create', async ({ page }) => {
      await page.click('text=Pathways');
      await page.click('button:has-text("Add Pathway")');
      await page.waitForTimeout(1000);
      await page.locator('input').first().fill(name);
      await page.fill('textarea', 'Bulk delete pathway test');
      const durationSelect = page.locator('text=Select weeks');
      if (await durationSelect.isVisible()) {
        await durationSelect.click();
        await page.locator('[role="option"]:has-text("12")').click();
        await page.waitForTimeout(300);
      }
      // Step 1 → Step 2
      await page.locator('button:has-text("Next"), button:has-text("Continue")').first().click();
      await page.waitForTimeout(1000);
      // Step 2 → Step 3
      const next2 = page.locator('button:has-text("Next"), button:has-text("Continue")');
      if (await next2.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await next2.first().click();
        await page.waitForTimeout(1000);
      }
      // Create
      const createBtn = page.locator('button:has-text("Create Pathway"), button:has-text("Save")');
      await createBtn.first().click({ timeout: 5000 });
      await page.waitForTimeout(3000);
      // Verify the pathway was created
      await page.click('text=Pathways');
      await expect(page.locator(`text=${name}`).first()).toBeVisible({ timeout: 10000 });
    });

    test('Update', async ({ page }) => {
      await page.click('text=Pathways');
      await page.waitForTimeout(2000);
      // Wait for the card to appear (may need page to fully load)
      await expect(page.locator(`text=${name}`).first()).toBeVisible({ timeout: 15000 });
      const card = page.locator('[class*="card"], [class*="Card"]').filter({ hasText: name }).first();
      await card.locator('button:has-text("Edit")').click();
      await page.waitForTimeout(1000);
      await page.fill('textarea', 'Updated by bulk pathway test');
      const nextBtn = page.locator('button:has-text("Next")');
      if (await nextBtn.isVisible()) { await nextBtn.click(); await page.waitForTimeout(300); }
      const nextBtn2 = page.locator('button:has-text("Next")');
      if (await nextBtn2.isVisible()) { await nextBtn2.click(); await page.waitForTimeout(300); }
      const saveBtn = page.locator('button:has-text("Save"), button:has-text("Update")');
      if (await saveBtn.first().isVisible()) {
        await saveBtn.first().click();
        await page.waitForTimeout(2000);
      }
    });

    test('Delete via bulk', async ({ page }) => {
      await page.click('text=Pathways');
      await page.waitForTimeout(1000);
      const checkbox = page.locator(`text=${name}`).first().locator('..').locator('..').locator('[role="checkbox"]').first();
      if (await checkbox.isVisible()) {
        await checkbox.click();
        await page.waitForTimeout(500);
        await page.click('button:has-text("Delete Selected")');
        await page.waitForTimeout(500);
        await page.click('button:has-text("Confirm")');
        await page.waitForTimeout(2000);
      }
    });
  });

  test.describe('Pathways — Detail Delete', () => {
    const name = `DtlPath_${TS}`;

    test('Create', async ({ page }) => {
      await page.click('text=Pathways');
      await page.click('button:has-text("Add Pathway")');
      await page.waitForTimeout(1000);
      await page.locator('input').first().fill(name);
      await page.fill('textarea', 'Detail delete pathway test');
      const durationSelect = page.locator('text=Select weeks');
      if (await durationSelect.isVisible()) {
        await durationSelect.click();
        await page.locator('[role="option"]:has-text("16")').click();
        await page.waitForTimeout(300);
      }
      // Step 1 → Step 2
      await page.locator('button:has-text("Next"), button:has-text("Continue")').first().click();
      await page.waitForTimeout(1000);
      // Step 2 → Step 3
      const next2 = page.locator('button:has-text("Next"), button:has-text("Continue")');
      if (await next2.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await next2.first().click();
        await page.waitForTimeout(1000);
      }
      // Create
      const createBtn = page.locator('button:has-text("Create Pathway"), button:has-text("Save")');
      await createBtn.first().click({ timeout: 5000 });
      await page.waitForTimeout(3000);
      // Verify the pathway was created
      await page.click('text=Pathways');
      await expect(page.locator(`text=${name}`).first()).toBeVisible({ timeout: 10000 });
    });

    test('Delete via detail page', async ({ page }) => {
      await page.click('text=Pathways');
      await page.waitForTimeout(2000);
      // Wait for the card to appear
      await expect(page.locator(`text=${name}`).first()).toBeVisible({ timeout: 15000 });
      const card = page.locator('[class*="card"], [class*="Card"]').filter({ hasText: name }).first();
      await card.locator('button:has-text("View Details")').click();
      await page.waitForTimeout(2000);
      await page.click('button:has-text("Delete")');
      await page.waitForTimeout(500);
      // Type confirmation name if required
      const confirmInput = page.locator('input[placeholder*="Type"]');
      if (await confirmInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmInput.fill(name);
        await page.waitForTimeout(300);
      }
      await page.locator('button:has-text("Delete Pathway"), button:has-text("Confirm Delete")').first().click({ timeout: 10000 });
      await page.waitForTimeout(2000);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // NAVIGATION
  // ═══════════════════════════════════════════════════════════════
  test.describe('Navigation', () => {
    test('Home page loads', async ({ page }) => {
      await expect(page.locator('text=Priorities')).toBeVisible();
    });

    test('Impact page loads with portfolio', async ({ page }) => {
      await page.click('text=Impact');
      await expect(page.locator('text=Portfolio Overview')).toBeVisible({ timeout: 10000 });
    });

    test('Pathways page loads', async ({ page }) => {
      await page.click('text=Pathways');
      await expect(page.locator('h1:has-text("Career Pathways")')).toBeVisible();
    });

    test('Settings page loads', async ({ page }) => {
      await page.goto('/settings');
      await expect(page.locator('h1:has-text("Settings")')).toBeVisible();
    });
  });
});
