/**
 * StockPilot ERP - Category Taxonomy Controller
 * Manages category hierarchy, code formats, description updates, and product count aggregations.
 */

const { all, get, run } = require('../db/database');

class CategoryController {
  /**
   * GET /api/categories
   * List all categories with product count & stock aggregations
   */
  static async listCategories(req, res) {
    try {
      const categories = await all(`
        SELECT c.*, COUNT(p.id) AS product_count, COALESCE(SUM(p.quantity), 0) AS total_stock
        FROM categories c
        LEFT JOIN products p ON c.id = p.category_id
        GROUP BY c.id
        ORDER BY c.name ASC
      `);
      return res.json({ categories });
    } catch (error) {
      console.error('Error fetching categories:', error);
      return res.status(500).json({ error: 'Failed to fetch categories list.' });
    }
  }

  /**
   * GET /api/categories/:id
   * Fetch single category details
   */
  static async getCategoryById(req, res) {
    try {
      const catId = req.params.id;
      const category = await get('SELECT * FROM categories WHERE id = ?', [catId]);
      if (!category) {
        return res.status(404).json({ error: 'Category not found.' });
      }

      const products = await all('SELECT id, sku, name, quantity, cost_price FROM products WHERE category_id = ? ORDER BY name ASC', [catId]);
      return res.json({ category, products });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to fetch category details.' });
    }
  }

  /**
   * POST /api/categories
   * Create a new category
   */
  static async createCategory(req, res) {
    try {
      const { name, code, description } = req.body;
      if (!name || !code) {
        return res.status(400).json({ error: 'Category name and unique code are required.' });
      }

      const result = await run(
        'INSERT INTO categories (name, code, description) VALUES (?, ?, ?)',
        [name.trim(), code.trim().toUpperCase(), description || '']
      );

      const newCategory = await get('SELECT * FROM categories WHERE id = ?', [result.lastID]);
      return res.status(201).json({ message: 'Category created successfully', category: newCategory });
    } catch (error) {
      if (error.message && error.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'Category name or code already exists.' });
      }
      return res.status(500).json({ error: 'Failed to create category.' });
    }
  }

  /**
   * PUT /api/categories/:id
   * Update category
   */
  static async updateCategory(req, res) {
    try {
      const catId = req.params.id;
      const { name, code, description } = req.body;

      const existing = await get('SELECT id FROM categories WHERE id = ?', [catId]);
      if (!existing) {
        return res.status(404).json({ error: 'Category not found.' });
      }

      await run(
        'UPDATE categories SET name = ?, code = ?, description = ? WHERE id = ?',
        [name.trim(), code.trim().toUpperCase(), description || '', catId]
      );

      const updated = await get('SELECT * FROM categories WHERE id = ?', [catId]);
      return res.json({ message: 'Category updated successfully', category: updated });
    } catch (error) {
      if (error.message && error.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'Category name or code already exists.' });
      }
      return res.status(500).json({ error: 'Failed to update category.' });
    }
  }

  /**
   * DELETE /api/categories/:id
   * Delete category (Admin only)
   */
  static async deleteCategory(req, res) {
    try {
      const catId = req.params.id;
      const existing = await get('SELECT id FROM categories WHERE id = ?', [catId]);
      if (!existing) {
        return res.status(404).json({ error: 'Category not found.' });
      }

      await run('DELETE FROM categories WHERE id = ?', [catId]);
      return res.json({ message: 'Category deleted successfully' });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to delete category.' });
    }
  }
}

module.exports = CategoryController;
