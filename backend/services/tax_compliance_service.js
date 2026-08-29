/**
 * StockPilot - International Tax & Customs Duties Compliance Engine
 * Calculates VAT, GST, Sales Tax, Import Duties, and HS Tariff Classifications.
 */

class TaxComplianceService {
  static TAX_RATES = {
    US: { standard_sales_tax: 0.0725, duty_flat_rate: 0.035 },
    EU: { vat_standard: 0.20, duty_flat_rate: 0.042 },
    UK: { vat_standard: 0.20, duty_flat_rate: 0.040 },
    CA: { gst_rate: 0.05, pst_rate: 0.07, duty_flat_rate: 0.038 },
    AU: { gst_rate: 0.10, duty_flat_rate: 0.050 }
  };

  /**
   * Calculate Total Tax & Duties for Purchase Order or Stock Invoice
   */
  static calculateTaxesAndDuties(amount, countryCode = 'US', hsCode = '8517.62.00') {
    const region = this.TAX_RATES[countryCode.toUpperCase()] || this.TAX_RATES['US'];
    
    let taxRate = 0.0;
    if (region.standard_sales_tax) taxRate += region.standard_sales_tax;
    if (region.vat_standard) taxRate += region.vat_standard;
    if (region.gst_rate) taxRate += region.gst_rate;
    if (region.pst_rate) taxRate += region.pst_rate;

    const dutyRate = region.duty_flat_rate || 0.035;

    const taxAmount = Math.round((amount * taxRate) * 100) / 100;
    const dutyAmount = Math.round((amount * dutyRate) * 100) / 100;
    const totalWithTax = Math.round((amount + taxAmount + dutyAmount) * 100) / 100;

    return {
      baseAmount: amount,
      countryCode: countryCode.toUpperCase(),
      hsCode,
      taxRate: Math.round(taxRate * 10000) / 100,
      taxAmount,
      dutyRate: Math.round(dutyRate * 10000) / 100,
      dutyAmount,
      totalAmountWithTaxAndDuty: totalWithTax
    };
  }

  /**
   * Validate International HS Tariff Code format (e.g., 8517.62.0090)
   */
  static validateHSCode(hsCodeStr) {
    if (!hsCodeStr) return false;
    const clean = hsCodeStr.replace(/[^0-9]/g, '');
    return clean.length >= 6 && clean.length <= 10;
  }
}

module.exports = TaxComplianceService;
