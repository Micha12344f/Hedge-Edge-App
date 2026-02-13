/**
 * seed_localStorage.js
 * ====================
 * Node.js execution script that reads all demo JSON from tmp/ and generates
 * an HTML seeder page. Opening this page in the same browser origin as the
 * Vite dev server writes all data to localStorage, then redirects to the app.
 *
 * Usage:
 *   node seed_localStorage.js
 *
 * Output:
 *   ../../../tmp/seed-demo-data.html
 */

const fs = require('fs');
const path = require('path');

const TMP_DIR = path.resolve(__dirname, '..', '..', '..', '..', 'tmp');

// Map of localStorage key → JSON filename
const DATA_MAP = {
  hedge_edge_demo_accounts: 'demo-accounts-preview.json',
  hedge_edge_copier_groups: 'demo-copier-groups.json',
  hedge_edge_relationships: 'demo-relationships.json',
  hedge_edge_trade_history: 'demo-trade-history.json',
};

// Read and validate all JSON files
const dataEntries = {};
for (const [key, filename] of Object.entries(DATA_MAP)) {
  const filePath = path.join(TMP_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Missing: ${filePath}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  JSON.parse(raw); // validate JSON
  dataEntries[key] = raw.trim();
  console.log(`✅ Loaded ${filename} → ${key}`);
}

// Also add hedge map account IDs (all accounts should show on the map)
const accounts = JSON.parse(dataEntries.hedge_edge_demo_accounts);
const mapAccountIds = accounts.map(a => a.id);
dataEntries.hedge_edge_map_accounts = JSON.stringify(mapAccountIds);

// Cross-reference validation
const accountIds = new Set(accounts.map(a => a.id));
const copierGroups = JSON.parse(dataEntries.hedge_edge_copier_groups);
for (const group of copierGroups) {
  if (!accountIds.has(group.leaderAccountId)) {
    console.warn(`⚠️  Copier group "${group.name}" references unknown leader: ${group.leaderAccountId}`);
  }
  for (const follower of group.followers) {
    if (!accountIds.has(follower.accountId)) {
      console.warn(`⚠️  Copier group "${group.name}" references unknown follower: ${follower.accountId}`);
    }
  }
}
console.log(`\n✅ Cross-reference validation complete (${accountIds.size} accounts, ${copierGroups.length} copier groups)`);

// Generate the HTML seeder page
const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Hedge Edge — Demo Data Seeder</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0a0a0a; color: #e5e5e5; padding: 40px; max-width: 700px; margin: 0 auto; }
    h1 { color: #22c55e; font-size: 1.5rem; }
    .status { margin: 12px 0; padding: 10px 14px; border-radius: 8px; background: #1a1a1a; border: 1px solid #333; }
    .status.ok { border-color: #22c55e; }
    .status.info { border-color: #3b82f6; }
    .count { color: #22c55e; font-weight: bold; }
    button { background: #22c55e; color: #000; border: none; padding: 12px 28px; border-radius: 6px; font-weight: bold; font-size: 1rem; cursor: pointer; margin-top: 20px; }
    button:hover { background: #16a34a; }
    .note { color: #888; font-size: 0.85rem; margin-top: 16px; }
  </style>
</head>
<body>
  <h1>🌱 Hedge Edge Demo Data Seeder</h1>
  <p>This page injects realistic mock trading data into the app's localStorage.</p>
  
  <div id="statuses"></div>
  <button id="seedBtn" onclick="seedData()">Seed Demo Data & Open App</button>
  <button id="clearBtn" onclick="clearData()" style="background:#ef4444;margin-left:10px;">Clear All Data</button>
  
  <div class="note">
    Ensure this page is served from the same origin as the Vite dev server (http://localhost:5173).<br>
    If opened as a local file, localStorage won't carry over to the app.
  </div>

  <script>
    const DATA = ${JSON.stringify(dataEntries)};
    
    function seedData() {
      const statuses = document.getElementById('statuses');
      statuses.innerHTML = '';
      
      // Clear existing demo data first
      const keysToClean = [
        'hedge_edge_demo_accounts',
        'hedge_edge_copier_groups', 
        'hedge_edge_relationships',
        'hedge_edge_trade_history',
        'hedge_edge_map_accounts',
        'hedge_edge_node_positions',
        'hedge_edge_map_zoom',
        'hedge_edge_map_pan',
        'hedge_edge_payouts',
      ];
      keysToClean.forEach(k => localStorage.removeItem(k));
      
      for (const [key, value] of Object.entries(DATA)) {
        try {
          localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
          const parsed = JSON.parse(typeof value === 'string' ? value : JSON.stringify(value));
          const count = Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length;
          statuses.innerHTML += '<div class="status ok">✅ <strong>' + key + '</strong> — <span class="count">' + count + ' entries</span></div>';
        } catch (e) {
          statuses.innerHTML += '<div class="status" style="border-color:#ef4444;">❌ <strong>' + key + '</strong> — ' + e.message + '</div>';
        }
      }
      
      statuses.innerHTML += '<div class="status info">🚀 Data seeded! Redirecting to app in 2s...</div>';
      setTimeout(() => { window.location.href = '/'; }, 2000);
    }
    
    function clearData() {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('hedge_edge'));
      keys.forEach(k => localStorage.removeItem(k));
      document.getElementById('statuses').innerHTML = '<div class="status ok">🧹 Cleared ' + keys.length + ' keys from localStorage</div>';
    }
  </script>
</body>
</html>`;

const outputPath = path.join(TMP_DIR, 'seed-demo-data.html');
fs.writeFileSync(outputPath, html, 'utf8');
console.log(`\n🎉 Generated seeder page: ${outputPath}`);
console.log('   Serve from the Vite dev server public folder or open alongside the app.');
