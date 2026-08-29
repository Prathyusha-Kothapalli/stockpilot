/**
 * StockPilot - Analytics & Financial Reporting Service
 * Computes deep inventory metrics, financial stock valuation reports, supplier scorecards,
 * and data aggregation for executive dashboards and export services.
 */

const InventoryEngine = require('../models/inventory_engine');
const WarehouseGridEngine = require('../models/warehouse_grid');

class AnalyticsReportingService {
  /**
   * Compute Complete Executive Overview Dashboard Data
   */
  static async computeExecutiveSummary(db) {
    const totalProducts = await db.get('SELECT COUNT(*) as cnt FROM products');
    const valuation = await db.get(`
      SELECT 
        COALESCE(SUM(quantity * cost_price), 0) as total_cost_value,
        COALESCE(SUM(quantity * selling_price), 0) as total_retail_value
      FROM products
    `);

    const lowStock = await db.get('SELECT COUNT(*) as cnt FROM products WHERE quantity <= reorder_level AND quantity > 0');
    const outOfStock = await db.get('SELECT COUNT(*) as cnt FROM products WHERE quantity = 0');
    const warehousesCount = await db.get('SELECT COUNT(*) as cnt FROM warehouses');
    const suppliersCount = await db.get('SELECT COUNT(*) as cnt FROM suppliers');
    const pendingPOs = await db.get("SELECT COUNT(*) as cnt FROM purchase_orders WHERE status IN ('Submitted', 'Approved')");
    const totalPOSpend = await db.get("SELECT COALESCE(SUM(total_amount), 0) as total FROM purchase_orders WHERE status = 'Received'");

    const totalCost = valuation ? valuation.total_cost_value : 0;
    const totalRetail = valuation ? valuation.total_retail_value : 0;
    const grossMargin = totalRetail - totalCost;
    const marginPct = totalRetail > 0 ? (grossMargin / totalRetail) * 100 : 0;

    const gmroi = InventoryEngine.calculateGMROI(grossMargin, totalCost);

    return {
      total_products: totalProducts ? totalProducts.cnt : 0,
      total_cost_valuation: Math.round(totalCost * 100) / 100,
      total_retail_valuation: Math.round(totalRetail * 100) / 100,
      potential_gross_margin: Math.round(grossMargin * 100) / 100,
      gross_margin_percent: Math.round(marginPct * 10) / 10,
      gmroi: gmroi,
      low_stock_count: lowStock ? lowStock.cnt : 0,
      out_of_stock_count: outOfStock ? outOfStock.cnt : 0,
      warehouses_count: warehousesCount ? warehousesCount.cnt : 0,
      suppliers_count: suppliersCount ? suppliersCount.cnt : 0,
      pending_pos_count: pendingPOs ? pendingPOs.cnt : 0,
      total_po_spend: Math.round((totalPOSpend ? totalPOSpend.total : 0) * 100) / 100
    };
  }

  /**
   * Compute Supplier Scorecard Metrics
   */
  static async computeSupplierScorecards(db) {
    const suppliers = await db.all(`
      SELECT s.id, s.name, s.code, s.rating,
             COUNT(po.id) as total_pos,
             SUM(CASE WHEN po.status = 'Received' THEN 1 ELSE 0 END) as fulfilled_pos,
             COALESCE(SUM(po.total_amount), 0) as total_spend
      FROM suppliers s
      LEFT JOIN purchase_orders po ON s.id = po.supplier_id
      GROUP BY s.id
      ORDER BY total_spend DESC
    `);

    return suppliers.map(s => {
      const fulfillmentRate = s.total_pos > 0 ? Math.round((s.fulfilled_pos / s.total_pos) * 100) : 100;
      return {
        ...s,
        fulfillment_rate_percent: fulfillmentRate,
        reliability_score: Math.round((s.rating * 0.6 + (fulfillmentRate / 20) * 0.4) * 10) / 10
      };
    });
  }

  /**
   * Compute Facility Utilization & Stock Health Matrix
   */
  static async computeWarehouseUtilizationReport(db) {
    const warehouses = await db.all(`
      SELECT w.id, w.name, w.code, w.capacity, w.manager_name,
             COALESCE(SUM(pws.quantity), 0) as current_stock_units,
             COUNT(DISTINCT pws.product_id) as total_distinct_skus
      FROM warehouses w
      LEFT JOIN product_warehouse_stock pws ON w.id = pws.warehouse_id
      GROUP BY w.id
      ORDER BY w.name ASC
    `);

    return warehouses.map(w => {
      const metrics = WarehouseGridEngine.calculateUtilization(w.current_stock_units, w.capacity);
      return {
        ...w,
        utilization_percent: metrics.pct,
        status: metrics.status,
        available_space_units: metrics.availableSpace
      };
    });
  }
}

module.exports = AnalyticsReportingService;
