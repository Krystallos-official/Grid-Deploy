import { getRuns, getMonthlyUsed, getBudget } from '../utils/budget.js';
import { fmt } from '../utils/carbon.js';

/** Render the budget header bar */
export async function renderBudgetBar(container) {
  const budget = await getBudget();
  const used = await getMonthlyUsed();
  const runs = await getRuns();
  
  const pct = Math.min((used / budget) * 100, 100);
  const isWarning = pct >= 80;
  const isOver = pct >= 100;

  const barColor = isOver
    ? 'var(--danger)'
    : isWarning
      ? 'var(--warning)'
      : 'var(--accent)';

  container.innerHTML = `
    <div class="budget-bar">
      <div class="budget-info">
        <span class="budget-label">
          <span class="budget-icon">📊</span>
          Monthly Carbon Budget
        </span>
        <span class="budget-numbers">
          <strong style="color:${barColor}">${fmt(used, 2)}</strong>
          <span class="budget-sep">/</span>
          <span>${fmt(budget, 1)} kg CO₂</span>
        </span>
      </div>
      <div class="budget-track">
        <div class="budget-fill" style="width:${pct}%;background:${barColor}"></div>
      </div>
      <div class="budget-actions">
        ${isWarning ? `<span class="budget-warning">${isOver ? '🚨 Budget exceeded!' : '⚠️ 80%+ used'}</span>` : ''}
        <button class="btn-sm btn-history" id="btn-history">📜 History (${runs.length})</button>
      </div>
    </div>
  `;

  document.getElementById('btn-history')?.addEventListener('click', showHistoryModal);
}

/** Show history modal */
async function showHistoryModal() {
  const runs = await getRuns();
  const existing = document.getElementById('history-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'history-modal';
  modal.className = 'modal-overlay';

  let tableRows = '';
  if (runs.length === 0) {
    tableRows = '<tr><td colspan="4" style="text-align:center;color:var(--text2);padding:24px">No runs logged this month</td></tr>';
  } else {
    runs.slice().reverse().forEach((r, i) => {
      const time = new Date(r.timestamp);
      const dateStr = time.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const timeStr = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      tableRows += `
        <tr>
          <td class="hist-date">${dateStr} ${timeStr}</td>
          <td>${r.workload_label}</td>
          <td><span class="region-id">${r.region}</span></td>
          <td class="hist-co2">${fmt(r.co2_kg, 3)} kg</td>
        </tr>
      `;
    });
  }

  const totalCo2 = runs.reduce((s, r) => s + r.co2_kg, 0);

  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>Run History — This Month</h2>
        <button class="modal-close" id="modal-close">✕</button>
      </div>
      <div class="modal-body">
        <div class="hist-summary">
          <div class="hist-stat">
            <div class="hist-stat-val">${runs.length}</div>
            <div class="hist-stat-label">Runs</div>
          </div>
          <div class="hist-stat">
            <div class="hist-stat-val">${fmt(totalCo2, 2)}</div>
            <div class="hist-stat-label">kg CO₂ total</div>
          </div>
          <div class="hist-stat">
            <div class="hist-stat-val">${fmt(totalCo2 * 6.3, 1)}</div>
            <div class="hist-stat-label">km driven equiv.</div>
          </div>
        </div>
        <div class="table-wrapper">
          <table class="rankings-table hist-table">
            <thead>
              <tr><th>Time</th><th>Workload</th><th>Region</th><th>CO₂</th></tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('modal-close').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
}
