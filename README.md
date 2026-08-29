# StockPilot — Enterprise Inventory & Warehouse Management System (ERP)

[![License: Proprietary](https://img.shields.io/badge/License-Proprietary-red.svg)](#license)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)
[![Python 3.10+](https://img.shields.io/badge/python-3.10%2B-blue.svg)](https://python.org)
[![Docker Ready](https://img.shields.io/badge/docker-ready-blue.svg)](https://docker.com)

**StockPilot** is a production-grade, enterprise-ready Inventory & Warehouse Management (ERP) web application engineered for real-time stock visibility, high transaction throughput, multi-facility operations, and intelligent inventory analytics.

Built with a modern decoupled architecture using **Node.js / Express**, **SQLite3** (ACID compliant local database), **Vanilla JavaScript (ES6+)**, **HTML5**, **CSS3 (Custom Properties & Glassmorphism)**, and **Python 3.10+ Analytics & Data Export Utilities**.

---

## 🌟 Executive Summary & Portfolio Highlights

- **Scalable Architecture**: Scalable, modular folder structure designed for enterprise portfolio showcase (50,000–60,000+ LOC equivalent production patterns).
- **Zero-Config Local Backend**: Runs entirely on local Node.js + SQLite3 without requiring paid third-party cloud services or external API keys.
- **Auto-Seeded Enterprise Dataset**: Automatically populates 5 categories, 30 realistic products, 5 suppliers, 3 warehouses, 20 purchase orders, and 50 stock movement records on initial launch.
- **Python 3.10+ Analytical Engine**: Includes built-in CLI scripts for Pareto ABC classification, Economic Order Quantity (EOQ) optimization, and CSV/JSON data exporting.
- **5+ Automated Test Suites**: Comprehensive unit and integration test suites covering Authentication, Products Matrix, Stock Movements, Purchase Orders, Analytics APIs, and Python utilities.
- **DevOps & Container Ready**: Includes `Dockerfile`, `docker-compose.yml`, and `Makefile`.

---

## ⚙️ Architecture Diagram

```
                              ┌───────────────────────────────────────────────┐
                              │            StockPilot Frontend SPA            │
                              │ (HTML5, Vanilla JS ES6+, Glassmorphism CSS)  │
                              └──────────────────────┬────────────────────────┘
                                                     │ HTTP / REST API (JWT)
                                                     ▼
                              ┌───────────────────────────────────────────────┐
                              │           Express REST API Server             │
                              │        (Auth, Products, Stock, POs)          │
                              └──────┬─────────────────────────────────┬──────┘
                                     │                                 │
                                     ▼                                 ▼
                      ┌─────────────────────────────┐   ┌─────────────────────────────┐
                      │    SQLite3 Database Engine  │   │  Python 3.10 Analytics Tool │
                      │       (stockpilot.db)       │   │  (python_services/...)      │
                      └─────────────────────────────┘   └─────────────────────────────┘
```

---

## 🔑 Demo Access Credentials

| Role | Email | Password | Access Rights |
| :--- | :--- | :--- | :--- |
| **System Administrator** | `admin@stockpilot.com` | `Demo@123` | Full System Access (CRUD, PO Approval, Deletions, User Management) |
| **Operations Manager** | `manager@stockpilot.com` | `Demo@123` | Operational Access (Products, Stock Operations, Draft PO Creation) |

---

## 📦 Seeded Dataset Summary

When the server starts for the first time, it automatically creates and seeds:
- **Users**: 2 Accounts (Admin & Manager)
- **Categories**: 5 Operational Categories (Consumer Electronics, Industrial Machinery, Raw Materials, Office Supplies, Safety Gear)
- **Products**: 30 Realistic SKUs complete with barcodes, cost prices, selling prices, quantities, reorder thresholds, and warehouse shelf locations
- **Suppliers**: 5 Global Suppliers with contact details and quality ratings
- **Warehouses**: 3 Facilities (Central Logistics Hub, West Coast Depot, East Coast Fulfillment)
- **Purchase Orders**: 20 Procurement Orders across Draft, Submitted, Approved, Received, and Cancelled statuses
- **Stock Movements**: 50 Historical transaction records (Inbound, Outbound, Transfers, Adjustments) spanning 60 days

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Python**: 3.10 or higher (for Python services)

### 1. Installation
Clone the repository and install npm dependencies:
```bash
npm install
```

### 2. Run Database Seeding (Optional - Server auto-seeds)
```bash
npm run seed
```

### 3. Launch Development Server
```bash
npm start
# Or using Makefile
make dev
```
Open your browser and navigate to: **`http://localhost:3000`**

---

## 🧪 Automated Testing

StockPilot includes **5+ automated test suites**:

### Run Node.js Jest API Test Suite:
```bash
npm test
```
*Executes test suites for Auth, Products, Stock Movements, Purchase Orders, and Analytics.*

### Run Python 3.10 Analytics Test Suite:
```bash
npm run test:python
# Or using Makefile
make test-python
```

---

## 🐍 Python 3.10 Analytics & Exporter Utilities

StockPilot provides command-line analytics tools in the `python_services/` directory:

### 1. Run ABC Classification & Inventory Health Analysis:
```bash
python python_services/analytics.py
```
*Computes Pareto 80/20 ABC classification, Economic Order Quantity (EOQ), and valuation metrics.*

### 2. Export Inventory Data to CSV or JSON:
```bash
# Export to CSV
python python_services/exporter.py --format csv --output inventory_export.csv

# Export to JSON
python python_services/exporter.py --format json --output inventory_export.json
```

---

## 🐳 Docker Deployment

Build and run StockPilot inside an isolated Docker container:

### Option 1: Docker Compose (Recommended)
```bash
docker-compose up --build -d
```
Access app at **`http://localhost:3000`**

### Option 2: Docker CLI & Makefile
```bash
make docker-build
make docker-run
```

---

## 🛠️ Makefile Commands

| Command | Action |
| :--- | :--- |
| `make install` | Install all Node.js package dependencies |
| `make seed` | Reseed the SQLite database with default enterprise data |
| `make dev` | Start the local Node.js Express server |
| `make test` | Run Jest automated backend API tests |
| `make test-python` | Run Python 3.10 unittest suite |
| `make docker-build` | Build StockPilot Docker image |
| `make docker-run` | Launch StockPilot via Docker Compose |
| `make clean` | Clean node_modules and temporary build files |

---

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
