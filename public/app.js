/* global domPanZoom */

let instance = null;
const logEl = document.getElementById('log');
const statusEl = document.getElementById('status');
const form = document.getElementById('options-form');

function log(message) {
  const line = `[${new Date().toLocaleTimeString()}] ${message}`;
  logEl.textContent = `${line}\n${logEl.textContent}`.slice(0, 4000);
}

function readOptions() {
  const data = new FormData(form);

  const bounds = data.get('bounds');
  const initialZoomRaw = String(data.get('initialZoom')).trim();
  const initialZoom = /^-?\d+(\.\d+)?$/.test(initialZoomRaw)
    ? parseFloat(initialZoomRaw)
    : initialZoomRaw;

  return {
    wrapperElement: '#wrapper',
    panZoomElement: '#content',
    bounds: bounds === 'false' ? false : bounds,
    center: data.get('center') === 'on',
    minZoom: parseFloat(data.get('minZoom')),
    maxZoom: parseFloat(data.get('maxZoom')),
    initialZoom,
    panEnabled: data.get('panEnabled') === 'on',
    zoomEnabled: data.get('zoomEnabled') === 'on',
    mouseWheelRequiresKey: data.get('mouseWheelRequiresKey') === 'on',
    dblClickZoomEnabled: data.get('dblClickZoomEnabled') === 'on',
    panStep: parseFloat(data.get('panStep')),
    zoomStep: parseFloat(data.get('zoomStep')),
    zoomSpeedWheel: parseFloat(data.get('zoomSpeedWheel')),
    zoomSpeedPinch: parseFloat(data.get('zoomSpeedPinch')),
    transitionSpeed: parseFloat(data.get('transitionSpeed')),
    initialPanX: parseFloat(data.get('initialPanX')),
    initialPanY: parseFloat(data.get('initialPanY')),
    onInit: (pos) => log(`onInit zoom=${pos.zoom.toFixed(3)}`),
    onChange: () => updateStatus(),
    onZoom: (pos) => log(`onZoom zoom=${pos.zoom.toFixed(3)}`),
    onPan: () => log('onPan')
  };
}

function updateStatus() {
  if (!instance) {
    statusEl.textContent = 'No instance — click Apply options';
    return;
  }

  const pan = instance.getPan();
  statusEl.textContent = [
    `zoom: ${instance.getZoom().toFixed(3)}`,
    `pan: ${pan.x.toFixed(1)}%, ${pan.y.toFixed(1)}%`,
    `matrix x/y: ${instance.x?.toFixed?.(1) ?? '—'}, ${instance.y?.toFixed?.(1) ?? '—'}`
  ].join('\n');
}

function destroyInstance() {
  instance = null;
}

function createInstance() {
  destroyInstance();

  try {
    instance = new domPanZoom(readOptions());
    log('Instance created');
    updateStatus();
  } catch (error) {
    log(`Error: ${error.message}`);
    updateStatus();
  }
}

function callMethod(name) {
  if (!instance) {
    log('Create an instance first');
    return;
  }

  switch (name) {
    case 'zoomToAt':
      instance.zoomToAt(2, { x: 200, y: 150, percent: false }, true);
      log('zoomToAt(2, { x: 200, y: 150 })');
      break;
    case 'reset':
      instance.reset(true);
      log('reset(true)');
      break;
    case 'resize':
      instance.resize();
      log('resize()');
      break;
    default:
      instance[name](true);
      log(`${name}(true)`);
  }

  updateStatus();
}

document.getElementById('apply').addEventListener('click', createInstance);

document.getElementById('reset-form').addEventListener('click', () => {
  form.reset();
  log('Form reset to defaults');
});

document.querySelectorAll('[data-method]').forEach((button) => {
  button.addEventListener('click', () => callMethod(button.dataset.method));
});

createInstance();
