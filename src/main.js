import './styles/main.css';
import { REGIONS, WORKLOAD_PRESETS } from './data/regions.js';
import { fetchAllIntensities } from './utils/api.js';
import { calculateCarbon, parseDuration, fmt } from './utils/carbon.js';
import { createWorldMap, renderMarkers, renderLegend, downloadMapSvg } from './components/worldMap.js';
import { renderRankings } from './components/rankings.js';
import { renderForecast } from './components/forecast.js';
import { renderBudgetBar } from './components/budget.js';
import { logRun, getBudget, setBudget } from './utils/budget.js';
import { renderConfigParser } from './components/configParser.js';
import { renderIntegrate } from './components/integrate.js';

// ─── State ───
let intensityData = {};
let analysisResults = {};
let rankedResults = [];
let selectedProvider = 'Custom';
let mapState = null;

// ─── Render App Shell ───
async function renderApp() {
  const app = document.getElementById('app');
  const isOffline = !navigator.onLine;
  const initialBudget = await getBudget();

  app.innerHTML = `
    <div class="offline-banner ${isOffline ? '' : 'hidden'}" id="offline-banner">
      ⚠️ Offline mode — showing 2024 annual average data, not live values
    </div>

    <!-- FEATURE 1: Budget tracker bar -->
    <div id="budget-header"></div>

    <header class="app-header">
      <div class="app-logo">
        <div class="app-logo-icon">G</div>
        <div>
          <h1>Grid<span>Deploy</span></h1>
          <div class="app-tagline">Carbon-aware cloud region picker</div>
        </div>
      </div>
      <div class="header-actions">
        <button class="btn-sm" id="btn-copy-report" disabled>📋 Copy Report</button>
        <button class="btn-sm" id="btn-download-svg" disabled>📥 Download SVG</button>
      </div>
    </header>

    <div class="app-layout">
      <!-- Left Panel: Inputs -->
      <aside class="input-panel" id="input-panel">

        <!-- FEATURE 2: Panel tabs for Workload vs Config Parser -->
        <div class="panel-tabs">
          <button class="panel-tab active" data-panel="workload">⚡ Workload</button>
          <button class="panel-tab" data-panel="config">📄 Parse Config</button>
        </div>

        <!-- Panel: Workload (existing) -->
        <div class="panel-content active" data-panel="workload" id="panel-workload">
          <div class="input-section">
            <label class="input-label">Cloud Provider</label>
            <div class="radio-group" id="provider-group">
              <button class="radio-btn" data-val="AWS">AWS</button>
              <button class="radio-btn" data-val="GCP">GCP</button>
              <button class="radio-btn" data-val="Azure">Azure</button>
              <button class="radio-btn active" data-val="Custom">All</button>
            </div>
          </div>

          <div class="input-section">
            <label class="input-label">Workload Type</label>
            <select class="input-select" id="workload-type">
              ${WORKLOAD_PRESETS.map(p =>
                `<option value="${p.watts ?? ''}">${p.label}</option>`
              ).join('')}
            </select>
          </div>

          <div class="input-section">
            <label class="input-label">Power Draw</label>
            <input type="number" class="input-field" id="watts-input" 
              placeholder="e.g. 300" min="1" step="1" value="300" />
            <div class="error-msg" id="watts-error">Required</div>
          </div>

          <div class="input-section">
            <label class="input-label">Duration</label>
            <div class="input-row">
              <input type="number" class="input-field" id="duration-input" 
                placeholder="e.g. 2" min="0.1" step="0.1" value="2" />
              <select class="input-select" id="duration-unit">
                <option value="hours" selected>hours</option>
                <option value="minutes">minutes</option>
                <option value="days">days</option>
              </select>
            </div>
            <div class="error-msg" id="duration-error">Required</div>
          </div>

          <div class="input-section">
            <label class="input-label">Runs per month</label>
            <input type="number" class="input-field" id="runs-input" 
              placeholder="1" min="1" step="1" value="1" />
          </div>

          <!-- FEATURE 1: Monthly budget input -->
          <div class="input-section">
            <label class="input-label">Monthly Carbon Budget</label>
            <div class="budget-input-row">
              <input type="number" class="input-field" id="budget-input"
                placeholder="50" min="1" step="1" value="${initialBudget}" />
              <span class="budget-input-unit">kg CO₂</span>
            </div>
          </div>

          <button class="btn-analyze" id="btn-analyze">Compare All Regions →</button>

          <div class="info-card">
            <strong>How it works:</strong> We pull live carbon intensity (gCO₂/kWh) from 
            <a href="https://electricitymap.org" target="_blank" style="color:var(--accent)">Electricity Maps</a> 
            for every major cloud region. Same workload, vastly different emissions — just pick the green one.
          </div>

          <div class="loading-status" id="loading-status"></div>
        </div>

        <!-- Panel: Config Parser (FEATURE 2) -->
        <div class="panel-content" data-panel="config" id="panel-config">
          <div id="config-parser-container"></div>
          <div class="loading-status" id="loading-status-config"></div>
        </div>

      </aside>

      <!-- Right Panel: Results -->
      <main class="results-panel" id="results-panel">
        <div class="tabs" id="tabs">
          <div class="tab active" data-tab="map">🗺️ World Map</div>
          <div class="tab" data-tab="rankings">📊 Region Rankings</div>
          <div class="tab" data-tab="forecast">⏰ Best Time to Run</div>
          <div class="tab" data-tab="integrate">🔧 Integrate</div>
        </div>

        <div class="tab-content active" data-tab="map" id="tab-map">
          <div id="welcome-state" class="welcome-state">
            <div class="welcome-icon">🌍</div>
            <h2>Configure your workload</h2>
            <p>Set your compute parameters on the left and hit <strong>Compare All Regions</strong> to see live carbon intensity across the globe.</p>
          </div>
          <div id="map-container" class="map-container" style="display:none"></div>
          <div id="map-legend" style="display:none"></div>
        </div>

        <div class="tab-content" data-tab="rankings" id="tab-rankings">
          <div id="rankings-container"></div>
        </div>

        <div class="tab-content" data-tab="forecast" id="tab-forecast">
          <div class="forecast-controls" id="forecast-controls" style="display:none">
            <label>Region:</label>
            <select class="input-select" id="forecast-region" style="width:280px"></select>
          </div>
          <div id="forecast-container">
            <div class="welcome-state" style="min-height:300px">
              <div class="welcome-icon">⏰</div>
              <h2>Run your analysis first</h2>
              <p>After analyzing, pick a region to see its 24-hour carbon forecast and optimal run window.</p>
            </div>
          </div>
        </div>

        <!-- FEATURE 3: Integrate tab -->
        <div class="tab-content" data-tab="integrate" id="tab-integrate">
          <div id="integrate-container">
            <div class="welcome-state" style="min-height:300px">
              <div class="welcome-icon">🔧</div>
              <h2>Loading integration tools…</h2>
              <p>Fetching grid data to generate your GitHub Action config.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  `;

  bindEvents();
  loadIntensityData();
  refreshBudgetBar();
}

