const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const port = 3000;
const DEFAULT_ESP32_IP = '192.168.254.170';
let targetIP = DEFAULT_ESP32_IP;

// Enable CORS for all origins in development
app.use(cors());

// Home route to show proxy status
app.get('/', (req, res) => {
  res.json({
    status: 'Proxy server running',
    targetIP: targetIP || 'Not set',
    usage: {
      setIP: 'POST /set-ip with { "ip": "your.esp32.ip" }',
      proxy: 'All /proxy/* requests will be forwarded to ESP32',
      proxyStatus: 'GET /proxy/status to test ESP32 connection'
    }
  });
  console.log('Status checked. Current target IP:', targetIP);
});

// Store ESP32 IP
// (Removed duplicate declaration)

// Endpoint to set ESP32 IP
app.post('/set-ip', express.json(), (req, res) => {
  const { ip } = req.body;
  if (!ip) {
    return res.status(400).json({ error: 'IP address required' });
  }
  targetIP = ip;
  console.log('Set target IP to:', targetIP);
  res.json({ success: true, ip: targetIP });
});

// Proxy middleware
app.use('/proxy', (req, res, next) => {
  if (!targetIP) {
    return res.status(400).json({ error: 'ESP32 IP not set. Call /set-ip first.' });
  }
  
  const proxy = createProxyMiddleware({
    target: `http://${targetIP}`,
    changeOrigin: true,
    pathRewrite: {
      '^/proxy': ''
    },
    onProxyReq: (proxyReq, req) => {
      console.log(`Proxying ${req.method}: ${targetIP}${proxyReq.path}`);
    },
    onError: (err, req, res) => {
      console.error('Proxy error:', err);
      res.status(500).json({ error: 'Proxy error', message: err.message });
    }
  });

  proxy(req, res, next);
});

app.listen(port, () => {
  console.log(`Proxy server running at http://localhost:${port}`);
  console.log('Waiting for ESP32 IP to be set...');
});