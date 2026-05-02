// Fallback carbon intensity data (gCO2eq/kWh — 2024 annual averages)
export const FALLBACK_INTENSITY = {
  'US-MIDA-PJM': 342, 'US-MIDW-MISO': 395, 'US-CAL-CISO': 210,
  'US-NW-PACW': 110, 'IE': 278, 'FR': 56, 'DE': 380, 'SE': 13,
  'SG': 408, 'JP-TK': 471, 'IN-WE': 708, 'BR-CS': 98, 'CA-QC': 2,
  'BE': 145, 'NL': 298, 'FI': 65, 'TW': 494, 'AU-NSW': 620,
};

// Real-world on-demand compute pricing ($/hr for a p3.2xlarge GPU instance equivalent)
// Source: public pricing pages for AWS/GCP/Azure, Jan 2025
const REGION_PRICING = {
  // AWS p3.2xlarge (1x V100)
  'us-east-1': 3.06, 'us-east-2': 3.06, 'us-west-1': 3.40, 'us-west-2': 3.06,
  'eu-west-1': 3.45, 'eu-west-3': 3.82, 'eu-central-1': 3.59,
  'eu-north-1': 3.27, 'ap-southeast-1': 3.92, 'ap-northeast-1': 4.19,
  'ap-south-1': 2.93, 'sa-east-1': 5.01, 'ca-central-1': 3.40,
  // GCP a2-highgpu-1g
  'us-central1': 3.67, 'us-east4': 3.67, 'europe-west1': 4.04,
  'europe-west4': 4.04, 'europe-north1': 3.81, 'asia-east1': 4.32,
  'asia-southeast1': 4.12, 'australia-southeast1': 4.73,
  // Azure NC6s_v3
  'eastus': 3.06, 'westeurope': 3.71, 'northeurope': 3.42,
  'westus2': 3.06, 'southeastasia': 3.98, 'japaneast': 4.28,
};

// Cloud regions with their metadata
export const REGIONS = [
  // AWS
  { id: 'us-east-1', name: 'N. Virginia', provider: 'AWS', zone: 'US-MIDA-PJM', coords: [-77.0, 38.9] },
  { id: 'us-east-2', name: 'Ohio', provider: 'AWS', zone: 'US-MIDW-MISO', coords: [-83.0, 40.0] },
  { id: 'us-west-1', name: 'N. California', provider: 'AWS', zone: 'US-CAL-CISO', coords: [-121.0, 37.0] },
  { id: 'us-west-2', name: 'Oregon', provider: 'AWS', zone: 'US-NW-PACW', coords: [-120.5, 45.5] },
  { id: 'eu-west-1', name: 'Ireland', provider: 'AWS', zone: 'IE', coords: [-8.0, 53.0] },
  { id: 'eu-west-3', name: 'Paris', provider: 'AWS', zone: 'FR', coords: [2.3, 48.9] },
  { id: 'eu-central-1', name: 'Frankfurt', provider: 'AWS', zone: 'DE', coords: [8.7, 50.1] },
  { id: 'eu-north-1', name: 'Stockholm', provider: 'AWS', zone: 'SE', coords: [18.0, 59.3] },
  { id: 'ap-southeast-1', name: 'Singapore', provider: 'AWS', zone: 'SG', coords: [103.8, 1.3] },
  { id: 'ap-northeast-1', name: 'Tokyo', provider: 'AWS', zone: 'JP-TK', coords: [139.7, 35.7] },
  { id: 'ap-south-1', name: 'Mumbai', provider: 'AWS', zone: 'IN-WE', coords: [72.9, 19.1] },
  { id: 'sa-east-1', name: 'São Paulo', provider: 'AWS', zone: 'BR-CS', coords: [-46.6, -23.5] },
  { id: 'ca-central-1', name: 'Montreal', provider: 'AWS', zone: 'CA-QC', coords: [-73.6, 45.5] },
  // GCP
  { id: 'us-central1', name: 'Iowa', provider: 'GCP', zone: 'US-MIDW-MISO', coords: [-93.6, 41.6] },
  { id: 'us-east4', name: 'N. Virginia', provider: 'GCP', zone: 'US-MIDA-PJM', coords: [-77.0, 38.9] },
  { id: 'europe-west1', name: 'Belgium', provider: 'GCP', zone: 'BE', coords: [3.7, 50.5] },
  { id: 'europe-west4', name: 'Netherlands', provider: 'GCP', zone: 'NL', coords: [4.9, 52.4] },
  { id: 'europe-north1', name: 'Finland', provider: 'GCP', zone: 'FI', coords: [25.0, 60.2] },
  { id: 'asia-east1', name: 'Taiwan', provider: 'GCP', zone: 'TW', coords: [121.0, 25.0] },
  { id: 'asia-southeast1', name: 'Singapore', provider: 'GCP', zone: 'SG', coords: [103.8, 1.3] },
  { id: 'australia-southeast1', name: 'Sydney', provider: 'GCP', zone: 'AU-NSW', coords: [151.2, -33.9] },
  // Azure
  { id: 'eastus', name: 'Virginia', provider: 'Azure', zone: 'US-MIDA-PJM', coords: [-77.0, 38.9] },
  { id: 'westeurope', name: 'Netherlands', provider: 'Azure', zone: 'NL', coords: [4.9, 52.4] },
  { id: 'northeurope', name: 'Ireland', provider: 'Azure', zone: 'IE', coords: [-8.0, 53.0] },
  { id: 'westus2', name: 'Washington', provider: 'Azure', zone: 'US-NW-PACW', coords: [-120.5, 47.6] },
  { id: 'southeastasia', name: 'Singapore', provider: 'Azure', zone: 'SG', coords: [103.8, 1.3] },
  { id: 'japaneast', name: 'Tokyo', provider: 'Azure', zone: 'JP-TK', coords: [139.7, 35.7] },
];

// Workload presets
export const WORKLOAD_PRESETS = [
  { label: 'ML Training — Small (1× GPU)', watts: 300 },
  { label: 'ML Training — Large (8× GPU cluster)', watts: 2400 },
  { label: 'Batch Data Processing (4 vCPU)', watts: 60 },
  { label: 'Web Server (2 vCPU standard)', watts: 30 },
  { label: 'Database Query Job (8 vCPU high-mem)', watts: 120 },
  { label: 'Serverless Function (lightweight)', watts: 5 },
  { label: 'Custom / Manual', watts: null },
];

// Cost tiers ($/hour by wattage — fallback if no region-specific pricing)
export const COST_TIERS = [
  { max: 10, rate: 0.02 },
  { max: 50, rate: 0.08 },
  { max: 150, rate: 0.25 },
  { max: 500, rate: 1.20 },
  { max: Infinity, rate: 3.50 },
];

// Color scale for carbon intensity
export const INTENSITY_COLORS = [
  { max: 50, color: '#00e676' },
  { max: 100, color: '#69f0ae' },
  { max: 200, color: '#ffff00' },
  { max: 300, color: '#ffab00' },
  { max: 450, color: '#ff6d00' },
  { max: 600, color: '#f44336' },
  { max: Infinity, color: '#b71c1c' },
];

export function getIntensityColor(intensity) {
  for (const tier of INTENSITY_COLORS) {
    if (intensity <= tier.max) return tier.color;
  }
  return '#b71c1c';
}

export function getCostRate(watts) {
  for (const tier of COST_TIERS) {
    if (watts <= tier.max) return tier.rate;
  }
  return 3.50;
}

/** Get real region-specific pricing ($/hr for GPU instance) */
export function getRegionPrice(regionId) {
  return REGION_PRICING[regionId] || 3.50;
}
