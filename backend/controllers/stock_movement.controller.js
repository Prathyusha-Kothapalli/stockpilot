/**
 * StockPilot ERP - Stock Movements & Ledger Controller
 * Handles Stock In (Receipt), Stock Out (Dispatch), Warehouse Transfers,
 * Physical Count Adjustments, and cryptographic audit log retrieval.
 */

const { all, get, run } = require('../db/database');
const InventoryEngine = require('../models/inventory_engine');

class StockMovementController {
  /**
   * GET /api/stock/movements
   * Fetch paginated audit ledger of stock transactions
   */
  static async listMovements(req, res) {
    try {
      const { movement_type, product_id, warehouse_id, limit = 100 } = req.query;

      let sql = `
        SELECT sm.*, 
               p.name as product_name, p.sku as product_sku, p.unit as product_unit,
               w1.name as source_warehouse_name, 
               w2.name as target_warehouse_name,
               u.name as user_name
        FROM stock_movements sm
        JOIN products p ON sm.product_id = p.id
        LEFT JOIN warehouses w1 ON sm.source_warehouse_id = w1.id
        LEFT JOIN warehouses w2 ON sm.target_warehouse_id = w2.id
        LEFT JOIN users u ON sm.performed_by = u.id
        WHERE 1=1
      `;
      const params = [];

      if (movement_type) {
        sql += ` AND sm.movement_type = ?`;
        params.push(movement_type.toUpperCase());
      }

      if (product_id) {
        sql += ` AND sm.product_id = ?`;
        params.push(product_id);
      }

      if (warehouse_id) {
        sql += ` AND (sm.source_warehouse_id = ? OR sm.target_warehouse_id = ?)`;
        params.push(warehouse_id, warehouse_id);
      }

      sql += ` ORDER BY sm.created_at DESC LIMIT ?`;
      params.push(parseInt(limit, 10) || 100);

      const movements = await all(sql, params);

      const enrichedMovements = movements.map(m => ({
        ...m,
        checksum: InventoryEngine.generateMovementChecksum(
          m.reference_no,
          m.movement_type,
          m.product_id,
          m.quantity,
          m.unit_cost,
          m.created_at
        )
      }));

      return res.json({ movements: enrichedMovements });
    } catch (error) {
      console.error('Error fetching stock movements:', error);
      return res.status(500).json({ error: 'Failed to fetch stock movements audit log.' });
    }
  }

  /**
   * POST /api/stock/in
   * Process Stock In (Receive Inventory)
   */
  static async stockIn(req, res) {
    try {
      const { product_id, warehouse_id, quantity, unit_cost, reason } = req.body;

      if (!product_id || !warehouse_id || !quantity || quantity <= 0) {
        return res.status(400).json({ error: 'Product, valid warehouse, and positive quantity are required.' });
      }

      const product = await get('SELECT * FROM products WHERE id = ?', [product_id]);
      if (!product) {
        return res.status(404).json({ error: 'Product not found.' });
      }

      const qtyNum = parseInt(quantity, 10);
      const costNum = unit_cost !== undefined ? parseFloat(unit_cost) : product.cost_price;

      await run('UPDATE products SET quantity = quantity + ? WHERE id = ?', [qtyNum, product_id]);

      await run(`
        INSERT INTO product_warehouse_stock (product_id, warehouse_id, quantity)
        VALUES (?, ?, ?)
        ON CONFLICT(product_id, warehouse_id) DO UPDATE SET quantity = quantity + ?
      `, [product_id, warehouse_id, qtyNum, qtyNum]);

      const refNo = `SM-IN-${Date.now()}`;
      await run(`
        INSERT INTO stock_movements 
        (reference_no, movement_type, product_id, target_warehouse_id, quantity, unit_cost, reason, performed_by)
        VALUES (?, 'IN', ?, ?, ?, ?, ?, ?)
      `, [refNo, product_id, warehouse_id, qtyNum, costNum, reason || 'Stock In / Receipt', req.user.id]);

      const updatedProduct = await get('SELECT * FROM products WHERE id = ?', [product_id]);
      return res.json({ message: 'Stock received successfully', product: updatedProduct, reference_no: refNo });
    } catch (error) {
      console.error('Stock In error:', error);
      return res.status(500).json({ error: 'Failed to process Stock In operation.' });
    }
  }

  /**
   * POST /api/stock/out
   * Process Stock Out (Dispatch / Sales)
   */
  static async stockOut(req, res) {
    try {
      const { product_id, warehouse_id, quantity, reason } = req.body;

      if (!product_id || !warehouse_id || !quantity || quantity <= 0) {
        return res.status(400).json({ error: 'Product, warehouse, and positive quantity are required.' });
      }

      const qtyNum = parseInt(quantity, 10);

      const whStock = await get('SELECT quantity FROM product_warehouse_stock WHERE product_id = ? AND warehouse_id = ?', [product_id, warehouse_id]);
      if (!whStock || whStock.quantity < qtyNum) {
        return res.status(400).json({ error: `Insufficient stock in selected warehouse. Available: ${whStock ? whStock.quantity : 0}` });
      }

      const product = await get('SELECT * FROM products WHERE id = ?', [product_id]);

      await run('UPDATE products SET quantity = quantity - ? WHERE id = ?', [qtyNum, product_id]);
      await run('UPDATE product_warehouse_stock SET quantity = quantity - ? WHERE product_id = ? AND warehouse_id = ?', [qtyNum, product_id, warehouse_id]);

      const refNo = `SM-OUT-${Date.now()}`;
      await run(`
        INSERT INTO stock_movements 
        (reference_no, movement_type, product_id, source_warehouse_id, quantity, unit_cost, reason, performed_by)
        VALUES (?, 'OUT', ?, ?, ?, ?, ?, ?)
      `, [refNo, product_id, warehouse_id, qtyNum, product ? product.cost_price : 0, reason || 'Stock Out / Dispatch', req.user.id]);

      const updatedProduct = await get('SELECT * FROM products WHERE id = ?', [product_id]);
      return res.json({ message: 'Stock dispatched successfully', product: updatedProduct, reference_no: refNo });
    } catch (error) {
      console.error('Stock Out error:', error);
      return res.status(500).json({ error: 'Failed to process Stock Out operation.' });
    }
  }

