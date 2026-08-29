/**
 * StockPilot - Executive Dashboard Controller
 */

async function loadDashboardData() {
  try {
    const kpiData = await apiFetch('/api/analytics/dashboard');
    if (kpiData && kpiData.kpis) {
      const k = kpiData.kpis;
      document.getElementById('kpi-cost-value').innerText = `$${k.total_cost_value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      document.getElementById('kpi-retail-value').innerText = `$${k.total_retail_value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      document.getElementById('kpi-total-skus').innerText = k.total_products;
      document.getElementById('kpi-low-stock').innerText = k.low_stock_count;
      document.getElementById('kpi-out-stock').innerText = k.out_of_stock_count;
      document.getElementById('kpi-warehouses').innerText = k.warehouses_count;
      document.getElementById('kpi-pending-pos').innerText = k.pending_pos_count;
      document.getElementById('kpi-total-po-spend').innerText = `$${k.total_po_spend.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;

      // Show Low Stock Banner if low_stock_count > 0
      const banner = document.getElementById('low-stock-banner');
      const bannerText = document.getElementById('low-stock-banner-text');
      if (banner && bannerText) {
        if (k.low_stock_count > 0) {
          banner.style.display = 'block';
          bannerText.innerText = `${k.low_stock_count} SKUs are currently at or below their automated reorder threshold (${k.out_of_stock_count} out of stock).`;
        } else {
          banner.style.display = 'none';
        }
      }
    }

    // Load Charts
    const chartData = await apiFetch('/api/analytics/charts');
    if (chartData) {
      renderLineChart('chart-movements', chartData.movement_trends || []);
      renderDonutChart('chart-categories', chartData.category_breakdown || []);
    }
  } catch (error) {
    console.error('Dashboard load error:', error);
  }
}
