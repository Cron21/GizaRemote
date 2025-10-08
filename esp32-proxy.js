const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const port = 3000;
const ESP32_IP = '192.168.254.170';  // Your ESP32's IP

// Enable CORS for all origins
app.use(cors());

// Log all requests
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
});

// Home route to show status
app.get('/', (req, res) => {
    res.json({
        status: 'Proxy server running',
        esp32IP: ESP32_IP,
        endpoints: {
            status: '/proxy/status',
            command: '/proxy/command'
        }
    });
});

// Create proxy middleware
const proxyOptions = {
    target: `http://${ESP32_IP}`,
    changeOrigin: true,
    pathRewrite: {
        '^/proxy': ''
    },
    onProxyReq: (proxyReq, req) => {
        console.log(`Proxying ${req.method}: ${ESP32_IP}${proxyReq.path}`);
    },
    onProxyRes: (proxyRes, req) => {
        console.log(`Response from ESP32: ${proxyRes.statusCode}`);
    },
    onError: (err, req, res) => {
        console.error('Proxy error:', err);
        res.status(500).json({ 
            error: 'Proxy error', 
            message: err.message,
            esp32IP: ESP32_IP
        });
    }
};

// Apply proxy to /proxy path
app.use('/proxy', createProxyMiddleware(proxyOptions));

// Start server
app.listen(port, () => {
    console.log(`Proxy server running at http://localhost:${port}`);
    console.log(`Proxying requests to ESP32 at ${ESP32_IP}`);
});