"""
StockPilot - Python 3.10 Automated Test Suite
"""

import unittest
import os
import sys

# Add parent directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from python_services.analytics import calculate_eoq, get_connection
from python_services.exporter import export_products_json

class TestStockPilotPythonServices(unittest.TestCase):

    def test_calculate_eoq(self):
        # EOQ = sqrt((2 * 1000 * 50) / (100 * 0.20)) = sqrt(100,000 / 20) = sqrt(5000) ~= 71
        eoq = calculate_eoq(annual_demand=1000, ordering_cost=50.0, holding_cost_pct=0.20, unit_cost=100.0)
        self.assertEqual(eoq, 71)

    def test_calculate_eoq_zero_demand(self):
        eoq = calculate_eoq(annual_demand=0, ordering_cost=50.0)
        self.assertEqual(eoq, 0)

    def test_database_connection(self):
        db_path = os.path.join(os.path.dirname(__file__), '../stockpilot.db')
        if os.path.exists(db_path):
            conn = get_connection(db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) as count FROM products")
            cnt = cursor.fetchone()['count']
            self.assertGreaterEqual(cnt, 0)
            conn.close()

if __name__ == '__main__':
    unittest.main()
