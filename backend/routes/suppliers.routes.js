const express = require('express');
const router = express.Router();
const { all, get, run } = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

/**
 * GET /api/suppliers
 * List all suppliers with PO counts & active orders
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const suppliers = await all(`
      SELECT s.*, 
             COUNT(po.id) AS total_orders,
             SUM(CASE WHEN po.status IN ('Submitted', 'Approved') THEN 1 ELSE 0 END) AS active_orders,
             COALESCE(SUM(po.total_amount), 0) AS total_spend
      FROM suppliers s
      LEFT JOIN purchase_orders po ON s.id = po.supplier_id
      GROUP BY s.id
      ORDER BY s.name ASC
    `);
    res.json({ suppliers });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch suppliers.' });
  }
});

/**
 * GET /api/suppliers/:id
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const supplier = await get('SELECT * FROM suppliers WHERE id = ?', [req.params.id]);
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found.' });
    }

    const pos = await all(`
      SELECT po.*, w.name as warehouse_name
      FROM purchase_orders po
      LEFT JOIN warehouses w ON po.warehouse_id = w.id
      WHERE po.supplier_id = ?
      ORDER BY po.created_at DESC
    `, [req.params.id]);

    res.json({ supplier, purchase_orders: pos });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch supplier details.' });
  }
});

/**
 * POST /api/suppliers
 * Create a new supplier
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, code, contact_person, email, phone, address, rating } = req.body;
    if (!name || !code) {
      return res.status(400).json({ error: 'Supplier name and unique code are required.' });
    }

    const result = await run(
      `INSERT INTO suppliers (name, code, contact_person, email, phone, address, rating)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name.trim(), code.trim().toUpperCase(), contact_person || '', email || '', phone || '', address || '', rating || 5.0]
    );

    const newSupplier = await get('SELECT * FROM suppliers WHERE id = ?', [result.lastID]);
    res.status(201).json({ message: 'Supplier created successfully', supplier: newSupplier });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Supplier code already exists.' });
    }
    res.status(500).json({ error: 'Failed to create supplier.' });
  }
});

/**
 * PUT /api/suppliers/:id
 * Update supplier
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { name, code, contact_person, email, phone, address, rating } = req.body;
    const supId = req.params.id;

    await run(
      `UPDATE suppliers 
       SET name = ?, code = ?, contact_person = ?, email = ?, phone = ?, address = ?, rating = ?
       WHERE id = ?`,
      [name.trim(), code.trim().toUpperCase(), contact_person || '', email || '', phone || '', address || '', rating || 5.0, supId]
    );

    const updated = await get('SELECT * FROM suppliers WHERE id = ?', [supId]);
    res.json({ message: 'Supplier updated successfully', supplier: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update supplier.' });
  }
});

/**
 * DELETE /api/suppliers/:id
 * Delete supplier (Admin only)
 */
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const supId = req.params.id;
    await run('DELETE FROM suppliers WHERE id = ?', [supId]);
    res.json({ message: 'Supplier deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete supplier.' });
  }
});

module.exports = router;
