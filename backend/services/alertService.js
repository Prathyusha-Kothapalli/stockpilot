class AlertService {
    constructor() {
        this.alerts = [];
    }
    createAlert(userId, ticker, thresholdPrice, condition) {
        const alert = { id: Date.now().toString(), userId, ticker, thresholdPrice, condition, createdAt: new Date().toISOString() };
        this.alerts.push(alert);
        return alert;
    }
    checkPrice(ticker, currentPrice) {
        return this.alerts.filter(a => a.ticker === ticker && (a.condition === 'ABOVE' ? currentPrice >= a.thresholdPrice : currentPrice <= a.thresholdPrice));
    }
}
module.exports = new AlertService();