// ─── Refresh budget bar ───
function refreshBudgetBar() {
  renderBudgetBar(document.getElementById('budget-header'));
}

// ─── Events ───
function bindEvents() {
  // Provider toggle
  document.getElementById('provider-group').addEventListener('click', (e) => {
    const btn = e.target.closest('.radio-btn');
    if (!btn) return;
    document.querySelectorAll('#provider-group .radio-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedProvider = btn.dataset.val;
  });

  // Workload preset
  document.getElementById('workload-type').addEventListener('change', (e) => {
    const watts = e.target.value;
    const input = document.getElementById('watts-input');
    if (watts) {
      input.value = watts;
    } else {
      input.value = '';
      input.focus();
    }
  });

  // Budget input
  document.getElementById('budget-input').addEventListener('change', async (e) => {
    const val = parseFloat(e.target.value);
    if (val > 0) {
      await setBudget(val);
      refreshBudgetBar();
    }
  });

  // Panel tabs (left sidebar: Workload / Parse Config)
  document.querySelector('.panel-tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.panel-tab');
    if (!tab) return;
    document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel-content').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const panel = document.querySelector(`.panel-content[data-panel="${tab.dataset.panel}"]`);
    panel?.classList.add('active');

    // Lazy-render config parser
    if (tab.dataset.panel === 'config') {
      const container = document.getElementById('config-parser-container');
      if (container && container.children.length === 0) {
        renderConfigParser(container, intensityData);
      }
    }
  });

  // Results tabs
  document.getElementById('tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelector(`.tab-content[data-tab="${tab.dataset.tab}"]`).classList.add('active');

    // Lazy-render integrate tab
    if (tab.dataset.tab === 'integrate' && Object.keys(intensityData).length > 0) {
      renderIntegrate(document.getElementById('integrate-container'), intensityData);
    }
  });

  // Analyze
  document.getElementById('btn-analyze').addEventListener('click', runAnalysis);

  // Export buttons
  document.getElementById('btn-copy-report').addEventListener('click', copyReport);
  document.getElementById('btn-download-svg').addEventListener('click', downloadMapSvg);

  // Forecast region change
  document.getElementById('forecast-region')?.addEventListener('change', (e) => {
    const region = REGIONS.find(r => r.id === e.target.value);
    if (region) {
      const w = parseFloat(document.getElementById('watts-input')?.value) || 300;
      renderForecast(document.getElementById('forecast-container'), region.zone, `${region.id} (${region.name})`, w);
    }
  });
}

