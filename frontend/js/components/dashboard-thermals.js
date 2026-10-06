import { animationAlpha, updateTelemetryStatus } from './component-utils.js?v=20261006.2';
import { EventBus } from '../store/event_bus.js?v=20261006.2';

const template = document.createElement('template');
template.innerHTML = `
<style>
  :host {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    position: relative;
    overflow: hidden;
    contain: layout style;
  }

  /* Card Header */
  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
    flex-shrink: 0;
  }
  .card-title-group {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .card-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }
  .thermals-icon {
    color: var(--neon-orange, #FB923C);
  }
  .card-title {
    font-family: var(--font-arabic);
    font-size: 24px;
    font-weight: 800;
    color: var(--text-pure-white, #FFFFFF);
    line-height: 1.2;
    margin: 0;
  }
  .card-sub {
    font-family: var(--font-numbers);
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 1px;
    color: #94A3B8;
  }

  .thermals-header-badges {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .card-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 14px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    font-size: 15px;
  }
  .thermal-header-badge .vital-icon {
    font-size: 18px;
  }
  .badge-label {
    font-family: var(--font-arabic);
    font-weight: 800;
    color: #F8FAFC;
    font-size: 17px;
  }
  .badge-val-group {
    display: flex;
    align-items: baseline;
    gap: 4px;
    direction: ltr;
  }
  .badge-value {
    font-family: var(--font-numbers);
    font-weight: 800;
    font-size: 22px;
    color: var(--text-pure-white);
  }
  .badge-unit {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 700;
    color: var(--neon-cyan);
  }

  /* Thermal Badges Grid */
  .thermal-badges-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px 14px;
    padding: 10px 4px;
    flex: 1;
    min-height: 0;
    align-content: center;
  }

  .thermal-capsule {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: 12px;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
    transition: all 0.25s ease;
  }
  .thermal-capsule:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(34, 211, 238, 0.3);
  }

  .capsule-label-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .vital-icon {
    font-size: 20px;
  }
  .vital-label {
    font-family: var(--font-arabic);
    font-size: 17px;
    font-weight: 700;
    color: #F8FAFC;
  }

  .thermal-capsule .vital-val {
    font-family: var(--font-numbers);
    font-size: 26px;
    font-weight: 800;
    color: #38BDF8;
  }
  .thermal-capsule .vital-unit {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 700;
    color: var(--neon-cyan, #22D3EE);
  }

  .pump-capsule {
    grid-column: span 2;
  }
  .pump-capsule .pump-val {
    color: var(--neon-orange, #FB923C);
  }
</style>

<div class="card-header">
  <div class="card-title-group">
    <div class="card-icon thermals-icon">
      <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
        <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"></path>
      </svg>
    </div>
    <div>
      <h2 class="card-title">الحرارة واللوحة</h2>
      <span class="card-sub">THERMAL NODES</span>
    </div>
  </div>
  <div class="thermals-header-badges">
    <div class="card-badge thermal-header-badge" id="max-temp-badge">
      <span class="vital-icon">🔥</span>
      <span class="badge-label">أعلى حرارة</span>
      <span class="badge-val-group" dir="ltr">
        <span class="badge-value" id="max_temp">--</span>
        <span class="badge-unit">°C</span>
      </span>
    </div>
    <div class="card-badge thermal-header-badge" id="total-power-badge">
      <span class="vital-icon">⚡</span>
      <span class="badge-label">الطاقة</span>
      <span class="badge-val-group" dir="ltr">
        <span class="badge-value" id="total_power">--</span>
        <span class="badge-unit">W</span>
      </span>
    </div>
  </div>
</div>

<div class="thermal-badges-grid">
  <!-- VRM -->
  <div class="thermal-capsule" title="حرارة منظم الجهد">
    <div class="capsule-label-group">
      <span class="vital-icon">🎛️</span>
      <span class="vital-label">منظم الجهد VRM</span>
    </div>
    <div class="badge-val-group" dir="ltr">
      <span class="vital-val" id="vrm_temp">--</span>
      <span class="vital-unit">°C</span>
    </div>
  </div>

  <!-- PCH -->
  <div class="thermal-capsule" title="حرارة شريحة اللوحة">
    <div class="capsule-label-group">
      <span class="vital-icon">💎</span>
      <span class="vital-label">الشريحة PCH</span>
    </div>
    <div class="badge-val-group" dir="ltr">
      <span class="vital-val" id="pch_temp">--</span>
      <span class="vital-unit">°C</span>
    </div>
  </div>

  <!-- Motherboard -->
  <div class="thermal-capsule" title="حرارة اللوحة الأم">
    <div class="capsule-label-group">
      <span class="vital-icon">🖥️</span>
      <span class="vital-label">اللوحة الأم</span>
    </div>
    <div class="badge-val-group" dir="ltr">
      <span class="vital-val" id="motherboard_temp">--</span>
      <span class="vital-unit">°C</span>
    </div>
  </div>

  <!-- NVMe -->
  <div class="thermal-capsule" title="حرارة التخزين السريع">
    <div class="capsule-label-group">
      <span class="vital-icon">💾</span>
      <span class="vital-label">التخزين NVMe</span>
    </div>
    <div class="badge-val-group" dir="ltr">
      <span class="vital-val" id="nvme_temp">--</span>
      <span class="vital-unit">°C</span>
    </div>
  </div>

  <!-- PUMP -->
  <div class="thermal-capsule pump-capsule" title="سرعة مضخة التبريد المائي">
    <div class="capsule-label-group">
      <span class="vital-icon">💧</span>
      <span class="vital-label">مضخة التبريد PUMP</span>
    </div>
    <div class="badge-val-group" dir="ltr">
      <span class="vital-val pump-val" id="pump_rpm">--</span>
      <span class="vital-unit">RPM</span>
    </div>
  </div>
</div>
`;

