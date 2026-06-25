#!/usr/bin/env node
/**
 * デプロイ前にリモートの extras-*.json を保護する。
 * リモートの updatedAt が新しい場合はリモートを採用。
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const REMOTE_BASE = process.env.EXTRAS_REMOTE_BASE
  || 'https://raw.githubusercontent.com/takpz93/invoice-input/main/data';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function metaTime(json) {
  const t = json?._meta?.updatedAt;
  return t ? new Date(t).getTime() : 0;
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

async function preserveFile(filename) {
  const localPath = path.join(DATA_DIR, filename);
  let local = null;
  if (fs.existsSync(localPath)) {
    try { local = JSON.parse(fs.readFileSync(localPath, 'utf8')); }
    catch (e) { console.warn(`Local ${filename} parse error:`, e.message); }
  }

  let remote = null;
  try {
    remote = await fetchJson(`${REMOTE_BASE}/${filename}`);
  } catch (e) {
    console.log(`Remote ${filename} not fetched:`, e.message);
  }

  if (!remote) {
    if (local) console.log(`Keeping local ${filename}`);
    return;
  }
  if (!local) {
    writeJson(localPath, remote);
    console.log(`Restored remote ${filename}`);
    return;
  }

  const lt = metaTime(local);
  const rt = metaTime(remote);
  if (rt > lt) {
    writeJson(localPath, remote);
    console.log(`Preserved remote ${filename} (newer)`);
  } else {
    console.log(`Keeping local ${filename}`);
  }
}

async function main() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const files = fs.readdirSync(DATA_DIR).filter((f) => f.startsWith('extras-') && f.endsWith('.json'));
  if (!files.length) {
    console.log('No extras-*.json files found');
    return;
  }
  for (const f of files) await preserveFile(f);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
