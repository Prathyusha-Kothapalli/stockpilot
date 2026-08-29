"""
StockPilot - Python 3.10 Advanced Inventory Optimizer & Solver Engine
Provides Safety Stock calculations, Reorder Point (ROP) optimization, Demand Forecasting (Exponential Smoothing),
and Automated Warehouse Allocation Solvers.
"""

import math
import json
import sqlite3
import os
import sys
from typing import List, Dict, Any, Tuple

DB_PATH = os.environ.get('DB_PATH', os.path.join(os.path.dirname(__file__), '../stockpilot.db'))

class InventoryOptimizer:
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path

    def get_connection(self):
        if not os.path.exists(self.db_path):
            raise FileNotFoundError(f"Database not found at {self.db_path}")
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    @staticmethod
    def calculate_exponential_smoothing(history: List[float], alpha: float = 0.3) -> float:
        """
        Simple Exponential Smoothing for Single Period Demand Forecast
        F_{t+1} = alpha * Y_t + (1 - alpha) * F_t
        """
        if not history:
            return 0.0
        forecast = history[0]
        for actual in history[1:]:
            forecast = (alpha * actual) + ((1.0 - alpha) * forecast)
        return round(forecast, 2)

    @staticmethod
    def calculate_safety_stock(daily_std_dev: float, lead_time_days: int, service_level_z: float = 1.65) -> int:
        """
        Safety Stock = Z * DailyStdDev * sqrt(LeadTimeDays)
        Z = 1.65 for 95% service level
        """
        if daily_std_dev <= 0 or lead_time_days <= 0:
            return 0
        safety_stock = service_level_z * daily_std_dev * math.sqrt(lead_time_days)
        return math.ceil(safety_stock)

    def optimize_reorder_points() -> List[Dict[str, Any]]:
        """
        Evaluates current SKU reorder thresholds against historical movement velocity.
        """
        conn = self.get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT p.id, p.sku, p.name, p.quantity, p.reorder_level, p.cost_price,
                   COALESCE(SUM(sm.quantity), 0) as total_moved
            FROM products p
            LEFT JOIN stock_movements sm ON p.id = sm.product_id AND sm.movement_type = 'OUT'
            GROUP BY p.id
            ORDER BY total_moved DESC
        """)
        products = [dict(row) for row in cursor.fetchall()]
        conn.close()

        optimized = []
        for p in products:
            daily_usage = p['total_moved'] / 60.0 # Assumed 60 day history window
            lead_time = 3 # Assumed average supplier lead time days
            suggested_rop = self.calculate_safety_stock(daily_std_dev=max(1.0, daily_usage * 0.4), lead_time_days=lead_time) + math.ceil(daily_usage * lead_time)
            
            p['suggested_reorder_level'] = max(5, suggested_rop)
            p['reorder_discrepancy'] = p['suggested_reorder_level'] - p['reorder_level']
            optimized.append(p)

        return optimized

if __name__ == '__main__':
    optimizer = InventoryOptimizer()
    print("Running Python 3.10 Inventory Optimization Solver...")
    results = optimizer.optimize_reorder_points()
    print(f"Evaluated {len(results)} products for ROP optimization.")
    for item in results[:5]:
        print(f"[{item['sku']}] Current ROP: {item['reorder_level']} -> Suggested ROP: {item['suggested_reorder_level']}")
