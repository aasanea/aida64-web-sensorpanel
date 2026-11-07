/** Isolated live theme proposals. Reuses production components without saved preferences. */
import { DashboardHeader } from '../../js/components/dashboard-header.js?v=20261007.3';
import { DashboardCPU } from '../../js/components/dashboard-cpu.js?v=20261007.3';
import { DashboardGPU } from '../../js/components/dashboard-gpu.js?v=20261007.3';
import { DashboardRAM } from '../../js/components/dashboard-ram.js?v=20261007.3';
import { DashboardStorage } from '../../js/components/dashboard-storage.js?v=20261007.3';
import { DashboardDisplay } from '../../js/components/dashboard-display.js?v=20261007.3';
import { DashboardWeather } from '../../js/components/dashboard-weather.js?v=20261007.3';
import { DashboardNetwork } from '../../js/components/dashboard-network.js?v=20261007.3';
import { DashboardAppointments } from '../../js/components/dashboard-appointments.js?v=20261007.3';
import { DashboardMatches } from '../../js/components/dashboard-matches.js?v=20261007.3';
import { GaugePicker } from '../../js/components/gauge-style-picker.js?v=20261007.3';
import { EventBus } from '../../js/store/event_bus.js?v=20261007.3';
import { StateManager } from '../../js/store/state_manager.js?v=20261007.3';

const proposals = {
  lumen: { name: 'Lumen Glass', ar: 'زجاج مضيء', color: '#8CEBDF', icon: '◈', gauge: 'holo-minimal' },
  titanium: { name: 'Titanium', ar: 'تيتانيوم', color: '#EBC28C', icon: '▦', gauge: 'dual-split' },
  pearl: { name: 'Pearl Atelier', ar: 'مشغل اللؤلؤ', color: '#176D70', icon: '◉', gauge: 'holo-minimal' }
};
const id = document.documentElement.dataset.previewTheme;
const proposal = proposals[id];
document.title = `${proposal.name} • AIDA64 Live Preview`;
document.getElementById('preview-label').textContent = `${proposal.name.toUpperCase()} / معاينة حية • 1920 × 1080`;

const response = await fetch('./components.css?v=1');
if (!response.ok) throw new Error('Theme stylesheet could not be loaded');
const css = await response.text();
const sheet = 'adoptedStyleSheets' in ShadowRoot.prototype ? new CSSStyleSheet() : null;
sheet?.replaceSync(css);

// Styling stays inside each component's constructor; no global shadow DOM renderer.
function styled(Base) {
  return class extends Base {
    constructor() {
      super();
      if (sheet) this.shadowRoot.adoptedStyleSheets = [...this.shadowRoot.adoptedStyleSheets, sheet];
      else {
        const style = document.createElement('style');
        style.textContent = css;
        this.shadowRoot.appendChild(style);
      }
    }
    connectedCallback() {
      this.dataset.previewVariant = id;
      super.connectedCallback();
    }
  };
}

class PreviewHeader extends styled(DashboardHeader) {
  initTheme() {
    this.updateThemeUI(proposal);
    this.dom.themeDropdownMenu.innerHTML = Object.entries(proposals).map(([key, theme]) =>
      `<div class="theme-menu-item ${key === id ? 'active' : ''}" data-theme-id="${key}" role="menuitem" tabindex="0"><span class="theme-item-icon">${theme.icon}</span><div class="theme-item-labels"><span class="theme-item-name-en">${theme.name}</span><span class="theme-item-name-ar">${theme.ar} — معاينة</span></div></div>`
    ).join('');
    this.dom.themeMenuItems = this.dom.themeDropdownMenu.querySelectorAll('.theme-menu-item');
  }
  setTheme(themeId, event) {
    event?.preventDefault();
    if (proposals[themeId]) location.href = `./preview.html?theme=${themeId}`;
  }
  cycleTheme(event) {
    const keys = Object.keys(proposals);
    this.setTheme(keys[(keys.indexOf(id) + 1) % keys.length], event);
  }
  checkForUpdates() {} // Proposals must not surface production update actions.
}

