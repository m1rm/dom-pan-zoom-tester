/* global domPanZoom */

let instance = null;
const logEl = document.getElementById('log');
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

function formatRoom(percent) {
  if (percent === null) {
    return '—';
  }
  if (!Number.isFinite(percent)) {
    return '∞';
  }
  return `${Math.max(0, percent).toFixed(1)}%`;
}

function setRoomValue(id, percent) {
  const el = document.getElementById(id);
  el.textContent = formatRoom(percent);
  el.classList.toggle('is-zero', Number.isFinite(percent) && percent <= 0.05);
}

/** Remaining pan room in each direction, as % of content (same units as panStep). */
function getPanRoom(inst) {
  const wrapper = inst.getWrapper();
  const container = inst.getContainer();
  if (!wrapper || !container) {
    return { left: 0, right: 0, up: 0, down: 0, bounded: true };
  }

  if (!inst.options.bounds) {
    return { left: Infinity, right: Infinity, up: Infinity, down: Infinity, bounded: false };
  }

  const zoom = inst.zoom;
  const wrapperWidth = wrapper.clientWidth;
  const wrapperHeight = wrapper.clientHeight;
  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;
  const containerZoomWidth = containerWidth * zoom;
  const containerZoomHeight = containerHeight * zoom;

  const upperOffsetX = (containerWidth / 2) * (zoom - 1);
  const lowerOffsetX = upperOffsetX * -1 + wrapperWidth - containerWidth;
  const upperOffsetY = (containerHeight / 2) * (zoom - 1);
  const lowerOffsetY = upperOffsetY * -1 + wrapperHeight - containerHeight;

  // Mirror setPosition() clamp ranges.
  let minX;
  let maxX;
  let minY;
  let maxY;

  if (containerZoomWidth < wrapperWidth) {
    minX = upperOffsetX;
    maxX = lowerOffsetX;
  } else {
    minX = lowerOffsetX;
    maxX = upperOffsetX;
  }

  if (containerZoomHeight < wrapperHeight) {
    minY = upperOffsetY;
    maxY = lowerOffsetY;
  } else {
    minY = lowerOffsetY;
    maxY = upperOffsetY;
  }

  if (minX > maxX) {
    minX = maxX = inst.x;
  }
  if (minY > maxY) {
    minY = maxY = inst.y;
  }

  const unitX = containerWidth * zoom;
  const unitY = containerHeight * zoom;

  // panLeft decreases x; panRight increases x; panUp decreases y; panDown increases y.
  return {
    left: ((inst.x - minX) / unitX) * 100,
    right: ((maxX - inst.x) / unitX) * 100,
    up: ((inst.y - minY) / unitY) * 100,
    down: ((maxY - inst.y) / unitY) * 100,
    bounded: true
  };
}

function updateStatus() {
  const hintEl = document.getElementById('status-bounds-hint');

  if (!instance) {
    document.getElementById('status-zoom').textContent = '—';
    document.getElementById('status-pan-x').textContent = '—';
    document.getElementById('status-pan-y').textContent = '—';
    document.getElementById('status-matrix').textContent = 'No instance — click Apply options';
    setRoomValue('status-room-left', null);
    setRoomValue('status-room-right', null);
    setRoomValue('status-room-up', null);
    setRoomValue('status-room-down', null);
    hintEl.textContent = '';
    return;
  }

  const pan = instance.getPan();
  const room = getPanRoom(instance);

  document.getElementById('status-zoom').textContent = instance.getZoom().toFixed(3);
  document.getElementById('status-pan-x').textContent = `${pan.x.toFixed(1)}%`;
  document.getElementById('status-pan-y').textContent = `${pan.y.toFixed(1)}%`;
  document.getElementById('status-matrix').textContent =
    `${instance.x?.toFixed?.(1) ?? '—'}, ${instance.y?.toFixed?.(1) ?? '—'}`;

  setRoomValue('status-room-left', room.left);
  setRoomValue('status-room-right', room.right);
  setRoomValue('status-room-up', room.up);
  setRoomValue('status-room-down', room.down);

  if (!room.bounded) {
    hintEl.textContent = 'bounds: false — pan is not clamped';
  } else {
    const lockedX = room.left <= 0.05 && room.right <= 0.05;
    const lockedY = room.up <= 0.05 && room.down <= 0.05;
    if (lockedX && lockedY) {
      hintEl.textContent =
        'No pan room — content fits the wrapper. Zoom in, or shrink the frame.';
    } else if (lockedX) {
      hintEl.textContent =
        'Horizontal pan locked (zoomed content fits the wrapper width). Vertical still has room.';
    } else if (lockedY) {
      hintEl.textContent =
        'Vertical pan locked (zoomed content fits the wrapper height). Horizontal still has room.';
    } else {
      hintEl.textContent =
        '“can pan …” is remaining room before bounds clamp. Near an edge, a full panStep may not reverse back to the same position %.';
    }
  }
}

function destroyInstance() {
  if (instance && typeof instance.destroy === 'function') {
    instance.destroy();
  }
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

  const panBefore = instance.getPan();

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
      if (/^pan(Left|Right|Up|Down)$/.test(name)) {
        const panAfter = instance.getPan();
        log(
          `${name}: L/R ${panBefore.x.toFixed(1)}%→${panAfter.x.toFixed(1)}%, ` +
            `U/D ${panBefore.y.toFixed(1)}%→${panAfter.y.toFixed(1)}%`
        );
      } else {
        log(`${name}(true)`);
      }
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

const wrapperFrame = document.getElementById('wrapper-frame');
const frameWidthInput = document.getElementById('frame-width');
const frameHeightInput = document.getElementById('frame-height');

function syncFrameSizeInputs() {
  frameWidthInput.value = Math.round(wrapperFrame.clientWidth);
  frameHeightInput.value = Math.round(wrapperFrame.clientHeight);
}

function applyFrameSize() {
  wrapperFrame.style.width = `${frameWidthInput.value}px`;
  wrapperFrame.style.height = `${frameHeightInput.value}px`;
  log(`Frame set to ${frameWidthInput.value}×${frameHeightInput.value}px`);
}

document.getElementById('apply-frame-size').addEventListener('click', applyFrameSize);
wrapperFrame.addEventListener('mouseup', syncFrameSizeInputs);

syncFrameSizeInputs();
createInstance();
