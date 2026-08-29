const express = require('express');
const router = express.Router();
const { all, get } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /api/analytics/dashboard
 * Real-time dynamic KPI metrics computed from live database
 */
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const totalProducts = await get('SELECT COUNT(*) as count FROM products');
    const valuation = await get(`
      SELECT 
        COALESCE(SUM(quantity * cost_price), 0) as total_cost_value,
        COALESCE(SUM(quantity * selling_price), 0) as total_retail_value
      FROM products
    `);
    const lowStock = await get('SELECT COUNT(*) as count FROM products WHERE quantity <= reorder_level AND quantity > 0');
    const outOfStock = await get('SELECT COUNT(*) as count FROM products WHERE quantity = 0');
    
    const warehousesCount = await get('SELECT COUNT(*) as count FROM warehouses');
    const suppliersCount = await get('SELECT COUNT(*) as count FROM suppliers');
    const pendingPOs = await get("SELECT COUNT(*) as count FROM purchase_orders WHERE status IN ('Submitted', 'Approved')");
    const totalPOSpend = await get("SELECT COALESCE(SUM(total_amount), 0) as total FROM purchase_orders WHERE status = 'Received'");

    const totalCost = valuation ? valuation.total_cost_value : 0;
    const totalRetail = valuation ? valuation.total_retail_value : 0;
    const totalPotentialProfit = totalRetail - totalCost;
    const marginPercent = totalRetail > 0 ? ((totalPotentialProfit / totalRetail) * 100).toFixed(1) : 0;

    res.json({
      kpis: {
        total_products: totalProducts.count,
        total_cost_value: totalCost,
        total_retail_value: totalRetail,
        potential_profit: totalPotentialProfit,
        margin_percent: parseFloat(marginPercent),
        low_stock_count: lowStock.count,
        out_of_stock_count: outOfStock.count,
        warehouses_count: warehousesCount.count,
        suppliers_count: suppliersCount.count,
        pending_pos_count: pendingPOs.count,
        total_po_spend: totalPOSpend.total
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard analytics:', error);
    res.status(500).json({ error: 'Failed to compute live dashboard metrics.' });
  }
});

/**
 * GET /api/analytics/charts
 * Dynamic Chart Datasets for SVG charts (Line, Bar, Donut)
 */
router.get('/charts', authenticateToken, async (req, res) => {
  try {
    // 1. Stock Movements Trend (Last 7 Days / 6 Months)
    const movementTrends = await all(`
      SELECT 
        DATE(created_at) as date,
        SUM(CASE WHEN movement_type = 'IN' THEN quantity ELSE 0 END) as inbound_qty,
        SUM(CASE WHEN movement_type = 'OUT' THEN quantity ELSE 0 END) as outbound_qty,
        SUM(CASE WHEN movement_type = 'TRANSFER' THEN quantity ELSE 0 END) as transfer_qty
      FROM stock_movements
      GROUP BY DATE(created_at)
      ORDER BY date ASC
      LIMIT 14
    `);

    // 2. Inventory Value & Stock Count by Category
    const categoryBreakdown = await all(`
      SELECT 
        c.name as category_name,
        c.code as category_code,
        COUNT(p.id) as product_count,
        COALESCE(SUM(p.quantity), 0) as total_quantity,
        COALESCE(SUM(p.quantity * p.cost_price), 0) as category_cost_value
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id
      GROUP BY c.id
      ORDER BY category_cost_value DESC
    `);

    // 3. Warehouse Distribution & Capacity Utilization
    const warehouseDistribution = await all(`
      SELECT 
        w.name as warehouse_name,
        w.code as warehouse_code,
        w.capacity,
        COALESCE(SUM(pws.quantity), 0) as occupied_quantity,
        ROUND(CAST(COALESCE(SUM(pws.quantity), 0) AS REAL) / CAST(w.capacity AS REAL) * 100, 1) as utilization_pct
      FROM warehouses w
      LEFT JOIN product_warehouse_stock pws ON w.id = pws.warehouse_id
      GROUP BY w.id
      ORDER BY w.name ASC
    `);

    // 4. Low Stock Critical Alerts
    const lowStockAlerts = await all(`
      SELECT p.id, p.sku, p.name, p.quantity, p.reorder_level, p.unit, c.name as category_name, w.name as warehouse_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN warehouses w ON p.primary_warehouse_id = w.id
      WHERE p.quantity <= p.reorder_level
      ORDER BY (p.quantity - p.reorder_level) ASC
      LIMIT 10
    `);

    res.json({
      movement_trends: movementTrends,
      category_breakdown: categoryBreakdown,
      warehouse_distribution: warehouseDistribution,
      low_stock_alerts: lowStockAlerts
    });
  } catch (error) {
    console.error('Chart analytics error:', error);
    res.status(500).json({ error: 'Failed to compute chart analytics data.' });
  }
});

/**
 * GET /api/analytics/reports
 * Detailed reports view data (Top movers, Valuation report, Supplier performance)
 */
router.get('/reports', authenticateToken, async (req, res) => {
  try {
    // Top moving products by movement velocity
    const topMovers = await all(`
      SELECT p.sku, p.name, c.name as category_name, SUM(sm.quantity) as total_moved_qty, p.cost_price, (SUM(sm.quantity) * p.cost_price) as total_volume_value
      FROM stock_movements sm
      JOIN products p ON sm.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      GROUP BY p.id
      ORDER BY total_moved_qty DESC
      LIMIT 10
    `);

    // Valuation by Warehouse
    const warehouseValuations = await all(`
      SELECT w.name as warehouse_name, 
             COUNT(DISTINCT pws.product_id) as total_skus,
             SUM(pws.quantity) as total_units,
             SUM(pws.quantity * p.cost_price) as total_cost_valuation,
             SUM(pws.quantity * p.selling_price) as total_retail_valuation
      FROM warehouses w
      JOIN product_warehouse_stock pws ON w.id = pws.warehouse_id
      JOIN products p ON pws.product_id = p.id
      GROUP BY w.id
    `);

    res.json({
      top_movers: topMovers,
      warehouse_valuations: warehouseValuations
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to compute analytical report data.' });
  }
});

module.exports = router;
