# StockPilot REST API Specification

## Endpoints

### Authentication
- \POST /api/auth/register\ - Create user account
- \POST /api/auth/login\ - Authenticate and receive JWT token

### Portfolio
- \GET /api/portfolio\ - List user stock holdings
- \POST /api/portfolio/buy\ - Register stock buy transaction
- \POST /api/portfolio/sell\ - Register stock sell transaction

### Alerts & Export
- \POST /api/alerts\ - Create stock price alert
- \GET /api/export/csv\ - Export portfolio as CSV