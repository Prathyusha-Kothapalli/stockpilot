const request = require('supertest');
const app = require('../server');
const { seedDatabase } = require('../backend/db/seed');

describe('Analytics & Reports API', () => {
  let adminToken;

  beforeAll(async () => {
    await seedDatabase(true);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@stockpilot.com', password: 'Demo@123' });
    adminToken = login.body.token;
  });

  test('GET /api/analytics/dashboard - Fetch live KPI metrics', async () => {
    const res = await request(app)
      .get('/api/analytics/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.kpis).toHaveProperty('total_products');
    expect(res.body.kpis).toHaveProperty('total_cost_value');
    expect(res.body.kpis).toHaveProperty('total_retail_value');
    expect(res.body.kpis.total_products).toBeGreaterThanOrEqual(30);
  });

  test('GET /api/analytics/charts - Fetch chart datasets', async () => {
    const res = await request(app)
      .get('/api/analytics/charts')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body.movement_trends)).toBeTruthy();
    expect(Array.isArray(res.body.category_breakdown)).toBeTruthy();
    expect(Array.isArray(res.body.warehouse_distribution)).toBeTruthy();
  });

  test('GET /api/analytics/reports - Fetch analytical reports', async () => {
    const res = await request(app)
      .get('/api/analytics/reports')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body.top_movers)).toBeTruthy();
    expect(Array.isArray(res.body.warehouse_valuations)).toBeTruthy();
  });
});
