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
  replaceChildren() { this.children=[]; }
  append(element) { return this.appendChild(element); }
  closest() { return null; }
  appendChild(element) { this.children.push(element); return element; }
  querySelector(selector) { if (!this.nodes.has(selector)) this.nodes.set(selector, new Element()); return this.nodes.get(selector); }
  querySelectorAll() { return []; }
  getElementById(id) { return this.querySelector(`#${id}`); }
  setAttribute(key, value) { this.attributes.set(key, String(value)); }
  getAttribute(key) { return this.attributes.get(key) ?? null; }
  hasAttribute(key) { return this.attributes.has(key); }
  removeAttribute(key) { this.attributes.delete(key); }
  contains(element) { return element === this || this.children.includes(element); }
  getTotalLength() { this.lengthReads = (this.lengthReads || 0) + 1; return 400; }
  focus() { this.focused = true; }
}
const context = vm.createContext({
  console, Event, EventTarget, AbortController, HTMLElement: Element,
  localStorage:{getItem:()=>null,setItem(){}},IntersectionObserver:class {observe(){} disconnect(){}},
  document: {hidden:false,addEventListener(){}, createElement: () => new Element(), createElementNS: () => new Element() },
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
load('components/av-readings.js');load('components/audio-signal-meter.js');load('components/gauge-styles-engine.js');load('components/sonar-panel.js');load('components/broadcast-view.js');
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
  display.onStateChange({ display_volume: 75, audio_master_volume: 0, fps: 100, fps_source: "AIDA64" });
  assert.equal(display.targetValues.display_volume, 0);
  assert.equal(display.currentValues.frametime_ms, 10); assert.equal(display.frameTimeSource, 'derived');
  display.onStateChange({ fps: 0 }); assert.equal(display.currentValues.frametime_ms, null);
  assert.equal(display.dom.frametime.textContent, '--'); assert.equal(display.frameTimeSource, 'unavailable');
  display.onStateChange({ fps: null, audio_master_volume: null }); assert.equal(display.targetValues.display_volume, null);
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
test('Core topology follows source IDs and removes shortened streams', `
  const cpu = new DashboardCPU();
  cpu.onStateChange({cpu_cores:[{type:'P',id:1,load:70,temp:55},{type:'E',id:3,load:0,temp:0}]});
  assert.equal(cpu.coreDom.cells.length,2);assert.equal(cpu.coreDom.cells[0].load.textContent,'70%');
  assert.equal(cpu.coreDom.cells[1].load.textContent,'0%');
  cpu.onStateChange({cpu_cores:null});assert.equal(cpu.coreDom.cells.length,0);
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

test('Failed source clears only its fields while a healthy transport stays live', `
  const manager=new StateManager();
  const sources={aida:{status:'live'},sonar:{status:'unavailable'},weather:{status:'cached'}};
  manager.processNewState({cpu_temp:40,audio_master_volume:55,riyadh_temp:30,telemetry_sources:sources,telemetry_fields:{cpu_temp:{source:'aida'},audio_master_volume:{source:'sonar'},riyadh_temp:{source:'weather'}}});
  assert.equal(manager.currentState.cpu_temp,40);assert.equal(manager.currentState.audio_master_volume,null);
  assert.equal(manager.currentState.riyadh_temp,30);assert.equal(manager.currentState.telemetry_status,'live');
`);
test('Sonar rendering preserves both independent stream paths and mute truth', `
  const target=document.createElement('div');
  renderSonarPanel(target,{sonar_connected:true,sonar_mode:'stream',sonar_channels:{master:{monitoring:{volume:0,muted:true},streaming:{volume:100,muted:false}},media:{monitoring:{volume:12,muted:false},streaming:{volume:30,muted:false}}}});
  assert.ok(target.innerHTML.includes('0% 🔇'));assert.ok(target.innerHTML.includes('100%'));assert.ok(target.innerHTML.includes('30%'));
  assert.ok(target.innerHTML.includes('استماع'));assert.ok(target.innerHTML.includes('بث'));
  renderSonarPanel(target,{sonar_connected:false,display_volume:90});
  assert.ok(target.innerHTML.includes('Sonar غير متاح'));assert.ok(!target.innerHTML.includes('90%'));
`);


test('Audio peaks have one delivery path and survive complete hardware snapshots', `
  const manager=new StateManager();manager.stopped=false;
  let audio=0,hardware=0;const off=EventBus.on('audio-levels',()=>audio++);const offHw=EventBus.on('state-changed',()=>hardware++);
  const sample={observed_at:Date.now()/1000,routes:{input:{peak:0,status:'live'},streaming:{peak:NaN,status:'live'}}};
  manager.processIncomingMessage(JSON.stringify({type:'audio-levels',data:sample}));
  assert.equal(audio,1);assert.equal(hardware,0);assert.equal(manager.currentState.audio_levels.routes.input.peak,0);
  assert.equal(manager.currentState.audio_levels.routes.streaming.peak,null);
  manager.processNewState({cpu_temp:40});assert.equal(manager.currentState.audio_levels.routes.input.peak,0);
  manager.processAudioLevels({...sample,observed_at:Date.now()/1000-1});assert.equal(manager.currentState.audio_levels.routes.input.peak,null);
  manager.stop();assert.equal(manager.currentState.audio_levels,null);off();offHw();
`);

test('Meter silence, logarithmic scale, gain zero, stale reset and lifecycle cleanup', `
  assert.equal(meterPosition(0),0);assert.equal(meterPosition(1),1);assert.ok(Math.abs(meterPosition(.001))<1e-9);
  const meter=new AudioSignalMeter();meter.setAttribute('route','input');meter.isConnected=true;
  const before=EventBus.events['audio-levels']?.length || 0;
  meter.connectedCallback();assert.equal(EventBus.events['audio-levels'].length,before+1);
  meter.state={telemetry_status:'live',sonar_mode:'stream',sonar_channels:{mic:{monitoring:{volume:0,muted:true}}}};meter.updateGain();assert.equal(meter.nodes.gain.textContent,'0% 🔇');
  meter.sample={routes:{input:{peak:.1,status:'live',name:'Real mic'}},receivedAt:1000};meter.route='input';meter.draw(1016);
  assert.ok(meter.level>0);assert.equal(meter.nodes.state.textContent,'حي');
  meter.draw(1400);assert.equal(meter.level,0);assert.equal(meter.held,0);assert.equal(meter.nodes.state.textContent,'غير متاح');
  meter.sample.receivedAt=1500;meter.sample.routes.input.peak=0;meter.draw(1500);assert.equal(meter.nodes.state.textContent,'صمت');
  // Cancel every scheduled ID for this mock; draw() normally runs only from its one RAF.
  for(const id of frames.keys())frames.delete(id);
  meter.disconnectedCallback();assert.equal(EventBus.events['audio-levels'].length,before);assert.equal(meter.raf,0);
`);

test('A/V card rejects refresh-rate FPS fallback and invalid measurements', `
  const fallback = displayReadings({fps:240,fps_source:'Display',display_hz:240});
  assert.equal(fallback.fps,null); assert.equal(fallback.frameTime,null); assert.equal(fallback.hz,240);
  for(const fps of [null,undefined,NaN,Infinity,-1,'240',true])assert.equal(displayReadings({fps,fps_source:'RTSS'}).fps,null);
  const valid=displayReadings({fps:120,fps_source:'RTSS',display_hz:240});assert.equal(valid.fps,120);assert.equal(valid.frameTime,1000/120);
  assert.equal(displayReadings({fps:0,fps_source:'AIDA64'}).fps,0);
  assert.equal(displayReadings({fps:0,fps_source:'AIDA64'}).frameTime,null);
  assert.equal(displayReadings({fps:120,fps_source:'RTSS',frametime_ms:7.3}).frameTime,7.3);
  assert.equal(displayReadings({fps:120,fps_source:'RTSS',telemetry_status:'stale'}).fps,null);
  assert.equal(displayReadings({fps:120,fps_source:'RTSS',frametime_ms:7.3,telemetry_sources:{aida:{status:'stale'}}}).frameTime,null);
`);
test('A/V keeps the actual FPS target and card body does not flip', `
  const card=new DashboardDisplay();card.onStateChange({fps:120,fps_source:'RTSS',display_hz:240});
  assert.equal(card.currentValues.fps,120);card.onStateChange({fps:60});assert.equal(card.targetValues.fps,60);assert.equal(card.currentValues.fps,120);
  card.connectedCallback();card.dispatchEvent(new Event('click'));assert.equal(card.classList.contains('flipped'),false);
  card.handleFlipBtnClick({stopPropagation(){}});assert.equal(card.classList.contains('flipped'),true);card.disconnectedCallback();
`);

test('FPS eases in both directions consistently across frame rates and clears stale data immediately', `
  const run=hz=>{const card=new DashboardDisplay();card.onStateChange({fps:60,fps_source:'RTSS'});card.onStateChange({fps:180});card.isRunning=true;card.previousTimestamp=0;
    let previous=60;
    for(let i=1;i<=hz/2;i++){card.tick(i*1000/hz);assert.ok(card.currentValues.fps>=previous&&card.currentValues.fps<=180);previous=card.currentValues.fps;}
    const high=card.currentValues.fps;assert.ok(high>170&&high<180);
    card.onStateChange({fps:30});card.tick(500+1000/hz);assert.ok(card.currentValues.fps<high&&card.currentValues.fps>30);
    card.onStateChange({fps:null});assert.equal(card.currentValues.fps,null);assert.equal(card.dom.fps.textContent,'--');
    for(const id of frames.keys())frames.delete(id);return high;};
  assert.ok(Math.abs(run(60)-run(240))<.0001);
`);

test('Each application meter reads its own peak, decays smoothly and releases subscriptions', `
  const initial=EventBus.events['audio-levels']?.length || 0;
  const chrome=new AudioSignalMeter(),riff=new AudioSignalMeter();
  for(const [meter,key]of [[chrome,'chrome-icon'],[riff,'riff-icon']]){meter.isConnected=true;meter.setAttribute('application',key);meter.setAttribute('signal-only','');meter.connectedCallback();}
  assert.equal(EventBus.events['audio-levels'].length,initial+2);
  const sample={receivedAt:1000,applications:[{active:true,icon_url:'chrome-icon',peak:.5,name:'Chrome'},{active:true,icon_url:'riff-icon',peak:0,name:'Riff'}],routes:{monitoring:{status:'live',peak:1}}};
  chrome.sample=riff.sample=sample;chrome.draw(1016);riff.draw(1016);
  assert.ok(chrome.level>0);assert.equal(riff.level,0);
  const before=chrome.level;sample.applications[0].peak=0;chrome.draw(1033);assert.ok(chrome.level>0&&chrome.level<before);
  chrome.draw(1400);assert.equal(chrome.level,0);assert.equal(chrome.held,0);
  chrome.disconnectedCallback();riff.disconnectedCallback();assert.equal(EventBus.events['audio-levels'].length,initial);
  for(const id of frames.keys())frames.delete(id);
`);

test('A/V source expiry clears gain and microphone status without changing audio', `
  const card=new DashboardDisplay();card.onStateChange({sonar_connected:true,sonar_mode:'stream',audio_mic_muted:false,sonar_source:{status:'live',observed_at:Date.now()/1000},sonar_channels:{master:{monitoring:{volume:23,muted:false}},mic:{monitoring:{volume:100,muted:false}}}});
  assert.ok(card.shadowRoot.getElementById('quick-master-gain').textContent.includes('23%'));
  card.onStateChange({sonar_source:{status:'stale',observed_at:Date.now()/1000}});
  assert.equal(card.shadowRoot.getElementById('quick-master-gain').textContent,'—');
  assert.equal(card.dom.micText.textContent,'غير متاح');
`);

test('Audio overview keeps microphone, listening, device identity and Discord states independent', `
  const card=new DashboardDisplay();
  card.audioSample={receivedAt:performance.now(),routes:{input:{status:'live',peak:.1,name:'Rode'},monitoring:{status:'live',peak:.2,name:'Bose'}}};
  card.onStateChange({sonar_connected:true,sonar_mode:'stream',sonar_channels:{mic:{streaming:{volume:17,muted:false},monitoring:{volume:91,muted:true}},master:{monitoring:{volume:0,muted:true},streaming:{volume:100,muted:false}}},audio_broadcast:{available:true,discord_ready:true,observed_at:Date.now()/1000,discord_muted:false}});
  assert.equal(card.shadowRoot.getElementById('quick-mic-gain').textContent,'17%');
  assert.equal(card.shadowRoot.getElementById('quick-master-gain').textContent,'0%');
  assert.equal(card.shadowRoot.getElementById('mic-overview').dataset.state,'live');
  assert.equal(card.shadowRoot.getElementById('listening-overview').dataset.state,'muted');
  assert.equal(card.shadowRoot.getElementById('quick-input-device').textContent,'Rode');
  assert.equal(card.shadowRoot.getElementById('quick-output-device').textContent,'Bose');
  card.onStateChange({audio_broadcast:{available:true,discord_ready:true,observed_at:Date.now()/1000,discord_deafened:true}});
  assert.equal(card.shadowRoot.getElementById('mic-overview').dataset.state,'muted');
  card.onStateChange({sonar_source:{status:'stale'}});
  assert.equal(card.shadowRoot.getElementById('quick-mic-gain').textContent,'—');
  assert.equal(card.shadowRoot.getElementById('mic-overview').dataset.state,'unknown');
`);
