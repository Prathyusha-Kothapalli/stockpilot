"""
StockPilot - Python 3.10+ Analytics & Inventory Intelligence Utility
Provides ABC Classification, Economic Order Quantity (EOQ), Stockout Risk Scoring, and Portfolio Analysis.
"""

import sqlite3
import os
import sys
import json
import math
from typing import List, Dict, Any

DB_PATH = os.environ.get('DB_PATH', os.path.join(os.path.dirname(__file__), '../stockpilot.db'))

def get_connection(db_path: str = DB_PATH):
    if not os.path.exists(db_path):
        raise FileNotFoundError(f"Database not found at {db_path}. Please initialize server first.")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

def calculate_abc_classification(db_path: str = DB_PATH) -> List[Dict[str, Any]]:
    """
    Performs Pareto (80/20) ABC Classification based on Inventory Value (Qty * Cost Price)
    - Category A: Top ~80% cumulative value (High value items requiring tight control)
    - Category B: Next ~15% cumulative value (Moderate value items)
    - Category C: Bottom ~5% cumulative value (Low value items)
    """
    conn = get_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, sku, name, brand, quantity, cost_price, selling_price,
               (quantity * cost_price) as inventory_value
        FROM products
        ORDER BY inventory_value DESC
    """)
    products = [dict(row) for row in cursor.fetchall()]
    conn.close()

    total_value = sum(p['inventory_value'] for p in products)
    if total_value == 0:
        return products

    cumulative_value = 0.0
    for p in products:
        cumulative_value += p['inventory_value']
        p['cumulative_pct'] = round((cumulative_value / total_value) * 100, 2)
        
        if p['cumulative_pct'] <= 80.0:
            p['abc_class'] = 'A'
        elif p['cumulative_pct'] <= 95.0:
            p['abc_class'] = 'B'
        else:
            p['abc_class'] = 'C'

    return products

def calculate_eoq(annual_demand: int, ordering_cost: float = 50.0, holding_cost_pct: float = 0.20, unit_cost: float = 100.0) -> int:
    """
    Economic Order Quantity (EOQ) formula:
    EOQ = sqrt((2 * Demand * OrderingCost) / (HoldingCostPerUnit))
    """
    if annual_demand <= 0 or unit_cost <= 0:
        return 0
    holding_cost_per_unit = unit_cost * holding_cost_pct
    if holding_cost_per_unit <= 0:
        return annual_demand
    eoq = math.sqrt((2 * annual_demand * ordering_cost) / holding_cost_per_unit)
    return max(1, round(eoq))

def generate_inventory_health_report(db_path: str = DB_PATH) -> Dict[str, Any]:
    """
    Computes overall inventory health metrics for executive reporting.
    """
    conn = get_connection(db_path)
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) as cnt FROM products")
    total_skus = cursor.fetchone()['cnt']

    cursor.execute("SELECT SUM(quantity) as total_qty, SUM(quantity * cost_price) as cost_val, SUM(quantity * selling_price) as retail_val FROM products")
    val_row = cursor.fetchone()

    cursor.execute("SELECT COUNT(*) as cnt FROM products WHERE quantity <= reorder_level")
    low_stock_cnt = cursor.fetchone()['cnt']

    cursor.execute("SELECT COUNT(*) as cnt FROM products WHERE quantity = 0")
    out_of_stock_cnt = cursor.fetchone()['cnt']

    conn.close()

    abc_products = calculate_abc_classification(db_path)
    class_a_count = sum(1 for p in abc_products if p.get('abc_class') == 'A')
    class_b_count = sum(1 for p in abc_products if p.get('abc_class') == 'B')
    class_c_count = sum(1 for p in abc_products if p.get('abc_class') == 'C')

    return {
        "total_skus": total_skus,
        "total_units": val_row['total_qty'] or 0,
        "total_cost_valuation": round(val_row['cost_val'] or 0.0, 2),
        "total_retail_valuation": round(val_row['retail_val'] or 0.0, 2),
        "potential_profit_margin": round((val_row['retail_val'] or 0.0) - (val_row['cost_val'] or 0.0), 2),
        "low_stock_alerts": low_stock_cnt,
        "out_of_stock_alerts": out_of_stock_cnt,
        "abc_distribution": {
            "Class_A_High_Value": class_a_count,
            "Class_B_Medium_Value": class_b_count,
            "Class_C_Low_Value": class_c_count
        }
    }

if __name__ == '__main__':
    print("=" * 60)
    print(" StockPilot Python 3.10 Analytics & Inventory Intelligence")
    print("=" * 60)
    try:
        report = generate_inventory_health_report()
        print("\n--- INVENTORY HEALTH SUMMARY ---")
        print(json.dumps(report, indent=2))

        print("\n--- TOP CLASS 'A' HIGH VALUE SKUs ---")
        abc = calculate_abc_classification()
        class_a_items = [p for p in abc if p.get('abc_class') == 'A'][:5]
        for item in class_a_items:
            print(f"[{item['sku']}] {item['name']} | Qty: {item['quantity']} | Val: ${item['inventory_value']:,.2f} | Cum: {item['cumulative_pct']}%")

    except Exception as e:
        print(f"Error running StockPilot analytics: {e}", file=sys.stderr)
        sys.exit(1)
