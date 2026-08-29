"""
StockPilot - Python 3.10 Database Integrity Checker & Schema Auditor
Validates database foreign key constraints, inventory balance consistency, and orphan record checks.
"""

import sqlite3
import os
import sys

DB_PATH = os.environ.get('DB_PATH', os.path.join(os.path.dirname(__file__), '../stockpilot.db'))

class DataValidator:
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path

    def check_integrity(self) -> Dict[str, Any]:
        if not os.path.exists(self.db_path):
            return {"status": "ERROR", "message": "Database file not found"}

        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        errors = []

        # 1. Foreign Key Integrity
        cursor.execute("PRAGMA foreign_key_check")
        fk_errors = cursor.fetchall()
        if fk_errors:
            errors.append(f"Foreign Key violations found: {len(fk_errors)}")

        # 2. Check Negative Inventory
        cursor.execute("SELECT id, sku, quantity FROM products WHERE quantity < 0")
        neg_prods = cursor.fetchall()
        if neg_prods:
            errors.append(f"Products with negative stock found: {len(neg_prods)}")

        # 3. Check Orphan Stock Movements
        cursor.execute("SELECT sm.id FROM stock_movements sm LEFT JOIN products p ON sm.product_id = p.id WHERE p.id IS NULL")
        orphans = cursor.fetchall()
        if orphans:
            errors.append(f"Orphan stock movements found: {len(orphans)}")

        conn.close()

        status = "PASSED" if not errors else "FAILED"
        return {
            "status": status,
            "error_count": len(errors),
            "errors": errors
        }

if __name__ == '__main__':
    validator = DataValidator()
    res = validator.check_integrity()
    print(f"Database Integrity Status: {res['status']}")
    if res['errors']:
        for e in res['errors']:
            print(f" - {e}")
