/**
 * CloudPulse Local Development & API Proxy Server
 * 
 * Uses standard Node.js built-in modules (http, https, fs, path).
 * Provides:
 * 1. Fast static file server for index.html, styles.css, app.js, and assets.
 * 2. Optional local CORS reverse proxy for the deployed AWS API Gateway stage
 *    (useful for testing in browsers before updating Lambda CORS headers).
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8000;
const AWS_TARGET = 'zpbpv26plb.execute-api.ap-south-1.amazonaws.com';
const AWS_STAGE = '/prod';

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  // CORS Headers for all local responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // 1. API Reverse Proxy Route: /aws-proxy/*
  if (req.url.startsWith('/aws-proxy')) {
    const remotePath = req.url.replace(/^\/aws-proxy/, AWS_STAGE);
    console.log(`[Proxy] ${req.method} ${remotePath} -> AWS Gateway`);

    const proxyReq = https.request({
      hostname: AWS_TARGET,
      port: 443,
      path: remotePath,
      method: req.method,
      headers: {
        ...req.headers,
        host: AWS_TARGET
      }
    }, proxyRes => {
      const responseHeaders = { ...proxyRes.headers };
      responseHeaders['access-control-allow-origin'] = '*';
      responseHeaders['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
      responseHeaders['access-control-allow-headers'] = 'Content-Type, Authorization, x-api-key, X-Amz-Date, X-Api-Key, X-Amz-Security-Token';
      res.writeHead(proxyRes.statusCode, responseHeaders);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', err => {
      console.error('[Proxy Error]', err);
      res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'Proxy request failed', details: err.message }));
    });

    req.pipe(proxyReq);
    return;
  }

  // 2. Static File Serving
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

  const filePath = path.join(__dirname, reqPath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`404 Not Found: ${reqPath}`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(` CloudPulse Frontend Server Running at http://localhost:${PORT}`);
  console.log(` Direct AWS Backend: https://${AWS_TARGET}${AWS_STAGE}`);
  console.log(` Local Reverse Proxy: http://localhost:${PORT}/aws-proxy/tasks`);
  console.log(`======================================================\n`);
});