// ─── Load intensity data ───
async function loadIntensityData() {
  const statusEl = document.getElementById('loading-status');
  statusEl.innerHTML = 'Fetching live grid data...';

  intensityData = await fetchAllIntensities((resolved, total, done) => {
    if (done) {
      statusEl.innerHTML = `<span class="count">✓</span> Grid data ready`;
      setTimeout(() => { statusEl.style.opacity = '0.5'; }, 2000);

      // Now render integrate tab if it's showing
      const integrateTab = document.querySelector('.tab-content[data-tab="integrate"]');
      if (integrateTab?.classList.contains('active')) {
        renderIntegrate(document.getElementById('integrate-container'), intensityData);
      }
    } else {
      const remaining = total - resolved;
      statusEl.innerHTML = `Fetching live grid data... <span class="count">${remaining} remaining</span>`;
    }
  });
}

// ─── Run Analysis ───
async function runAnalysis() {
  // Validate
  const wattsInput = document.getElementById('watts-input');
  const durationInput = document.getElementById('duration-input');
  const wattsError = document.getElementById('watts-error');
  const durationError = document.getElementById('duration-error');
  let valid = true;

  wattsInput.classList.remove('input-error');
  durationInput.classList.remove('input-error');
  wattsError.classList.remove('visible');
  durationError.classList.remove('visible');

  const watts = parseFloat(wattsInput.value);
  if (!watts || watts <= 0) {
    wattsInput.classList.add('input-error');
    wattsError.classList.add('visible');
    valid = false;
  }

  const durationVal = parseFloat(durationInput.value);
  const durationUnit = document.getElementById('duration-unit').value;
  const durationHours = parseDuration(durationVal, durationUnit);
  if (!durationHours || durationHours <= 0) {
    durationInput.classList.add('input-error');
    durationError.classList.add('visible');
    valid = false;
  }

  if (!valid) return;

  const runsPerMonth = parseInt(document.getElementById('runs-input').value) || 1;

  // Wait for intensity data if not loaded
  if (Object.keys(intensityData).length === 0) {
    await loadIntensityData();
  }

  // Filter regions by provider
  const regions = selectedProvider === 'Custom'
    ? REGIONS
    : REGIONS.filter(r => r.provider === selectedProvider);

  // Calculate for each region
  analysisResults = {};
  regions.forEach(region => {
    const zoneData = intensityData[region.zone];
    if (!zoneData) return;
    const result = calculateCarbon(watts, durationHours, zoneData.intensity, runsPerMonth, region.id);
    analysisResults[region.id] = {
      ...result,
      ...region,
      intensity: zoneData.intensity,
      source: zoneData.source,
      minutesAgo: zoneData.minutesAgo,
    };
  });

  // Sort by CO2
  rankedResults = Object.values(analysisResults).sort((a, b) => a.co2Kg - b.co2Kg);

  // ─── FEATURE 1: Log run to budget tracker ───
  const bestRegion = rankedResults[0];
  if (bestRegion) {
    const workloadLabel = document.getElementById('workload-type').selectedOptions[0]?.text || 'Custom';
    await logRun(bestRegion.id, bestRegion.co2Kg, workloadLabel);
    refreshBudgetBar();
  }

  // Render map
  document.getElementById('welcome-state').style.display = 'none';
  const mapContainer = document.getElementById('map-container');
  mapContainer.style.display = 'block';
  document.getElementById('map-legend').style.display = 'block';

  if (!mapState) {
    mapState = await createWorldMap(mapContainer);
  }
  renderMarkers(mapState.markersGroup, regions, intensityData, analysisResults);
  renderLegend(document.getElementById('map-legend'));

  // Render rankings
  renderRankings(document.getElementById('rankings-container'), rankedResults, runsPerMonth);

  // Set up forecast dropdown
  const forecastSelect = document.getElementById('forecast-region');
  const forecastControls = document.getElementById('forecast-controls');
  forecastControls.style.display = 'flex';
  forecastSelect.innerHTML = rankedResults.map(r =>
    `<option value="${r.id}">${r.id} — ${r.name} (${r.provider}) — ${r.intensity} gCO₂/kWh</option>`
  ).join('');

  // Auto-load forecast for best region
  if (bestRegion) {
    renderForecast(
      document.getElementById('forecast-container'),
      bestRegion.zone,
      `${bestRegion.id} (${bestRegion.name})`,
      watts
    );
  }

  // Enable export buttons
  document.getElementById('btn-copy-report').disabled = false;
  document.getElementById('btn-download-svg').disabled = false;

  // Switch to map tab
  document.querySelector('.tab[data-tab="map"]').click();
}

