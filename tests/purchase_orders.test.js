const request = require('supertest');
const app = require('../server');
const { seedDatabase } = require('../backend/db/seed');

describe('Purchase Orders Workflow API', () => {
  let adminToken;
  let supplierId;
  let warehouseId;
  let productId;

  beforeAll(async () => {
    await seedDatabase(true);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@stockpilot.com', password: 'Demo@123' });
    adminToken = login.body.token;

    const sups = await request(app).get('/api/suppliers').set('Authorization', `Bearer ${adminToken}`);
    supplierId = sups.body.suppliers[0].id;

    const whs = await request(app).get('/api/warehouses').set('Authorization', `Bearer ${adminToken}`);
    warehouseId = whs.body.warehouses[0].id;

    const prods = await request(app).get('/api/products').set('Authorization', `Bearer ${adminToken}`);
    productId = prods.body.products[0].id;
  });

  test('POST /api/purchase-orders - Create new purchase order', async () => {
    const res = await request(app)
      .post('/api/purchase-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplier_id: supplierId,
        warehouse_id: warehouseId,
        expected_delivery: '2026-09-30',
        items: [
          { product_id: productId, quantity_ordered: 50, unit_cost: 25.00 }
        ]
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body.purchase_order.po_number).toContain('PO-2026-');
    expect(res.body.purchase_order.status).toEqual('Draft');
  });

  test('PUT /api/purchase-orders/:id/status - Workflow state transition (Draft -> Submitted -> Approved -> Received)', async () => {
    // 1. Create Draft PO
    const createRes = await request(app)
      .post('/api/purchase-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplier_id: supplierId,
        warehouse_id: warehouseId,
        items: [{ product_id: productId, quantity_ordered: 30, unit_cost: 15.00 }]
      });

    const poId = createRes.body.purchase_order.id;

    // 2. Submit PO
    const subRes = await request(app)
      .put(`/api/purchase-orders/${poId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'Submitted' });

    expect(subRes.body.purchase_order.status).toEqual('Submitted');

    // 3. Approve PO
    const appRes = await request(app)
      .put(`/api/purchase-orders/${poId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'Approved' });

    expect(appRes.body.purchase_order.status).toEqual('Approved');

    // 4. Receive PO (Triggers automated inventory receipt)
    const recRes = await request(app)
      .put(`/api/purchase-orders/${poId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'Received' });

    expect(recRes.body.purchase_order.status).toEqual('Received');
  });
});
