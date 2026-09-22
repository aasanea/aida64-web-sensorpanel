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
    color: #34D399; /* Storage icon color */
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

  /* Badge */
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
  .badge-label {
    font-family: var(--font-arabic);
    font-weight: 800;
    color: #F8FAFC;
    font-size: 17px;
  }
  .badge-value {
    font-family: var(--font-numbers);
    font-weight: 800;
    font-size: 22px;
    color: var(--text-pure-white);
    direction: ltr;
  }
  .badge-unit {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 700;
    color: var(--neon-cyan);
    direction: ltr;
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

  /* Storage Item */
  .storage-drive-item {
    display: flex;
    flex-direction: column;
    gap: 3px;
    margin-bottom: 4px;
  }
  .storage-drive-item:last-child {
    margin-bottom: 0;
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
  .cap-free-text {
    font-family: var(--font-arabic);
    font-size: 18px;
    font-weight: 800;
    color: #34D399;
    opacity: 1;
    margin-right: 6px;
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
  .metric-num-group {
    display: flex;
    align-items: baseline;
    gap: 4px;
    direction: ltr;
  }
  .metric-val {
    font-family: var(--font-numbers);
    font-size: 27px;
    font-weight: 700;
    color: var(--text-pure-white);
    line-height: 1;
  }
  .metric-unit {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 700;
    color: var(--neon-cyan);
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
    <div class="card-icon storage-icon">
      <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
        <line x1="22" y1="12" x2="2" y2="12"></line>
        <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path>
        <line x1="6" y1="16" x2="6.01" y2="16"></line>
        <line x1="10" y1="16" x2="10.01" y2="16"></line>
      </svg>
    </div>
    <div>
      <h2 class="card-title">وحدات التخزين</h2>
      <span class="card-sub">STORAGE POOL</span>
    </div>
  </div>
  <div class="card-badge">
    <span class="badge-label">المساحة الحرة</span>
    <span class="badge-value" id="storage_total_free_gb">--</span>
    <span class="badge-unit">GB</span>
  </div>
</div>

<div class="card-body-medium">
  <!-- Drive C -->
  <div class="storage-drive-item">
    <div class="capacity-row">
      <span class="arabic-label">القرص C: (النظام)</span>
      <div class="capacity-val-group">
        <span class="cap-val" id="drive_c_used_gb">--</span>
        <span class="cap-separator">/</span>
        <span class="cap-total" id="drive_c_total_gb">--</span>
        <span class="cap-unit">GB</span>
        <span class="cap-free-text">(حر: <bdi dir="ltr"><span id="drive_c_free_gb">--</span> GB</bdi>)</span>
      </div>
    </div>
    <div class="metric-row">
      <div class="metric-info">
        <span class="arabic-label">استهلاك القرص C</span>
        <span class="metric-num-group">
          <span class="metric-val" id="drive_c_bar_val">--</span>
          <span class="metric-unit">%</span>
        </span>
      </div>
      <div class="progress-track">
        <div class="progress-bar" id="drive_c_bar" style="width: 0%;">
          <span class="progress-dot"></span>
        </div>
      </div>
    </div>
  </div>

  <!-- Drive D -->
  <div class="storage-drive-item">
    <div class="capacity-row">
      <span class="arabic-label">القرص D: (البيانات)</span>
      <div class="capacity-val-group">
        <span class="cap-val" id="drive_d_used_gb">--</span>
        <span class="cap-separator">/</span>
        <span class="cap-total" id="drive_d_total_gb">--</span>
        <span class="cap-unit">GB</span>
        <span class="cap-free-text">(حر: <bdi dir="ltr"><span id="drive_d_free_gb">--</span> GB</bdi>)</span>
      </div>
    </div>
    <div class="metric-row">
      <div class="metric-info">
        <span class="arabic-label">استهلاك القرص D</span>
        <span class="metric-num-group">
          <span class="metric-val" id="drive_d_bar_val">--</span>
          <span class="metric-unit">%</span>
        </span>
      </div>
      <div class="progress-track">
        <div class="progress-bar" id="drive_d_bar" style="width: 0%;">
          <span class="progress-dot"></span>
        </div>
      </div>
    </div>
  </div>
</div>
`;

export class DashboardStorage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));
    
    this.currentValues = {
      storage_total_free_gb: null,
      drive_c_used_gb: null,
      drive_c_total_gb: null,
      drive_c_free_gb: null,
      drive_c_used_percent: null,
      drive_d_used_gb: null,
      drive_d_total_gb: null,
      drive_d_free_gb: null,
      drive_d_used_percent: null
    };

    this.targetValues = {
      storage_total_free_gb: null,
      drive_c_used_gb: null,
      drive_c_total_gb: null,
      drive_c_free_gb: null,
      drive_c_used_percent: null,
      drive_d_used_gb: null,
      drive_d_total_gb: null,
      drive_d_free_gb: null,
      drive_d_used_percent: null
    };

    this.isRunning = false;

    this.dom = {
      storage_total_free_gb: this.shadowRoot.getElementById('storage_total_free_gb'),
      
      drive_c_used_gb: this.shadowRoot.getElementById('drive_c_used_gb'),
      drive_c_total_gb: this.shadowRoot.getElementById('drive_c_total_gb'),
      drive_c_free_gb: this.shadowRoot.getElementById('drive_c_free_gb'),
      drive_c_bar_val: this.shadowRoot.getElementById('drive_c_bar_val'),
      drive_c_bar: this.shadowRoot.getElementById('drive_c_bar'),
      
      drive_d_used_gb: this.shadowRoot.getElementById('drive_d_used_gb'),
      drive_d_total_gb: this.shadowRoot.getElementById('drive_d_total_gb'),
      drive_d_free_gb: this.shadowRoot.getElementById('drive_d_free_gb'),
      drive_d_bar_val: this.shadowRoot.getElementById('drive_d_bar_val'),
      drive_d_bar: this.shadowRoot.getElementById('drive_d_bar')
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
    this.updateText(this.dom.storage_total_free_gb, this.currentValues.storage_total_free_gb, 0);

    // Drive C
    this.updateText(this.dom.drive_c_used_gb, this.currentValues.drive_c_used_gb, 1);
    this.updateText(this.dom.drive_c_total_gb, this.currentValues.drive_c_total_gb, 1);
    this.updateText(this.dom.drive_c_free_gb, this.currentValues.drive_c_free_gb, 1);
    this.updateBar(this.dom.drive_c_bar_val, this.dom.drive_c_bar, this.currentValues.drive_c_used_percent, 0, 100, 0);

    // Drive D
    this.updateText(this.dom.drive_d_used_gb, this.currentValues.drive_d_used_gb, 1);
    this.updateText(this.dom.drive_d_total_gb, this.currentValues.drive_d_total_gb, 1);
    this.updateText(this.dom.drive_d_free_gb, this.currentValues.drive_d_free_gb, 1);
    this.updateBar(this.dom.drive_d_bar_val, this.dom.drive_d_bar, this.currentValues.drive_d_used_percent, 0, 100, 0);
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

customElements.define('dashboard-storage', DashboardStorage);
