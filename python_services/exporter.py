"""
StockPilot - Python 3.10 Exporter Utility
Exports stock catalog, warehouse inventory levels, and purchase order data to CSV or JSON formats.
"""

import sqlite3
import csv
import json
import os
import argparse
import sys

DB_PATH = os.environ.get('DB_PATH', os.path.join(os.path.dirname(__file__), '../stockpilot.db'))

def export_products_csv(output_filepath: str, db_path: str = DB_PATH):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("""
        SELECT p.sku, p.barcode, p.name, c.name as category, p.brand, 
               p.cost_price, p.selling_price, p.quantity, p.reorder_level, 
               p.unit, p.warehouse_location, w.name as primary_warehouse,
               (p.quantity * p.cost_price) as cost_valuation
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN warehouses w ON p.primary_warehouse_id = w.id
        ORDER BY p.sku ASC
    """)
    rows = cursor.fetchall()
    conn.close()

    if not rows:
        print("No products found to export.")
        return

    fieldnames = list(rows[0].keys())

    with open(output_filepath, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in rows:
            writer.writerow(dict(r))

    print(f"Exported {len(rows)} products successfully to: {output_filepath}")

def export_products_json(output_filepath: str, db_path: str = DB_PATH):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("""
        SELECT p.sku, p.barcode, p.name, c.name as category, p.brand, 
               p.cost_price, p.selling_price, p.quantity, p.reorder_level, 
               p.unit, p.warehouse_location, w.name as primary_warehouse,
               (p.quantity * p.cost_price) as cost_valuation
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN warehouses w ON p.primary_warehouse_id = w.id
        ORDER BY p.sku ASC
    """)
    products = [dict(r) for r in cursor.fetchall()]
    conn.close()

    with open(output_filepath, 'w', encoding='utf-8') as f:
        json.dump(products, f, indent=2)

    print(f"Exported {len(products)} products successfully to JSON: {output_filepath}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="StockPilot Inventory Data Exporter")
    parser.add_argument('--format', choices=['csv', 'json'], default='csv', help='Export file format')
    parser.add_argument('--output', default='inventory_export.csv', help='Output file path')
    args = parser.parse_args()

    if args.format == 'csv':
        export_products_csv(args.output)
    else:
        export_products_json(args.output)
