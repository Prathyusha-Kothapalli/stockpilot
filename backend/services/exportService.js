class ExportService {
    exportToCSV(holdings) {
        const headers = ['Ticker', 'Shares', 'AverageCost', 'CurrentPrice', 'TotalValue'];
        const rows = holdings.map(h => [h.ticker, h.shares, h.avgCost, h.currentPrice, (h.shares * h.currentPrice).toFixed(2)].join(','));
        return [headers.join(','), ...rows].join('\n');
    }
    exportToJSON(holdings) {
        return JSON.stringify({ exportedAt: new Date().toISOString(), totalHoldings: holdings.length, holdings }, null, 2);
    }
}
module.exports = new ExportService();