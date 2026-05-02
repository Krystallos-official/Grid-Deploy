import { Octokit } from 'octokit';
import { REGIONS, FALLBACK_INTENSITY } from '../src/data/regions.js';

// We'll pass the fetchZoneIntensity function from server to decouple
export async function handlePRWebhook(payload, fetchZoneIntensity, ghToken) {
  if (!ghToken) {
    console.warn("No GITHUB_TOKEN set. Cannot process PR webhook.");
    return;
  }

  // Ensure this is a PR open or sync event
  const pr = payload.pull_request;
  if (!pr) return;
  
  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const pull_number = pr.number;

  const octokit = new Octokit({ auth: ghToken });

  try {
    // 1. Fetch changed files
    const { data: files } = await octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number,
    });

    // 2. Scan files for region declarations (Terraform, YAML, etc.)
    const regionRegex = /(?:region\s*=\s*"|region:\s*"|aws-region:\s*"|location\s*=\s*")([a-z0-9-]+)/g;
    const detectedRegions = new Set();

    files.forEach(file => {
      // Only process likely config files
      if (!/\.(tf|yml|yaml|json|ts|js)$/.test(file.filename)) return;
      
      const patch = file.patch || '';
      // Only look at added lines in the patch (starting with + but not +++)
      const addedLines = patch.split('\n').filter(line => line.startsWith('+') && !line.startsWith('+++')).join('\n');

      let match;
      while ((match = regionRegex.exec(addedLines)) !== null) {
        detectedRegions.add(match[1]);
      }
    });

    if (detectedRegions.size === 0) return;

    // 3. Check carbon intensity and build comment
    const THRESHOLD = process.env.CARBON_THRESHOLD || 200;
    let commentBody = "";

    for (const regionId of detectedRegions) {
      const regionMeta = REGIONS.find(r => r.id === regionId);
      if (!regionMeta) continue;

      let intensity = 999;
      try {
        intensity = await fetchZoneIntensity(regionMeta.zone);
      } catch {
        intensity = FALLBACK_INTENSITY[regionMeta.zone] || 999;
      }

      if (intensity > THRESHOLD) {
        // Find a cleaner alternative in the same provider
        const sameProvider = REGIONS.filter(r => r.provider === regionMeta.provider && r.id !== regionId);
        let bestAlt = null;
        let bestCi = 999;
        
        for (const alt of sameProvider) {
           let ci = FALLBACK_INTENSITY[alt.zone] || 999;
           try {
             ci = await fetchZoneIntensity(alt.zone);
           } catch { /* use fallback */ }
           if (ci < bestCi) {
             bestCi = ci;
             bestAlt = alt;
           }
        }

        commentBody += `### ⚠️ GridDeploy Carbon Alert\n\n`;
        commentBody += `Your PR deploys to **${regionId}** (${regionMeta.name}) — currently at **${intensity} gCO₂/kWh**.\n\n`;
        
        if (bestAlt) {
           const savedPct = Math.round((1 - bestCi / intensity) * 100);
           commentBody += `| | Current | Suggested |\n`;
           commentBody += `|---|---|---|\n`;
           commentBody += `| **Region** | ${regionId} (${regionMeta.name}) | ${bestAlt.id} (${bestAlt.name}) |\n`;
           commentBody += `| **Carbon** | ${intensity} gCO₂/kWh | ${bestCi} gCO₂/kWh |\n`;
           commentBody += `| **Saving** | — | **${savedPct}% cleaner** |\n\n`;
           commentBody += `🌱 **Suggestion:** Change to \`${bestAlt.id}\` (${bestAlt.name} — ${bestCi} gCO₂/kWh).\n\n`;
        }
      }
    }

    if (commentBody) {
      commentBody += `---\n<sub>🤖 Powered by GridDeploy GreenOps Bot</sub>`;
      
      // 4. Post comment
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: pull_number,
        body: commentBody
      });
      console.log(`Posted carbon alert on ${owner}/${repo}#${pull_number}`);
    }

  } catch (error) {
    console.error("Error processing PR webhook:", error);
  }
}
