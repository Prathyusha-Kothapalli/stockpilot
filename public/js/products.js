/**
 * StockPilot - Products Matrix & Catalog Controller
 */

let currentProductsList = [];

async function loadProducts() {
  const search = document.getElementById('prod-search-input')?.value || '';
  const categoryId = document.getElementById('prod-category-filter')?.value || '';
  const warehouseId = document.getElementById('prod-warehouse-filter')?.value || '';
  const lowStock = document.getElementById('prod-lowstock-filter')?.checked ? 'true' : '';
  const sortBy = document.getElementById('prod-sort-by')?.value || 'created_at';

  let url = `/api/products?sort_by=${sortBy}&sort_dir=DESC`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  if (categoryId) url += `&category_id=${categoryId}`;
  if (warehouseId) url += `&warehouse_id=${warehouseId}`;
  if (lowStock) url += `&low_stock=true`;

  try {
    const data = await apiFetch(url);
    if (!data) return;

    currentProductsList = data.products || [];
    renderProductsTable(currentProductsList);
  } catch (error) {
    showToast('Failed to load products', 'error');
  }
}

function renderProductsTable(products) {
  const tbody = document.getElementById('products-table-body');
  if (!tbody) return;

  if (products.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-muted); padding: 2rem;">No products match current filters.</td></tr>`;
    return;
  }

  tbody.innerHTML = products.map(p => {
    const isLow = p.quantity <= p.reorder_level;
    const isOut = p.quantity === 0;

    let statusBadge = `<span class="badge badge-normalstock">Normal (${p.quantity})</span>`;
    if (isOut) {
      statusBadge = `<span class="badge badge-lowstock" style="background: rgba(244,63,94,0.3);">OUT OF STOCK</span>`;
    } else if (isLow) {
      statusBadge = `<span class="badge badge-lowstock">Low Stock (${p.quantity})</span>`;
    }

    return `
      <tr>
        <td>
          <div style="font-weight: 700; color: var(--accent-primary); font-family: monospace;">${p.sku}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace;">Barcode: ${p.barcode}</div>
        </td>
        <td>
          <div style="font-weight: 600;">${escapeHtml(p.name)}</div>
        </td>
        <td><span class="badge" style="background: rgba(255,255,255,0.06);">${escapeHtml(p.category_name || 'Unassigned')}</span></td>
        <td>${escapeHtml(p.brand || 'N/A')}</td>
        <td>$${p.cost_price.toFixed(2)}</td>
        <td><strong>$${p.selling_price.toFixed(2)}</strong></td>
        <td><strong style="font-size: 1rem;">${p.quantity}</strong> <span style="font-size: 0.75rem; color: var(--text-muted);">${p.unit || 'pcs'}</span></td>
        <td>${statusBadge}</td>
        <td><span style="font-size: 0.8rem; color: var(--text-secondary);">${escapeHtml(p.warehouse_location || 'A-01-01')}</span></td>
        <td style="text-align: right;">
          <button class="btn btn-secondary btn-sm" onclick="viewProductHistory(${p.id})">History</button>
          <button class="btn btn-secondary btn-sm" onclick="editProduct(${p.id})">Edit</button>
          ${currentUser && currentUser.role === 'admin' ? `<button class="btn btn-rose btn-sm" onclick="deleteProduct(${p.id})">Delete</button>` : ''}
        </td>
      </tr>
    `;
  }).join('');
}

