/**
 * StockPilot - Stock Movement & Transactions Controller
 */

async function loadStockMovements() {
  try {
    const data = await apiFetch('/api/stock/movements?limit=100');
    if (!data) return;

    renderStockMovementsTable(data.movements || []);
  } catch (error) {
    showToast('Failed to load stock movements', 'error');
  }
}

function renderStockMovementsTable(movements) {
  const tbody = document.getElementById('stock-movements-table');
  const dashBody = document.getElementById('dash-recent-movements');

  if (tbody) {
    if (movements.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 2rem;">No stock transactions logged yet.</td></tr>`;
    } else {
      tbody.innerHTML = movements.map(m => `
        <tr>
          <td style="font-family: monospace; font-size: 0.8rem; font-weight: 700;">${m.reference_no}</td>
          <td><span class="badge badge-${m.movement_type.toLowerCase()}">${m.movement_type}</span></td>
          <td>
            <div style="font-weight: 600;">${escapeHtml(m.product_name)}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace;">${m.product_sku}</div>
          </td>
          <td><strong style="font-size: 1rem;">${m.quantity}</strong> <span style="font-size: 0.75rem; color: var(--text-muted);">${m.product_unit || 'pcs'}</span></td>
          <td>${escapeHtml(m.source_warehouse_name || '—')}</td>
          <td>${escapeHtml(m.target_warehouse_name || '—')}</td>
          <td><span style="font-size: 0.85rem; color: var(--text-secondary);">${escapeHtml(m.reason || 'N/A')}</span></td>
          <td>${escapeHtml(m.user_name || 'System')}</td>
          <td style="font-size: 0.75rem; color: var(--text-muted);">${new Date(m.created_at).toLocaleString()}</td>
        </tr>
      `).join('');
    }
  }

  if (dashBody) {
    const recent = movements.slice(0, 5);
    if (recent.length === 0) {
      dashBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">No activity logged.</td></tr>`;
    } else {
      dashBody.innerHTML = recent.map(m => `
        <tr>
          <td style="font-family: monospace; font-size: 0.8rem;">${m.reference_no}</td>
          <td><span class="badge badge-${m.movement_type.toLowerCase()}">${m.movement_type}</span></td>
          <td><strong>${escapeHtml(m.product_name)}</strong></td>
          <td><strong>${m.quantity}</strong></td>
          <td>${m.source_warehouse_name ? m.source_warehouse_name + ' &rarr; ' : ''}${m.target_warehouse_name || 'System'}</td>
          <td>${escapeHtml(m.user_name || 'Admin')}</td>
          <td style="font-size: 0.75rem; color: var(--text-muted);">${new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
        </tr>
      `).join('');
    }
  }
}

function toggleWizardFields() {
  const type = document.getElementById('wizard-op-type').value;
  const srcGroup = document.getElementById('wizard-source-wh-group');
  const tgtGroup = document.getElementById('wizard-target-wh-group');
  const qtyLabel = document.getElementById('wizard-qty-label');

  if (type === 'IN') {
    srcGroup.style.display = 'none';
    tgtGroup.style.display = 'block';
    qtyLabel.innerText = 'Quantity to Receive *';
  } else if (type === 'OUT') {
    srcGroup.style.display = 'block';
    tgtGroup.style.display = 'none';
    qtyLabel.innerText = 'Quantity to Dispatch *';
  } else if (type === 'TRANSFER') {
    srcGroup.style.display = 'block';
    tgtGroup.style.display = 'block';
    qtyLabel.innerText = 'Quantity to Transfer *';
  } else if (type === 'ADJUSTMENT') {
    srcGroup.style.display = 'none';
    tgtGroup.style.display = 'block';
    qtyLabel.innerText = 'New Actual Quantity Count *';
  }
}

function populateWizardProducts(products) {
  const sel = document.getElementById('wizard-product');
  if (sel) {
    sel.innerHTML = `<option value="">Select Product</option>` + products.map(p => `
      <option value="${p.id}">${escapeHtml(p.name)} (${p.sku}) — Stock: ${p.quantity}</option>
    `).join('');
  }
}

async function processStockWizard(e) {
  e.preventDefault();
  const type = document.getElementById('wizard-op-type').value;
  const productId = document.getElementById('wizard-product').value;
  const srcWh = document.getElementById('wizard-source-wh').value;
  const tgtWh = document.getElementById('wizard-target-wh').value;
  const quantity = document.getElementById('wizard-quantity').value;
  const reason = document.getElementById('wizard-reason').value;

  if (!productId || !quantity) {
    showToast('Please select product and quantity', 'error');
    return;
  }

  let endpoint = '/api/stock/in';
  let payload = {};

  if (type === 'IN') {
    endpoint = '/api/stock/in';
    payload = { product_id: productId, warehouse_id: tgtWh, quantity, reason };
  } else if (type === 'OUT') {
    endpoint = '/api/stock/out';
    payload = { product_id: productId, warehouse_id: srcWh, quantity, reason };
  } else if (type === 'TRANSFER') {
    endpoint = '/api/stock/transfer';
    payload = { product_id: productId, source_warehouse_id: srcWh, target_warehouse_id: tgtWh, quantity, reason };
  } else if (type === 'ADJUSTMENT') {
    endpoint = '/api/stock/adjust';
    payload = { product_id: productId, warehouse_id: tgtWh, new_quantity: quantity, reason };
  }

  try {
    const res = await apiFetch(endpoint, { method: 'POST', body: payload });
    if (res) {
      showToast(res.message || 'Transaction processed successfully!', 'success');
      closeModal('modal-stock-wizard');
      document.getElementById('form-stock-wizard').reset();
      loadStockMovements();
      if (typeof loadProducts === 'function') loadProducts();
      if (typeof loadDashboardData === 'function') loadDashboardData();
    }
  } catch (error) {
    showToast(error.message || 'Failed to process stock transaction', 'error');
  }
}