// ─── Copy Report ───
function copyReport() {
  if (rankedResults.length === 0) return;
  const best = rankedResults[0];
  const worst = rankedResults[rankedResults.length - 1];
  const savedPerRun = worst.co2Kg - best.co2Kg;
  const runsPerMonth = parseInt(document.getElementById('runs-input').value) || 1;
  const savedYearly = savedPerRun * runsPerMonth * 12;
  const watts = document.getElementById('watts-input').value;
  const duration = `${document.getElementById('duration-input').value} ${document.getElementById('duration-unit').value}`;
  const workloadType = document.getElementById('workload-type').selectedOptions[0]?.text || 'Custom';

  const report = `GridDeploy Analysis — ${new Date().toISOString().slice(0, 16).replace('T', ' ')}
Workload: ${workloadType}, ${watts}W, ${duration}

Cleanest option:  ${best.id} (${best.name}) — ${best.intensity} gCO₂/kWh — ${fmt(best.co2Kg, 3)} kg CO₂
Dirtiest option:  ${worst.id} (${worst.name}) — ${worst.intensity} gCO₂/kWh — ${fmt(worst.co2Kg, 3)} kg CO₂
Potential saving: ${fmt(savedPerRun, 3)} kg CO₂/run (${fmt(savedYearly, 1)} kg/year)

Equivalent to ${fmt(savedYearly * 6.3, 0)} km not driven per year.
Data source: Electricity Maps (electricitymap.org)`;

  navigator.clipboard.writeText(report).then(() => {
    showToast('Report copied to clipboard!');
  });
}

function showToast(msg) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

// ─── Init ───
renderApp();
