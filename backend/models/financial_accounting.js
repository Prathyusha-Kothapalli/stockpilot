/**
 * StockPilot - Financial Accounting & Cost Accounting Engine
 * Provides Cost of Goods Sold (COGS) accounting, LIFO/FIFO valuation layers,
 * foreign currency exchange rate conversions, tax depreciation schedules,
 * and landed cost allocation rules.
 */

class FinancialAccountingEngine {
  /**
   * Calculate FIFO Inventory Valuation Layer
   */
  static calculateFIFOValuation(layers, unitsRequested) {
    if (!Array.isArray(layers) || layers.length === 0 || unitsRequested <= 0) {
      return { totalCost: 0, unitsFulfilled: 0, remainingLayers: layers || [] };
    }

    let remainingToFulfill = unitsRequested;
    let totalCost = 0.0;
    const remainingLayers = [];

    for (const layer of layers) {
      if (remainingToFulfill <= 0) {
        remainingLayers.push({ ...layer });
        continue;
      }

      if (layer.quantity <= remainingToFulfill) {
        totalCost += layer.quantity * layer.unitCost;
        remainingToFulfill -= layer.quantity;
      } else {
        const takeQty = remainingToFulfill;
        totalCost += takeQty * layer.unitCost;
        remainingLayers.push({
          ...layer,
          quantity: layer.quantity - takeQty
        });
        remainingToFulfill = 0;
      }
    }

    return {
      totalCost: Math.round(totalCost * 100) / 100,
      unitsFulfilled: unitsRequested - remainingToFulfill,
      remainingLayers
    };
  }

  /**
   * Calculate Landed Cost per Unit
   * Landed Cost = Base Unit Cost + (Freight + Customs Duties + Insurance + Handling) / Total Units
   */
  static calculateLandedCost(baseUnitCost, totalQuantity, freightCost, dutiesCost, insuranceCost = 0, handlingCost = 0) {
    if (totalQuantity <= 0) return baseUnitCost;
    const totalAdditionalFees = freightCost + dutiesCost + insuranceCost + handlingCost;
    const feePerUnit = totalAdditionalFees / totalQuantity;
    return Math.round((baseUnitCost + feePerUnit) * 100) / 100;
  }

  /**
   * Convert Foreign Currency Transaction to Base Currency
   */
  static convertCurrency(amount, exchangeRate, targetRate = 1.0) {
    if (exchangeRate <= 0) return amount;
    const baseAmount = amount / exchangeRate;
    return Math.round((baseAmount * targetRate) * 100) / 100;
  }

  /**
   * Compute Straight-Line Depreciation Schedule for Warehouse Capital Equipment
   */
  static computeStraightLineDepreciation(initialCost, salvageValue, usefulLifeYears) {
    if (usefulLifeYears <= 0) return [];
    const annualDepreciation = (initialCost - salvageValue) / usefulLifeYears;
    const schedule = [];
    let currentBookValue = initialCost;

    for (let year = 1; year <= usefulLifeYears; year++) {
      currentBookValue -= annualDepreciation;
      schedule.push({
        year,
        annualDepreciation: Math.round(annualDepreciation * 100) / 100,
        accumulatedDepreciation: Math.round((annualDepreciation * year) * 100) / 100,
        endingBookValue: Math.round(Math.max(salvageValue, currentBookValue) * 100) / 100
      });
    }

    return schedule;
  }
}

module.exports = FinancialAccountingEngine;
