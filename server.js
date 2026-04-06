const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const os    = require('os');

const PORT_HTTPS = 3443;
const PORT_HTTP  = 3000;

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.ico':  'image/x-icon',
};

function handler(req, res) {
  let filePath = '.' + decodeURIComponent(req.url.split('?')[0]);
  if (filePath === './') filePath = './index.html';

  const ext = path.extname(filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found: ' + filePath); return; }
    res.writeHead(200, { 'Content-Type': mime[ext] || 'text/plain' });
    res.end(data);
  });
}

// ── HTTPS server (pro tilt na mobilu) ───────────────────────────────────────
try {
  const ssl = {
    key:  fs.readFileSync('cert.key'),
    cert: fs.readFileSync('cert.pem'),
  };
  https.createServer(ssl, handler).listen(PORT_HTTPS);
} catch(e) {
  console.warn('  SSL cert nenalezen — HTTPS server nespuštěn');
}

// ── HTTP redirect → HTTPS ────────────────────────────────────────────────────
http.createServer((req, res) => {
  res.writeHead(301, { Location: `https://${req.headers.host?.replace(PORT_HTTP, PORT_HTTPS) || 'localhost:' + PORT_HTTPS}${req.url}` });
  res.end();
}).on('error', () => {
  console.warn(`  HTTP redirect (port ${PORT_HTTP}) nelze spustit — port obsazen`);
}).listen(PORT_HTTP);

// ── Zobraz IP adresy ─────────────────────────────────────────────────────────
const nets = os.networkInterfaces();
const ips = [];
for (const iface of Object.values(nets)) {
  for (const n of iface) {
    if (n.family === 'IPv4' && !n.internal) ips.push(n.address);
  }
}

console.log('\n  VOID RUNNER server (HTTPS)\n');
console.log(`  Lokálně:  https://localhost:${PORT_HTTPS}`);
ips.forEach(ip => console.log(`  Mobil:    https://${ip}:${PORT_HTTPS}  ← toto otevři na telefonu`));
console.log('\n  Poznámka: prohlížeč zobrazí varování o certifikátu — klikni "Pokračovat"');
console.log();
