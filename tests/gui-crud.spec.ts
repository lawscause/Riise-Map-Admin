import { test, expect } from '@playwright/test';

const EMAIL = process.env.E2E_EMAIL ?? '';
const PASSWORD = process.env.E2E_PASSWORD ?? '';
const TS = Date.now();

test.skip(!EMAIL || !PASSWORD, 'Set E2E_EMAIL and E2E_PASSWORD to run authenticated tests');

async function login(page: any) {
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
}

test.describe('GUI CRUD — Full Lifecycle', () => {

  test('Funding Source: create → update → delete', async ({ page }) => {
    await login(page);
    const name = `GUIFund_${TS}`;

    // ── CREATE ──
    await page.click('a:has-text("Funding Sources")');
    await page.waitForSelector('h1:has-text("Funding Sources")', { timeout: 5000 });
    await page.click('button:has-text("Add Funding Source")');
    await page.waitForTimeout(500);
    await page.fill('input[placeholder*="e.g. City"]', name);
    await page.fill('textarea[placeholder*="goals"]', 'GUI test objectives');
    await page.fill('textarea[placeholder*="narrative"]', 'GUI test narrative');
    await page.fill('input[placeholder*="250000"]', '85000');
    await page.fill('input[placeholder*="50"]', '20');
    await page.fill('input[type="date"] >> nth=0', '2026-01-15');
    await page.fill('input[type="date"] >> nth=1', '2026-12-15');
    await page.click('button:has-text("Create")');
    await page.waitForTimeout(3000);
    // Verify on list
    await page.click('a:has-text("Funding Sources")');
    await expect(page.locator(`text=${name}`).first()).toBeVisible({ timeout: 5000 });

    // ── UPDATE ──
    // Click View button in the row — it's next to Edit in each card
    await page.click('a:has-text("Funding Sources")');
    await page.waitForTimeout(1000);
    // Scroll to find our record and click its View button
    const row = page.locator(`text=${name}`).first();
    await row.scrollIntoViewIfNeeded();
    // The View and Edit buttons are siblings in the same row
    const rowContainer = page.locator(`text=${name}`).first().locator('..').locator('..').locator('..');
    await rowContainer.locator('button:has-text("View")').first().click();
    await page.waitForTimeout(1000);
    // Now on detail page - click Edit
    await page.click('button:has-text("Edit")');
    await page.waitForTimeout(500);
    await page.locator('textarea').first().fill('Updated via GUI test');
    await page.click('button:has-text("Save")');
    await page.waitForTimeout(2000);

    // ── DELETE ──
    // Navigate fresh to list, then into detail
    await page.click('a:has-text("Funding Sources")');
    await page.waitForTimeout(1000);
    await page.locator(`text=${name}`).first().locator('..').locator('..').locator('..').locator('button:has-text("View")').first().click();
    await page.waitForTimeout(1000);
    await page.click('button:has-text("Delete")');
    await page.waitForTimeout(500);
    await page.locator('input[placeholder*="Type"]').fill(name);
    await page.locator('button:has-text("Delete")').last().click();
    await page.waitForTimeout(2000);
  });

  test('Program: create → update → delete', async ({ page }) => {
    await login(page);
    const name = `GUIProg_${TS}`;
    const tag = `gui-prog-${TS}`;

    // ── CREATE ──
    await page.click('a:has-text("Programs")');
    await page.waitForSelector('h1:has-text("Programs")', { timeout: 5000 });
    await page.click('[data-testid="create-program-btn"]');
    await page.waitForTimeout(500);
    await page.fill('input[placeholder*="Cloud Operations"]', name);
    await page.fill('input[placeholder*="cloud-ops"]', tag);
    await page.fill('textarea[placeholder*="Describe"]', 'GUI test program');
    await page.fill('input[placeholder*="Summer"]', 'GUI Cohort 2026');
    // Scroll down in the modal before selecting funder
    await page.locator('text=Select a funding source').scrollIntoViewIfNeeded();
    await page.click('text=Select a funding source');
    await page.waitForTimeout(500);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.fill('input[type="date"] >> nth=0', '2026-02-01');
    await page.fill('input[type="date"] >> nth=1', '2026-11-30');
    await page.click('[data-testid="submit-program-btn"]');
    await page.waitForTimeout(3000);
    // Verify
    await page.click('a:has-text("Programs")');
    await expect(page.locator(`text=${name}`).first()).toBeVisible({ timeout: 5000 });

    // ── UPDATE ──
    await page.click('a:has-text("Programs")');
    await page.waitForTimeout(1000);
    // Scroll to our program and use the card's data-testid
    await page.locator(`text=${name}`).first().scrollIntoViewIfNeeded();
    // Each program card has data-testid="program-card-{id}" - click its Edit button
    // Find the Edit button that is visible after scrolling to our program name
    const allEditBtns = page.locator('button:has-text("Edit")');
    const editCount = await allEditBtns.count();
    let clicked = false;
    for (let i = 0; i < editCount; i++) {
      const btn = allEditBtns.nth(i);
      const card = await btn.evaluate((el: any) => el.closest('[data-testid]')?.textContent || '');
      if (card.includes(name)) { await btn.click(); clicked = true; break; }
    }
    if (!clicked) await allEditBtns.first().click();
    await page.waitForTimeout(500);
    await page.fill('textarea', 'Updated via GUI test');
    await page.locator('button:has-text("Save"), button:has-text("Update")').first().click();
    await page.waitForTimeout(2000);

    // ── DELETE ──
    await page.click('a:has-text("Programs")');
    await page.waitForTimeout(1000);
    await page.locator(`text=${name}`).first().scrollIntoViewIfNeeded();
    const allViewBtns = page.locator('button:has-text("View Program")');
    const viewCount = await allViewBtns.count();
    let viewClicked = false;
    for (let i = 0; i < viewCount; i++) {
      const btn = allViewBtns.nth(i);
      const card = await btn.evaluate((el: any) => el.closest('[data-testid]')?.textContent || '');
      if (card.includes(name)) { await btn.click(); viewClicked = true; break; }
    }
    if (!viewClicked) await allViewBtns.first().click();
    await page.waitForTimeout(1000);
    await page.click('button:has-text("Delete")');
    await page.waitForTimeout(500);
    const confirmProg = page.locator('input[placeholder*="Type"]');
    if (await confirmProg.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmProg.fill(name);
    }
    await page.locator('button:has-text("Delete")').last().click();
    await page.waitForTimeout(3000);
  });

  test('Learner: create → update → delete', async ({ page }) => {
    await login(page);
    const firstName = 'GUILrn';
    const lastName = `T${TS}`;
    const fullName = `${firstName} ${lastName}`;
    const learnerEmail = `guilrn_${TS}@example.com`;

    // ── CREATE ──
    await page.click('a:has-text("Learners")');
    await page.waitForSelector('h1:has-text("Learners")', { timeout: 5000 });
    await page.locator('button:has-text("Invite Learners")').click();
    await page.waitForTimeout(1000);
    await page.locator('input[placeholder*="First"]').fill(firstName);
    await page.locator('input[placeholder*="Last"]').fill(lastName);
    await page.locator('input[placeholder*="email"], input[type="email"]').first().fill(learnerEmail);
    // Select pathway if available
    const pathSelect = page.locator('text=Select pathway');
    if (await pathSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await pathSelect.click();
      await page.locator('[role="option"]').first().click();
      await page.waitForTimeout(300);
    }
    // Select program if available
    const progSelect = page.locator('text=Select program');
    if (await progSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await progSelect.click();
      await page.waitForTimeout(300);
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
    }
    // Submit
    const sendInviteBtn = page.locator('[data-testid="send-invite-btn"]');
    const addLearnerBtn = page.locator('button:has-text("Add Learner & Copy Invitation"), button:has-text("Send Invite"), button:has-text("Add Learner")');
    if (await sendInviteBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await sendInviteBtn.click();
    } else {
      await addLearnerBtn.first().click();
    }
    await page.waitForTimeout(3000);
    // Close any modal that's still open
    const closeBtn = page.locator('button:has-text("View Learner List"), button:has-text("Close"), button:has-text("Done")');
    if (await closeBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await closeBtn.first().click();
      await page.waitForTimeout(1000);
    }
    // If modal is still open, use the X button in the modal header
    const modalXBtn = page.locator('[role="dialog"] button:has(img), .fixed button:has(img)').first();
    if (await page.locator('.fixed.inset-0').first().isVisible({ timeout: 1000 }).catch(() => false)) {
      // Try X button first
      const xBtn = page.locator('button').filter({ has: page.locator('img') }).filter({ hasNotText: /\w{2,}/ });
      if (await xBtn.first().isVisible({ timeout: 1000 }).catch(() => false)) {
        await xBtn.first().click();
        await page.waitForTimeout(500);
      }
      // If still open, press Escape
      if (await page.locator('.fixed.inset-0').first().isVisible({ timeout: 500 }).catch(() => false)) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1000);
      }
    }
    // Navigate using force to bypass any remaining overlay
    await page.goto('/learners');
    await page.waitForSelector('h1:has-text("Learners")', { timeout: 10000 });
    await expect(page.locator(`text=${firstName}`).first()).toBeVisible({ timeout: 5000 });

    // ── UPDATE ──
    await page.goto('/learners');
    await page.waitForTimeout(1000);
    // Find the View button in the row containing our learner
    const allViewBtns = page.locator('button:has-text("View")');
    const viewCount = await allViewBtns.count();
    let viewClicked = false;
    for (let i = 0; i < viewCount; i++) {
      const btn = allViewBtns.nth(i);
      const row = await btn.evaluate((el: any) => el.closest('tr')?.textContent || '');
      if (row.includes(firstName)) { await btn.click(); viewClicked = true; break; }
    }
    if (!viewClicked && viewCount > 0) await allViewBtns.first().click();
    await page.waitForTimeout(1000);
    await page.click('button:has-text("Edit")');
    await page.waitForTimeout(500);
    await page.locator('label:has-text("Coach")').locator('..').locator('input').fill('GUI Coach');
    await page.click('button:has-text("Save")');
    await page.waitForTimeout(2000);

    // ── DELETE ──
    await page.click('button:has-text("Delete")');
    await page.waitForTimeout(500);
    await page.locator('input[placeholder*="Type"]').fill(fullName);
    await page.locator('button:has-text("Delete Learner")').click();
    await page.waitForTimeout(2000);
    await expect(page.locator('h1:has-text("Learners")')).toBeVisible({ timeout: 5000 });
  });

  test('Pathway: create → update → delete', async ({ page }) => {
    await login(page);
    const name = `GUIPath_${TS}`;

    // ── CREATE ──
    await page.click('a:has-text("Pathways")');
    await page.waitForSelector('h1:has-text("Career Pathways")', { timeout: 5000 });
    await page.click('button:has-text("Add Pathway")');
    await page.waitForTimeout(500);
    await page.locator('input').first().fill(name);
    await page.locator('textarea').first().fill('GUI test pathway');
    const durSelect = page.locator('text=Select weeks');
    if (await durSelect.isVisible()) {
      await durSelect.click();
      await page.locator('[role="option"]:has-text("16")').click();
    }
    await page.locator('button:has-text("Next"), button:has-text("Continue")').first().click();
    await page.waitForTimeout(500);
    const next2 = page.locator('button:has-text("Next"), button:has-text("Continue")');
    if (await next2.first().isVisible({ timeout: 2000 }).catch(() => false)) { await next2.first().click(); await page.waitForTimeout(500); }
    await page.locator('button:has-text("Create Pathway"), button:has-text("Save")').first().click();
    await page.waitForTimeout(3000);
    // Close creation confirmation if shown
    const backBtn = page.locator('button:has-text("Back to Pathways")');
    if (await backBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await backBtn.click();
      await page.waitForTimeout(1000);
    }
    // Verify
    await page.click('a:has-text("Pathways")');
    await expect(page.locator(`text=${name}`).first()).toBeVisible({ timeout: 5000 });

    // ── UPDATE ──
    await page.click('a:has-text("Pathways")');
    await page.waitForTimeout(1000);
    // Find card with our pathway and click View Details
    const allViewDetailBtns = page.locator('button:has-text("View Details")');
    const vdCount = await allViewDetailBtns.count();
    let vdClicked = false;
    for (let i = 0; i < vdCount; i++) {
      const btn = allViewDetailBtns.nth(i);
      const card = await btn.evaluate((el: any) => el.closest('[class*="card"], [class*="Card"]')?.textContent || '');
      if (card.includes(name)) { await btn.click(); vdClicked = true; break; }
    }
    if (!vdClicked && vdCount > 0) await allViewDetailBtns.first().click();
    await page.waitForTimeout(1000);
    await page.click('button:has-text("Edit Pathway"), button:has-text("Edit")');
    await page.waitForTimeout(500);
    await page.locator('textarea').first().fill('Updated via GUI test');
    const nextEdit = page.locator('button:has-text("Next"), button:has-text("Continue")');
    if (await nextEdit.first().isVisible({ timeout: 2000 }).catch(() => false)) { await nextEdit.first().click(); await page.waitForTimeout(300); }
    const nextEdit2 = page.locator('button:has-text("Next"), button:has-text("Continue")');
    if (await nextEdit2.first().isVisible({ timeout: 2000 }).catch(() => false)) { await nextEdit2.first().click(); await page.waitForTimeout(300); }
    await page.locator('button:has-text("Save"), button:has-text("Update")').first().click();
    await page.waitForTimeout(2000);

    // ── DELETE ──
    await page.click('a:has-text("Pathways")');
    await page.waitForTimeout(1000);
    // Find the card with our pathway and click View Details
    const allDetailBtns = page.locator('button:has-text("View Details")');
    const detailCount = await allDetailBtns.count();
    let detailClicked = false;
    for (let i = 0; i < detailCount; i++) {
      const btn = allDetailBtns.nth(i);
      const card = await btn.evaluate((el: any) => el.closest('[class*="card"], [class*="Card"]')?.textContent || '');
      if (card.includes(name)) { await btn.click(); detailClicked = true; break; }
    }
    if (!detailClicked && detailCount > 0) await allDetailBtns.first().click();
    await page.waitForTimeout(1000);
    await page.click('button:has-text("Delete")');
    await page.waitForTimeout(500);
    await page.locator('input[placeholder*="Type"]').fill(name);
    await page.locator('button:has-text("Delete Pathway")').click();
    await page.waitForTimeout(2000);
  });
});
