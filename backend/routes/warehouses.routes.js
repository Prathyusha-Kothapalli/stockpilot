const express = require('express');
const router = express.Router();
const { all, get, run } = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

/**
 * GET /api/warehouses
 * List all warehouses with stock metrics & utilization
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const warehouses = await all(`
      SELECT w.*, 
             COALESCE(SUM(pws.quantity), 0) AS total_items,
             COUNT(DISTINCT pws.product_id) AS total_products,
             ROUND(CAST(COALESCE(SUM(pws.quantity), 0) AS REAL) / CAST(w.capacity AS REAL) * 100, 1) AS utilization_rate
      FROM warehouses w
      LEFT JOIN product_warehouse_stock pws ON w.id = pws.warehouse_id
      GROUP BY w.id
      ORDER BY w.name ASC
    `);
    res.json({ warehouses });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch warehouses.' });
  }
});

/**
 * GET /api/warehouses/:id
 * Warehouse details with product inventory listing
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const warehouse = await get('SELECT * FROM warehouses WHERE id = ?', [req.params.id]);
    if (!warehouse) {
      return res.status(404).json({ error: 'Warehouse not found.' });
    }

    const stock = await all(`
      SELECT p.id as product_id, p.sku, p.name, p.brand, p.cost_price, p.selling_price, p.unit, c.name as category_name, pws.quantity
      FROM product_warehouse_stock pws
      JOIN products p ON pws.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE pws.warehouse_id = ? AND pws.quantity > 0
      ORDER BY p.name ASC
    `, [req.params.id]);

    res.json({ warehouse, stock });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch warehouse details.' });
  }
});

/**
 * POST /api/warehouses
 * Create a new warehouse
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, code, address, manager_name, capacity } = req.body;
    if (!name || !code) {
      return res.status(400).json({ error: 'Warehouse name and code are required.' });
    }

    const result = await run(
      'INSERT INTO warehouses (name, code, address, manager_name, capacity) VALUES (?, ?, ?, ?, ?)',
      [name.trim(), code.trim().toUpperCase(), address || '', manager_name || '', capacity || 10000]
    );

    const newWarehouse = await get('SELECT * FROM warehouses WHERE id = ?', [result.lastID]);
    res.status(201).json({ message: 'Warehouse created successfully', warehouse: newWarehouse });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Warehouse code already exists.' });
    }
    res.status(500).json({ error: 'Failed to create warehouse.' });
  }
});

/**
 * PUT /api/warehouses/:id
 * Update warehouse
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { name, code, address, manager_name, capacity } = req.body;
    const whId = req.params.id;

    await run(
      'UPDATE warehouses SET name = ?, code = ?, address = ?, manager_name = ?, capacity = ? WHERE id = ?',
      [name.trim(), code.trim().toUpperCase(), address || '', manager_name || '', capacity || 10000, whId]
    );

    const updated = await get('SELECT * FROM warehouses WHERE id = ?', [whId]);
    res.json({ message: 'Warehouse updated successfully', warehouse: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update warehouse.' });
  }
});

/**
 * DELETE /api/warehouses/:id
 * Delete warehouse (Admin only)
 */
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const whId = req.params.id;
    await run('DELETE FROM warehouses WHERE id = ?', [whId]);
    res.json({ message: 'Warehouse deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete warehouse.' });
  }
});

module.exports = router;
