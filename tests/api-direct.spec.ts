import { test, expect } from '@playwright/test';

// Credentials and targets come from the environment; nothing here points at a
// deployed stack by default. See tests/README.md.
const EMAIL = process.env.E2E_EMAIL ?? '';
const PASSWORD = process.env.E2E_PASSWORD ?? '';
const COGNITO_CLIENT_ID = process.env.E2E_COGNITO_CLIENT_ID ?? '';
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
// The local Vite dev server proxies /api to the api-server, so the API is
// reachable through BASE_URL. Deployed stacks expose the API on its own host.
const API_URL = process.env.E2E_API_URL ?? BASE_URL;
const TS = Date.now();

test.skip(
  !EMAIL || !PASSWORD || !COGNITO_CLIENT_ID,
  'Set E2E_EMAIL, E2E_PASSWORD and E2E_COGNITO_CLIENT_ID to run authenticated API tests',
);

let authToken: string;

// Helper to get auth token via Cognito
async function getToken(request: any): Promise<string> {
  if (!EMAIL || !PASSWORD || !COGNITO_CLIENT_ID) {
    throw new Error('getToken called without E2E credentials; the file-level skip should have prevented this');
  }
  const res = await request.post('https://cognito-idp.us-east-1.amazonaws.com/', {
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
    },
    data: {
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: COGNITO_CLIENT_ID,
      AuthParameters: { USERNAME: EMAIL, PASSWORD: PASSWORD },
    },
  });
  const body = await res.json();
  return body.AuthenticationResult.IdToken;
}

test.describe('API Direct CRUD Tests', () => {
  test.beforeAll(async ({ request }) => {
    authToken = await getToken(request);
    expect(authToken).toBeTruthy();
  });

  // ═══════════════════════════════════════════════════════
  // FUNDING SOURCES
  // ═══════════════════════════════════════════════════════
  test.describe('Funding Sources API', () => {
    let createdId: number;

    test('POST /api/funding-sources — creates a record', async ({ request }) => {
      const res = await request.post(`${API_URL}/api/funding-sources`, {
        headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        data: { name: `API_Fund_${TS}`, objectives: 'Test objectives', amount: '100000', learnerCount: 20, startDate: '2026-01-01', endDate: '2026-12-31' },
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body.id).toBeTruthy();
      expect(body.name).toBe(`API_Fund_${TS}`);
      createdId = body.id;
    });

    test('PUT /api/funding-sources/:id — updates the record', async ({ request }) => {
      const res = await request.put(`${API_URL}/api/funding-sources/${createdId}`, {
        headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        data: { name: `API_Fund_${TS}`, objectives: 'Updated objectives', amount: '100000', learnerCount: 25, startDate: '2026-01-01', endDate: '2026-12-31' },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.objectives).toBe('Updated objectives');
    });

    test('DELETE /api/funding-sources/:id — deletes the record', async ({ request }) => {
      const res = await request.delete(`${API_URL}/api/funding-sources/${createdId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(res.status()).toBe(200);
    });
  });

  // ═══════════════════════════════════════════════════════
  // PROGRAMS
  // ═══════════════════════════════════════════════════════
  test.describe('Programs API', () => {
    let createdId: number;

    test('POST /api/programs — creates a record', async ({ request }) => {
      const res = await request.post(`${API_URL}/api/programs`, {
        headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        data: {
          name: `API_Prog_${TS}`,
          programTag: `api-prog-${TS}`,
          description: 'API test program',
          pathwayCategory: 'Test',
          activeLearners: 0,
          completionRate: 0,
          readinessScore: 0,
          eventParticipation: 0,
          placementReady: 0,
          funderTag: 'Test Funder',
          cohort: 'Test Cohort 2026',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
        },
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body.id).toBeTruthy();
      expect(body.name).toBe(`API_Prog_${TS}`);
      createdId = body.id;
    });

    test('PUT /api/programs/:id — updates the record', async ({ request }) => {
      const res = await request.put(`${API_URL}/api/programs/${createdId}`, {
        headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        data: { description: 'Updated by API test' },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.description).toBe('Updated by API test');
    });

    test('DELETE /api/programs/:id — deletes the record', async ({ request }) => {
      const res = await request.delete(`${API_URL}/api/programs/${createdId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(res.status()).toBe(200);
    });
  });

  // ═══════════════════════════════════════════════════════
  // PATHWAYS
  // ═══════════════════════════════════════════════════════
  test.describe('Pathways API', () => {
    let createdId: number;

    test('POST /api/pathways — creates a record', async ({ request }) => {
      const res = await request.post(`${API_URL}/api/pathways`, {
        headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        data: {
          name: `API_Path_${TS}`,
          description: 'API test pathway',
          targetProfile: 'Test learners',
          estimatedWeeks: 16,
          activeLearners: 0,
        },
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body.id).toBeTruthy();
      expect(body.name).toBe(`API_Path_${TS}`);
      createdId = body.id;
    });

    test('PUT /api/pathways/:id — updates the record', async ({ request }) => {
      const res = await request.put(`${API_URL}/api/pathways/${createdId}`, {
        headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        data: { description: 'Updated by API test' },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.description).toBe('Updated by API test');
    });

    test('DELETE /api/pathways/:id — deletes the record', async ({ request }) => {
      const res = await request.delete(`${API_URL}/api/pathways/${createdId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(res.status()).toBe(200);
    });
  });

  // ═══════════════════════════════════════════════════════
  // LEARNERS
  // ═══════════════════════════════════════════════════════
  test.describe('Learners API', () => {
    let createdId: number;

    test('POST /api/learners — creates a record', async ({ request }) => {
      const res = await request.post(`${API_URL}/api/learners`, {
        headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        data: {
          name: `API Learner ${TS}`,
          email: `apilearner_${TS}@example.com`,
          pathway: 'Test Pathway',
          program: 'Test Program',
          coach: 'Test Coach',
          progress: 0,
          readiness: 0,
          status: 'New Learner',
          lastActive: 'Just invited',
          nextAction: 'Complete onboarding',
          joinDate: new Date().toISOString().split('T')[0],
        },
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body.id).toBeTruthy();
      expect(body.name).toBe(`API Learner ${TS}`);
      createdId = body.id;
    });

    test('PUT /api/learners/:id — updates the record', async ({ request }) => {
      const res = await request.put(`${API_URL}/api/learners/${createdId}`, {
        headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        data: {
          name: `API Learner ${TS}`,
          email: `apilearner_${TS}@example.com`,
          pathway: 'Test Pathway',
          program: 'Test Program',
          coach: 'Updated Coach',
          progress: 50,
          readiness: 40,
          status: 'Active',
          lastActive: new Date().toISOString().split('T')[0],
          nextAction: 'Continue learning',
          joinDate: new Date().toISOString().split('T')[0],
        },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.coach).toBe('Updated Coach');
      expect(body.progress).toBe(50);
    });

    test('DELETE /api/learners/:id — deletes the record', async ({ request }) => {
      const res = await request.delete(`${API_URL}/api/learners/${createdId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(res.status()).toBe(200);
    });
  });

  // ═══════════════════════════════════════════════════════
  // VERIFY AUDIT LOG
  // ═══════════════════════════════════════════════════════
  test('Audit log contains entries from API tests', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/audit-log?limit=20`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    // Should have entries from our create/update/delete operations
    const ourEntries = body.filter((e: any) => e.entityName?.includes(`${TS}`) || e.entityName?.includes(`API`));
    expect(ourEntries.length).toBeGreaterThan(0);
  });
});
