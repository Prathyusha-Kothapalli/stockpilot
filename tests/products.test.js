const request = require('supertest');
const app = require('../server');
const { seedDatabase } = require('../backend/db/seed');

describe('Products & Inventory Catalog API', () => {
  let adminToken;

  beforeAll(async () => {
    await seedDatabase(true);
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@stockpilot.com', password: 'Demo@123' });
    adminToken = login.body.token;
  });

  test('GET /api/products - List all products catalog', async () => {
    const res = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body.products)).toBeTruthy();
    expect(res.body.products.length).toBeGreaterThanOrEqual(30);
  });

  test('GET /api/products?low_stock=true - Filter low stock products', async () => {
    const res = await request(app)
      .get('/api/products?low_stock=true')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.products.length).toBeGreaterThan(0);
    res.body.products.forEach(p => {
      expect(p.quantity).toBeLessThanOrEqual(p.reorder_level);
    });
  });

  test('POST /api/products - Create a new product item', async () => {
    const newProd = {
      name: 'Automated Test Sensor 9000',
      brand: 'TestCorp',
      cost_price: 50.00,
      selling_price: 89.99,
      quantity: 40,
      reorder_level: 10,
      unit: 'pcs'
    };

    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(newProd);

    expect(res.statusCode).toEqual(201);
    expect(res.body.product.name).toEqual('Automated Test Sensor 9000');
    expect(res.body.product.sku).toContain('SKU-GEN-');
  });

  test('GET /api/products/generate-sku - Auto-generate SKU & Barcode', async () => {
    const res = await request(app)
      .get('/api/products/generate-sku?category_code=ELEC')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.sku).toContain('SKU-ELEC-');
    expect(res.body.barcode).toMatch(/^890/);
  });
});
