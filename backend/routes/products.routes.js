const express = require('express');
const router = express.Router();
const { all, get, run } = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

/**
 * Utility to generate unique SKU
 */
function generateSKU(categoryCode = 'GEN') {
  const cleanCode = categoryCode.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 4) || 'GEN';
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  return `SKU-${cleanCode}-${randomNum}`;
}

/**
 * Utility to generate EAN-13 / Code-128 Barcode
 */
function generateBarcode() {
  const prefix = '890';
  const randomPart = Math.floor(100000000 + Math.random() * 900000000).toString();
  return `${prefix}${randomPart}`;
}

/**
 * GET /api/products/generate-sku
 */
router.get('/generate-sku', authenticateToken, async (req, res) => {
  const catCode = req.query.category_code || 'GEN';
  res.json({ sku: generateSKU(catCode), barcode: generateBarcode() });
});

/**
 * GET /api/products
 * Full Search, Filter, Sort, and Paginated product list
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const {
      search,
      category_id,
      warehouse_id,
      low_stock,
      brand,
      sort_by = 'created_at',
      sort_dir = 'DESC',
      page = 1,
      limit = 100
    } = req.query;

    let sql = `
      SELECT p.*, 
             c.name as category_name, 
             c.code as category_code,
             w.name as primary_warehouse_name,
             (p.quantity <= p.reorder_level) as is_low_stock,
             (p.quantity * p.cost_price) as total_cost_value,
             (p.quantity * p.selling_price) as total_retail_value
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN warehouses w ON p.primary_warehouse_id = w.id
      WHERE 1=1
    `;

    const params = [];

    if (search) {
      sql += ` AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ? OR p.brand LIKE ? OR p.warehouse_location LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term, term);
    }

    if (category_id) {
      sql += ` AND p.category_id = ?`;
      params.push(category_id);
    }

    if (warehouse_id) {
      sql += ` AND p.primary_warehouse_id = ?`;
      params.push(warehouse_id);
    }

    if (brand) {
      sql += ` AND p.brand LIKE ?`;
      params.push(`%${brand.trim()}%`);
    }

    if (low_stock === 'true' || low_stock === '1') {
      sql += ` AND p.quantity <= p.reorder_level`;
    }

    // Sorting safe column check
    const allowedSortCols = ['name', 'sku', 'quantity', 'cost_price', 'selling_price', 'reorder_level', 'created_at', 'brand'];
    const safeSortCol = allowedSortCols.includes(sort_by) ? `p.${sort_by}` : 'p.created_at';
    const safeSortDir = sort_dir.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    sql += ` ORDER BY ${safeSortCol} ${safeSortDir}`;

    // Pagination
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 100;
    const offset = (pageNum - 1) * limitNum;

    sql += ` LIMIT ? OFFSET ?`;
    params.push(limitNum, offset);

    const products = await all(sql, params);

    // Get total count for pagination metadata
    let countSql = `SELECT COUNT(*) as total FROM products p WHERE 1=1`;
    const countParams = [];
    if (search) {
      countSql += ` AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ? OR p.brand LIKE ? OR p.warehouse_location LIKE ?)`;
      const term = `%${search.trim()}%`;
      countParams.push(term, term, term, term, term);
    }
    if (category_id) {
      countSql += ` AND p.category_id = ?`;
      countParams.push(category_id);
    }
    if (warehouse_id) {
      countSql += ` AND p.primary_warehouse_id = ?`;
      countParams.push(warehouse_id);
    }
    if (brand) {
      countSql += ` AND p.brand LIKE ?`;
      countParams.push(`%${brand.trim()}%`);
    }
    if (low_stock === 'true' || low_stock === '1') {
      countSql += ` AND p.quantity <= p.reorder_level`;
    }

    const countRow = await get(countSql, countParams);

    res.json({
      products,
      pagination: {
        total: countRow ? countRow.total : 0,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil((countRow ? countRow.total : 0) / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products catalog.' });
  }
});

/**
 * GET /api/products/:id
 * Single product with warehouse stock distribution & movement audit history
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const product = await get(`
      SELECT p.*, c.name as category_name, c.code as category_code, w.name as primary_warehouse_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN warehouses w ON p.primary_warehouse_id = w.id
      WHERE p.id = ?
    `, [req.params.id]);

    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    // Warehouse stock breakdown
    const warehouseStock = await all(`
      SELECT pws.*, w.name as warehouse_name, w.code as warehouse_code
      FROM product_warehouse_stock pws
      JOIN warehouses w ON pws.warehouse_id = w.id
      WHERE pws.product_id = ?
    `, [req.params.id]);

    // Stock movement history
    const stockHistory = await all(`
      SELECT sm.*, 
             w1.name as source_warehouse_name, 
             w2.name as target_warehouse_name,
             u.name as user_name
      FROM stock_movements sm
      LEFT JOIN warehouses w1 ON sm.source_warehouse_id = w1.id
      LEFT JOIN warehouses w2 ON sm.target_warehouse_id = w2.id
      LEFT JOIN users u ON sm.performed_by = u.id
      WHERE sm.product_id = ?
      ORDER BY sm.created_at DESC
      LIMIT 20
    `, [req.params.id]);

    res.json({
      product,
      warehouse_stock: warehouseStock,
      stock_history: stockHistory
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch product details.' });
  }
});

/**
 * POST /api/products
 * Create new product
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    let {
      sku,
      barcode,
      name,
      category_id,
      brand,
      cost_price,
      selling_price,
      quantity,
      reorder_level,
      unit,
      warehouse_location,
      primary_warehouse_id
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Product name is required.' });
    }

    // Auto-generate SKU / Barcode if not provided
    if (!sku) {
      let catCode = 'GEN';
      if (category_id) {
        const cat = await get('SELECT code FROM categories WHERE id = ?', [category_id]);
        if (cat) catCode = cat.code;
      }
      sku = generateSKU(catCode);
    }

    if (!barcode) {
      barcode = generateBarcode();
    }

    const costPriceNum = parseFloat(cost_price) || 0;
    const sellPriceNum = parseFloat(selling_price) || 0;
    const qtyNum = parseInt(quantity, 10) || 0;
    const reorderNum = parseInt(reorder_level, 10) || 10;

    const result = await run(`
      INSERT INTO products 
      (sku, barcode, name, category_id, brand, cost_price, selling_price, quantity, reorder_level, unit, warehouse_location, primary_warehouse_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      sku.trim().toUpperCase(),
      barcode.trim(),
      name.trim(),
      category_id || null,
      brand ? brand.trim() : '',
      costPriceNum,
      sellPriceNum,
      qtyNum,
      reorderNum,
      unit || 'pcs',
      warehouse_location || 'A-01-01',
      primary_warehouse_id || null
    ]);

    const newProdId = result.lastID;

    // Record stock in primary warehouse if specified
    if (primary_warehouse_id) {
      await run(`
        INSERT INTO product_warehouse_stock (product_id, warehouse_id, quantity)
        VALUES (?, ?, ?)
        ON CONFLICT(product_id, warehouse_id) DO UPDATE SET quantity = ?
      `, [newProdId, primary_warehouse_id, qtyNum, qtyNum]);
    }

    // Log initial stock creation movement if qty > 0
    if (qtyNum > 0) {
      const refNo = `SM-INIT-${Date.now()}`;
      await run(`
        INSERT INTO stock_movements 
        (reference_no, movement_type, product_id, target_warehouse_id, quantity, unit_cost, reason, performed_by)
        VALUES (?, 'IN', ?, ?, ?, ?, 'Initial Product Catalog Setup', ?)
      `, [refNo, newProdId, primary_warehouse_id || null, qtyNum, costPriceNum, req.user.id]);
    }

    const createdProduct = await get('SELECT * FROM products WHERE id = ?', [newProdId]);
    res.status(201).json({ message: 'Product created successfully', product: createdProduct });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Product SKU or Barcode already exists in inventory.' });
    }
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Failed to create product.' });
  }
});

/**
 * PUT /api/products/:id
 * Update product info
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const prodId = req.params.id;
    const {
      sku,
      barcode,
      name,
      category_id,
      brand,
      cost_price,
      selling_price,
      quantity,
      reorder_level,
      unit,
      warehouse_location,
      primary_warehouse_id
    } = req.body;

    const existing = await get('SELECT * FROM products WHERE id = ?', [prodId]);
    if (!existing) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const costPriceNum = parseFloat(cost_price) !== undefined ? parseFloat(cost_price) : existing.cost_price;
    const sellPriceNum = parseFloat(selling_price) !== undefined ? parseFloat(selling_price) : existing.selling_price;
    const qtyNum = parseInt(quantity, 10) !== undefined ? parseInt(quantity, 10) : existing.quantity;
    const reorderNum = parseInt(reorder_level, 10) !== undefined ? parseInt(reorder_level, 10) : existing.reorder_level;

    await run(`
      UPDATE products 
      SET sku = ?, barcode = ?, name = ?, category_id = ?, brand = ?, cost_price = ?, selling_price = ?, quantity = ?, reorder_level = ?, unit = ?, warehouse_location = ?, primary_warehouse_id = ?
      WHERE id = ?
    `, [
      sku ? sku.trim().toUpperCase() : existing.sku,
      barcode ? barcode.trim() : existing.barcode,
      name ? name.trim() : existing.name,
      category_id || existing.category_id,
      brand !== undefined ? brand.trim() : existing.brand,
      costPriceNum,
      sellPriceNum,
      qtyNum,
      reorderNum,
      unit || existing.unit,
      warehouse_location || existing.warehouse_location,
      primary_warehouse_id || existing.primary_warehouse_id,
      prodId
    ]);

    // Update primary warehouse stock
    const targetWhId = primary_warehouse_id || existing.primary_warehouse_id;
    if (targetWhId) {
      await run(`
        INSERT INTO product_warehouse_stock (product_id, warehouse_id, quantity)
        VALUES (?, ?, ?)
        ON CONFLICT(product_id, warehouse_id) DO UPDATE SET quantity = ?
      `, [prodId, targetWhId, qtyNum, qtyNum]);
    }

    const updated = await get('SELECT * FROM products WHERE id = ?', [prodId]);
    res.json({ message: 'Product updated successfully', product: updated });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Product SKU or Barcode already exists.' });
    }
    res.status(500).json({ error: 'Failed to update product.' });
  }
});

/**
 * DELETE /api/products/:id
 * Delete product (Admin only)
 */
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const prodId = req.params.id;
    await run('DELETE FROM products WHERE id = ?', [prodId]);
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete product.' });
  }
});

module.exports = router;
