/**
 * StockPilot - Supplier Directory Controller
 */

async function loadSuppliers() {
  try {
    const data = await apiFetch('/api/suppliers');
    if (!data) return;

    renderSuppliersGrid(data.suppliers || []);
    populateSupplierDropdowns(data.suppliers || []);
  } catch (error) {
    showToast('Failed to load suppliers', 'error');
  }
}

function renderSuppliersGrid(suppliers) {
  const container = document.getElementById('suppliers-grid');
  if (!container) return;

  if (suppliers.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; color: var(--text-muted);">No suppliers registered.</div>`;
    return;
  }

  container.innerHTML = suppliers.map(s => `
    <div class="card" style="display: flex; flex-direction: column; justify-content: space-between;">
      <div>
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
          <span class="badge" style="background: rgba(99,102,241,0.15); color: var(--accent-primary); font-family: monospace;">${s.code}</span>
          <span style="color: var(--accent-amber); font-weight: 700;">★ ${s.rating.toFixed(1)}</span>
        </div>
        <h3 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 0.25rem;">${escapeHtml(s.name)}</h3>
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">Contact: ${escapeHtml(s.contact_person || 'N/A')}</p>
        
        <div style="font-size: 0.825rem; color: var(--text-secondary); display: flex; flex-direction: column; gap: 0.25rem; margin-bottom: 1rem;">
          <div>📧 ${escapeHtml(s.email || 'N/A')}</div>
          <div>📞 ${escapeHtml(s.phone || 'N/A')}</div>
          <div>📍 ${escapeHtml(s.address || 'N/A')}</div>
        </div>
      </div>

      <div style="padding-top: 1rem; border-top: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between;">
        <span style="font-size: 0.8rem; color: var(--text-muted);">${s.total_orders || 0} Purchase Orders</span>
        <button class="btn btn-secondary btn-sm" onclick="editSupplier(${s.id})">Edit</button>
      </div>
    </div>
  `).join('');
}

function populateSupplierDropdowns(suppliers) {
  const poDropdown = document.getElementById('po-form-supplier');
  if (poDropdown) {
    poDropdown.innerHTML = `<option value="">Select Supplier</option>` + suppliers.map(s => `
      <option value="${s.id}">${escapeHtml(s.name)} (${s.code})</option>
    `).join('');
  }
}

async function saveSupplier(e) {
  e.preventDefault();
  const payload = {
    name: document.getElementById('sup-form-name').value,
    code: document.getElementById('sup-form-code').value,
    contact_person: document.getElementById('sup-form-contact').value,
    email: document.getElementById('sup-form-email').value,
    phone: document.getElementById('sup-form-phone').value
  };

  try {
    const res = await apiFetch('/api/suppliers', { method: 'POST', body: payload });
    if (res) {
      showToast('Supplier added successfully!', 'success');
      closeModal('modal-supplier');
      document.getElementById('form-supplier').reset();
      loadSuppliers();
    }
  } catch (error) {
    showToast('Failed to save supplier', 'error');
  }
}
