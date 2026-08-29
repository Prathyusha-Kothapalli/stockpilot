const express = require('express');
const router = express.Router();
const { all, get, run } = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

/**
 * GET /api/purchase-orders
 * List purchase orders with status filter & supplier info
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, supplier_id, warehouse_id } = req.query;

    let sql = `
      SELECT po.*, 
             s.name as supplier_name, s.code as supplier_code,
             w.name as warehouse_name, w.code as warehouse_code,
             u.name as creator_name,
             (SELECT COUNT(*) FROM purchase_order_items WHERE po_id = po.id) as line_item_count
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      LEFT JOIN warehouses w ON po.warehouse_id = w.id
      LEFT JOIN users u ON po.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      sql += ` AND po.status = ?`;
      params.push(status);
    }

    if (supplier_id) {
      sql += ` AND po.supplier_id = ?`;
      params.push(supplier_id);
    }

    if (warehouse_id) {
      sql += ` AND po.warehouse_id = ?`;
      params.push(warehouse_id);
    }

    sql += ` ORDER BY po.created_at DESC`;

    const purchaseOrders = await all(sql, params);
    res.json({ purchase_orders: purchaseOrders });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch purchase orders.' });
  }
});

/**
 * GET /api/purchase-orders/:id
 * Single PO with line items
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const po = await get(`
      SELECT po.*, 
             s.name as supplier_name, s.code as supplier_code, s.contact_person, s.email as supplier_email, s.phone as supplier_phone,
             w.name as warehouse_name, w.code as warehouse_code, w.address as warehouse_address,
             u.name as creator_name
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      LEFT JOIN warehouses w ON po.warehouse_id = w.id
      LEFT JOIN users u ON po.created_by = u.id
      WHERE po.id = ?
    `, [req.params.id]);

    if (!po) {
      return res.status(404).json({ error: 'Purchase Order not found.' });
    }

    const items = await all(`
      SELECT poi.*, p.name as product_name, p.sku as product_sku, p.unit as product_unit
      FROM purchase_order_items poi
      JOIN products p ON poi.product_id = p.id
      WHERE poi.po_id = ?
    `, [req.params.id]);

    res.json({ purchase_order: po, items });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch Purchase Order details.' });
  }
});

/**
 * POST /api/purchase-orders
 * Create new Purchase Order with items
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { supplier_id, warehouse_id, expected_delivery, notes, items } = req.body;

    if (!supplier_id || !warehouse_id || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Supplier, target warehouse, and at least one line item are required.' });
    }

    const poNumber = `PO-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    let totalAmount = 0;
    items.forEach(item => {
      totalAmount += (parseInt(item.quantity_ordered, 10) || 0) * (parseFloat(item.unit_cost) || 0);
    });

    const poResult = await run(`
      INSERT INTO purchase_orders 
      (po_number, supplier_id, warehouse_id, status, total_amount, notes, created_by, expected_delivery)
      VALUES (?, ?, ?, 'Draft', ?, ?, ?, ?)
    `, [poNumber, supplier_id, warehouse_id, totalAmount, notes || '', req.user.id, expected_delivery || null]);

    const poId = poResult.lastID;

    // Insert line items
    for (const item of items) {
      await run(`
        INSERT INTO purchase_order_items (po_id, product_id, quantity_ordered, quantity_received, unit_cost)
        VALUES (?, ?, ?, 0, ?)
      `, [poId, item.product_id, parseInt(item.quantity_ordered, 10), parseFloat(item.unit_cost)]);
    }

    const createdPo = await get('SELECT * FROM purchase_orders WHERE id = ?', [poId]);
    res.status(201).json({ message: 'Purchase Order created successfully', purchase_order: createdPo });
  } catch (error) {
    console.error('Error creating PO:', error);
    res.status(500).json({ error: 'Failed to create Purchase Order.' });
  }
});

/**
 * PUT /api/purchase-orders/:id/status
 * Update PO Status & trigger stock receipt on 'Received'
 */
router.put('/:id/status', authenticateToken, async (req, res) => {
  try {
    const poId = req.params.id;
    const { status } = req.body;

    const allowedStatuses = ['Draft', 'Submitted', 'Approved', 'Received', 'Cancelled'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}` });
    }

    const po = await get('SELECT * FROM purchase_orders WHERE id = ?', [poId]);
    if (!po) {
      return res.status(404).json({ error: 'Purchase Order not found.' });
    }

    // Role check: Only Admin can Approve or Cancel POs
    if ((status === 'Approved' || status === 'Cancelled') && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin permission required to Approve or Cancel Purchase Orders.' });
    }

    // If changing to 'Received', process automatic stock receipt if not already received
    if (status === 'Received' && po.status !== 'Received') {
      const items = await all('SELECT * FROM purchase_order_items WHERE po_id = ?', [poId]);

      for (const item of items) {
        const qtyToReceive = item.quantity_ordered - item.quantity_received;
        if (qtyToReceive > 0) {
          // Update item received quantity
          await run('UPDATE purchase_order_items SET quantity_received = quantity_ordered WHERE id = ?', [item.id]);

          // Update product total quantity
          await run('UPDATE products SET quantity = quantity + ? WHERE id = ?', [qtyToReceive, item.product_id]);

          // Update warehouse stock map
          if (po.warehouse_id) {
            await run(`
              INSERT INTO product_warehouse_stock (product_id, warehouse_id, quantity)
              VALUES (?, ?, ?)
              ON CONFLICT(product_id, warehouse_id) DO UPDATE SET quantity = quantity + ?
            `, [item.product_id, po.warehouse_id, qtyToReceive, qtyToReceive]);
          }

          // Record Stock Movement log
          const refNo = `SM-PO-${po.po_number}-${item.product_id}`;
          await run(`
            INSERT INTO stock_movements 
            (reference_no, movement_type, product_id, target_warehouse_id, quantity, unit_cost, reason, performed_by)
            VALUES (?, 'IN', ?, ?, ?, ?, ?, ?)
          `, [refNo, item.product_id, po.warehouse_id, qtyToReceive, item.unit_cost, `Purchase Order Fulfillment (${po.po_number})`, req.user.id]);
        }
      }
    }

    await run('UPDATE purchase_orders SET status = ? WHERE id = ?', [status, poId]);
    const updatedPo = await get('SELECT * FROM purchase_orders WHERE id = ?', [poId]);

    res.json({ message: `Purchase Order status updated to ${status}`, purchase_order: updatedPo });
  } catch (error) {
    console.error('Error updating PO status:', error);
    res.status(500).json({ error: 'Failed to update Purchase Order status.' });
  }
});

module.exports = router;