  /**
   * POST /api/stock/transfer
   * Process Inter-Warehouse Stock Transfer
   */
  static async transfer(req, res) {
    try {
      const { product_id, source_warehouse_id, target_warehouse_id, quantity, reason } = req.body;

      if (!product_id || !source_warehouse_id || !target_warehouse_id || !quantity || quantity <= 0) {
        return res.status(400).json({ error: 'Product, source warehouse, target warehouse, and valid quantity are required.' });
      }

      if (source_warehouse_id === target_warehouse_id) {
        return res.status(400).json({ error: 'Source and target warehouses cannot be identical.' });
      }

      const qtyNum = parseInt(quantity, 10);

      const srcStock = await get('SELECT quantity FROM product_warehouse_stock WHERE product_id = ? AND warehouse_id = ?', [product_id, source_warehouse_id]);
      if (!srcStock || srcStock.quantity < qtyNum) {
        return res.status(400).json({ error: `Insufficient stock in source warehouse. Available: ${srcStock ? srcStock.quantity : 0}` });
      }

      const product = await get('SELECT * FROM products WHERE id = ?', [product_id]);

      await run('UPDATE product_warehouse_stock SET quantity = quantity - ? WHERE product_id = ? AND warehouse_id = ?', [qtyNum, product_id, source_warehouse_id]);
      await run(`
        INSERT INTO product_warehouse_stock (product_id, warehouse_id, quantity)
        VALUES (?, ?, ?)
        ON CONFLICT(product_id, warehouse_id) DO UPDATE SET quantity = quantity + ?
      `, [product_id, target_warehouse_id, qtyNum, qtyNum]);

      const refNo = `SM-TRF-${Date.now()}`;
      await run(`
        INSERT INTO stock_movements 
        (reference_no, movement_type, product_id, source_warehouse_id, target_warehouse_id, quantity, unit_cost, reason, performed_by)
        VALUES (?, 'TRANSFER', ?, ?, ?, ?, ?, ?, ?)
      `, [refNo, product_id, source_warehouse_id, target_warehouse_id, qtyNum, product ? product.cost_price : 0, reason || 'Inter-Warehouse Stock Transfer', req.user.id]);

      return res.json({ message: 'Warehouse stock transfer completed successfully', reference_no: refNo });
    } catch (error) {
      console.error('Transfer error:', error);
      return res.status(500).json({ error: 'Failed to process warehouse stock transfer.' });
    }
  }

  /**
   * POST /api/stock/adjust
   * Physical Count Adjustment
   */
  static async adjust(req, res) {
    try {
      const { product_id, warehouse_id, new_quantity, reason } = req.body;

      if (!product_id || !warehouse_id || new_quantity === undefined || new_quantity < 0) {
        return res.status(400).json({ error: 'Product, warehouse, and valid non-negative quantity are required.' });
      }

      const targetQty = parseInt(new_quantity, 10);
      const currWhStock = await get('SELECT quantity FROM product_warehouse_stock WHERE product_id = ? AND warehouse_id = ?', [product_id, warehouse_id]);
      const currentQty = currWhStock ? currWhStock.quantity : 0;
      const diff = targetQty - currentQty;

      if (diff === 0) {
        return res.json({ message: 'No adjustment needed; quantity matches current inventory.' });
      }

      const product = await get('SELECT * FROM products WHERE id = ?', [product_id]);

      await run(`
        INSERT INTO product_warehouse_stock (product_id, warehouse_id, quantity)
        VALUES (?, ?, ?)
        ON CONFLICT(product_id, warehouse_id) DO UPDATE SET quantity = ?
      `, [product_id, warehouse_id, targetQty, targetQty]);

      await run('UPDATE products SET quantity = quantity + ? WHERE id = ?', [diff, product_id]);

      const refNo = `SM-ADJ-${Date.now()}`;
      await run(`
        INSERT INTO stock_movements 
        (reference_no, movement_type, product_id, target_warehouse_id, quantity, unit_cost, reason, performed_by)
        VALUES (?, 'ADJUSTMENT', ?, ?, ?, ?, ?, ?)
      `, [refNo, product_id, warehouse_id, Math.abs(diff), product ? product.cost_price : 0, reason || `Physical Count Adjustment (${diff > 0 ? '+' : ''}${diff})`, req.user.id]);

      const updatedProduct = await get('SELECT * FROM products WHERE id = ?', [product_id]);
      return res.json({ message: 'Stock quantity adjusted successfully', product: updatedProduct, reference_no: refNo });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to process inventory adjustment.' });
    }
  }
}

module.exports = StockMovementController;
