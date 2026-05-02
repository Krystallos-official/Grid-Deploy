import * as topojson from 'topojson-client';
import { getIntensityColor } from '../data/regions.js';
import { fmt } from '../utils/carbon.js';

const MAP_WIDTH = 960;
const MAP_HEIGHT = 500;

// Simple equirectangular projection
function projectPoint(lon, lat) {
  const x = (lon + 180) / 360 * MAP_WIDTH;
  const y = (90 - lat) / 180 * MAP_HEIGHT;
  return [x, y];
}

// Convert GeoJSON coordinates to SVG path string
function geoToPath(geometry) {
  if (!geometry) return '';
  const paths = [];

  function processRing(ring) {
    return ring.map((coord, i) => {
      const [x, y] = projectPoint(coord[0], coord[1]);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join('') + 'Z';
  }

  if (geometry.type === 'Polygon') {
    geometry.coordinates.forEach(ring => paths.push(processRing(ring)));
  } else if (geometry.type === 'MultiPolygon') {
    geometry.coordinates.forEach(polygon => {
      polygon.forEach(ring => paths.push(processRing(ring)));
    });
  }
  return paths.join(' ');
}

export async function createWorldMap(container) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`);
  svg.setAttribute('class', 'world-map-svg');
  svg.id = 'world-map-svg';

  // Background
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width', MAP_WIDTH);
  bg.setAttribute('height', MAP_HEIGHT);
  bg.setAttribute('fill', '#0d1117');
  svg.appendChild(bg);

  // Country group
  const countriesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  countriesGroup.setAttribute('class', 'countries');
  svg.appendChild(countriesGroup);

  // Markers group
  const markersGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  markersGroup.setAttribute('class', 'markers');
  svg.appendChild(markersGroup);

  container.innerHTML = '';
  container.appendChild(svg);

  // Fetch world topology
  try {
    const resp = await fetch('https://unpkg.com/world-atlas@2/countries-110m.json');
    const world = await resp.json();
    const countries = topojson.feature(world, world.objects.countries);

    countries.features.forEach(feature => {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', geoToPath(feature.geometry));
      path.setAttribute('fill', '#1a2332');
      path.setAttribute('stroke', '#2a3a4a');
      path.setAttribute('stroke-width', '0.5');
      countriesGroup.appendChild(path);
    });
  } catch {
    // Fallback: just show markers on blank map
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', MAP_WIDTH / 2);
    text.setAttribute('y', MAP_HEIGHT / 2);
    text.setAttribute('fill', '#555');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-size', '14');
    text.textContent = 'Map data unavailable — showing region markers only';
    countriesGroup.appendChild(text);
  }

  return { svg, markersGroup };
}

// Tooltip element (shared)
let tooltip = null;
function getTooltip() {
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.className = 'map-tooltip';
    document.body.appendChild(tooltip);
  }
  return tooltip;
}

export function renderMarkers(markersGroup, regions, intensityData, results) {
  markersGroup.innerHTML = '';

  regions.forEach(region => {
    const zoneData = intensityData[region.zone];
    if (!zoneData) return;

    const [x, y] = projectPoint(region.coords[0], region.coords[1]);
    const intensity = zoneData.intensity;
    const color = getIntensityColor(intensity);
    const result = results?.[region.id];

    // Glow filter
    const glow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    glow.setAttribute('cx', x);
    glow.setAttribute('cy', y);
    glow.setAttribute('r', '18');
    glow.setAttribute('fill', color);
    glow.setAttribute('opacity', '0.15');
    glow.setAttribute('class', 'marker-glow');
    markersGroup.appendChild(glow);

    // Main circle
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', x);
    circle.setAttribute('cy', y);
    circle.setAttribute('r', '6');
    circle.setAttribute('fill', color);
    circle.setAttribute('stroke', '#000');
    circle.setAttribute('stroke-width', '1.5');
    circle.setAttribute('class', 'region-marker');
    circle.setAttribute('data-region', region.id);

    // Tooltip handlers
    circle.addEventListener('mouseenter', (e) => {
      const tt = getTooltip();
      const sourceTag = zoneData.source === 'live'
        ? '<span class="tag-live">live</span>'
        : zoneData.source === 'cached'
          ? `<span class="tag-cached">cached ${zoneData.minutesAgo || ''}m ago</span>`
          : '<span class="tag-estimated">estimated</span>';

      let html = `
        <div class="tt-header">${region.id} — ${region.name}</div>
        <div class="tt-provider">${region.provider}</div>
        <div class="tt-intensity">${intensity} gCO2/kWh ${sourceTag}</div>
      `;
      if (result) {
        html += `
          <div class="tt-co2">Your workload: ${fmt(result.co2Kg, 2)} kg CO₂</div>
          <div class="tt-equiv">≈ ${fmt(result.kmDriven, 1)} km driven</div>
        `;
      }
      tt.innerHTML = html;
      tt.style.display = 'block';

      // Position near cursor
      const rect = circle.closest('svg').getBoundingClientRect();
      const scale = rect.width / MAP_WIDTH;
      tt.style.left = `${rect.left + x * scale + 20}px`;
      tt.style.top = `${rect.top + y * scale - 20}px`;

      // Keep tooltip in viewport
      requestAnimationFrame(() => {
        const ttRect = tt.getBoundingClientRect();
        if (ttRect.right > window.innerWidth) {
          tt.style.left = `${rect.left + x * scale - ttRect.width - 20}px`;
        }
        if (ttRect.bottom > window.innerHeight) {
          tt.style.top = `${window.innerHeight - ttRect.height - 10}px`;
        }
      });
    });

    circle.addEventListener('mouseleave', () => {
      getTooltip().style.display = 'none';
    });

    markersGroup.appendChild(circle);
  });
}

export function renderLegend(container) {
  container.innerHTML = `
    <div class="map-legend">
      <div class="legend-bar">
        <div class="legend-gradient"></div>
        <div class="legend-labels">
          <span>0</span><span>100</span><span>200</span><span>300</span><span>400</span><span>600+</span>
        </div>
      </div>
      <div class="legend-label-row">
        <span class="legend-label-clean">🌿 Clean grid</span>
        <span class="legend-label-unit">gCO₂/kWh</span>
        <span class="legend-label-dirty">🔥 Dirty grid</span>
      </div>
    </div>
  `;
}

export function downloadMapSvg() {
  const svg = document.getElementById('world-map-svg');
  if (!svg) return;
  const serializer = new XMLSerializer();
  let source = serializer.serializeToString(svg);
  source = '<?xml version="1.0" standalone="no"?>\n' + source;
  const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const ts = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-');
  a.download = `griddeploy-${ts}.svg`;
  a.href = url;
  a.click();
  URL.revokeObjectURL(url);
}
