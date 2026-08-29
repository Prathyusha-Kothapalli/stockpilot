const express = require('express');
const router = express.Router();
const { all, get, run } = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

/**
 * GET /api/categories
 * List all categories with product counts
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const categories = await all(`
      SELECT c.*, COUNT(p.id) AS product_count, SUM(p.quantity) AS total_stock
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id
      GROUP BY c.id
      ORDER BY c.name ASC
    `);
    res.json({ categories });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories.' });
  }
});

/**
 * GET /api/categories/:id
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const category = await get('SELECT * FROM categories WHERE id = ?', [req.params.id]);
    if (!category) {
      return res.status(404).json({ error: 'Category not found.' });
    }
    res.json({ category });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch category details.' });
  }
});

/**
 * POST /api/categories
 * Create new category (Admin & Manager)
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, code, description } = req.body;
    if (!name || !code) {
      return res.status(400).json({ error: 'Category name and code are required.' });
    }

    const result = await run(
      'INSERT INTO categories (name, code, description) VALUES (?, ?, ?)',
      [name.trim(), code.trim().toUpperCase(), description || '']
    );

    const newCategory = await get('SELECT * FROM categories WHERE id = ?', [result.lastID]);
    res.status(201).json({ message: 'Category created successfully', category: newCategory });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Category name or code already exists.' });
    }
    res.status(500).json({ error: 'Failed to create category.' });
  }
});

/**
 * PUT /api/categories/:id
 * Update category
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { name, code, description } = req.body;
    const catId = req.params.id;

    const existing = await get('SELECT id FROM categories WHERE id = ?', [catId]);
    if (!existing) {
      return res.status(404).json({ error: 'Category not found.' });
    }

    await run(
      'UPDATE categories SET name = ?, code = ?, description = ? WHERE id = ?',
      [name.trim(), code.trim().toUpperCase(), description || '', catId]
    );

    const updated = await get('SELECT * FROM categories WHERE id = ?', [catId]);
    res.json({ message: 'Category updated successfully', category: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update category.' });
  }
});

/**
 * DELETE /api/categories/:id
 * Delete category (Admin only)
 */
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const catId = req.params.id;
    await run('DELETE FROM categories WHERE id = ?', [catId]);
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete category.' });
  }
});

module.exports = router;
