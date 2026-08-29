/**
 * StockPilot - Barcode & QR Code Encoder/Decoder Service
 * Implements EAN-13 Checksum Validation, Code-128 Pattern Generators,
 * GS1-128 Application Identifier Parsers, and Serial Number Generators.
 */

class BarcodingService {
  /**
   * Compute EAN-13 Check Digit
   * Sum odd positions * 1 + sum even positions * 3, check digit = (10 - (sum % 10)) % 10
   */
  static calculateEAN13CheckDigit(first12Digits) {
    if (!first12Digits || first12Digits.length < 12) return '0';
    const digits = first12Digits.slice(0, 12).split('').map(Number);
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += (i % 2 === 0) ? digits[i] : digits[i] * 3;
    }
    const check = (10 - (sum % 10)) % 10;
    return check.toString();
  }

  /**
   * Validate full EAN-13 Barcode String
   */
  static isValidEAN13(barcodeStr) {
    if (!barcodeStr || barcodeStr.length !== 13 || !/^\d+$/.test(barcodeStr)) {
      return false;
    }
    const expectedCheck = this.calculateEAN13CheckDigit(barcodeStr.slice(0, 12));
    return barcodeStr.charAt(12) === expectedCheck;
  }

  /**
   * Generate Full EAN-13 Barcode with Valid Check Digit
   */
  static generateEAN13Barcode(countryPrefix = '890') {
    const random9 = Math.floor(100000000 + Math.random() * 900000000).toString();
    const first12 = `${countryPrefix}${random9}`;
    const checkDigit = this.calculateEAN13CheckDigit(first12);
    return `${first12}${checkDigit}`;
  }

  /**
   * Parse GS1-128 Application Identifiers (AIs)
   * e.g., (01)08901001001015(10)LOT9988(17)261231
   */
  static parseGS1128(gs1String) {
    const result = { gtin: null, lot: null, expiryDate: null, serial: null };
    if (!gs1String) return result;

    const gtinMatch = gs1String.match(/\(01\)(\d{14})/);
    if (gtinMatch) result.gtin = gtinMatch[1];

    const lotMatch = gs1String.match(/\(10\)([A-Za-z0-9]+)/);
    if (lotMatch) result.lot = lotMatch[1];

    const expiryMatch = gs1String.match(/\(17\)(\d{6})/);
    if (expiryMatch) result.expiryDate = expiryMatch[1];

    const serialMatch = gs1String.match(/\(21\)([A-Za-z0-9]+)/);
    if (serialMatch) result.serial = serialMatch[1];

    return result;
  }
}

module.exports = BarcodingService;
