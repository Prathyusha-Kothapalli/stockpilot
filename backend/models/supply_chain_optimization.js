/**
 * StockPilot - Supply Chain Optimization & Bullwhip Effect Mitigation Engine
 * Calculates lead time variance, order batching distortion, safety stock buffers,
 * multi-echelon inventory allocation, and supplier lead time risk index.
 */

class SupplyChainOptimizationEngine {
  /**
   * Calculate Bullwhip Effect Ratio
   * Bullwhip Index = Variance of Orders / Variance of Demand
   * Ratio > 1.0 indicates bullwhip amplification in supply chain.
   */
  static calculateBullwhipIndex(ordersHistory, demandHistory) {
    if (!Array.isArray(ordersHistory) || !Array.isArray(demandHistory) || ordersHistory.length < 2 || demandHistory.length < 2) {
      return 1.0;
    }

    const calculateVariance = (arr) => {
      const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
      return arr.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / (arr.length - 1);
    };

    const varOrders = calculateVariance(ordersHistory);
    const varDemand = calculateVariance(demandHistory);

    if (varDemand <= 0) return 1.0;
    return Math.round((varOrders / varDemand) * 100) / 100;
  }

  /**
   * Multi-Echelon Stock Allocation Optimization
   * Distributes central warehouse inventory across regional fulfillment centers based on forecast demand ratio.
   */
  static optimizeMultiEchelonAllocation(totalCentralAvailableStock, regionalFacilities) {
    if (!Array.isArray(regionalFacilities) || regionalFacilities.length === 0 || totalCentralAvailableStock <= 0) {
      return [];
    }

    const totalForecastDemand = regionalFacilities.reduce((sum, f) => sum + (f.forecast_demand || 0), 0);
    if (totalForecastDemand <= 0) {
      const equalShare = Math.floor(totalCentralAvailableStock / regionalFacilities.length);
      return regionalFacilities.map(f => ({ ...f, allocated_qty: equalShare }));
    }

    let remainingStock = totalCentralAvailableStock;
    const allocations = regionalFacilities.map(facility => {
      const demandRatio = (facility.forecast_demand || 0) / totalForecastDemand;
      const targetQty = Math.floor(totalCentralAvailableStock * demandRatio);
      const allocated = Math.min(facility.capacity - (facility.current_stock || 0), targetQty);
      remainingStock -= allocated;

      return {
        facility_id: facility.id,
        facility_name: facility.name,
        allocated_qty: Math.max(0, allocated),
        fulfillment_percentage: Math.round((allocated / (facility.forecast_demand || 1)) * 100)
      };
    });

    return allocations;
  }

  /**
   * Supplier Risk Score Index (0 to 100)
   * Score = 100 - (LeadTimeVariance * 15 + DefectRatePct * 25 + LateDeliveryPct * 60)
   */
  static calculateSupplierRiskIndex(leadTimeVarianceDays, defectRatePct, lateDeliveryPct) {
    const penalty = (leadTimeVarianceDays * 15.0) + (defectRatePct * 25.0) + (lateDeliveryPct * 60.0);
    const riskScore = Math.max(0, Math.min(100, Math.round(100.0 - penalty)));
    
    let riskLevel = 'LOW';
    if (riskScore < 50) riskLevel = 'HIGH';
    else if (riskScore < 75) riskLevel = 'MEDIUM';

    return { riskScore, riskLevel };
  }
}

module.exports = SupplyChainOptimizationEngine;
