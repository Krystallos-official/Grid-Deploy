import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import path from 'path';
import db, { getRuns, logRun, getBudget, setBudget } from './db.js';
import { handlePRWebhook } from './github.js';

dotenv.config();

const app = express();
app.use(cors());

// Use raw body for webhook signature verification if needed later, 
// but for simplicity we'll just use json for everything here.
app.use(express.json());

const PORT = process.env.PORT || 3000;
const API_BASE = 'https://api.electricitymap.org/v3';

// Simple in-memory cache for the server
const intensityCache = new Map();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

async function fetchZoneIntensity(zone) {
  // Check cache
  if (intensityCache.has(zone)) {
    const cached = intensityCache.get(zone);
    if (Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.intensity;
    }
  }

  // Fetch from API
  const resp = await fetch(`${API_BASE}/carbon-intensity/latest?zone=${zone}`);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const json = await resp.json();
  const intensity = json.carbonIntensity;

  // Store in cache
  intensityCache.set(zone, { intensity, timestamp: Date.now() });
  return intensity;
}

// ─── Carbon API Proxy ───

app.get('/api/carbon/live', async (req, res) => {
  const { zone } = req.query;
  if (!zone) return res.status(400).json({ error: 'Zone is required' });

  try {
    const intensity = await fetchZoneIntensity(zone);
    // Determine minutes ago if served from cache vs fresh
    let minutesAgo = 0;
    let source = 'live';
    if (intensityCache.has(zone)) {
       const cached = intensityCache.get(zone);
       minutesAgo = Math.round((Date.now() - cached.timestamp) / 60000);
       if (minutesAgo > 0) source = 'cached';
    }

    res.json({ intensity, source, minutesAgo });
  } catch (error) {
    res.status(502).json({ error: 'Failed to fetch intensity', details: error.message });
  }
});

app.get('/api/carbon/forecast', async (req, res) => {
  const { zone } = req.query;
  if (!zone) return res.status(400).json({ error: 'Zone is required' });

  try {
    const resp = await fetch(`${API_BASE}/carbon-intensity/forecast?zone=${zone}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    res.json(json.forecast || json);
  } catch (error) {
    res.status(502).json({ error: 'Failed to fetch forecast', details: error.message });
  }
});

// ─── Budget & Runs Tracking (SQLite) ───

app.get('/api/budget', (req, res) => {
  res.json({ budget: getBudget() });
});

app.post('/api/budget', (req, res) => {
  const { budget } = req.body;
  if (budget === undefined) return res.status(400).json({ error: 'Budget required' });
  setBudget(parseFloat(budget));
  res.json({ success: true, budget: getBudget() });
});

app.get('/api/runs', (req, res) => {
  res.json(getRuns());
});

app.post('/api/runs', (req, res) => {
  const { region, co2_kg, workload_label } = req.body;
  if (!region || co2_kg === undefined || !workload_label) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  logRun(region, parseFloat(co2_kg), workload_label);
  res.json({ success: true, runs: getRuns() });
});

// ─── GitHub Webhook ───

app.post('/api/webhooks/github', async (req, res) => {
  const event = req.headers['x-github-event'];
  if (event === 'pull_request') {
    const action = req.body.action;
    // We care about opened, synchronize, or reopened PRs
    if (['opened', 'synchronize', 'reopened'].includes(action)) {
      // Process in background
      handlePRWebhook(req.body, fetchZoneIntensity, process.env.GITHUB_TOKEN);
    }
  }
  // Always acknowledge receipt
  res.status(200).send('OK');
});

// ─── Serve Frontend in Production ───
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, '../dist')));

app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// ─── Start Server ───
app.listen(PORT, () => {
  console.log(`🚀 GridDeploy Backend running on http://localhost:${PORT}`);
});
