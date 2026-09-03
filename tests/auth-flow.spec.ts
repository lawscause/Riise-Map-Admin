import { test, expect } from '@playwright/test';

// Only the tests that exercise a real, registered account need these; the
// rendering/navigation tests run against any stack without credentials.
const EMAIL = process.env.E2E_EMAIL ?? '';
const PASSWORD = process.env.E2E_PASSWORD ?? '';
const NEEDS_ACCOUNT = 'Set E2E_EMAIL to run tests that need a registered account';
const NEEDS_CREDENTIALS = 'Set E2E_EMAIL and E2E_PASSWORD to run authenticated tests';

test.describe('Auth Flow — Page Rendering & Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  });

  // ═══════════════════════════════════════════════════════════════
  // LOGIN PAGE
  // ═══════════════════════════════════════════════════════════════
  test.describe('Login Page', () => {
    test('renders sign in form', async ({ page }) => {
      await expect(page.locator('h1:has-text("Sign In")')).toBeVisible();
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]:has-text("Sign In")')).toBeVisible();
    });

    test('shows "Create one" link to signup', async ({ page }) => {
      await expect(page.locator('text=Create one')).toBeVisible();
    });

    test('shows "Forgot password?" link', async ({ page }) => {
      await expect(page.locator('text=Forgot password?')).toBeVisible();
    });

    test('shows error on invalid credentials', async ({ page }) => {
      await page.fill('input[type="email"]', 'fake@example.com');
      await page.fill('input[type="password"]', 'WrongPass123');
      await page.click('button[type="submit"]');
      await expect(page.locator('text=Invalid email or password')).toBeVisible({ timeout: 10000 });
    });

    test('submit button shows loading state', async ({ page }) => {
      await page.fill('input[type="email"]', 'fake@example.com');
      await page.fill('input[type="password"]', 'WrongPass123');
      await page.click('button[type="submit"]');
      await expect(page.locator('button:has-text("Signing in...")')).toBeVisible();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // SIGNUP PAGE
  // ═══════════════════════════════════════════════════════════════
  test.describe('Signup Page', () => {
    test.beforeEach(async ({ page }) => {
      await page.click('text=Create one');
    });

    test('navigates to signup from login', async ({ page }) => {
      await expect(page.locator('h1:has-text("Create Account")')).toBeVisible();
    });

    test('renders email and password fields', async ({ page }) => {
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]:has-text("Create Account")')).toBeVisible();
    });

    test('shows password requirements hint', async ({ page }) => {
      await expect(page.locator('text=Min 8 chars')).toBeVisible();
    });

    test('"Already have an account?" links back to login', async ({ page }) => {
      await page.click('text=Sign in');
      await expect(page.locator('h1:has-text("Sign In")')).toBeVisible();
    });

    test('shows error for already-registered email', async ({ page }) => {
      test.skip(!EMAIL, NEEDS_ACCOUNT);
      await page.fill('input[type="email"]', EMAIL);
      await page.fill('input[type="password"]', 'TestPass123!');
      await page.click('button[type="submit"]');
      await expect(page.locator('.text-destructive')).toBeVisible({ timeout: 10000 });
    });

    test('submit button shows loading state', async ({ page }) => {
      await page.fill('input[type="email"]', 'newuser@example.com');
      await page.fill('input[type="password"]', 'TestPass123!');
      await page.click('button[type="submit"]');
      await expect(page.locator('button:has-text("Creating account...")')).toBeVisible();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // FORGOT PASSWORD PAGE
  // ═══════════════════════════════════════════════════════════════
  test.describe('Forgot Password Page', () => {
    test.beforeEach(async ({ page }) => {
      await page.click('text=Forgot password?');
    });

    test('navigates to forgot password from login', async ({ page }) => {
      await expect(page.locator('h1:has-text("Forgot Password")')).toBeVisible();
    });

    test('renders email field and submit button', async ({ page }) => {
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]:has-text("Send Reset Code")')).toBeVisible();
    });

    test('"Back to sign in" links to login', async ({ page }) => {
      await page.click('text=Back to sign in');
      await expect(page.locator('h1:has-text("Sign In")')).toBeVisible();
    });

    test('submitting email navigates to reset password page', async ({ page }) => {
      test.skip(!EMAIL, NEEDS_ACCOUNT);
      await page.fill('input[type="email"]', EMAIL);
      await page.click('button[type="submit"]');
      await expect(page.locator('h1:has-text("Reset Password")')).toBeVisible({ timeout: 10000 });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // RESET PASSWORD PAGE
  // ═══════════════════════════════════════════════════════════════
  test.describe('Reset Password Page', () => {
    test.skip(!EMAIL, NEEDS_ACCOUNT);

    test.beforeEach(async ({ page }) => {
      await page.click('text=Forgot password?');
      await page.fill('input[type="email"]', EMAIL);
      await page.click('button[type="submit"]');
      await page.waitForSelector('h1:has-text("Reset Password")', { timeout: 10000 });
    });

    test('renders verification code and new password fields', async ({ page }) => {
      await expect(page.locator('input[placeholder="123456"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]:has-text("Reset Password")')).toBeVisible();
    });

    test('displays the target email', async ({ page }) => {
      await expect(page.locator(`text=${EMAIL}`)).toBeVisible();
    });

    test('"Back to sign in" links to login', async ({ page }) => {
      await page.click('text=Back to sign in');
      await expect(page.locator('h1:has-text("Sign In")')).toBeVisible();
    });

    test('shows error on invalid code', async ({ page }) => {
      await page.fill('input[placeholder="123456"]', '000000');
      await page.fill('input[type="password"]', 'NewPass123!');
      await page.click('button[type="submit"]');
      await expect(page.locator('.text-destructive')).toBeVisible({ timeout: 10000 });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // FULL FLOW NAVIGATION
  // ═══════════════════════════════════════════════════════════════
  test.describe('Cross-Page Navigation', () => {
    test('Login → Signup → Login round trip', async ({ page }) => {
      await page.click('text=Create one');
      await expect(page.locator('h1:has-text("Create Account")')).toBeVisible();
      await page.click('text=Sign in');
      await expect(page.locator('h1:has-text("Sign In")')).toBeVisible();
    });

    test('Login → Forgot → Reset → Login round trip', async ({ page }) => {
      await page.click('text=Forgot password?');
      await expect(page.locator('h1:has-text("Forgot Password")')).toBeVisible();
      await page.fill('input[type="email"]', 'test@example.com');
      await page.click('button[type="submit"]');
      await expect(page.locator('h1:has-text("Reset Password")')).toBeVisible({ timeout: 10000 });
      await page.click('text=Back to sign in');
      await expect(page.locator('h1:has-text("Sign In")')).toBeVisible();
    });

    test('Successful login reaches authenticated app', async ({ page }) => {
      test.skip(!EMAIL || !PASSWORD, NEEDS_CREDENTIALS);
      await page.evaluate(() => {
        localStorage.setItem('riisemap_onboarding', 'true');
      });
      await page.fill('input[type="email"]', EMAIL);
      await page.fill('input[type="password"]', PASSWORD);
      await page.click('button[type="submit"]');
      await expect(page.locator('nav, [data-sidebar]')).toBeVisible({ timeout: 15000 });
    });
  });
});
