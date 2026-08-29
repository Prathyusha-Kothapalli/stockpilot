const request = require('supertest');
const app = require('../server');
const { seedDatabase } = require('../backend/db/seed');

describe('Stock Movements & Inventory Transactions API', () => {
  let adminToken;
  let testProductId;
  let wh1Id;
  let wh2Id;

  beforeAll(async () => {
    await seedDatabase(true);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@stockpilot.com', password: 'Demo@123' });
    adminToken = login.body.token;

    const prodsRes = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${adminToken}`);
    testProductId = prodsRes.body.products[0].id;

    const whRes = await request(app)
      .get('/api/warehouses')
      .set('Authorization', `Bearer ${adminToken}`);
    wh1Id = whRes.body.warehouses[0].id;
    wh2Id = whRes.body.warehouses[1].id;
  });

  test('POST /api/stock/in - Process Stock In receipt', async () => {
    const res = await request(app)
      .post('/api/stock/in')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        product_id: testProductId,
        warehouse_id: wh1Id,
        quantity: 25,
        reason: 'Integration Test Inbound'
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('reference_no');
  });

  test('POST /api/stock/transfer - Transfer inventory between warehouses', async () => {
    // Ensure stock exists in wh1 first
    await request(app)
      .post('/api/stock/in')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ product_id: testProductId, warehouse_id: wh1Id, quantity: 30 });

    const res = await request(app)
      .post('/api/stock/transfer')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        product_id: testProductId,
        source_warehouse_id: wh1Id,
        target_warehouse_id: wh2Id,
        quantity: 10,
        reason: 'Automated Test Inter-Warehouse Transfer'
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body.reference_no).toContain('SM-TRF-');
  });

  test('POST /api/stock/out - Rejects dispatch when quantity exceeds warehouse stock', async () => {
    const res = await request(app)
      .post('/api/stock/out')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        product_id: testProductId,
        warehouse_id: wh1Id,
        quantity: 999999, // Exceeds balance
        reason: 'Over-dispatch test'
      });

    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toContain('Insufficient stock');
  });

  test('GET /api/stock/movements - Fetch stock movement audit trail', async () => {
    const res = await request(app)
      .get('/api/stock/movements')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body.movements)).toBeTruthy();
    expect(res.body.movements.length).toBeGreaterThan(0);
  });
});
