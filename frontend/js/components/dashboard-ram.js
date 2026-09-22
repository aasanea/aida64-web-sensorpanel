import { EventBus } from '../store/event_bus.js';

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

  /* Typography */
  .arabic-label {
    font-family: var(--font-arabic);
    font-size: 19px;
    font-weight: 800;
    color: #FFFFFF;
    opacity: 1;
    letter-spacing: 0.3px;
    line-height: 1.2;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
  }

  .huge-number {
    font-family: var(--font-numbers);
    font-size: 58px;
    font-weight: 800;
    color: var(--text-pure-white);
    line-height: 1;
    direction: ltr;
    display: inline-block;
    text-shadow: 0 0 24px rgba(248, 250, 255, 0.25);
    font-variant-numeric: tabular-nums;
  }

  .huge-unit {
    font-family: var(--font-display);
    font-size: 24px;
    font-weight: 700;
    color: var(--neon-cyan);
    margin-right: 4px;
    direction: ltr;
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
    color: #38BDF8; /* RAM icon color */
  }
  .card-title {
    font-family: var(--font-arabic);
    font-size: 24px;
    font-weight: 800;
    color: var(--text-pure-white);
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

  /* Medium Card Layout */
  .card-body-medium {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 6px;
    flex: 1;
    min-height: 0;
  }

  .hero-metric-display {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .hero-metric-display .huge-number {
    font-size: 52px;
    font-weight: 800;
  }
  .hero-val-unit {
    display: flex;
    align-items: baseline;
    direction: ltr;
  }

  /* Capacity */
  .capacity-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 5px 10px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 8px;
  }
  .capacity-val-group {
    display: flex;
    align-items: baseline;
    gap: 6px;
    direction: ltr;
  }
  .cap-val {
    font-family: var(--font-numbers);
    font-size: 28px;
    font-weight: 800;
    color: var(--text-pure-white);
  }
  .cap-separator {
    font-family: var(--font-display);
    font-size: 20px;
    color: var(--text-muted);
  }
  .cap-total {
    font-family: var(--font-numbers);
    font-size: 22px;
    font-weight: 700;
    color: #CBD5E1;
  }
  .cap-unit {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 700;
    color: var(--neon-cyan);
  }

  /* Sub grid */
  .card-sub-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    margin: 2px 0 4px 0;
  }
  .sub-stat-box {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    padding: 4px 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .sub-stat-val {
    display: flex;
    align-items: baseline;
    gap: 4px;
    direction: ltr;
  }
  .sub-num {
    font-family: var(--font-numbers);
    font-size: 25px;
    font-weight: 800;
    color: var(--text-pure-white);
  }
  .sub-unit {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 700;
    color: var(--neon-cyan);
  }

  /* Progress Bar */
  .metric-row {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .metric-info {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .progress-track {
    width: 100%;
    height: 4px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 4px;
    position: relative;
    direction: ltr;
    overflow: visible;
    contain: layout style;
  }
  .progress-bar {
    height: 100%;
    width: 0%;
    background: linear-gradient(90deg, var(--neon-cyan), var(--neon-violet));
    border-radius: 4px;
    position: relative;
    will-change: width;
    transform: translateZ(0);
    transition: width 0.1s linear;
    box-shadow: 0 0 10px rgba(34, 211, 238, 0.35);
  }
  .progress-dot {
    position: absolute;
    right: -4px;
    top: 50%;
    transform: translateY(-50%);
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #F8FAFF;
    box-shadow: 0 0 8px var(--neon-cyan), 0 0 16px var(--neon-violet);
    opacity: 0;
    transition: opacity 0.2s ease;
    pointer-events: none;
  }
  .progress-bar.active .progress-dot {
    opacity: 1;
  }
</style>

<div class="card-header">
  <div class="card-title-group">
    <div class="card-icon ram-icon">
      <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
        <rect x="2" y="7" width="20" height="10" rx="2"></rect>
        <path d="M6 11v2M10 11v2M14 11v2M18 11v2"></path>
      </svg>
    </div>
    <div>
      <h2 class="card-title">الذاكرة العشوائية</h2>
      <span class="card-sub">SYSTEM RAM</span>
    </div>
  </div>
</div>

<div class="card-body-medium">
  <div class="hero-metric-display">
    <span class="arabic-label">نسبة الاستهلاك</span>
    <div class="hero-val-unit">
      <span class="huge-number" id="ram_used_percent">--</span>
      <span class="huge-unit">%</span>
    </div>
  </div>

  <div class="capacity-row">
    <span class="arabic-label">الذاكرة المستخدمة</span>
    <div class="capacity-val-group">
      <span class="cap-val" id="ram_used_gb">--</span>
      <span class="cap-separator">/</span>
      <span class="cap-total" id="ram_total_gb">--</span>
      <span class="cap-unit">GB</span>
    </div>
  </div>

  <div class="card-sub-grid">
    <div class="sub-stat-box">
      <span class="arabic-label">تردد الذاكرة</span>
      <div class="sub-stat-val">
        <span class="sub-num" id="ram_speed_mhz">--</span>
        <span class="sub-unit">MHz</span>
      </div>
    </div>
    <div class="sub-stat-box">
      <span class="arabic-label">حرارة الذاكرة</span>
      <div class="sub-stat-val">
        <span class="sub-num" id="ram_temp">--</span>
        <span class="sub-unit">°C</span>
      </div>
    </div>
  </div>

  <div class="metric-row">
    <div class="metric-info">
      <span class="arabic-label">مؤشر الامتلاء</span>
    </div>
    <div class="progress-track">
      <div class="progress-bar" id="ram_used_percent_bar" style="width: 0%;">
        <span class="progress-dot"></span>
      </div>
    </div>
  </div>
</div>
`;

export class DashboardRAM extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));
    
    this.currentValues = {
      ram_used_percent: null,
      ram_used_gb: null,
      ram_total_gb: null,
      ram_speed_mhz: null,
      ram_temp: null
    };

    this.targetValues = {
      ram_used_percent: null,
      ram_used_gb: null,
      ram_total_gb: null,
      ram_speed_mhz: null,
      ram_temp: null
    };

    this.isRunning = false;

    this.dom = {
      ram_used_percent: this.shadowRoot.getElementById('ram_used_percent'),
      ram_used_gb: this.shadowRoot.getElementById('ram_used_gb'),
      ram_total_gb: this.shadowRoot.getElementById('ram_total_gb'),
      ram_speed_mhz: this.shadowRoot.getElementById('ram_speed_mhz'),
      ram_temp: this.shadowRoot.getElementById('ram_temp'),
      ram_used_percent_bar: this.shadowRoot.getElementById('ram_used_percent_bar')
    };

    this.onStateChange = this.onStateChange.bind(this);
    this.tick = this.tick.bind(this);
  }

  connectedCallback() {
    this.unsubscribe = EventBus.on('state-changed', this.onStateChange);
    this.unsubscribeData = EventBus.on('telemetry:data', this.onStateChange);
    this.isRunning = true;
    requestAnimationFrame(this.tick);
  }

  disconnectedCallback() {
    this.isRunning = false;
    if (this.unsubscribe) this.unsubscribe();
    if (this.unsubscribeData) this.unsubscribeData();
  }

  onStateChange(delta) {
    for (const key in this.targetValues) {
      if (delta[key] !== undefined) {
        this.targetValues[key] = delta[key];
      }
    }
  }

  tick() {
    if (!this.isRunning) return;
    
    let needsRender = false;

    for (const key in this.targetValues) {
      const target = this.targetValues[key];
      let current = this.currentValues[key];

      if (target === null || target === undefined) {
         if (current !== null) {
           this.currentValues[key] = null;
           needsRender = true;
         }
         continue;
      }

      if (current === null) {
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
          current += diff * 0.15;
          needsRender = true;
        }
      }
      this.currentValues[key] = current;
    }

    if (needsRender) {
      this.render();
    }

    requestAnimationFrame(this.tick);
  }

  render() {
    this.updateText(this.dom.ram_used_percent, this.currentValues.ram_used_percent, 0);
    this.updateText(this.dom.ram_used_gb, this.currentValues.ram_used_gb, 1);
    this.updateText(this.dom.ram_total_gb, this.currentValues.ram_total_gb, 1);
    this.updateText(this.dom.ram_speed_mhz, this.currentValues.ram_speed_mhz, 0);
    this.updateText(this.dom.ram_temp, this.currentValues.ram_temp, 0);
    
    this.updateBar(null, this.dom.ram_used_percent_bar, this.currentValues.ram_used_percent, 0, 100, 0);
  }

  updateText(element, value, decimals) {
    if (!element) return;
    const text = (value === null || value === undefined) ? '--' : 
                 (decimals > 0 ? value.toFixed(decimals) : Math.round(value).toString());
    if (element.textContent !== text) {
      element.textContent = text;
    }
  }

  updateBar(textEl, barEl, value, min, max, decimals) {
    if (textEl) {
      this.updateText(textEl, value, decimals);
    }
    if (!barEl) return;
    
    if (value === null || value === undefined) {
      if (barEl.style.width !== '0%') {
        barEl.style.width = '0%';
        barEl.classList.remove('active');
      }
      return;
    }

    const ratio = Math.min(1, Math.max(0, (value - min) / (max - min)));
    const percent = Math.round(ratio * 100);
    const widthStr = `${percent}%`;
    
    if (barEl.style.width !== widthStr) {
      barEl.style.width = widthStr;
      if (percent > 0) {
        barEl.classList.add('active');
      } else {
        barEl.classList.remove('active');
      }
    }
  }
}

customElements.define('dashboard-ram', DashboardRAM);
