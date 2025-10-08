const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();
const PORT = 3001;

// Enable CORS for all routes
app.use(cors());

// Proxy endpoint for ESP32 commands
app.use('/esp32', createProxyMiddleware({
  target: 'http://192.168.254.170', // Your ESP32 IP
  changeOrigin: true,
  pathRewrite: {
    '^/esp32': '', // Remove /esp32 prefix
  },
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
    res.status(500).json({ error: 'ESP32 not reachable' });
  }
}));

// Serve static files
app.use(express.static('.'));

app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
  console.log(`ESP32 proxy available at http://localhost:${PORT}/esp32`);
});
