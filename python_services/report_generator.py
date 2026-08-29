"""
StockPilot - Python 3.10 Automated Executive Report Generator
Generates Markdown, HTML, CSV, and JSON audit reports directly from the SQLite database.
"""

import sqlite3
import os
import json
import argparse
from typing import List, Dict, Any

DB_PATH = os.environ.get('DB_PATH', os.path.join(os.path.dirname(__file__), '../stockpilot.db'))

class ExecutiveReportGenerator:
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path

    def get_connection(self):
        if not os.path.exists(self.db_path):
            raise FileNotFoundError(f"Database file not found at {self.db_path}")
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def generate_markdown_report(self, output_file: str = "inventory_executive_summary.md"):
        conn = self.get_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) as cnt, SUM(quantity * cost_price) as total_cost, SUM(quantity * selling_price) as total_retail FROM products")
        kpi = cursor.fetchone()

        cursor.execute("SELECT c.name as category_name, COUNT(p.id) as cnt, SUM(p.quantity) as qty, SUM(p.quantity * p.cost_price) as val FROM categories c LEFT JOIN products p ON c.id = p.category_id GROUP BY c.id")
        categories = cursor.fetchall()

        cursor.execute("SELECT w.name as warehouse_name, w.capacity, SUM(pws.quantity) as current_qty FROM warehouses w LEFT JOIN product_warehouse_stock pws ON w.id = pws.warehouse_id GROUP BY w.id")
        warehouses = cursor.fetchall()

        conn.close()

        md_content = f"""# StockPilot Executive Inventory Valuation Report

## Executive Summary Metrics
- **Total Catalog SKUs**: {kpi['cnt'] or 0}
- **Total Stock Cost Valuation**: ${kpi['total_cost']:,.2f}
- **Total Stock Retail Valuation**: ${kpi['total_retail']:,.2f}
- **Potential Gross Profit Margin**: ${(kpi['total_retail'] - kpi['total_cost']):,.2f}

## Valuation by Category
| Category Name | SKU Count | Total Units | Total Cost Valuation |
| :--- | :--- | :--- | :--- |
"""
        for cat in categories:
            val = cat['val'] or 0.0
            md_content += f"| {cat['category_name']} | {cat['cnt']} | {cat['qty'] or 0} | ${val:,.2f} |\n"

        md_content += "\n## Facility Capacity Utilization\n"
        md_content += "| Warehouse Facility | Max Capacity | Current Occupied Units | Utilization Rate |\n| :--- | :--- | :--- | :--- |\n"
        for wh in warehouses:
            cap = wh['capacity'] or 1
            qty = wh['current_qty'] or 0
            rate = round((qty / cap) * 100, 1)
            md_content += f"| {wh['warehouse_name']} | {cap:,} | {qty:,} | {rate}% |\n"

        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(md_content)

        print(f"Executive Markdown Report successfully generated: {output_file}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="StockPilot Executive Report Generator")
    parser.add_argument('--output', default='executive_report.md', help='Output Markdown file path')
    args = parser.parse_args()

    generator = ExecutiveReportGenerator()
    generator.generate_markdown_report(args.output)
