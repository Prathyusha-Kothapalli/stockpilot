/**
 * StockPilot - Multi-Warehouse Facilities Controller
 */

async function loadWarehouses() {
  try {
    const data = await apiFetch('/api/warehouses');
    if (!data) return;

    renderWarehousesGrid(data.warehouses || []);
    populateWarehouseDropdowns(data.warehouses || []);
  } catch (error) {
    showToast('Failed to load warehouses', 'error');
  }
}

function renderWarehousesGrid(warehouses) {
  const container = document.getElementById('warehouses-grid');
  if (!container) return;

  if (warehouses.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; color: var(--text-muted);">No warehouse facilities registered.</div>`;
    return;
  }

  container.innerHTML = warehouses.map(w => {
    const pct = Math.min(100, w.utilization_rate || 0);
    let progressColor = 'var(--accent-emerald)';
    if (pct > 80) progressColor = 'var(--accent-amber)';
    if (pct > 95) progressColor = 'var(--accent-rose)';

    return `
      <div class="card">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
          <span class="badge" style="background: rgba(6,182,212,0.15); color: var(--accent-cyan); font-family: monospace;">${w.code}</span>
          <span style="font-size: 0.8rem; color: var(--text-muted);">Manager: ${escapeHtml(w.manager_name || 'Unassigned')}</span>
        </div>
        <h3 style="font-size: 1.2rem; font-weight: 700; margin-bottom: 0.25rem;">${escapeHtml(w.name)}</h3>
        <p style="font-size: 0.825rem; color: var(--text-secondary); margin-bottom: 1.25rem;">📍 ${escapeHtml(w.address || 'N/A')}</p>

        <!-- Capacity Gauge Bar -->
        <div style="margin-bottom: 1rem;">
          <div style="display: flex; justify-content: space-between; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.35rem;">
            <span>Capacity Utilization</span>
            <span style="color: ${progressColor};">${pct}% (${(w.total_items || 0).toLocaleString()} / ${w.capacity.toLocaleString()} units)</span>
          </div>
          <div style="width: 100%; height: 8px; background: rgba(255,255,255,0.06); border-radius: var(--radius-full); overflow: hidden;">
            <div style="width: ${pct}%; height: 100%; background: ${progressColor}; transition: width 0.4s ease;"></div>
          </div>
        </div>

        <div style="padding-top: 1rem; border-top: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between;">
          <span style="font-size: 0.8rem; color: var(--text-muted);">${w.total_products || 0} Distinct SKUs</span>
          <button class="btn btn-secondary btn-sm" onclick="viewWarehouseDetail(${w.id})">Stock Listing</button>
        </div>
      </div>
    `;
  }).join('');
}

function populateWarehouseDropdowns(warehouses) {
  const selects = [
    'prod-warehouse-filter',
    'form-prod-warehouse',
    'wizard-source-wh',
    'wizard-target-wh',
    'po-form-warehouse'
  ];

  selects.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      const firstOpt = id.includes('filter') ? '<option value="">All Warehouses</option>' : '<option value="">Select Warehouse</option>';
      el.innerHTML = firstOpt + warehouses.map(w => `<option value="${w.id}">${escapeHtml(w.name)} (${w.code})</option>`).join('');
    }
  });
}

async function saveWarehouse(e) {
  e.preventDefault();
  const payload = {
    name: document.getElementById('wh-form-name').value,
    code: document.getElementById('wh-form-code').value,
    manager_name: document.getElementById('wh-form-manager').value,
    capacity: parseInt(document.getElementById('wh-form-capacity').value, 10) || 10000,
    address: document.getElementById('wh-form-address').value
  };

  try {
    const res = await apiFetch('/api/warehouses', { method: 'POST', body: payload });
    if (res) {
      showToast('Warehouse facility created!', 'success');
      closeModal('modal-warehouse');
      document.getElementById('form-warehouse').reset();
      loadWarehouses();
    }
  } catch (error) {
    showToast('Failed to create warehouse', 'error');
  }
}

async function viewWarehouseDetail(id) {
  try {
    const data = await apiFetch(`/api/warehouses/${id}`);
    if (!data) return;

    const wh = data.warehouse;
    const stock = data.stock || [];

    document.getElementById('history-modal-title').innerText = `Warehouse Inventory: ${wh.name}`;
    document.getElementById('history-stock-summary').innerHTML = `
      <strong>Code:</strong> ${wh.code} | 
      <strong>Manager:</strong> ${wh.manager_name || 'N/A'} | 
      <strong>Capacity:</strong> ${wh.capacity.toLocaleString()} units
    `;

    const tbody = document.getElementById('history-table-body');
    if (stock.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No stock items currently stored in this warehouse facility.</td></tr>`;
    } else {
      tbody.innerHTML = stock.map(s => `
        <tr>
          <td style="font-family: monospace; font-size: 0.8rem; font-weight: 700;">${s.sku}</td>
          <td>${escapeHtml(s.name)}</td>
          <td><strong style="font-size: 1rem; color: var(--accent-cyan);">${s.quantity}</strong> ${s.unit || 'pcs'}</td>
          <td>$${s.cost_price.toFixed(2)}</td>
          <td>$${s.selling_price.toFixed(2)}</td>
          <td>${s.category_name || 'Unassigned'}</td>
        </tr>
      `).join('');
    }

    openModal('modal-product-history');
  } catch (error) {
    showToast('Failed to fetch warehouse details', 'error');
  }
}
