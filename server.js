const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');

const PORT = process.env.PORT || 3443;
const IS_LOCAL = !process.env.PORT;

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

if (IS_LOCAL) {
  // Lokálně — HTTPS s self-signed certem (kvůli DeviceOrientation)
  try {
    const ssl = { key: fs.readFileSync('cert.key'), cert: fs.readFileSync('cert.pem') };
    https.createServer(ssl, handler).listen(PORT, () => {
      console.log(`\n  VOID RUNNER: https://localhost:${PORT}\n`);
    });
    // HTTP → HTTPS redirect
    http.createServer((req, res) => {
      res.writeHead(301, { Location: `https://localhost:${PORT}${req.url}` });
      res.end();
    }).on('error', () => {}).listen(3000);
  } catch(e) {
    http.createServer(handler).listen(PORT, () => {
      console.log(`\n  VOID RUNNER: http://localhost:${PORT}\n`);
    });
  }
} else {
  // OCP / produkce — plain HTTP, SSL řeší ingress
  http.createServer(handler).listen(PORT, '0.0.0.0', () => {
    console.log(`VOID RUNNER listening on port ${PORT}`);
  });
}
