/**
 * StockPilot ERP - Analytics & BI Controller
 * Computes live executive KPI summaries, SVG chart datasets, Pareto ABC categorization,
 * GMROI metrics, Days Sales of Inventory (DSI), and velocity reports.
 */

const { all, get } = require('../db/database');
const AnalyticsReportingService = require('../services/analytics_reporting_service');
const InventoryEngine = require('../models/inventory_engine');

class AnalyticsController {
  /**
   * GET /api/analytics/dashboard
   * Real-time executive KPI metrics
   */
  static async getDashboardKPIs(req, res) {
    try {
      const db = { get, all };
      const summary = await AnalyticsReportingService.computeExecutiveSummary(db);
      return res.json({ kpis: summary });
    } catch (error) {
      console.error('Error computing dashboard KPIs:', error);
      return res.status(500).json({ error: 'Failed to compute live executive KPI metrics.' });
    }
  }

  /**
   * GET /api/analytics/charts
   * Dynamic Chart Datasets (Line, Bar, Donut)
   */
  static async getChartDatasets(req, res) {
    try {
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

      const lowStockAlerts = await all(`
        SELECT p.id, p.sku, p.name, p.quantity, p.reorder_level, p.unit, c.name as category_name, w.name as warehouse_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN warehouses w ON p.primary_warehouse_id = w.id
        WHERE p.quantity <= p.reorder_level
        ORDER BY (p.quantity - p.reorder_level) ASC
        LIMIT 10
      `);

      return res.json({
        movement_trends: movementTrends,
        category_breakdown: categoryBreakdown,
        warehouse_distribution: warehouseDistribution,
        low_stock_alerts: lowStockAlerts
      });
    } catch (error) {
      console.error('Error fetching chart datasets:', error);
      return res.status(500).json({ error: 'Failed to compute chart analytics data.' });
    }
  }

  /**
   * GET /api/analytics/reports
   * Detailed analytical reports (Top Movers, Warehouse Valuations, ABC Analysis)
   */
  static async getAnalyticalReports(req, res) {
    try {
      const db = { get, all };
      
      const topMovers = await all(`
        SELECT p.sku, p.name, c.name as category_name, SUM(sm.quantity) as total_moved_qty, p.cost_price, (SUM(sm.quantity) * p.cost_price) as total_volume_value
        FROM stock_movements sm
        JOIN products p ON sm.product_id = p.id
        LEFT JOIN categories c ON p.category_id = c.id
        GROUP BY p.id
        ORDER BY total_moved_qty DESC
        LIMIT 10
      `);

      const warehouseValuations = await AnalyticsReportingService.computeWarehouseUtilizationReport(db);

      const allProducts = await all('SELECT id, sku, name, brand, quantity, cost_price, selling_price FROM products');
      const abcCategorized = InventoryEngine.categorizeABC(allProducts);

      return res.json({
        top_movers: topMovers,
        warehouse_valuations: warehouseValuations,
        abc_categorization_sample: abcCategorized.slice(0, 10)
      });
    } catch (error) {
      console.error('Error generating analytical report data:', error);
      return res.status(500).json({ error: 'Failed to compute analytical report data.' });
    }
  }
}

module.exports = AnalyticsController;
