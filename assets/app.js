/* App state */
const state = {
  espIp: localStorage.getItem('espIp') || '',
  deviceTransport: 'none', // 'wifi' | 'ble' | 'none'
  ble: {
    device: null,
    server: null,
    service: null,
    characteristic: null,
  },
  timers: {
    statusPoll: null,
  }
};

/* Constants - match Arduino sketch */
const BLE_SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const BLE_CHAR_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';
const DEFAULT_DEVICE_NAME = 'GizaPyramid';

/* DOM */
const $ = (id) => document.getElementById(id);
const espIpInput = $('espIp');
const saveIpBtn = $('saveIpBtn');
const wifiTestBtn = $('wifiTestBtn');
const wifiStatus = $('wifiStatus');
const bleConnectBtn = $('bleConnectBtn');
const bleDisconnectBtn = $('bleDisconnectBtn');
const bleStatus = $('bleStatus');
const dayBtn = $('dayBtn');
const nightBtn = $('nightBtn');
const stormBtn = $('stormBtn');
const modeValue = $('modeValue');
const soundValue = $('soundValue');
const vibrationValue = $('vibrationValue');
const proximityValue = $('proximityValue');
const deviceConn = $('deviceConn');
const refreshStatusBtn = $('refreshStatusBtn');
const autoRefreshToggle = $('autoRefreshToggle');
const installBtn = $('installBtn');

// PWA install prompt
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.hidden = false;
});
installBtn?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.hidden = true;
});

// Service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(console.error);
  });
}

// Init
espIpInput.value = state.espIp;
updateDeviceConn();

saveIpBtn.addEventListener('click', () => {
  state.espIp = (espIpInput.value || '').trim();
  localStorage.setItem('espIp', state.espIp);
  wifiStatus.textContent = 'Saved IP: ' + state.espIp;
});

wifiTestBtn.addEventListener('click', async () => {
  try {
    wifiStatus.textContent = 'Testing...';
    const status = await fetchStatus();
    wifiStatus.textContent = 'Wi‑Fi reachable';
    renderStatus(status);
    state.deviceTransport = 'wifi';
    updateDeviceConn();
  } catch (e) {
    console.error('Wi-Fi test failed:', e);
    wifiStatus.textContent = `Wi‑Fi error: ${e.message}`;
  }
});

bleConnectBtn.addEventListener('click', async () => {
  try {
    bleStatus.textContent = 'Connecting...';
    await bleConnect();
    bleStatus.textContent = 'BLE connected';
    state.deviceTransport = 'ble';
    updateDeviceConn();
  } catch (e) {
    console.error('BLE connect failed:', e);
    bleStatus.textContent = `BLE error: ${e.message}`;
  }
});

bleDisconnectBtn.addEventListener('click', async () => {
  await bleDisconnect();
});

dayBtn.addEventListener('click', () => sendCommand('DAY'));
nightBtn.addEventListener('click', () => sendCommand('NIGHT'));
stormBtn.addEventListener('click', () => sendCommand('STORM'));

refreshStatusBtn.addEventListener('click', async () => {
  try {
    const st = await fetchStatus();
    renderStatus(st);
  } catch {}
});

autoRefreshToggle.addEventListener('change', () => {
  if (autoRefreshToggle.checked) {
    startAutoRefresh();
  } else {
    stopAutoRefresh();
  }
});

function startAutoRefresh() {
  stopAutoRefresh();
  state.timers.statusPoll = setInterval(async () => {
    try {
      const st = await fetchStatus();
      renderStatus(st);
    } catch {}
  }, 1500);
}

function stopAutoRefresh() {
  if (state.timers.statusPoll) clearInterval(state.timers.statusPoll);
  state.timers.statusPoll = null;
}

function updateDeviceConn() {
  const label = state.deviceTransport === 'wifi' ? 'Wi‑Fi' : state.deviceTransport === 'ble' ? 'BLE' : 'Wi‑Fi/BLE';
  deviceConn.textContent = label;
  bleDisconnectBtn.disabled = state.deviceTransport !== 'ble';
}

async function sendCommand(cmd) {
  try {
    if (state.deviceTransport === 'ble' && state.ble.characteristic) {
      const encoder = new TextEncoder();
      await state.ble.characteristic.writeValue(encoder.encode(cmd));
      console.log('BLE command sent:', cmd);
      return;
    }
    const ip = state.espIp || espIpInput.value.trim();
    if (!ip) {
      alert('Enter ESP32 IP address first or connect via BLE.');
      return;
    }
    const url = `http://${ip}/command`;
    console.log('Sending Wi-Fi command:', cmd, 'to', url);
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: cmd });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    console.log('Wi-Fi command sent successfully');
  } catch (e) {
    console.error('Command failed:', e);
    alert(`Command failed: ${e.message}`);
  }
}

async function fetchStatus() {
  const ip = state.espIp || espIpInput.value.trim();
  if (!ip) throw new Error('No IP - enter ESP32 IP address');
  const url = `http://${ip}/status`;
  console.log('Fetching status from:', url);
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return await res.json();
}

function renderStatus(st) {
  if (!st) return;
  modeValue.textContent = st.mode || '—';
  // Display what sensors detect
  // ESP32 JSON: sound = 1 when digitalRead == LOW (sound detected)
  //             vibration = 1 when digitalRead == HIGH (vibration detected)
  const soundDetected = !!st.sound;
  const vibrationDetected = !!st.vibration;
  soundValue.textContent = soundDetected ? 'Detected' : 'None';
  vibrationValue.textContent = vibrationDetected ? 'Detected' : 'None';
  proximityValue.textContent = st.proximity ?? '—';
}

async function bleConnect() {
  if (!navigator.bluetooth) {
    throw new Error('Web Bluetooth not supported. Use Chrome on Android or enable experimental features.');
  }
  
  // Check if Bluetooth is available
  if (!await navigator.bluetooth.getAvailability()) {
    throw new Error('Bluetooth not available. Enable Bluetooth on your device.');
  }
  
  const device = await navigator.bluetooth.requestDevice({
    filters: [{ name: DEFAULT_DEVICE_NAME }, { services: [BLE_SERVICE_UUID] }],
    optionalServices: [BLE_SERVICE_UUID]
  });
  const server = await device.gatt.connect();
  const service = await server.getPrimaryService(BLE_SERVICE_UUID);
  const characteristic = await service.getCharacteristic(BLE_CHAR_UUID);
  state.ble = { device, server, service, characteristic };
  device.addEventListener('gattserverdisconnected', () => {
    bleStatus.textContent = 'BLE disconnected';
    state.deviceTransport = 'none';
    updateDeviceConn();
  });
}

async function bleDisconnect() {
  try {
    if (state.ble.device && state.ble.device.gatt.connected) {
      state.ble.device.gatt.disconnect();
    }
  } finally {
    state.ble = { device: null, server: null, service: null, characteristic: null };
    bleStatus.textContent = 'Not connected';
    if (state.deviceTransport === 'ble') state.deviceTransport = 'none';
    updateDeviceConn();
  }
}


