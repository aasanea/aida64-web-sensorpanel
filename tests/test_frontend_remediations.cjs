// Run with: node tests/test_frontend_remediations.cjs (no packages/build required).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../frontend/js');
let now = 1000, nextId = 0;
const frames = new Map(), intervals = new Map(), timeouts = new Map();
class Element extends EventTarget {
  constructor() {
    super(); this.style = {}; this.dataset = {}; this.nodes = new Map(); this.attributes = new Map();
    this.textContent = ''; this.children = []; this.inert = false;
    const classes = new Set();
    this.classList = {
      contains: key => classes.has(key), add: (...keys) => keys.forEach(key => classes.add(key)),
      remove: (...keys) => keys.forEach(key => classes.delete(key)),
      toggle(key, force = !classes.has(key)) { force ? classes.add(key) : classes.delete(key); return force; }
    };
    this.content = { cloneNode: () => new Element() };
  }
  attachShadow() { return this.shadowRoot = new Element(); }
  appendChild(element) { this.children.push(element); return element; }
  querySelector(selector) { if (!this.nodes.has(selector)) this.nodes.set(selector, new Element()); return this.nodes.get(selector); }
  querySelectorAll() { return []; }
  getElementById(id) { return this.querySelector(`#${id}`); }
  setAttribute(key, value) { this.attributes.set(key, String(value)); }
  getAttribute(key) { return this.attributes.get(key) ?? null; }
  contains(element) { return element === this || this.children.includes(element); }
  getTotalLength() { this.lengthReads = (this.lengthReads || 0) + 1; return 400; }
  focus() { this.focused = true; }
}
const context = vm.createContext({
  console, EventTarget, AbortController, HTMLElement: Element,
  document: { createElement: () => new Element(), createElementNS: () => new Element() },
  window: { location: { protocol: 'http:', host: '127.0.0.1:8088' } },
  customElements: { define() {} }, MutationObserver: class { observe() {} disconnect() {} },
  performance: { now: () => now },
  requestAnimationFrame(fn) { frames.set(++nextId, fn); return nextId; },
  cancelAnimationFrame(id) { frames.delete(id); },
  setInterval(fn, ms) { intervals.set(++nextId, { fn, ms }); return nextId; },
  clearInterval(id) { intervals.delete(id); },
  setTimeout(fn, ms) { timeouts.set(++nextId, { fn, ms }); return nextId; },
  clearTimeout(id) { timeouts.delete(id); },
  WebSocket: class { static OPEN = 1; static CONNECTING = 0; readyState = 0; close() { this.readyState = 3; } },
  fetch: () => Promise.reject(new Error('No network in unit tests'))
});
function load(relative) {
  const raw = fs.readFileSync(path.join(root, relative), 'utf8');
  const names = [...raw.matchAll(/export (?:class|const|function) (\w+)/g)].map(match => match[1]);
  const source = raw
    .replace(/^import .*;\s*$/gm, '').replace(/\bexport (?=(class|const|function)\b)/g, '');
  vm.runInContext(`(() => { ${source}\nObject.assign(globalThis, { ${names.join(',')} }); })()`, context, { filename: relative });
}
load('store/event_bus.js'); load('store/state_manager.js'); load('components/component-utils.js');
load('components/gauge-styles-engine.js');
vm.runInContext("const GaugePicker = { getSavedStyle: () => 'tachometer' };", context);
for (const name of ['cpu', 'gpu', 'ram', 'display', 'weather', 'appointments']) load(`components/dashboard-${name}.js`);
let passed = 0;
function test(name, source) {
  vm.runInContext(`(() => { ${source} })()`, context);
  passed++; console.log(`PASS ${name}`);
}
Object.assign(context, { assert, frames, intervals });
test('One delta per changed snapshot; unchanged snapshots are silent', `
  const manager = new StateManager(); let deltaCount = 0, fullCount = 0;
  const off = EventBus.on('state-changed', () => deltaCount++);
  const offFull = EventBus.on('telemetry:data', () => fullCount++);
  manager.processNewState({ cpu_temp: 50, fps: 0, audio_master_volume: 0 });
  manager.processNewState({ cpu_temp: 50, fps: 0, audio_master_volume: 0 });
  assert.equal(deltaCount, 1); assert.equal(fullCount, 0);
  assert.equal(manager.currentState.fps, 0); off(); offFull();
`);
test('AbortController removes EventBus listeners without a remount leak', `
  const events = new AbortController(); let calls = 0;
  EventBus.on('test:abort', () => calls++, { signal: events.signal });
  EventBus.emit('test:abort'); events.abort(); EventBus.emit('test:abort');
  assert.equal(calls, 1); assert.equal(EventBus.events['test:abort'].length, 0);
`);
test('Omitted fields and nonfinite numbers clear; silence becomes stale', `
  const manager = new StateManager(); manager.processNewState({ cpu_temp: 50, gpu_temp: 45 });
  manager.processNewState({ cpu_temp: Infinity });
  assert.equal(manager.currentState.gpu_temp, null); assert.equal(manager.currentState.cpu_temp, null);
  manager.processNewState({ cpu_temp: 60 });
  manager.lastReceivedAt = -10000; manager.processIncomingMessage('pong'); manager.checkFreshness();
  assert.equal(manager.currentState.cpu_temp, null); assert.equal(manager.currentState.telemetry_status, 'stale');
  manager.processNewState({ cpu_temp: 0 }); assert.equal(manager.currentState.telemetry_status, 'live');
`);
test('Master volume zero, missing FPS, and frame-time provenance', `
  const display = new DashboardDisplay();
  display.onStateChange({ display_volume: 75, audio_master_volume: 0, fps: 100 });
  assert.equal(display.targetValues.display_volume, 0);
  assert.equal(display.currentValues.frametime_ms, 10); assert.equal(display.frameTimeSource, 'derived');
  display.onStateChange({ fps: 0 }); assert.equal(display.currentValues.frametime_ms, null);
  assert.equal(display.dom.frametime.textContent, '--'); assert.equal(display.frameTimeSource, 'unavailable');
  display.onStateChange({ fps: null, audio_master_volume: null }); assert.equal(display.targetValues.display_volume, 75);
  display.onStateChange({ frametime_ms: 7.5 }); assert.equal(display.currentValues.frametime_ms, 7.5);
  assert.equal(display.frameTimeSource, 'measured');
  display.onStateChange({ frametime_ms: null }); assert.equal(display.currentValues.frametime_ms, null);
`);
test('Smoothing converges equally at 60 Hz and 240 Hz', `
  const sample = hz => { const component = { previousTimestamp: 0 }; let value = 0;
    for (let i = 1; i <= hz; i++) value += (100 - value) * animationAlpha(component, i * 1000 / hz);
    return value;
  };
  assert.ok(Math.abs(sample(60) - sample(240)) < 1e-9);
  assert.equal(animationAlpha({ previousTimestamp: 0 }, 10000), 1 - Math.exp(-1));
`);
test('Derived RAM percentages recompute on deltas and never retain stale results', `
  const ram = new DashboardRAM(); ram.onStateChange({ ram_used_gb: 8, ram_total_gb: 32, ram_used_percent: null });
  assert.equal(ram.targetValues.ram_used_percent, 25); assert.equal(ram.dataset.percentSource, 'derived');
  ram.onStateChange({ ram_used_gb: 16 }); assert.equal(ram.targetValues.ram_used_percent, 50);
  ram.onStateChange({ ram_used_gb: null }); assert.equal(ram.targetValues.ram_used_percent, null);
  assert.equal(ram.dataset.percentSource, 'unavailable');
`);
test('Missing and shortened core streams clear individual readings', `
  const cpu = new DashboardCPU(); cpu.cpuCores = [{ type:'P', id:1, load:70, temp:55 }]; cpu.renderCores();
  assert.equal(cpu.coreDom.cells[0].load.textContent, '70%');
  cpu.cpuCores = []; cpu.renderCores(); assert.equal(cpu.coreDom.cells[0].load.textContent, '--%');
`);
test('Missing temperature streams clear a held thermal alarm', `
  for (const Type of [DashboardCPU, DashboardGPU]) {
    const card = new Type(); card.updateThermalAlarm(90, 96); assert.equal(card.isCritical, true);
    card.updateThermalAlarm(null, null); assert.equal(card.isCritical, false);
  }
`);
test('CPU/GPU repeated mounting cancels frames and subscriptions', `
  for (const Type of [DashboardCPU, DashboardGPU]) {
    const component = new Type(); const base = EventBus.events['state-changed']?.length || 0;
    for (let i = 0; i < 10; i++) {
      component.connectedCallback(); component.connectedCallback();
      assert.equal(EventBus.events['state-changed'].length, base + 1);
      assert.equal(component.events.signal.aborted, false);
      const signal = component.events.signal, id = component.rafId;
      component.disconnectedCallback(); assert.equal(signal.aborted, true);
      assert.equal(EventBus.events['state-changed'].length, base); assert.equal(component.rafId, null);
      assert.equal(frames.has(id), false);
    }
  }
`);
test('Unavailable gauges clear and geometry is cached', `
  const mount = document.createElement('div');
  GaugeEngine.updateGaugeSvg('hexa-matrix', mount, 50);
  GaugeEngine.updateGaugeSvg('hexa-matrix', mount, 60);
  assert.equal(mount.querySelector('.hexa-arc').lengthReads, 1);
  GaugeEngine.updateGaugeSvg('hexa-matrix', mount, null);
  assert.equal(mount.querySelector('.gauge-huge-number').textContent, '--');
  assert.equal(mount.querySelector('.pill-text').textContent, 'غير متاح');
`);
test('Prayer/appointment clocks use one-second timers and clear missing data', `
  const weather = new DashboardWeather(); weather.connectedCallback();
  assert.equal(intervals.get(weather.timerId).ms, 1000); assert.equal(weather.rafId, undefined);
  weather.onStateChange({ next_prayer_seconds: 60 }); weather.tick();
  assert.equal(weather.dom.next_countdown.textContent, '00:01:00');
  weather.onStateChange({ next_prayer_seconds: null }); weather.tick();
  assert.equal(weather.dom.next_countdown.textContent, '--:--:--');
  const id = weather.timerId; weather.disconnectedCallback(); assert.equal(intervals.has(id), false);
  const appointments = Object.create(DashboardAppointments.prototype);
  appointments.isRunning = true; appointments.timerState = { lastUpdateMs: 0, nextSecsBase: 60, isOngoing: false };
  appointments.dom = { countdown: document.createElement('span') }; appointments.tick();
  assert.equal(appointments.dom.countdown.textContent, '00:00:59');
`);
test('Inactive flip face is inert and focus moves to the visible face', `
  const host = new HTMLElement(); host.attachShadow();
  const front = host.shadowRoot.querySelector('.card-front'), back = host.shadowRoot.querySelector('.card-back');
  front.appendChild(front.querySelector('button')); host.shadowRoot.activeElement = front.querySelector('button');
  syncFlipFaces(host); assert.equal(back.inert, true); assert.equal(back.getAttribute('aria-hidden'), 'true');
  host.classList.add('flipped'); syncFlipFaces(host);
  assert.equal(front.inert, true); assert.equal(front.getAttribute('aria-hidden'), 'true');
  assert.equal(back.inert, false); assert.equal(back.querySelector('button').focused, true);
`);
test('Stopping transport clears heartbeat, reconnect, and stale timers', `
  const manager = new StateManager(); manager.start(); manager.startHeartbeat(); manager.scheduleReconnect();
  manager.processNewState({ cpu_temp: 55 }); manager.stop();
  assert.equal(manager.ws, null); assert.equal(manager.pingInterval, null); assert.equal(manager.staleTimer, null);
  assert.equal(manager.reconnectTimeout, null); assert.equal(manager.currentState.cpu_temp, null);
`);
(async () => {
  const fetchBefore = context.fetch; let complete, signal;
  context.fetch = (_url, options) => { signal = options.signal; return new Promise(resolve => complete = resolve); };
  const manager = new context.StateManager(); manager.stopped = false; manager.startPollingFallback();
  manager.stop(); assert.equal(signal.aborted, true);
  complete({ ok:true, json:async () => ({ cpu_temp:99 }) });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(manager.currentState.cpu_temp, undefined);
  assert.equal(manager.currentState.telemetry_status, 'stale');
  context.fetch = fetchBefore; passed++;
  console.log('PASS An in-flight fallback response cannot repopulate stopped telemetry');
  console.log(`${passed} behavioral checks passed`);
})().catch(error => { console.error(error); process.exitCode = 1; });
