const alertService = require('../backend/services/alertService');
const exportService = require('../backend/services/exportService');

describe('StockPilot Services Unit Tests', () => {
    test('AlertService creates and checks threshold alerts', () => {
        alertService.createAlert('user1', 'AAPL', 150, 'ABOVE');
        const triggered = alertService.checkPrice('AAPL', 155);
        expect(triggered.length).toBeGreaterThan(0);
    });

    test('ExportService formats CSV correctly', () => {
        const holdings = [{ ticker: 'AAPL', shares: 10, avgCost: 140, currentPrice: 150 }];
        const csv = exportService.exportToCSV(holdings);
        expect(csv).toContain('Ticker,Shares');
        expect(csv).toContain('AAPL,10,140,150,1500.00');
    });
});