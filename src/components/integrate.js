import { REGIONS, FALLBACK_INTENSITY, getIntensityColor } from '../data/regions.js';

const DEFAULT_ZONES = ['FR', 'DE', 'SE', 'IE', 'US-NW-PACW', 'CA-QC'];

function getZoneOptions(intensityData) {
  const seen = new Set();
  return REGIONS
    .filter(r => { if (seen.has(r.zone)) return false; seen.add(r.zone); return true; })
    .map(r => ({
      zone: r.zone, label: `${r.zone} (${r.name})`,
      intensity: intensityData?.[r.zone]?.intensity || null,
    }))
    .sort((a, b) => (a.intensity || 999) - (b.intensity || 999));
}

// ──────── PR Bot comment preview ────────
function generatePRComment(regionId, intensityData) {
  const region = REGIONS.find(r => r.id === regionId);
  if (!region) return '';
  const intensity = intensityData?.[region.zone]?.intensity || FALLBACK_INTENSITY[region.zone] || 400;
  const color = getIntensityColor(intensity);

  // Find cleanest same-provider alternative
  const sameProvider = REGIONS
    .filter(r => r.provider === region.provider && r.id !== regionId)
    .map(r => ({ ...r, ci: intensityData?.[r.zone]?.intensity || FALLBACK_INTENSITY[r.zone] || 999 }))
    .sort((a, b) => a.ci - b.ci);
  const alt = sameProvider[0];
  if (!alt) return '';

  const savedPct = Math.round((1 - alt.ci / intensity) * 100);
  const co2PerYear = ((0.3 * 24 * 365) * intensity / 1000).toFixed(0); // rough: 300W always-on
  const co2AltPerYear = ((0.3 * 24 * 365) * alt.ci / 1000).toFixed(0);
  const tonsAvoided = ((co2PerYear - co2AltPerYear) / 1000).toFixed(1);

  return `### ⚠️ GridDeploy Carbon Alert

Your PR deploys to **${regionId}** (${region.name}) — currently at **${intensity} gCO₂/kWh**.

| | Current | Suggested |
|---|---|---|
| **Region** | ${regionId} (${region.name}) | ${alt.id} (${alt.name}) |
| **Carbon** | ${intensity} gCO₂/kWh | ${alt.ci} gCO₂/kWh |
| **Saving** | — | **${savedPct}% cleaner** |

🌱 **Suggestion:** Change to \`${alt.id}\` (${alt.name} — ${alt.ci} gCO₂/kWh).
📉 **Impact:** Saving ~**${tonsAvoided} tons** of CO₂ per year for a typical workload.

---
<sub>🤖 Powered by <a href="#">GridDeploy</a> · <a href="#">Apply suggestion</a></sub>`;
}

// PR bot yaml removed, now handled by backend webhook
// ──────── Deploy Action YAML ────────
function generateDeployYaml(selectedZones, threshold) {
  const zonesStr = selectedZones.join(',');
  return `name: Carbon-Aware Deploy
on: [push]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Find cleanest region
        id: griddeploy
        run: |
          ZONES="${zonesStr}"
          BEST_ZONE=""
          BEST_SCORE=9999

          for ZONE in $(echo $ZONES | tr ',' ' '); do
            INTENSITY=$(curl -sf "https://api.electricitymap.org/v3/carbon-intensity/latest?zone=$ZONE" \\
              | python3 -c "import sys,json; print(json.load(sys.stdin).get('carbonIntensity', 9999))" \\
              2>/dev/null || echo 9999)
            echo "Zone $ZONE: $INTENSITY gCO2/kWh"
            if [ "$(echo "$INTENSITY < $BEST_SCORE" | bc -l)" = "1" ]; then
              BEST_SCORE=$INTENSITY
              BEST_ZONE=$ZONE
            fi
          done

          echo "region=$BEST_ZONE" >> $GITHUB_OUTPUT
          echo "intensity=$BEST_SCORE" >> $GITHUB_OUTPUT

      - name: Carbon threshold gate
        run: |
          INTENSITY=\${{ steps.griddeploy.outputs.intensity }}
          if [ "$(echo "$INTENSITY > ${threshold}" | bc -l)" = "1" ]; then
            echo "::warning::Carbon intensity ($INTENSITY) exceeds threshold (${threshold})"
          fi

      - name: Deploy to cleanest region
        env:
          TARGET_REGION: \${{ steps.griddeploy.outputs.region }}
          CARBON_INTENSITY: \${{ steps.griddeploy.outputs.intensity }}
        run: |
          echo "🌿 Deploying to $TARGET_REGION ($CARBON_INTENSITY gCO2/kWh)"
          # Your deploy command here:
          # terraform apply -var="region=$TARGET_REGION"`;
}

