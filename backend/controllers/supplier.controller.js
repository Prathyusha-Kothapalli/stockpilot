/**
 * StockPilot ERP - Supplier & Vendor Directory Controller
 * Manages supplier profiles, contact details, vendor scorecard metrics,
 * lead time reliability tracking, and purchase order spending statistics.
 */

const { all, get, run } = require('../db/database');
const SupplyChainOptimizationEngine = require('../models/supply_chain_optimization');

class SupplierController {
  /**
   * GET /api/suppliers
   * List all suppliers with PO counts & active orders
   */
  static async listSuppliers(req, res) {
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

      const enriched = suppliers.map(s => {
        const risk = SupplyChainOptimizationEngine.calculateSupplierRiskIndex(1.5, 2.0, 5.0);
        return {
          ...s,
          risk_level: risk.riskLevel,
          risk_score: risk.riskScore
        };
      });

      return res.json({ suppliers: enriched });
    } catch (error) {
      console.error('Error listing suppliers:', error);
      return res.status(500).json({ error: 'Failed to fetch suppliers directory.' });
    }
  }

  /**
   * GET /api/suppliers/:id
   * Fetch single supplier profile with purchase order history
   */
  static async getSupplierById(req, res) {
    try {
      const supId = req.params.id;
      const supplier = await get('SELECT * FROM suppliers WHERE id = ?', [supId]);
      if (!supplier) {
        return res.status(404).json({ error: 'Supplier not found.' });
      }

      const purchaseOrders = await all(`
        SELECT po.*, w.name as warehouse_name
        FROM purchase_orders po
        LEFT JOIN warehouses w ON po.warehouse_id = w.id
        WHERE po.supplier_id = ?
        ORDER BY po.created_at DESC
      `, [supId]);

      return res.json({ supplier, purchase_orders: purchaseOrders });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to fetch supplier details.' });
    }
  }

  /**
   * POST /api/suppliers
   * Create new supplier
   */
  static async createSupplier(req, res) {
    try {
      const { name, code, contact_person, email, phone, address, rating } = req.body;
      if (!name || !code) {
        return res.status(400).json({ error: 'Supplier name and unique code are required.' });
      }

      const ratingNum = Math.min(5.0, Math.max(1.0, parseFloat(rating) || 5.0));

      const result = await run(
        `INSERT INTO suppliers (name, code, contact_person, email, phone, address, rating)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [name.trim(), code.trim().toUpperCase(), contact_person || '', email || '', phone || '', address || '', ratingNum]
      );

      const newSupplier = await get('SELECT * FROM suppliers WHERE id = ?', [result.lastID]);
      return res.status(201).json({ message: 'Supplier registered successfully', supplier: newSupplier });
    } catch (error) {
      if (error.message && error.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'Supplier code already exists.' });
      }
      return res.status(500).json({ error: 'Failed to register supplier.' });
    }
  }

  /**
   * PUT /api/suppliers/:id
   * Update supplier profile
   */
  static async updateSupplier(req, res) {
    try {
      const supId = req.params.id;
      const { name, code, contact_person, email, phone, address, rating } = req.body;

      const existing = await get('SELECT * FROM suppliers WHERE id = ?', [supId]);
      if (!existing) {
        return res.status(404).json({ error: 'Supplier not found.' });
      }

      const ratingNum = rating !== undefined ? Math.min(5.0, Math.max(1.0, parseFloat(rating))) : existing.rating;

      await run(
        `UPDATE suppliers 
         SET name = ?, code = ?, contact_person = ?, email = ?, phone = ?, address = ?, rating = ?
         WHERE id = ?`,
        [
          name ? name.trim() : existing.name,
          code ? code.trim().toUpperCase() : existing.code,
          contact_person !== undefined ? contact_person : existing.contact_person,
          email !== undefined ? email : existing.email,
          phone !== undefined ? phone : existing.phone,
          address !== undefined ? address : existing.address,
          ratingNum,
          supId
        ]
      );

      const updated = await get('SELECT * FROM suppliers WHERE id = ?', [supId]);
      return res.json({ message: 'Supplier updated successfully', supplier: updated });
    } catch (error) {
      if (error.message && error.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'Supplier code already exists.' });
      }
      return res.status(500).json({ error: 'Failed to update supplier.' });
    }
  }

  /**
   * DELETE /api/suppliers/:id
   * Delete supplier (Admin only)
   */
  static async deleteSupplier(req, res) {
    try {
      const supId = req.params.id;
      const existing = await get('SELECT id FROM suppliers WHERE id = ?', [supId]);
      if (!existing) {
        return res.status(404).json({ error: 'Supplier not found.' });
      }

      await run('DELETE FROM suppliers WHERE id = ?', [supId]);
      return res.json({ message: 'Supplier deleted successfully' });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to delete supplier.' });
    }
  }
}

module.exports = SupplierController;