async function saveProduct(e) {
  e.preventDefault();
  const id = document.getElementById('prod-id').value;

  const payload = {
    sku: document.getElementById('form-prod-sku').value,
    barcode: document.getElementById('form-prod-barcode').value,
    name: document.getElementById('form-prod-name').value,
    category_id: document.getElementById('form-prod-category').value || null,
    brand: document.getElementById('form-prod-brand').value,
    cost_price: parseFloat(document.getElementById('form-prod-cost').value) || 0,
    selling_price: parseFloat(document.getElementById('form-prod-sell').value) || 0,
    quantity: parseInt(document.getElementById('form-prod-qty').value, 10) || 0,
    reorder_level: parseInt(document.getElementById('form-prod-reorder').value, 10) || 10,
    unit: document.getElementById('form-prod-unit').value || 'pcs',
    primary_warehouse_id: document.getElementById('form-prod-warehouse').value || null,
    warehouse_location: document.getElementById('form-prod-location').value || 'A-01-01'
  };

  try {
    const url = id ? `/api/products/${id}` : '/api/products';
    const method = id ? 'PUT' : 'POST';

    const res = await apiFetch(url, { method, body: payload });
    if (res) {
      showToast(id ? 'Product updated successfully!' : 'Product created successfully!', 'success');
      closeModal('modal-product');
      document.getElementById('form-product').reset();
      loadProducts();
      if (typeof loadDashboardData === 'function') loadDashboardData();
    }
  } catch (error) {
    showToast('Error saving product', 'error');
  }
}

function editProduct(id) {
  const p = currentProductsList.find(x => x.id === id);
  if (!p) return;

  document.getElementById('modal-product-title').innerText = 'Edit Product Catalog Item';
  document.getElementById('prod-id').value = p.id;
  document.getElementById('form-prod-sku').value = p.sku;
  document.getElementById('form-prod-barcode').value = p.barcode;
  document.getElementById('form-prod-name').value = p.name;
  document.getElementById('form-prod-category').value = p.category_id || '';
  document.getElementById('form-prod-brand').value = p.brand || '';
  document.getElementById('form-prod-cost').value = p.cost_price;
  document.getElementById('form-prod-sell').value = p.selling_price;
  document.getElementById('form-prod-qty').value = p.quantity;
  document.getElementById('form-prod-reorder').value = p.reorder_level;
  document.getElementById('form-prod-unit').value = p.unit || 'pcs';
  document.getElementById('form-prod-warehouse').value = p.primary_warehouse_id || '';
  document.getElementById('form-prod-location').value = p.warehouse_location || 'A-01-01';

  openModal('modal-product');
}

async function viewProductHistory(id) {
  try {
    const data = await apiFetch(`/api/products/${id}`);
    if (!data) return;

    const p = data.product;
    document.getElementById('history-modal-title').innerText = `Stock History: ${p.name} (${p.sku})`;
    document.getElementById('history-stock-summary').innerHTML = `
      <strong>Current Quantity:</strong> ${p.quantity} ${p.unit || 'pcs'} | 
      <strong>Reorder Level:</strong> ${p.reorder_level} | 
      <strong>Cost:</strong> $${p.cost_price.toFixed(2)} | 
      <strong>Selling Price:</strong> $${p.selling_price.toFixed(2)}
    `;

    const tbody = document.getElementById('history-table-body');
    const history = data.stock_history || [];

    if (history.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No stock movement logs recorded.</td></tr>`;
    } else {
      tbody.innerHTML = history.map(h => `
        <tr>
          <td style="font-family: monospace; font-size: 0.8rem;">${h.reference_no}</td>
          <td><span class="badge badge-${h.movement_type.toLowerCase()}">${h.movement_type}</span></td>
          <td><strong>${h.quantity}</strong></td>
          <td>${h.source_warehouse_name ? h.source_warehouse_name + ' &rarr; ' : ''}${h.target_warehouse_name || 'System'}</td>
          <td>${h.user_name || 'System'}</td>
          <td style="font-size: 0.75rem; color: var(--text-muted);">${new Date(h.created_at).toLocaleString()}</td>
        </tr>
      `).join('');
    }

    openModal('modal-product-history');
  } catch (error) {
    showToast('Failed to load product history', 'error');
  }
}

async function deleteProduct(id) {
  if (!confirm('Are you sure you want to permanently delete this product?')) return;
  try {
    const res = await apiFetch(`/api/products/${id}`, { method: 'DELETE' });
    if (res) {
      showToast('Product deleted', 'success');
      loadProducts();
    }
  } catch (error) {
    showToast('Failed to delete product', 'error');
  }
}

function filterLowStockOnly() {
  const chk = document.getElementById('prod-lowstock-filter');
  if (chk) {
    chk.checked = true;
    loadProducts();
  }
}
