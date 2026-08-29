const request = require('supertest');
const app = require('../server');
const { seedDatabase } = require('../backend/db/seed');

describe('Authentication & Access Control API', () => {
  beforeAll(async () => {
    await seedDatabase(true);
  });

  test('POST /api/auth/login - Admin Login with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@stockpilot.com', password: 'Demo@123' });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.role).toEqual('admin');
  });

  test('POST /api/auth/login - Manager Login with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'manager@stockpilot.com', password: 'Demo@123' });

    expect(res.statusCode).toEqual(200);
    expect(res.body.user.role).toEqual('manager');
  });

  test('POST /api/auth/login - Rejects invalid password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@stockpilot.com', password: 'WrongPassword' });

    expect(res.statusCode).toEqual(401);
    expect(res.body).toHaveProperty('error');
  });

  test('GET /api/auth/me - Access protected profile with token', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@stockpilot.com', password: 'Demo@123' });

    const token = loginRes.body.token;

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meRes.statusCode).toEqual(200);
    expect(meRes.body.user.email).toEqual('admin@stockpilot.com');
  });
});
