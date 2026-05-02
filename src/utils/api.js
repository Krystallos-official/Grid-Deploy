import { FALLBACK_INTENSITY, REGIONS } from '../data/regions.js';

// Fetch live carbon intensity for a single zone from our backend proxy
async function fetchZoneIntensity(zone) {
  const resp = await fetch(`/api/carbon/live?zone=${zone}`);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

// Fetch all unique zones in parallel, with fallback
export async function fetchAllIntensities(onProgress) {
  const uniqueZones = [...new Set(REGIONS.map(r => r.zone))];
  const total = uniqueZones.length;
  let resolved = 0;
  const results = {};

  const isOffline = !navigator.onLine;
  if (isOffline) {
    for (const zone of uniqueZones) {
      results[zone] = {
        intensity: FALLBACK_INTENSITY[zone] || 300,
        source: 'estimated',
        minutesAgo: 0
      };
    }
    onProgress?.(total, total, true);
    return results;
  }

  const promises = uniqueZones.map(async (zone) => {
    try {
      const data = await fetchZoneIntensity(zone);
      results[zone] = { 
        intensity: data.intensity, 
        source: data.source, 
        minutesAgo: data.minutesAgo || 0 
      };
    } catch {
      results[zone] = {
        intensity: FALLBACK_INTENSITY[zone] || 300,
        source: 'estimated',
        minutesAgo: 0
      };
    } finally {
      resolved++;
      onProgress?.(resolved, total, resolved === total);
    }
  });

  await Promise.allSettled(promises);
  return results;
}

// Fetch 24h forecast for a zone from our backend proxy
export async function fetchForecast(zone) {
  if (!navigator.onLine) return null;
  try {
    const resp = await fetch(`/api/carbon/forecast?zone=${zone}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  } catch {
    return null;
  }
}
