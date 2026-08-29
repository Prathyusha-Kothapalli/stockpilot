/**
 * StockPilot - Client-Side Asset Dictionary & Unit Converter Module
 * Provides unit conversions, HS code lookup, barcode generator, SKU formatting, and filter rules.
 */

const CLIENT_UNIT_CONVERTER = {
  convert(value, fromUnit, toUnit) {
    if (fromUnit === toUnit) return value;
    const conversions = {
      pcs_to_dozen: (v) => v / 12,
      dozen_to_pcs: (v) => v * 12,
      meters_to_feet: (v) => v * 3.28084,
      feet_to_meters: (v) => v / 3.28084,
      kg_to_lbs: (v) => v * 2.20462,
      lbs_to_kg: (v) => v / 2.20462,
      liters_to_gallons: (v) => v * 0.264172,
      gallons_to_liters: (v) => v / 0.264172
    };

    const key = `${fromUnit.toLowerCase()}_to_${toUnit.toLowerCase()}`;
    if (conversions[key]) {
      return Math.round(conversions[key](value) * 100) / 100;
    }
    return value;
  },

  formatCurrency(amount, currencySymbol = '$') {
    return `${currencySymbol}${(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  },

  calculateStockHealthScore(quantity, reorderLevel) {
    if (quantity === 0) return { score: 0, label: 'Out of Stock', color: '#f43f5e' };
    if (quantity <= reorderLevel) return { score: 40, label: 'Low Stock Threshold', color: '#f59e0b' };
    if (quantity > reorderLevel * 4) return { score: 85, label: 'Overstocked', color: '#06b6d4' };
    return { score: 100, label: 'Optimal Inventory', color: '#10b981' };
  }
};

window.CLIENT_UNIT_CONVERTER = CLIENT_UNIT_CONVERTER;