// ──────── Main render ────────
export function renderIntegrate(container, intensityData) {
  const zoneOptions = getZoneOptions(intensityData);

  // Generate PR bot preview for us-east-1
  const prPreview = generatePRComment('us-east-1', intensityData);

  container.innerHTML = `
    <div class="integrate-page">

      <!-- ═══ HERO ═══ -->
      <div class="integrate-hero">
        <div class="integrate-hero-icon">⚡</div>
        <h2>From Dashboard to Infrastructure</h2>
        <p>Two deployable GitHub Actions that make every PR and every deploy carbon-aware. 
        Zero dependencies, zero API keys, zero config.</p>
      </div>

      <!-- ═══ SUB-TABS ═══ -->
      <div class="integrate-subtabs" id="integrate-subtabs">
        <button class="integrate-subtab active" data-stab="prbot">🤖 GreenOps PR Bot</button>
        <button class="integrate-subtab" data-stab="deploy">🚀 Carbon-Aware Deploy</button>
      </div>

      <!-- ═══ TAB: PR BOT ═══ -->
      <div class="integrate-stab-content active" data-stab="prbot" id="stab-prbot">
        <div class="integrate-how" style="background: rgba(34, 197, 94, 0.05); border: 1px solid var(--accent); padding: 24px; border-radius: 8px;">
          <h3 style="color: var(--accent); margin-top: 0;">✅ Webhook Bot is Active</h3>
          <p class="integrate-desc">
            The GreenOps PR Bot is currently running on your local Express backend. It's actively listening for Pull Request events via GitHub Webhooks.
          </p>
          <div class="integrate-steps" style="margin-top: 16px;">
            <div class="integrate-step">
              <div class="integrate-step-num" style="background: var(--accent); color: var(--bg);">1</div>
              <div class="integrate-step-text">
                Expose your local server to the internet using <code>ngrok http 3000</code>.
              </div>
            </div>
            <div class="integrate-step">
              <div class="integrate-step-num" style="background: var(--accent); color: var(--bg);">2</div>
              <div class="integrate-step-text">
                In your GitHub repo, go to <strong>Settings > Webhooks</strong> and add <code>https://&lt;your-ngrok-url&gt;/api/webhooks/github</code>.
              </div>
            </div>
            <div class="integrate-step">
              <div class="integrate-step-num" style="background: var(--accent); color: var(--bg);">3</div>
              <div class="integrate-step-text">
                Select <strong>Let me select individual events</strong> and check <strong>Pull requests</strong>.
              </div>
            </div>
          </div>
        </div>

        <div style="margin-top:32px; margin-bottom: 12px; font-weight: 500; color: var(--text1);">
          Live comment preview:
        </div>

        <!-- PR Comment Preview -->
        <div class="pr-preview">
          <div class="pr-preview-header">
            <div class="pr-preview-avatar">🤖</div>
            <div class="pr-preview-meta">
              <strong>griddeploy-bot</strong> <span class="pr-preview-badge">bot</span>
              <span class="pr-preview-time">commented just now</span>
            </div>
          </div>
          <div class="pr-preview-body" id="pr-preview-body">${renderMarkdown(prPreview)}</div>
        </div>

        <div class="pr-preview-controls">
          <label class="input-label">Preview with region:</label>
          <div class="input-row">
            <select class="input-select" id="pr-preview-region" style="width:220px">
              ${REGIONS.filter(r => r.provider === 'AWS').map(r =>
                `<option value="${r.id}" ${r.id === 'us-east-1' ? 'selected' : ''}>${r.id} (${r.name})</option>`
              ).join('')}
            </select>
          </div>
        </div>
      </div>

      <!-- ═══ TAB: DEPLOY ACTION ═══ -->
      <div class="integrate-stab-content" data-stab="deploy" id="stab-deploy">
        <div class="integrate-how">
          <h3>Carbon-Aware Deploy</h3>
          <p class="integrate-desc">
            On every push, query live carbon intensity across your candidate regions and 
            automatically route the deployment to the cleanest one. Your infra goes where the grid is greenest.
          </p>
        </div>

        <div class="integrate-config">
          <h3>Configure your action</h3>
          <div class="integrate-config-row">
            <div class="input-section">
              <label class="input-label">Candidate Zones</label>
              <div class="zone-picker" id="zone-picker">
                ${zoneOptions.map(z => `
                  <label class="zone-chip ${DEFAULT_ZONES.includes(z.zone) ? 'active' : ''}">
                    <input type="checkbox" value="${z.zone}" ${DEFAULT_ZONES.includes(z.zone) ? 'checked' : ''} />
                    <span class="zone-chip-label">${z.zone}</span>
                    ${z.intensity !== null ? `<span class="zone-chip-val">${z.intensity}</span>` : ''}
                  </label>
                `).join('')}
              </div>
            </div>
            <div class="input-section" style="max-width:180px">
              <label class="input-label">Threshold (gCO₂/kWh)</label>
              <input type="number" class="input-field" id="threshold-input" value="200" min="1" />
              <span class="input-hint">Warn if intensity exceeds this</span>
            </div>
          </div>
        </div>

        <div class="integrate-output">
          <div class="integrate-output-header">
            <h3>📄 .github/workflows/carbon-deploy.yml</h3>
            <button class="btn-sm" id="btn-copy-yaml">📋 Copy YAML</button>
          </div>
          <pre class="yaml-code" id="yaml-output">${escapeHtml(generateDeployYaml(DEFAULT_ZONES, 200))}</pre>
        </div>
      </div>

      <!-- ═══ FOOTER ═══ -->
      <div class="integrate-footer">
        <div class="info-card">
          <strong>Zero dependencies.</strong> Both actions use only <code>curl</code>, <code>python3</code>, 
          <code>bc</code>, and <code>actions/github-script</code> — all pre-installed on <code>ubuntu-latest</code>. 
          No npm packages, no Docker image, no API key required (Electricity Maps free tier).
        </div>
      </div>
    </div>
  `;

  // ─── Wire events ───
  // Sub-tab switching
  document.getElementById('integrate-subtabs')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.integrate-subtab');
    if (!btn) return;
    document.querySelectorAll('.integrate-subtab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.integrate-stab-content').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.querySelector(`.integrate-stab-content[data-stab="${btn.dataset.stab}"]`)?.classList.add('active');
  });

  // PR preview region change
  document.getElementById('pr-preview-region')?.addEventListener('change', (e) => {
    const preview = generatePRComment(e.target.value, intensityData);
    const body = document.getElementById('pr-preview-body');
    if (body) body.innerHTML = renderMarkdown(preview);
  });

  // threshold change removed as it's now handled by the backend ENV var

  // Deploy zone picker + threshold
  const updateDeployYaml = () => {
    const checked = [...document.querySelectorAll('#zone-picker input:checked')].map(i => i.value);
    const threshold = document.getElementById('threshold-input')?.value || 200;
    const yamlEl = document.getElementById('yaml-output');
    if (yamlEl && checked.length > 0) yamlEl.textContent = generateDeployYaml(checked, threshold);
  };

  document.getElementById('zone-picker')?.addEventListener('change', (e) => {
    const label = e.target.closest('.zone-chip');
    if (label) label.classList.toggle('active', e.target.checked);
    updateDeployYaml();
  });
  document.getElementById('threshold-input')?.addEventListener('input', updateDeployYaml);

  // Copy buttons
  bindCopy('btn-copy-yaml', 'yaml-output');
}

