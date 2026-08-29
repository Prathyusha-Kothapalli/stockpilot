/**
 * StockPilot Chart Engine - Handcrafted SVG Charts
 */

function renderLineChart(containerId, data) {
  const container = document.getElementById(containerId);
  if (!container || !data || data.length === 0) {
    if (container) container.innerHTML = '<div style="color: var(--text-muted); padding: 2rem;">No movement data recorded yet.</div>';
    return;
  }

  const width = container.clientWidth || 500;
  const height = 240;
  const padding = 35;

  const maxVal = Math.max(...data.map(d => Math.max(d.inbound_qty || 0, d.outbound_qty || 0)), 10);
  const xScale = (i) => padding + (i / (data.length - 1 || 1)) * (width - padding * 2);
  const yScale = (val) => height - padding - (val / maxVal) * (height - padding * 2);

  // Line points
  const pointsIn = data.map((d, i) => `${xScale(i)},${yScale(d.inbound_qty || 0)}`).join(' ');
  const pointsOut = data.map((d, i) => `${xScale(i)},${yScale(d.outbound_qty || 0)}`).join(' ');

  let svg = `
    <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gradIn" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#10b981" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="#10b981" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="gradOut" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#f43f5e" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="#f43f5e" stop-opacity="0"/>
        </linearGradient>
      </defs>

      <!-- Grid lines -->
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="var(--border-color)" stroke-width="1"/>
      <line x1="${padding}" y1="${padding}" x2="${width - padding}" y2="${padding}" stroke="var(--border-color)" stroke-width="1" stroke-dasharray="4"/>

      <!-- Inbound Area & Line -->
      <polygon points="${padding},${height-padding} ${pointsIn} ${width-padding},${height-padding}" fill="url(#gradIn)"/>
      <polyline points="${pointsIn}" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round"/>

      <!-- Outbound Area & Line -->
      <polygon points="${padding},${height-padding} ${pointsOut} ${width-padding},${height-padding}" fill="url(#gradOut)"/>
      <polyline points="${pointsOut}" fill="none" stroke="#f43f5e" stroke-width="3" stroke-linecap="round"/>

      <!-- Data Dots -->
      ${data.map((d, i) => `
        <circle cx="${xScale(i)}" cy="${yScale(d.inbound_qty || 0)}" r="4" fill="#10b981"/>
        <circle cx="${xScale(i)}" cy="${yScale(d.outbound_qty || 0)}" r="4" fill="#f43f5e"/>
      `).join('')}

      <!-- Labels -->
      ${data.map((d, i) => i % 2 === 0 ? `
        <text x="${xScale(i)}" y="${height - 10}" fill="var(--text-muted)" font-size="10" text-anchor="middle">
          ${d.date ? d.date.slice(5) : ''}
        </text>
      ` : '').join('')}
    </svg>
  `;

  container.innerHTML = svg;
}

function renderDonutChart(containerId, data) {
  const container = document.getElementById(containerId);
  if (!container || !data || data.length === 0) {
    if (container) container.innerHTML = '<div style="color: var(--text-muted); padding: 2rem;">No category data found.</div>';
    return;
  }

  const totalValue = data.reduce((acc, d) => acc + (d.category_cost_value || 0), 0);
  if (totalValue === 0) {
    container.innerHTML = '<div style="color: var(--text-muted);">No stock value recorded.</div>';
    return;
  }

  const colors = ['#6366f1', '#10b981', '#f59e0b', '#06b6d4', '#8b5cf6'];
  let currentAngle = 0;

  const svgPaths = data.map((d, i) => {
    const value = d.category_cost_value || 0;
    const pct = value / totalValue;
    const angle = pct * 360;

    const x1 = 100 + 70 * Math.cos((Math.PI * currentAngle) / 180);
    const y1 = 100 + 70 * Math.sin((Math.PI * currentAngle) / 180);

    currentAngle += angle;

    const x2 = 100 + 70 * Math.cos((Math.PI * currentAngle) / 180);
    const y2 = 100 + 70 * Math.sin((Math.PI * currentAngle) / 180);

    const largeArc = angle > 180 ? 1 : 0;
    const color = colors[i % colors.length];

    return `<path d="M ${x1} ${y1} A 70 70 0 ${largeArc} 1 ${x2} ${y2}" fill="none" stroke="${color}" stroke-width="26"/>`;
  }).join('');

  let legendHtml = `
    <div style="display: flex; flex-direction: column; gap: 0.5rem; width: 100%; font-size: 0.8rem;">
      ${data.map((d, i) => `
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="width: 10px; height: 10px; border-radius: 50%; background: ${colors[i % colors.length]}; display: inline-block;"></span>
            <span>${d.category_name}</span>
          </div>
          <span style="font-weight: 700;">$${(d.category_cost_value || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}</span>
        </div>
      `).join('')}
    </div>
  `;

  container.innerHTML = `
    <div style="display: flex; align-items: center; gap: 1.5rem; width: 100%;">
      <svg width="160" height="160" viewBox="0 0 200 200" style="flex-shrink: 0;">
        ${svgPaths}
        <text x="100" y="105" fill="var(--text-primary)" font-size="14" font-weight="bold" text-anchor="middle">Categories</text>
      </svg>
      ${legendHtml}
    </div>
  `;
}
