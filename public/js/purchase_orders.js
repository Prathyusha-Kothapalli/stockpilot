/**
 * StockPilot - Purchase Order Workflow Controller
 */

async function loadPurchaseOrders() {
  const statusFilter = document.getElementById('po-status-filter')?.value || '';
  let url = '/api/purchase-orders';
  if (statusFilter) url += `?status=${statusFilter}`;

  try {
    const data = await apiFetch(url);
    if (!data) return;

    renderPOTable(data.purchase_orders || []);
  } catch (error) {
    showToast('Failed to load purchase orders', 'error');
  }
}

function renderPOTable(orders) {
  const tbody = document.getElementById('po-table-body');
  if (!tbody) return;

  if (orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2rem;">No purchase orders match current filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = orders.map(po => {
    let actionBtn = '';
    const isAdmin = currentUser && currentUser.role === 'admin';

    if (po.status === 'Draft') {
      actionBtn = `<button class="btn btn-secondary btn-sm" onclick="updatePOStatus(${po.id}, 'Submitted')">Submit for Approval</button>`;
    } else if (po.status === 'Submitted') {
      if (isAdmin) {
        actionBtn = `<button class="btn btn-primary btn-sm" onclick="updatePOStatus(${po.id}, 'Approved')">Approve PO</button>`;
      } else {
        actionBtn = `<span style="font-size: 0.8rem; color: var(--text-muted);">Awaiting Admin Approval</span>`;
      }
    } else if (po.status === 'Approved') {
      actionBtn = `<button class="btn btn-emerald btn-sm" onclick="updatePOStatus(${po.id}, 'Received')">Receive Stock</button>`;
    } else if (po.status === 'Received') {
      actionBtn = `<span style="font-size: 0.8rem; color: var(--accent-emerald); font-weight: 600;">✓ Fulfilled</span>`;
    }

    return `
      <tr>
        <td><strong style="font-family: monospace; color: var(--accent-primary);">${po.po_number}</strong></td>
        <td>${escapeHtml(po.supplier_name || 'N/A')}</td>
        <td>${escapeHtml(po.warehouse_name || 'Central Facility')}</td>
        <td><strong style="font-size: 0.95rem;">$${(po.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></td>
        <td><span class="badge status-${po.status.toLowerCase()}">${po.status}</span></td>
        <td>${po.expected_delivery ? po.expected_delivery : 'Standard'}</td>
        <td><span class="badge" style="background: rgba(255,255,255,0.06);">${po.line_item_count || 1} Items</span></td>
        <td style="text-align: right;">${actionBtn}</td>
      </tr>
    `;
  }).join('');
}

function addPoLineItem() {
  const tbody = document.getElementById('po-items-rows');
  if (!tbody) return;

  const products = currentProductsList || [];
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>
      <select class="form-control po-item-prod" style="width: 100%;" required>
        <option value="">Select Product</option>
        ${products.map(p => `<option value="${p.id}" data-cost="${p.cost_price}">${escapeHtml(p.name)} ($${p.cost_price.toFixed(2)})</option>`).join('')}
      </select>
    </td>
    <td><input type="number" class="form-control po-item-qty" value="20" min="1" required style="width: 100%;"></td>
    <td><input type="number" step="0.01" class="form-control po-item-cost" value="10.00" min="0" required style="width: 100%;"></td>
    <td style="text-align: center;">
      <button type="button" class="btn btn-rose btn-sm" onclick="this.closest('tr').remove()">&times;</button>
    </td>
  `;

  // Auto set unit cost on product select
  const sel = tr.querySelector('.po-item-prod');
  sel.addEventListener('change', (e) => {
    const opt = sel.options[sel.selectedIndex];
    const cost = opt.getAttribute('data-cost');
    if (cost) tr.querySelector('.po-item-cost').value = parseFloat(cost).toFixed(2);
  });

  tbody.appendChild(tr);
}

async function savePurchaseOrder(e) {
  e.preventDefault();
  const supplierId = document.getElementById('po-form-supplier').value;
  const warehouseId = document.getElementById('po-form-warehouse').value;
  const expectedDate = document.getElementById('po-form-date').value;

  const itemRows = document.querySelectorAll('#po-items-rows tr');
  const items = [];

  itemRows.forEach(row => {
    const prodId = row.querySelector('.po-item-prod').value;
    const qty = row.querySelector('.po-item-qty').value;
    const cost = row.querySelector('.po-item-cost').value;
    if (prodId && qty) {
      items.push({
        product_id: parseInt(prodId, 10),
        quantity_ordered: parseInt(qty, 10),
        unit_cost: parseFloat(cost) || 0
      });
    }
  });

  if (items.length === 0) {
    showToast('Please add at least one line item to the PO', 'error');
    return;
  }

  try {
    const res = await apiFetch('/api/purchase-orders', {
      method: 'POST',
      body: {
        supplier_id: supplierId,
        warehouse_id: warehouseId,
        expected_delivery: expectedDate,
        items
      }
    });

    if (res) {
      showToast('Purchase Order created successfully!', 'success');
      closeModal('modal-po-builder');
      document.getElementById('form-po-builder').reset();
      document.getElementById('po-items-rows').innerHTML = '';
      loadPurchaseOrders();
      if (typeof loadDashboardData === 'function') loadDashboardData();
    }
  } catch (error) {
    showToast('Failed to create Purchase Order', 'error');
  }
}

async function updatePOStatus(id, newStatus) {
  try {
    const res = await apiFetch(`/api/purchase-orders/${id}/status`, {
      method: 'PUT',
      body: { status: newStatus }
    });

    if (res) {
      showToast(`PO status updated to ${newStatus}`, 'success');
      loadPurchaseOrders();
      if (typeof loadProducts === 'function') loadProducts();
      if (typeof loadDashboardData === 'function') loadDashboardData();
    }
  } catch (error) {
    showToast(error.message || 'Failed to update PO status', 'error');
  }
}