export class DashboardThermals extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));
    
    this.currentValues = {
      max_temp: null,
      total_power: null,
      vrm_temp: null,
      pch_temp: null,
      motherboard_temp: null,
      nvme_temp: null,
      pump_rpm: null
    };

    this.targetValues = {
      max_temp: null,
      total_power: null,
      vrm_temp: null,
      pch_temp: null,
      motherboard_temp: null,
      nvme_temp: null,
      pump_rpm: null
    };

    this.isRunning = false;
    this.rafId = null;
    this.unsubscribe = null;

    this.dom = {
      max_temp: this.shadowRoot.getElementById('max_temp'),
      total_power: this.shadowRoot.getElementById('total_power'),
      vrm_temp: this.shadowRoot.getElementById('vrm_temp'),
      pch_temp: this.shadowRoot.getElementById('pch_temp'),
      motherboard_temp: this.shadowRoot.getElementById('motherboard_temp'),
      nvme_temp: this.shadowRoot.getElementById('nvme_temp'),
      pump_rpm: this.shadowRoot.getElementById('pump_rpm')
    };

    this.onStateChange = this.onStateChange.bind(this);
    this.tick = this.tick.bind(this);
  }

  connectedCallback() {
    if (this.isRunning) return;
    this.previousTimestamp = null;
    this.events?.abort();
    this.events = new AbortController();
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    this.unsubscribe = EventBus.on('state-changed', this.onStateChange);


    if (typeof window !== 'undefined' && window.stateManager && window.stateManager.currentState) {
      this.onStateChange(window.stateManager.currentState);
    }

    if (!this.isRunning) {
      this.isRunning = true;
      this.rafId = requestAnimationFrame(this.tick);
    }
  }

  disconnectedCallback() {
    cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.previousTimestamp = null;
    this.events?.abort();
    this.flipObserver?.disconnect();
    this.isRunning = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  _sanitizeNumber(val) {
    if (val === null || val === undefined) return null;
    if (typeof val === 'number') return Number.isFinite(val) ? val : null;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (!trimmed) return null;
      const num = Number(trimmed);
      return Number.isFinite(num) ? num : null;
    }
    return null;
  }

  onStateChange(delta) {
    if (!delta || typeof delta !== 'object') return;
    updateTelemetryStatus(this, delta, Object.keys(this.targetValues));
    if (!delta || typeof delta !== 'object') return;
    for (const key in this.targetValues) {
      if (delta[key] !== undefined) {
        this.targetValues[key] = this._sanitizeNumber(delta[key]);
      }
    }
  }

  tick(timestamp) {
    if (!this.isRunning) return;
    const alpha = animationAlpha(this, timestamp);
    
    let needsRender = false;

    for (const key in this.targetValues) {
      const target = this.targetValues[key];
      let current = this.currentValues[key];

      if (target === null || target === undefined || !Number.isFinite(target)) {
        if (current !== null) {
          this.currentValues[key] = null;
          needsRender = true;
        }
        continue;
      }

      if (current === null || !Number.isFinite(current)) {
        current = target;
        needsRender = true;
      } else {
        const diff = target - current;
        if (Math.abs(diff) < 0.04) {
          if (current !== target) {
            current = target;
            needsRender = true;
          }
        } else {
          current += diff * alpha;
          needsRender = true;
        }
      }
      this.currentValues[key] = current;
    }

    if (needsRender) {
      this.render();
    }

    this.rafId = requestAnimationFrame(this.tick);
  }

  render() {
    this.updateText(this.dom.max_temp, this.currentValues.max_temp, 0);
    this.updateText(this.dom.total_power, this.currentValues.total_power, 0);
    this.updateText(this.dom.vrm_temp, this.currentValues.vrm_temp, 0);
    this.updateText(this.dom.pch_temp, this.currentValues.pch_temp, 0);
    this.updateText(this.dom.motherboard_temp, this.currentValues.motherboard_temp, 0);
    this.updateText(this.dom.nvme_temp, this.currentValues.nvme_temp, 0);
    this.updateText(this.dom.pump_rpm, this.currentValues.pump_rpm, 0);
  }

  updateText(element, value, decimals = 0) {
    if (!element) return;
    const text = (value === null || value === undefined || !Number.isFinite(value)) ? '--' : 
                 (decimals > 0 ? value.toFixed(decimals) : Math.round(value).toString());
    if (element.textContent !== text) {
      element.textContent = text;
    }
  }
}

customElements.define('dashboard-thermals', DashboardThermals);
