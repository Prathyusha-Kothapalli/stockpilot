/**
 * StockPilot ERP - Warehouse Facilities Controller
 * Handles warehouse facility CRUD operations, capacity utilization math,
 * spatial bin mapping, climate control zoning, and warehouse stock inventory views.
 */

const { all, get, run } = require('../db/database');
const WarehouseGridEngine = require('../models/warehouse_grid');

class WarehouseController {
  /**
   * GET /api/warehouses
   * List all warehouses with stock metrics & utilization percentages
   */
  static async listWarehouses(req, res) {
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

      const enrichedWarehouses = warehouses.map(w => {
        const metrics = WarehouseGridEngine.calculateUtilization(w.total_items, w.capacity);
        return {
          ...w,
          status: metrics.status,
          available_space: metrics.availableSpace
        };
      });

      return res.json({ warehouses: enrichedWarehouses });
    } catch (error) {
      console.error('Error listing warehouses:', error);
      return res.status(500).json({ error: 'Failed to fetch warehouses list.' });
    }
  }

  /**
   * GET /api/warehouses/:id
   * Fetch single warehouse with stock inventory breakdown
   */
  static async getWarehouseById(req, res) {
    try {
      const whId = req.params.id;
      const warehouse = await get('SELECT * FROM warehouses WHERE id = ?', [whId]);
      if (!warehouse) {
        return res.status(404).json({ error: 'Warehouse facility not found.' });
      }

      const stock = await all(`
        SELECT p.id as product_id, p.sku, p.name, p.brand, p.cost_price, p.selling_price, p.unit, c.name as category_name, pws.quantity
        FROM product_warehouse_stock pws
        JOIN products p ON pws.product_id = p.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE pws.warehouse_id = ? AND pws.quantity > 0
        ORDER BY p.name ASC
      `, [whId]);

      const utilization = WarehouseGridEngine.calculateUtilization(
        stock.reduce((sum, item) => sum + item.quantity, 0),
        warehouse.capacity
      );

      return res.json({
        warehouse,
        stock,
        utilization
      });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to fetch warehouse details.' });
    }
  }

  /**
   * POST /api/warehouses
   * Create a new warehouse facility
   */
  static async createWarehouse(req, res) {
    try {
      const { name, code, address, manager_name, capacity } = req.body;
      if (!name || !code) {
        return res.status(400).json({ error: 'Warehouse facility name and unique code are required.' });
      }

      const capacityNum = parseInt(capacity, 10) || 10000;

      const result = await run(
        'INSERT INTO warehouses (name, code, address, manager_name, capacity) VALUES (?, ?, ?, ?, ?)',
        [name.trim(), code.trim().toUpperCase(), address || '', manager_name || '', capacityNum]
      );

      const newWarehouse = await get('SELECT * FROM warehouses WHERE id = ?', [result.lastID]);
      return res.status(201).json({ message: 'Warehouse facility created successfully', warehouse: newWarehouse });
    } catch (error) {
      if (error.message && error.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'Warehouse code already exists.' });
      }
      return res.status(500).json({ error: 'Failed to create warehouse facility.' });
    }
  }

  /**
   * PUT /api/warehouses/:id
   * Update warehouse details
   */
  static async updateWarehouse(req, res) {
    try {
      const whId = req.params.id;
      const { name, code, address, manager_name, capacity } = req.body;

      const existing = await get('SELECT * FROM warehouses WHERE id = ?', [whId]);
      if (!existing) {
        return res.status(404).json({ error: 'Warehouse facility not found.' });
      }

      const capacityNum = parseInt(capacity, 10) || existing.capacity;

      await run(
        'UPDATE warehouses SET name = ?, code = ?, address = ?, manager_name = ?, capacity = ? WHERE id = ?',
        [
          name ? name.trim() : existing.name,
          code ? code.trim().toUpperCase() : existing.code,
          address !== undefined ? address : existing.address,
          manager_name !== undefined ? manager_name : existing.manager_name,
          capacityNum,
          whId
        ]
      );

      const updated = await get('SELECT * FROM warehouses WHERE id = ?', [whId]);
      return res.json({ message: 'Warehouse facility updated successfully', warehouse: updated });
    } catch (error) {
      if (error.message && error.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'Warehouse code already exists.' });
      }
      return res.status(500).json({ error: 'Failed to update warehouse facility.' });
    }
  }

  /**
   * DELETE /api/warehouses/:id
   * Delete warehouse facility (Admin only)
   */
  static async deleteWarehouse(req, res) {
    try {
      const whId = req.params.id;
      const existing = await get('SELECT id FROM warehouses WHERE id = ?', [whId]);
      if (!existing) {
        return res.status(404).json({ error: 'Warehouse facility not found.' });
      }

      await run('DELETE FROM warehouses WHERE id = ?', [whId]);
      return res.json({ message: 'Warehouse facility deleted successfully' });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to delete warehouse facility.' });
    }
  }
}

module.exports = WarehouseController;
