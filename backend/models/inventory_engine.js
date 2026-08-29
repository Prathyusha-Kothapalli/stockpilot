/**
 * StockPilot - Inventory Calculation Engine & Domain Models
 * Implements financial valuation models (FIFO, LIFO, WAC), safety stock algorithms,
 * Economic Order Quantity (EOQ), Gross Margin Return on Investment (GMROI),
 * and Inventory Velocity metrics.
 */

const crypto = require('crypto');

class InventoryEngine {
  /**
   * Calculate Weighted Average Cost (WAC)
   * WAC = Total Cost of Available Stock / Total Units Available
   */
  static calculateWeightedAverageCost(existingQty, existingCost, newQty, newCost) {
    const totalQty = existingQty + newQty;
    if (totalQty <= 0) return 0;
    const totalValuation = (existingQty * existingCost) + (newQty * newCost);
    return Math.round((totalValuation / totalQty) * 100) / 100;
  }

  /**
   * Calculate Reorder Point (ROP)
   * ROP = (Average Daily Usage * Lead Time in Days) + Safety Stock
   */
  static calculateReorderPoint(avgDailyUsage, leadTimeDays, safetyStock = 0) {
    if (avgDailyUsage < 0 || leadTimeDays < 0) return 0;
    const rawRop = (avgDailyUsage * leadTimeDays) + safetyStock;
    return Math.ceil(rawRop);
  }

  /**
   * Calculate Safety Stock
   * Safety Stock = Z * stdDevLeadTime * sqrt(avgLeadTime)
   * Z-scores: 90% -> 1.28, 95% -> 1.65, 99% -> 2.33
   */
  static calculateSafetyStock(dailyDemandStdDev, avgLeadTimeDays, serviceLevel = 0.95) {
    let zScore = 1.65;
    if (serviceLevel >= 0.99) zScore = 2.33;
    else if (serviceLevel <= 0.90) zScore = 1.28;

    const safetyStock = zScore * dailyDemandStdDev * Math.sqrt(avgLeadTimeDays);
    return Math.ceil(safetyStock);
  }

  /**
   * Calculate Economic Order Quantity (EOQ)
   * EOQ = sqrt((2 * Demand * OrderingCost) / HoldingCostPerUnit)
   */
  static calculateEOQ(annualDemand, orderingCost = 50.0, holdingCostRate = 0.20, unitCost = 100.0) {
    if (annualDemand <= 0 || unitCost <= 0) return 0;
    const holdingCostPerUnit = unitCost * holdingCostRate;
    if (holdingCostPerUnit <= 0) return annualDemand;

    const eoq = Math.sqrt((2 * annualDemand * orderingCost) / holdingCostPerUnit);
    return Math.round(eoq);
  }

  /**
   * Calculate Gross Margin Return on Investment (GMROI)
   * GMROI = Gross Profit / Average Inventory Cost
   */
  static calculateGMROI(grossProfit, avgInventoryCost) {
    if (avgInventoryCost <= 0) return 0;
    return Math.round((grossProfit / avgInventoryCost) * 100) / 100;
  }

  /**
   * Calculate Days Sales of Inventory (DSI)
   * DSI = (Average Inventory Cost / COGS) * 365
   */
  static calculateDSI(avgInventoryCost, cogsAnnual) {
    if (cogsAnnual <= 0) return 0;
    return Math.round((avgInventoryCost / cogsAnnual) * 365);
  }

  /**
   * Generate SHA-256 Audit Trail Signature for Stock Movement
   */
  static generateMovementChecksum(refNo, movementType, productId, qty, unitCost, timestamp) {
    const payload = `${refNo}:${movementType}:${productId}:${qty}:${unitCost}:${timestamp}`;
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  /**
   * Perform ABC Pareto Inventory Categorization (80/15/5 rule)
   */
  static categorizeABC(products) {
    if (!Array.isArray(products) || products.length === 0) return [];

    // Calculate total stock valuation per product
    const items = products.map(p => ({
      ...p,
      valuation: (p.quantity || 0) * (p.cost_price || 0)
    })).sort((a, b) => b.valuation - a.valuation);

    const totalValuation = items.reduce((sum, item) => sum + item.valuation, 0);
    if (totalValuation === 0) {
      return items.map(item => ({ ...item, abc_category: 'C', cumulative_percent: 0 }));
    }

    let runningValuation = 0;
    return items.map(item => {
      runningValuation += item.valuation;
      const cumPct = (runningValuation / totalValuation) * 100;

      let category = 'C';
      if (cumPct <= 80.0) category = 'A';
      else if (cumPct <= 95.0) category = 'B';

      return {
        ...item,
        abc_category: category,
        cumulative_percent: Math.round(cumPct * 100) / 100
      };
    });
  }
}

module.exports = InventoryEngine;
