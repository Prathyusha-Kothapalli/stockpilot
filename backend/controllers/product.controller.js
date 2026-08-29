/**
 * StockPilot ERP - Product Catalog Controller
 * Manages product lifecycle, SKU/Barcode generation, multi-criteria search,
 * warehouse inventory filtering, price margin calculations, reorder alerts,
 * and paginated matrix view queries.
 */

const { all, get, run } = require('../db/database');
const InventoryEngine = require('../models/inventory_engine');
const BarcodingService = require('../services/barcoding_service');

class ProductController {
  /**
   * Generate SKU Code based on Category Code
   */
  static generateSKU(categoryCode = 'GEN') {
    const cleanCode = categoryCode.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 4) || 'GEN';
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    return `SKU-${cleanCode}-${randomNum}`;
  }

  /**
   * Generate EAN-13 Barcode
   */
  static generateBarcode() {
    return BarcodingService.generateEAN13Barcode('890');
  }

  /**
   * GET /api/products/generate-sku
   */
  static async handleGenerateSKU(req, res) {
    try {
      const catCode = req.query.category_code || 'GEN';
      const sku = ProductController.generateSKU(catCode);
      const barcode = ProductController.generateBarcode();
      return res.json({ sku, barcode });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to generate SKU and Barcode.' });
    }
  }

  /**
   * GET /api/products
   * Search, filter, sort, and paginate product catalog matrix
   */
  static async listProducts(req, res) {
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
               (p.quantity * p.selling_price) as total_retail_value,
               (p.selling_price - p.cost_price) as unit_profit_margin,
               CASE 
                 WHEN p.selling_price > 0 THEN ROUND(((p.selling_price - p.cost_price) / p.selling_price) * 100, 1)
                 ELSE 0
               END as margin_percent
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

      const allowedSortCols = ['name', 'sku', 'quantity', 'cost_price', 'selling_price', 'reorder_level', 'created_at', 'brand'];
      const safeSortCol = allowedSortCols.includes(sort_by) ? `p.${sort_by}` : 'p.created_at';
      const safeSortDir = sort_dir.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      sql += ` ORDER BY ${safeSortCol} ${safeSortDir}`;

      const pageNum = parseInt(page, 10) || 1;
      const limitNum = parseInt(limit, 10) || 100;
      const offset = (pageNum - 1) * limitNum;

      sql += ` LIMIT ? OFFSET ?`;
      params.push(limitNum, offset);

      const products = await all(sql, params);

      // Pagination total count
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
      const totalCount = countRow ? countRow.total : 0;

      return res.json({
        products,
        pagination: {
          total: totalCount,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(totalCount / limitNum)
        }
      });
    } catch (error) {
      console.error('Error fetching product catalog:', error);
      return res.status(500).json({ error: 'Failed to fetch product matrix.' });
    }
  }

  /**
   * GET /api/products/:id
   * Single product with warehouse stock distribution & movement audit history
   */
  static async getProductById(req, res) {
    try {
      const prodId = req.params.id;
      const product = await get(`
        SELECT p.*, c.name as category_name, c.code as category_code, w.name as primary_warehouse_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN warehouses w ON p.primary_warehouse_id = w.id
        WHERE p.id = ?
      `, [prodId]);

      if (!product) {
        return res.status(404).json({ error: 'Product catalog item not found.' });
      }

      const warehouseStock = await all(`
        SELECT pws.*, w.name as warehouse_name, w.code as warehouse_code, w.address as warehouse_address
        FROM product_warehouse_stock pws
        JOIN warehouses w ON pws.warehouse_id = w.id
        WHERE pws.product_id = ?
      `, [prodId]);

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
        LIMIT 25
      `, [prodId]);

      const recommendedEOQ = InventoryEngine.calculateEOQ(product.quantity * 4, 50, 0.20, product.cost_price);

      return res.json({
        product,
        warehouse_stock: warehouseStock,
        stock_history: stockHistory,
        analytics: {
          recommended_eoq: recommendedEOQ,
          cost_valuation: Math.round((product.quantity * product.cost_price) * 100) / 100,
          retail_valuation: Math.round((product.quantity * product.selling_price) * 100) / 100
        }
      });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to fetch product details.' });
    }
  }

  /**
   * POST /api/products
   * Create new product catalog entry
   */
  static async createProduct(req, res) {
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

      if (!name || name.trim() === '') {
        return res.status(400).json({ error: 'Product name is required.' });
      }

      if (!sku || sku.trim() === '') {
        let catCode = 'GEN';
        if (category_id) {
          const cat = await get('SELECT code FROM categories WHERE id = ?', [category_id]);
          if (cat) catCode = cat.code;
        }
        sku = ProductController.generateSKU(catCode);
      }

      if (!barcode || barcode.trim() === '') {
        barcode = ProductController.generateBarcode();
      }

      const costPriceNum = Math.max(0, parseFloat(cost_price) || 0);
      const sellPriceNum = Math.max(0, parseFloat(selling_price) || 0);
      const qtyNum = Math.max(0, parseInt(quantity, 10) || 0);
      const reorderNum = Math.max(0, parseInt(reorder_level, 10) || 10);

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

      if (primary_warehouse_id) {
        await run(`
          INSERT INTO product_warehouse_stock (product_id, warehouse_id, quantity)
          VALUES (?, ?, ?)
          ON CONFLICT(product_id, warehouse_id) DO UPDATE SET quantity = ?
        `, [newProdId, primary_warehouse_id, qtyNum, qtyNum]);
      }

      if (qtyNum > 0) {
        const refNo = `SM-INIT-${Date.now()}`;
        await run(`
          INSERT INTO stock_movements 
          (reference_no, movement_type, product_id, target_warehouse_id, quantity, unit_cost, reason, performed_by)
          VALUES (?, 'IN', ?, ?, ?, ?, 'Initial Product Catalog Registration', ?)
        `, [refNo, newProdId, primary_warehouse_id || null, qtyNum, costPriceNum, req.user.id]);
      }

      const createdProduct = await get('SELECT * FROM products WHERE id = ?', [newProdId]);
      return res.status(201).json({ message: 'Product created successfully', product: createdProduct });
    } catch (error) {
      if (error.message && error.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'Product SKU or Barcode already exists.' });
      }
      console.error('Error creating product:', error);
      return res.status(500).json({ error: 'Failed to create product.' });
    }
  }

  /**
   * PUT /api/products/:id
   * Update existing product
   */
  static async updateProduct(req, res) {
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
        category_id !== undefined ? category_id : existing.category_id,
        brand !== undefined ? brand.trim() : existing.brand,
        costPriceNum,
        sellPriceNum,
        qtyNum,
        reorderNum,
        unit || existing.unit,
        warehouse_location || existing.warehouse_location,
        primary_warehouse_id !== undefined ? primary_warehouse_id : existing.primary_warehouse_id,
        prodId
      ]);

      const targetWhId = primary_warehouse_id || existing.primary_warehouse_id;
      if (targetWhId) {
        await run(`
          INSERT INTO product_warehouse_stock (product_id, warehouse_id, quantity)
          VALUES (?, ?, ?)
          ON CONFLICT(product_id, warehouse_id) DO UPDATE SET quantity = ?
        `, [prodId, targetWhId, qtyNum, qtyNum]);
      }

      const updated = await get('SELECT * FROM products WHERE id = ?', [prodId]);
      return res.json({ message: 'Product updated successfully', product: updated });
    } catch (error) {
      if (error.message && error.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'Product SKU or Barcode already exists.' });
      }
      return res.status(500).json({ error: 'Failed to update product.' });
    }
  }

  /**
   * DELETE /api/products/:id
   * Delete product (Admin only)
   */
  static async deleteProduct(req, res) {
    try {
      const prodId = req.params.id;
      const existing = await get('SELECT id FROM products WHERE id = ?', [prodId]);
      if (!existing) {
        return res.status(404).json({ error: 'Product not found.' });
      }

      await run('DELETE FROM products WHERE id = ?', [prodId]);
      return res.json({ message: 'Product deleted successfully' });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to delete product.' });
    }
  }
}

module.exports = ProductController;
