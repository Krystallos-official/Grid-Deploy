import { getIntensityColor } from '../data/regions.js';
import { fmt, calculateROI } from '../utils/carbon.js';

/**
 * Build the ranked results table with Carbon ROI
 */
export function renderRankings(container, rankedResults, runsPerMonth) {
  const best = rankedResults[0];
  const worst = rankedResults[rankedResults.length - 1];
  const roi = calculateROI(best, worst, runsPerMonth);

  const totalCount = rankedResults.length;
  const bottomThirdStart = totalCount - Math.ceil(totalCount / 3);

  function getVerdict(rank) {
    if (rank === 1) return { text: '✦ Best choice', cls: 'verdict-best' };
    if (rank <= 3) return { text: 'Good', cls: 'verdict-good' };
    if (rank >= totalCount - 1) return { text: 'Worst choice', cls: 'verdict-worst' };
    if (rank >= bottomThirdStart) return { text: 'Avoid', cls: 'verdict-avoid' };
    return { text: 'Average', cls: 'verdict-avg' };
  }

  // ─── Carbon ROI Card ───
  const costVerb = roi.greenIsCheaper ? 'saves' : 'costs an extra';
  const costAmt = Math.abs(roi.costSavedYearly);
  const costColor = roi.greenIsCheaper ? 'var(--accent)' : 'var(--warning)';
  const winWin = roi.greenIsCheaper && roi.carbonPctSaved > 30;

  let html = `
    <div class="roi-grid">
      <!-- Carbon savings card -->
      <div class="roi-card roi-carbon">
        <div class="roi-card-header">
          <span class="roi-card-icon">🌿</span>
          <span class="roi-card-title">Carbon Savings</span>
        </div>
        <div class="roi-card-value" style="color:var(--accent)">${roi.carbonPctSaved}%</div>
        <div class="roi-card-sub">less CO₂ at <strong>${best.id}</strong> vs <strong>${worst.id}</strong></div>
        <div class="roi-card-detail">
          <span>${fmt(roi.carbonSavedPerRun, 2)} kg/run</span>
          <span class="roi-sep">→</span>
          <span>${fmt(roi.carbonSavedYearly, 1)} kg/year</span>
        </div>
        <div class="roi-card-equiv">
          ≈ ${fmt(roi.carbonSavedYearly * 6.3, 0)} km not driven · ${fmt(roi.carbonSavedYearly / 21.7, 1)} trees planted
        </div>
      </div>

      <!-- Cost card -->
      <div class="roi-card roi-cost">
        <div class="roi-card-header">
          <span class="roi-card-icon">💰</span>
          <span class="roi-card-title">Cost Impact</span>
        </div>
        <div class="roi-card-value" style="color:${costColor}">
          ${roi.greenIsCheaper ? '−' : '+'}$${fmt(costAmt, 0)}<span class="roi-card-unit">/year</span>
        </div>
        <div class="roi-card-sub">
          ${roi.greenIsCheaper
            ? `Going green <strong style="color:var(--accent)">also saves money</strong>`
            : `Green costs <strong>$${fmt(Math.abs(roi.costDiffPerRun), 2)}</strong> more per run`
          }
        </div>
        <div class="roi-card-detail">
          <span>${best.id}: $${fmt(best.regionPrice, 2)}/hr</span>
          <span class="roi-sep">vs</span>
          <span>${worst.id}: $${fmt(worst.regionPrice, 2)}/hr</span>
        </div>
        ${winWin ? `
          <div class="roi-winwin">
            <span class="roi-winwin-badge">🏆 Win-Win</span>
            Greener AND cheaper — the business case writes itself
          </div>
        ` : ''}
      </div>
    </div>

    <div class="savings-callout">
      <div class="savings-icon">💡</div>
      <div class="savings-text">
        Rerouting to <strong>${best.id} (${best.name})</strong> instead of
        <strong>${worst.id} (${worst.name})</strong>
        saves <span class="savings-highlight">${roi.carbonPctSaved}% on carbon</span>
        ${roi.greenIsCheaper
          ? `<strong>AND</strong> <span class="savings-highlight">$${fmt(costAmt, 0)}/year on billing</span>.`
          : `. Cost difference: +$${fmt(costAmt, 0)}/year.`
        }
        Over a year at ${runsPerMonth} run${runsPerMonth > 1 ? 's' : ''}/month, that's
        <span class="savings-highlight">${fmt(roi.carbonSavedYearly, 1)} kg CO₂</span> —
        the same as planting <strong>${fmt(roi.carbonSavedYearly / 21.7, 1)} trees</strong>.
      </div>
    </div>

    <div class="table-wrapper">
      <table class="rankings-table" id="rankings-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Region</th>
            <th>Provider</th>
            <th>Carbon Intensity</th>
            <th>Your CO₂</th>
            <th>Monthly CO₂</th>
            <th>$/hr</th>
            <th>Cost/Run</th>
            <th>Verdict</th>
          </tr>
        </thead>
        <tbody>
  `;

  rankedResults.forEach((r, i) => {
    const rank = i + 1;
    const verdict = getVerdict(rank);
    const rowClass = rank === 1 ? 'row-best' : rank === totalCount ? 'row-worst' : '';
    const sourceTag = r.source === 'live'
      ? '<span class="tag-live">live</span>'
      : r.source === 'cached'
        ? '<span class="tag-cached">cached</span>'
        : '<span class="tag-estimated">est.</span>';

    // Cost comparison vs most expensive
    const cheaperPct = worst.costPerRun > 0
      ? Math.round((1 - r.costPerRun / worst.costPerRun) * 100) : 0;

    html += `
      <tr class="${rowClass}">
        <td class="rank-cell">${rank}</td>
        <td>
          <div class="region-cell">
            <span class="region-id">${r.id}</span>
            <span class="region-name">${r.name}</span>
          </div>
        </td>
        <td><span class="provider-badge provider-${r.provider.toLowerCase()}">${r.provider}</span></td>
        <td>
          <span class="intensity-dot" style="background:${getIntensityColor(r.intensity)}"></span>
          ${r.intensity} gCO₂/kWh ${sourceTag}
        </td>
        <td>${fmt(r.co2Kg, 3)} kg</td>
        <td>${fmt(r.monthlyCo2Kg, 2)} kg</td>
        <td class="cost-cell">$${fmt(r.regionPrice, 2)}</td>
        <td class="cost-cell">$${fmt(r.costPerRun, 2)}
          ${cheaperPct > 5 ? `<span class="cost-save-tag">-${cheaperPct}%</span>` : ''}
        </td>
        <td><span class="verdict-badge ${verdict.cls}">${verdict.text}</span></td>
      </tr>
    `;
  });

  html += '</tbody></table></div>';
  container.innerHTML = html;
}
