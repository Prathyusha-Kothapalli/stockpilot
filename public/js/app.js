/**
 * StockPilot - Main Application Controller & App Shell
 */

let authToken = localStorage.getItem('stockpilot_token') || null;
let currentUser = null;

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  setupEventListeners();
  checkAuth();
});

// Check Authentication Status
async function checkAuth() {
  if (!authToken) {
    showAuthOverlay();
    return;
  }

  try {
    const data = await apiFetch('/api/auth/me');
    if (data && data.user) {
      currentUser = data.user;
      hideAuthOverlay();
      updateUserUI();
      loadActiveTab('dashboard');
    } else {
      logout();
    }
  } catch (error) {
    logout();
  }
}

// Global API Fetch Helper
async function apiFetch(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  try {
    const response = await fetch(url, { ...options, headers: { ...headers, ...(options.body ? { 'Content-Type': 'application/json' } : {}) }, body: options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined });

    if (response.status === 401 || response.status === 403) {
      if (url !== '/api/auth/login') {
        showToast('Session expired. Please log in again.', 'warning');
        logout();
        return null;
      }
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Server error occurred.');
    }
    return data;
  } catch (error) {
    console.error('API Error:', error);
    showToast(error.message || 'Network request failed', 'error');
    throw error;
  }
}

// Event Listeners Setup
function setupEventListeners() {
  // Login form submit
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;

      try {
        const res = await apiFetch('/api/auth/login', {
          method: 'POST',
          body: { email, password }
        });

        if (res && res.token) {
          authToken = res.token;
          currentUser = res.user;
          localStorage.setItem('stockpilot_token', authToken);
          hideAuthOverlay();
          updateUserUI();
          showToast(`Welcome back, ${currentUser.name}!`, 'success');
          loadActiveTab('dashboard');
        }
      } catch (err) {
        // Error toast handled in apiFetch
      }
    });
  }

  // Logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);

  // Theme toggle button
  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      setTheme(current === 'dark' ? 'light' : 'dark');
    });
  }

  // Sidebar Nav Items
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = item.getAttribute('data-tab');
      if (tab) switchTab(tab);
    });
  });

  // Modal forms binding
  const formProd = document.getElementById('form-product');
  if (formProd) formProd.addEventListener('submit', saveProduct);

  const formWizard = document.getElementById('form-stock-wizard');
  if (formWizard) formWizard.addEventListener('submit', processStockWizard);

  const formPo = document.getElementById('form-po-builder');
  if (formPo) formPo.addEventListener('submit', savePurchaseOrder);

  const formCat = document.getElementById('form-category');
  if (formCat) formCat.addEventListener('submit', saveCategory);

  const formSup = document.getElementById('form-supplier');
  if (formSup) formSup.addEventListener('submit', saveSupplier);

  const formWh = document.getElementById('form-warehouse');
  if (formWh) formWh.addEventListener('submit', saveWarehouse);

  // Products filtering listeners
  const searchInp = document.getElementById('prod-search-input');
  if (searchInp) searchInp.addEventListener('input', debounce(loadProducts, 300));

  const catFil = document.getElementById('prod-category-filter');
  if (catFil) catFil.addEventListener('change', loadProducts);

  const whFil = document.getElementById('prod-warehouse-filter');
  if (whFil) whFil.addEventListener('change', loadProducts);

  const lowChk = document.getElementById('prod-lowstock-filter');
  if (lowChk) lowChk.addEventListener('change', loadProducts);

  const sortSel = document.getElementById('prod-sort-by');
  if (sortSel) sortSel.addEventListener('change', loadProducts);

  // PO status filter listener
  const poStatusFil = document.getElementById('po-status-filter');
  if (poStatusFil) poStatusFil.addEventListener('change', loadPurchaseOrders);
}

// Navigation Controller
function switchTab(tabId) {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-tab') === tabId);
  });

  document.querySelectorAll('.tab-view').forEach(view => {
    view.style.display = view.id === `tab-${tabId}` ? 'block' : 'none';
  });

  loadActiveTab(tabId);
}

function loadActiveTab(tabId) {
  if (tabId === 'dashboard') {
    loadDashboardData();
  } else if (tabId === 'products') {
    loadProducts();
    loadCategories();
    loadWarehouses();
  } else if (tabId === 'categories') {
    loadCategories();
  } else if (tabId === 'suppliers') {
    loadSuppliers();
  } else if (tabId === 'warehouses') {
    loadWarehouses();
  } else if (tabId === 'purchase-orders') {
    loadPurchaseOrders();
    loadSuppliers();
    loadWarehouses();
  } else if (tabId === 'stock-movements') {
    loadStockMovements();
    loadProducts();
    loadWarehouses();
  } else if (tabId === 'reports') {
    loadReportsData();
  }
}