class PreviewAppointments extends styled(DashboardAppointments) {
  connectedCallback() {
    super.connectedCallback();
    this.dom.btn_open.disabled = true;
    this.dom.btn_open.title = 'المواعيد الحقيقية للعرض فقط أثناء معاينة التصميم';
  }
  openModal() {}
  handleSubmit(event) { event.preventDefault(); }
}

// Gauge choices are ephemeral in this document. The main dashboard's settings stay intact.
const gaugeChoices = new Map();
GaugePicker.getSavedStyle = gaugeId => gaugeChoices.get(gaugeId) || proposal.gauge;
GaugePicker._applySelection = (gaugeId, styleId, applyAll) => {
  for (const key of applyAll ? ['cpu', 'gpu'] : [gaugeId]) gaugeChoices.set(key, styleId);
  EventBus.emit('gauge:style-changed', { gaugeId, styleId, applyAll });
};
GaugePicker._playSoftBeep = () => {};
GaugePicker._playSuccessChime = () => {};
const createPicker = GaugePicker._createModalElements;
GaugePicker._createModalElements = function () {
  createPicker.call(this);
  this._backdrop.querySelector('#gauge-btn-apply').textContent = 'تجربة النمط في المعاينة';
  this._backdrop.inert = true;
  this._backdrop.setAttribute('aria-hidden', 'true');
};
const openPicker = GaugePicker.open;
GaugePicker.open = function (gaugeId) {
  this._backdrop.inert = false;
  this._backdrop.setAttribute('aria-hidden', 'false');
  openPicker.call(this, gaugeId);
};
const closePicker = GaugePicker.close;
GaugePicker.close = function () {
  closePicker.call(this);
  this._backdrop.inert = true;
  this._backdrop.setAttribute('aria-hidden', 'true');
};
GaugePicker.init();
window.GaugePicker = GaugePicker;
window.EventBus = EventBus;
const stateManager = new StateManager();
window.stateManager = stateManager;

for (const [tag, Base] of Object.entries({
  header: PreviewHeader, cpu: styled(DashboardCPU), gpu: styled(DashboardGPU),
  ram: styled(DashboardRAM), storage: styled(DashboardStorage), display: styled(DashboardDisplay),
  weather: styled(DashboardWeather), network: styled(DashboardNetwork),
  appointments: PreviewAppointments, matches: styled(DashboardMatches)
})) customElements.define(`preview-${tag}`, Base);

stateManager.start();
window.addEventListener('pagehide', () => stateManager.stop());
window.addEventListener('pageshow', event => { if (event.persisted) stateManager.start(); });

// Optional benchmark is opt-in, observes the actual dashboard, and never injects telemetry.
if (new URLSearchParams(location.search).has('measure')) {
  const samples = [], started = performance.now();
  let previous, rafId;
  const longTasks = [];
  const observer = typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes.includes('longtask')
    ? new PerformanceObserver(list => longTasks.push(...list.getEntries()
      .filter(entry => entry.startTime - started >= 2000).map(entry => entry.duration))) : null;
  observer?.observe({ type: 'longtask', buffered: false });
  function tick(timestamp) {
    if (previous && timestamp - started > 2000) samples.push(timestamp - previous);
    previous = timestamp;
    if (timestamp - started < 12000) rafId = requestAnimationFrame(tick);
    else {
      observer?.disconnect();
      const sorted = [...samples].sort((a, b) => a - b);
      const result = { theme: id, frames: samples.length, meanMs: samples.reduce((a, b) => a + b, 0) / samples.length,
        p95Ms: sorted[Math.floor(sorted.length * .95)], maxMs: Math.max(...samples), longTasks };
      const output = document.createElement('output');
      output.id = 'preview-benchmark'; output.hidden = true; output.textContent = JSON.stringify(result);
      document.body.appendChild(output);
    }
  }
  rafId = requestAnimationFrame(tick);
  window.addEventListener('pagehide', () => { cancelAnimationFrame(rafId); observer?.disconnect(); }, { once: true });
}
