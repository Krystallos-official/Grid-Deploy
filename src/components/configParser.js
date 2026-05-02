import { REGIONS, getIntensityColor } from '../data/regions.js';
import { fmt } from '../utils/carbon.js';

// Regex patterns for extracting region strings from configs
const PATTERNS = [
  { name: 'Terraform', regex: /region\s*=\s*["']([a-z0-9-]+)["']/gi },
  { name: 'AWS SDK/CDK', regex: /region[:\s]+["']([a-z0-9-]+)["']/gi },
  { name: 'GCP', regex: /location[=:]\s*["']([a-z0-9-]+)["']/gi },
  { name: 'GitHub Actions', regex: /(?:aws-region|region):\s*["']?([a-z0-9-]+)["']?/gi },
];

/** Try to extract a known region ID from arbitrary config text */
function extractRegion(text) {
  const knownIds = new Set(REGIONS.map(r => r.id));
  const trimmed = text.trim();

  // Direct match against known region IDs
  if (knownIds.has(trimmed)) {
    return { regionId: trimmed, source: 'Direct match', match: trimmed };
  }

  // Try each regex pattern
  for (const pat of PATTERNS) {
    pat.regex.lastIndex = 0;
    const m = pat.regex.exec(text);
    if (m && knownIds.has(m[1])) {
      return { regionId: m[1], source: pat.name, match: m[0] };
    }
  }

  // Fuzzy: scan for any known region ID substring
  for (const id of knownIds) {
    if (text.includes(id)) {
      return { regionId: id, source: 'Substring match', match: id };
    }
  }

  return null;
}

/** Render the config parser panel */
export function renderConfigParser(container, intensityData) {
  container.innerHTML = `
    <div class="config-parser">
      <div class="input-section">
        <label class="input-label">Paste your config</label>
        <textarea class="input-field config-textarea" id="config-input" rows="8"
          placeholder='provider "aws" {\n  region = "us-east-1"\n}\n\n— or paste a GitHub Actions yml —\n— or just type: eu-west-1'></textarea>
      </div>
      <button class="btn-analyze btn-parse" id="btn-parse-config">
        🔍 Detect Region & Analyze
      </button>
      <div id="config-result"></div>
    </div>
  `;

  document.getElementById('btn-parse-config').addEventListener('click', () => {
    const text = document.getElementById('config-input').value;
    if (!text.trim()) {
      document.getElementById('config-input').classList.add('input-error');
      setTimeout(() => document.getElementById('config-input').classList.remove('input-error'), 600);
      return;
    }
    analyzeConfig(text, intensityData);
  });
}

function analyzeConfig(text, intensityData) {
  const result = extractRegion(text);
  const container = document.getElementById('config-result');

  if (!result) {
    container.innerHTML = `
      <div class="config-no-match">
        <div class="config-no-match-icon">❌</div>
        <p>Could not detect a known cloud region in this config.</p>
        <p class="config-hint">Try pasting a Terraform provider block, AWS CDK config, 
        GitHub Actions workflow, or a raw region ID like <code>us-east-1</code></p>
      </div>
    `;
    return;
  }

  const region = REGIONS.find(r => r.id === result.regionId);
  if (!region) return;

  const zoneData = intensityData[region.zone];
  const intensity = zoneData?.intensity || 0;
  const color = getIntensityColor(intensity);

  // Find top 3 cleaner alternatives
  const allWithIntensity = REGIONS
    .filter(r => intensityData[r.zone])
    .map(r => ({ ...r, intensity: intensityData[r.zone].intensity }))
    .sort((a, b) => a.intensity - b.intensity);

  const alternatives = allWithIntensity
    .filter(r => r.intensity < intensity && r.id !== region.id)
    .slice(0, 3);

  const bestAlt = alternatives[0];
  const savingsPct = bestAlt ? Math.round((1 - bestAlt.intensity / intensity) * 100) : 0;

  // Generate modified config text
  let modifiedConfig = text;
  if (bestAlt) {
    modifiedConfig = text.replace(
      new RegExp(result.regionId.replace(/[-/]/g, '\\$&'), 'g'),
      bestAlt.id
    );
  }

  let altRows = '';
  alternatives.forEach((alt, i) => {
    const diff = intensity - alt.intensity;
    const pct = Math.round((diff / intensity) * 100);
    altRows += `
      <div class="config-alt">
        <div class="config-alt-rank">#${i + 1}</div>
        <div class="config-alt-info">
          <span class="config-alt-name">${alt.id} <span class="config-alt-loc">(${alt.name})</span></span>
          <span class="provider-badge provider-${alt.provider.toLowerCase()}">${alt.provider}</span>
        </div>
        <div class="config-alt-intensity">
          <span class="intensity-dot" style="background:${getIntensityColor(alt.intensity)}"></span>
          ${alt.intensity} gCO₂/kWh
        </div>
        <div class="config-alt-saving">
          <span class="savings-highlight">−${pct}%</span>
          <span class="config-alt-diff">(−${diff} gCO₂/kWh)</span>
        </div>
      </div>
    `;
  });

  container.innerHTML = `
    <div class="config-detected">
      <div class="config-detected-header">
        <span class="config-detected-badge">Detected via ${result.source}</span>
      </div>
      
      <div class="config-current">
        <div class="config-current-label">Your config uses</div>
        <div class="config-current-region">
          <span class="intensity-dot" style="background:${color};width:12px;height:12px"></span>
          <span class="config-region-id">${region.id}</span>
          <span class="config-region-name">${region.name} · ${region.provider}</span>
        </div>
        <div class="config-current-intensity" style="color:${color}">
          ${intensity} gCO₂/kWh
        </div>
      </div>

      ${alternatives.length > 0 ? `
        <div class="config-alts-header">
          <span>🌿 Cleaner alternatives</span>
          ${savingsPct > 0 ? `<span class="savings-highlight">Up to ${savingsPct}% cleaner</span>` : ''}
        </div>
        <div class="config-alts">${altRows}</div>

        <div class="config-output">
          <div class="config-output-header">
            <span class="input-label">Updated config → ${bestAlt.id} (${bestAlt.name})</span>
            <button class="btn-sm btn-copy-config" id="btn-copy-config">📋 Copy</button>
          </div>
          <pre class="config-output-code" id="config-output-code">${escapeHtml(modifiedConfig)}</pre>
        </div>
      ` : `
        <div class="config-alts-header" style="color:var(--accent)">
          ✨ You're already using one of the cleanest regions!
        </div>
      `}
    </div>
  `;

  document.getElementById('btn-copy-config')?.addEventListener('click', () => {
    navigator.clipboard.writeText(modifiedConfig).then(() => {
      const btn = document.getElementById('btn-copy-config');
      btn.textContent = '✓ Copied!';
      setTimeout(() => { btn.textContent = '📋 Copy'; }, 1500);
    });
  });
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
