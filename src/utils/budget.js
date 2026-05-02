/** Get all logged runs from backend */
export async function getRuns() {
  try {
    const resp = await fetch('/api/runs');
    if (!resp.ok) return [];
    return await resp.json();
  } catch { return []; }
}

/** Log a new run via backend */
export async function logRun(region, co2Kg, workloadLabel) {
  try {
    await fetch('/api/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ region, co2_kg: co2Kg, workload_label: workloadLabel })
    });
  } catch (err) {
    console.error('Failed to log run:', err);
  }
}

/** Get monthly budget in kg CO2 from backend */
export async function getBudget() {
  try {
    const resp = await fetch('/api/budget');
    if (!resp.ok) return 50;
    const data = await resp.json();
    return data.budget;
  } catch { return 50; }
}

/** Set monthly budget via backend */
export async function setBudget(kg) {
  try {
    await fetch('/api/budget', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ budget: kg })
    });
  } catch (err) {
    console.error('Failed to set budget:', err);
  }
}

/** Sum CO2 used this month from backend */
export async function getMonthlyUsed() {
  const runs = await getRuns();
  return runs.reduce((sum, r) => sum + r.co2_kg, 0);
}