function bindCopy(btnId, srcId) {
  document.getElementById(btnId)?.addEventListener('click', () => {
    const text = document.getElementById(srcId)?.textContent || '';
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById(btnId);
      btn.textContent = '✓ Copied!';
      setTimeout(() => { btn.textContent = '📋 Copy YAML'; }, 1500);
    });
  });
}

/** Simple markdown → HTML (tables, bold, code, links, headings, hr) */
function renderMarkdown(md) {
  if (!md) return '';
  let html = escapeHtml(md);
  // headings
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  // bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  // links (already escaped, so handle &lt;a&gt;)
  html = html.replace(/&lt;a href="([^"]*)"&gt;(.+?)&lt;\/a&gt;/g, '<a href="$1">$2</a>');
  html = html.replace(/&lt;sub&gt;/g, '<sub>').replace(/&lt;\/sub&gt;/g, '</sub>');
  // hr
  html = html.replace(/^---$/gm, '<hr/>');
  // simple table
  html = html.replace(/\|(.+)\|/g, (match) => {
    const cells = match.split('|').filter(c => c.trim());
    if (cells.every(c => /^[-\s]+$/.test(c))) return ''; // separator row
    const tag = cells.some(c => c.trim().startsWith('**')) ? 'td' : 'td';
    return '<tr>' + cells.map(c => `<${tag}>${c.trim()}</${tag}>`).join('') + '</tr>';
  });
  // wrap table rows
  const hasTable = html.includes('<tr>');
  if (hasTable) {
    html = html.replace(/(<tr>[\s\S]*?<\/tr>)/g, (m) => m);
    // Find consecutive <tr> blocks and wrap in <table>
    html = html.replace(/((?:<tr>.*?<\/tr>\s*)+)/g, '<table class="pr-table">$1</table>');
  }
  // paragraphs
  html = html.replace(/\n\n/g, '</p><p>');
  html = '<p>' + html + '</p>';
  html = html.replace(/<p>\s*<\/p>/g, '');
  html = html.replace(/<p>(<h3>)/g, '$1').replace(/(<\/h3>)<\/p>/g, '$1');
  html = html.replace(/<p>(<table)/g, '$1').replace(/(<\/table>)<\/p>/g, '$1');
  html = html.replace(/<p>(<hr\/>)<\/p>/g, '$1');
  return html;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