// Modal Helpers
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('active');

  // Trigger dropdown populates if needed
  if (modalId === 'modal-stock-wizard') {
    toggleWizardFields();
    if (typeof currentProductsList !== 'undefined') populateWizardProducts(currentProductsList);
  } else if (modalId === 'modal-po-builder') {
    const tbody = document.getElementById('po-items-rows');
    if (tbody && tbody.children.length === 0) addPoLineItem();
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}

// UI State Updates
function updateUserUI() {
  if (!currentUser) return;
  const nameEl = document.getElementById('current-user-name');
  const roleEl = document.getElementById('current-user-role');
  const avatarEl = document.getElementById('avatar-initial');

  if (nameEl) nameEl.innerText = currentUser.name;
  if (roleEl) {
    roleEl.innerText = currentUser.role.toUpperCase();
    roleEl.className = `user-role-pill role-${currentUser.role}`;
  }
  if (avatarEl) avatarEl.innerText = currentUser.name.charAt(0).toUpperCase();

  // Settings tab info
  const setNavName = document.getElementById('settings-user-name');
  const setNavEmail = document.getElementById('settings-user-email');
  const setNavRole = document.getElementById('settings-user-role');
  if (setNavName) setNavName.innerText = currentUser.name;
  if (setNavEmail) setNavEmail.innerText = currentUser.email;
  if (setNavRole) setNavRole.innerText = `${currentUser.role.toUpperCase()} USER`;
}

function showAuthOverlay() {
  document.getElementById('auth-overlay').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}

function hideAuthOverlay() {
  document.getElementById('auth-overlay').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
}

function fillDemo(email) {
  document.getElementById('login-email').value = email;
  document.getElementById('login-password').value = 'Demo@123';
}

function logout() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('stockpilot_token');
  showAuthOverlay();
  showToast('Logged out successfully', 'info');
}

// Theme Switcher
function initTheme() {
  const saved = localStorage.getItem('stockpilot_theme') || 'dark';
  setTheme(saved);
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('stockpilot_theme', theme);
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.innerText = theme === 'dark' ? '🌙' : '☀️';
}

// Toast System
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}</span>
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Category Loader Helper
async function loadCategories() {
  try {
    const data = await apiFetch('/api/categories');
    if (!data) return;

    renderCategoriesGrid(data.categories || []);
    populateCategoryDropdowns(data.categories || []);
  } catch (err) {}
}

function renderCategoriesGrid(categories) {
  const grid = document.getElementById('categories-grid');
  if (!grid) return;

  if (categories.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/-1; color: var(--text-muted);">No categories available.</div>`;
    return;
  }

  grid.innerHTML = categories.map(c => `
    <div class="card">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
        <span class="badge" style="background: rgba(139,92,246,0.15); color: var(--accent-purple); font-family: monospace;">${c.code}</span>
        <span style="font-size: 0.8rem; color: var(--text-muted);">${c.product_count || 0} Products</span>
      </div>
      <h3 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 0.35rem;">${escapeHtml(c.name)}</h3>
      <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">${escapeHtml(c.description || 'No description provided.')}</p>
      <div style="padding-top: 0.75rem; border-top: 1px solid var(--border-color); font-size: 0.8rem; color: var(--text-muted);">
        Total Units in Stock: <strong>${(c.total_stock || 0).toLocaleString()}</strong>
      </div>
    </div>
  `).join('');
}

function populateCategoryDropdowns(categories) {
  const selects = ['prod-category-filter', 'form-prod-category'];
  selects.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      const firstOpt = id.includes('filter') ? '<option value="">All Categories</option>' : '<option value="">Select Category</option>';
      el.innerHTML = firstOpt + categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)} (${c.code})</option>`).join('');
    }
  });
}

async function saveCategory(e) {
  e.preventDefault();
  const payload = {
    name: document.getElementById('cat-form-name').value,
    code: document.getElementById('cat-form-code').value,
    description: document.getElementById('cat-form-desc').value
  };

  try {
    const res = await apiFetch('/api/categories', { method: 'POST', body: payload });
    if (res) {
      showToast('Category created!', 'success');
      closeModal('modal-category');
      document.getElementById('form-category').reset();
      loadCategories();
    }
  } catch (err) {}
}

async function resetSeedData() {
  if (!confirm('Warning: This will reset all inventory, products, orders, and logs to default seed data state. Proceed?')) return;
  try {
    await apiFetch('/api/auth/register', { method: 'POST', body: {} }).catch(() => {}); // dummy call
    showToast('Re-seeding database...', 'info');
    window.location.reload();
  } catch (err) {}
}

// Utilities
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}
