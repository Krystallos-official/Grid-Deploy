import { getIntensityColor } from '../data/regions.js';
import { fetchForecast } from '../utils/api.js';
import { fmt } from '../utils/carbon.js';

const CHART_W = 800;
const CHART_H = 300;
const PAD = { top: 40, right: 20, bottom: 50, left: 55 };

export async function renderForecast(container, zone, regionLabel, workloadWatts) {
  container.innerHTML = `
    <div class="forecast-loading">
      <div class="pulse-ring"></div>
      <p>Fetching 24h forecast for <strong>${regionLabel}</strong>…</p>
    </div>
  `;

  const data = await fetchForecast(zone);
  const watts = workloadWatts || 300;

  if (!data || !Array.isArray(data) || data.length === 0) {
    container.innerHTML = `
      <div class="forecast-empty">
        <div class="forecast-empty-icon">📡</div>
        <p>Hourly forecast unavailable for this region — showing live intensity only.</p>
        <p class="forecast-hint">The Electricity Maps free tier may not provide forecasts for all zones.</p>
      </div>
    `;
    return;
  }

  // Take up to 24 data points
  const points = data.slice(0, 24).map((d, i) => ({
    hour: new Date(d.datetime).getHours(),
    index: i,
    intensity: d.carbonIntensity,
  }));

  const maxIntensity = Math.max(...points.map(p => p.intensity), 100);
  const plotW = CHART_W - PAD.left - PAD.right;
  const plotH = CHART_H - PAD.top - PAD.bottom;
  const barW = plotW / points.length - 3;

  // Find best 4-hour window
  let bestStart = 0;
  let bestSum = Infinity;
  for (let i = 0; i <= points.length - 4; i++) {
    const sum = points.slice(i, i + 4).reduce((s, p) => s + p.intensity, 0);
    if (sum < bestSum) { bestSum = sum; bestStart = i; }
  }
  const bestEnd = bestStart + 3;
  const bestAvg = bestSum / 4;

  // Also find worst 4-hour window for comparison
  let worstStart = 0;
  let worstSum = 0;
  for (let i = 0; i <= points.length - 4; i++) {
    const sum = points.slice(i, i + 4).reduce((s, p) => s + p.intensity, 0);
    if (sum > worstSum) { worstSum = sum; worstStart = i; }
  }
  const worstAvg = worstSum / 4;

  // Current hour
  const currentHour = new Date().getHours();

  // Build SVG bars
  let bars = '';
  points.forEach((p, i) => {
    const x = PAD.left + i * (plotW / points.length) + 1.5;
    const barH = (p.intensity / maxIntensity) * plotH;
    const y = PAD.top + plotH - barH;
    const color = getIntensityColor(p.intensity);
    const isBest = i >= bestStart && i <= bestEnd;
    const opacity = isBest ? 1 : 0.7;

    bars += `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" 
      fill="${color}" opacity="${opacity}" rx="2">
      <title>${p.hour}:00 — ${p.intensity} gCO₂/kWh</title>
    </rect>`;

    if (points.length <= 24) {
      bars += `<text x="${x + barW / 2}" y="${CHART_H - 8}" 
        fill="#666" font-size="10" text-anchor="middle">${p.hour}</text>`;
    }
  });

  // Best window bracket
  const bx1 = PAD.left + bestStart * (plotW / points.length);
  const bx2 = PAD.left + (bestEnd + 1) * (plotW / points.length);
  const by = PAD.top - 8;
  bars += `
    <line x1="${bx1}" y1="${by}" x2="${bx2}" y2="${by}" stroke="#00e676" stroke-width="3" stroke-linecap="round"/>
    <line x1="${bx1}" y1="${by}" x2="${bx1}" y2="${by + 8}" stroke="#00e676" stroke-width="2"/>
    <line x1="${bx2}" y1="${by}" x2="${bx2}" y2="${by + 8}" stroke="#00e676" stroke-width="2"/>
    <text x="${(bx1 + bx2) / 2}" y="${by - 6}" fill="#00e676" font-size="11" text-anchor="middle" font-weight="600">
      Best window to run
    </text>
  `;

  // Current hour indicator
  const currentIdx = points.findIndex(p => p.hour === currentHour);
  if (currentIdx >= 0) {
    const cx = PAD.left + currentIdx * (plotW / points.length) + barW / 2;
    bars += `<line x1="${cx}" y1="${PAD.top}" x2="${cx}" y2="${PAD.top + plotH}" 
      stroke="white" stroke-width="1.5" stroke-dasharray="4,4" opacity="0.6"/>`;
    bars += `<text x="${cx}" y="${PAD.top - 2}" fill="white" font-size="9" text-anchor="middle">NOW</text>`;
  }

  // Y axis
  let yAxis = '';
  const yTicks = 5;
  for (let i = 0; i <= yTicks; i++) {
    const val = Math.round((maxIntensity / yTicks) * i);
    const y = PAD.top + plotH - (i / yTicks) * plotH;
    yAxis += `<text x="${PAD.left - 8}" y="${y + 4}" fill="#666" font-size="10" text-anchor="end">${val}</text>`;
    yAxis += `<line x1="${PAD.left}" y1="${y}" x2="${CHART_W - PAD.right}" y2="${y}" stroke="#1e2d3d" stroke-width="0.5"/>`;
  }
  yAxis += `<text x="14" y="${PAD.top + plotH / 2}" fill="#888" font-size="11" text-anchor="middle" 
    transform="rotate(-90, 14, ${PAD.top + plotH / 2})">gCO₂/kWh</text>`;

  // Compute metrics
  const currentIntensity = currentIdx >= 0 ? points[currentIdx].intensity : points[0].intensity;
  const pctCleaner = currentIntensity > 0 ? Math.round((1 - bestAvg / currentIntensity) * 100) : 0;
  const bestStartHour = points[bestStart].hour;
  const bestEndHour = points[bestEnd].hour;

  // ML time-shifting savings
  const energyKwh4h = (watts / 1000) * 4;
  const co2Best = (energyKwh4h * bestAvg) / 1000;
  const co2Worst = (energyKwh4h * worstAvg) / 1000;
  const co2Now = (energyKwh4h * currentIntensity) / 1000;
  const savedVsNow = co2Now - co2Best;
  const savedVsWorst = co2Worst - co2Best;

  // Generate cron expression for best window
  const cronHour = bestStartHour;
  const cronExpr = `${cronHour} * * *`;

  container.innerHTML = `
    <div class="forecast-chart-wrap">
      <svg viewBox="0 0 ${CHART_W} ${CHART_H}" class="forecast-svg">
        ${yAxis}
        ${bars}
      </svg>
    </div>

    <!-- Time-shifting recommendation -->
    <div class="forecast-recommendation">
      <div class="forecast-rec-icon">⚡</div>
      <div class="forecast-rec-text">
        Schedule your workload between <strong>${bestStartHour}:00</strong> and 
        <strong>${(bestEndHour + 1) % 24}:00</strong> to minimize emissions.
        ${pctCleaner > 0
          ? `This window is <span class="savings-highlight">${pctCleaner}% cleaner</span> than running right now.`
          : 'This is already a clean window!'}
      </div>
    </div>

    <!-- ML Time-Shift: GridDeploy Cron -->
    <div class="cron-section">
      <h3 class="cron-title">🧠 GridDeploy Cron — ML Time-Shifting</h3>
      <p class="cron-desc">
        AI training runs consume massive power. Instead of just choosing <em>where</em> to run, 
        choose <em>when</em>. Delay heavy batch jobs until the grid peaks with renewables.
      </p>

      <div class="cron-stats">
        <div class="cron-stat">
          <div class="cron-stat-label">Run now (${currentHour}:00)</div>
          <div class="cron-stat-val" style="color:${getIntensityColor(currentIntensity)}">${fmt(co2Now, 3)} kg CO₂</div>
          <div class="cron-stat-sub">${currentIntensity} gCO₂/kWh</div>
        </div>
        <div class="cron-stat-arrow">→</div>
        <div class="cron-stat cron-stat-best">
          <div class="cron-stat-label">Delay to ${bestStartHour}:00</div>
          <div class="cron-stat-val" style="color:var(--accent)">${fmt(co2Best, 3)} kg CO₂</div>
          <div class="cron-stat-sub">${Math.round(bestAvg)} gCO₂/kWh avg</div>
        </div>
        <div class="cron-stat-arrow">=</div>
        <div class="cron-stat">
          <div class="cron-stat-label">Saved per run</div>
          <div class="cron-stat-val" style="color:var(--accent)">${savedVsNow > 0 ? fmt(savedVsNow, 3) : '0'} kg</div>
          <div class="cron-stat-sub">${savedVsNow > 0 ? `${Math.round(savedVsNow / co2Now * 100)}% reduction` : 'Already optimal!'}</div>
        </div>
      </div>

      <div class="cron-output">
        <div class="cron-output-header">
          <span class="input-label">Cron Schedule (daily at optimal hour)</span>
          <button class="btn-sm" id="btn-copy-cron">📋 Copy</button>
        </div>
        <div class="cron-code">
          <div class="cron-code-main">
            <span class="cron-code-label">crontab</span>
            <code>0 ${cronExpr} /path/to/training-job.sh</code>
          </div>
          <div class="cron-code-main">
            <span class="cron-code-label">GitHub Actions</span>
            <code>on: schedule: [{cron: '0 ${cronExpr}'}]</code>
          </div>
          <div class="cron-code-main">
            <span class="cron-code-label">Kubernetes</span>
            <code>schedule: "0 ${cronExpr}"</code>
          </div>
        </div>
      </div>

      ${savedVsWorst > 0 ? `
        <div class="cron-impact">
          <strong>Annual impact of time-shifting:</strong> Running daily at ${bestStartHour}:00 instead of 
          the dirtiest hour saves <span class="savings-highlight">${fmt(savedVsWorst * 365, 1)} kg CO₂/year</span> 
          — equivalent to <strong>${fmt(savedVsWorst * 365 * 6.3, 0)} km</strong> not driven.
        </div>
      ` : ''}
    </div>
  `;

  // Copy cron
  document.getElementById('btn-copy-cron')?.addEventListener('click', () => {
    const text = `0 ${cronExpr} # GridDeploy: optimal carbon window for ${regionLabel}`;
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('btn-copy-cron');
      btn.textContent = '✓ Copied!';
      setTimeout(() => { btn.textContent = '📋 Copy'; }, 1500);
    });
  });
}
