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
    const status = await fetchStatus();
    wifiStatus.textContent = 'Wi‑Fi reachable';
    renderStatus(status);
    state.deviceTransport = 'wifi';
    updateDeviceConn();
  } catch (e) {
    wifiStatus.textContent = 'Wi‑Fi not reachable';
  }
});

bleConnectBtn.addEventListener('click', async () => {
  try {
    await bleConnect();
    bleStatus.textContent = 'BLE connected';
    state.deviceTransport = 'ble';
    updateDeviceConn();
  } catch (e) {
    bleStatus.textContent = 'BLE connect failed';
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
  if (state.deviceTransport === 'ble' && state.ble.characteristic) {
    const encoder = new TextEncoder();
    await state.ble.characteristic.writeValue(encoder.encode(cmd));
    return;
  }
  if (!state.espIp) {
    alert('Set ESP32 IP first or connect via BLE.');
    return;
  }
  const url = `http://${state.espIp}/command`;
  await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: cmd });
}

async function fetchStatus() {
  if (!state.espIp) throw new Error('No IP');
  const url = `http://${state.espIp}/status`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Status error');
  return await res.json();
}

function renderStatus(st) {
  if (!st) return;
  modeValue.textContent = st.mode || '—';
  soundValue.textContent = st.sound ? '1' : '0';
  vibrationValue.textContent = st.vibration ? '1' : '0';
  proximityValue.textContent = st.proximity ?? '—';
}

async function bleConnect() {
  if (!navigator.bluetooth) throw new Error('Web Bluetooth not supported');
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


