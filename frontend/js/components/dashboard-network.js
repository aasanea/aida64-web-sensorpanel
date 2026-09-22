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

  .arabic-label {
    font-family: var(--font-arabic, 'Cairo', sans-serif);
    font-size: 15px;
    font-weight: 700;
    color: var(--text-pure-white, #FFFFFF);
    line-height: 1.2;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }

  .huge-number {
    font-family: var(--font-numbers, monospace);
    font-size: 46px;
    font-weight: 800;
    line-height: 1;
    direction: ltr;
    display: inline-block;
    font-variant-numeric: tabular-nums;
  }

  .huge-unit {
    font-family: var(--font-display, sans-serif);
    font-size: 19px;
    font-weight: 700;
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
  }
  .net-icon {
    color: var(--neon-cyan, #22D3EE);
  }
  .card-title {
    font-family: var(--font-arabic, 'Cairo', sans-serif);
    font-size: 24px;
    font-weight: 800;
    color: var(--text-pure-white, #FFFFFF);
    line-height: 1.2;
    margin: 0;
  }
  .card-sub {
    font-family: var(--font-numbers, monospace);
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 1px;
    color: #94A3B8;
  }

  /* Network Body */
  .network-body {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
    min-height: 0;
    justify-content: space-around;
  }

  .net-direction-box {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 10px;
  }

  .net-dir-header {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .net-icon-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 6px;
  }

  .dl-badge {
    background: rgba(34, 211, 238, 0.15);
    color: var(--neon-cyan, #22D3EE);
  }

  .ul-badge {
    background: rgba(168, 85, 247, 0.15);
    color: var(--neon-purple, #A855F7);
  }

  .net-val-row {
    display: flex;
    align-items: baseline;
    gap: 4px;
    direction: ltr;
  }

  .net-dl-number {
    color: var(--text-pure-white, #FFFFFF);
    text-shadow: 0 0 20px rgba(34, 211, 238, 0.3);
  }

  .net-ul-number {
    color: var(--text-pure-white, #FFFFFF);
    text-shadow: 0 0 20px rgba(168, 85, 247, 0.3);
  }

  .net-val-row .huge-unit {
    color: #94A3B8;
  }

  .metric-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .metric-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .progress-track {
    width: 100%;
    height: 4px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 2px;
    overflow: hidden;
    position: relative;
  }

  .progress-bar {
    height: 100%;
    width: 0%;
    border-radius: 2px;
    position: relative;
    transition: width 0.15s ease-out;
  }

  .dl-bar {
    background: linear-gradient(90deg, #06B6D4, var(--neon-cyan, #22D3EE));
    box-shadow: 0 0 10px rgba(34, 211, 238, 0.5);
  }

  .ul-bar {
    background: linear-gradient(90deg, #7C5CFF, var(--neon-purple, #A855F7));
    box-shadow: 0 0 10px rgba(168, 85, 247, 0.5);
  }

  .progress-dot {
    position: absolute;
    top: 50%;
    left: 100%;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #FFFFFF;
    transform: translate(-50%, -50%);
    box-shadow: 0 0 6px rgba(255, 255, 255, 0.8);
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .progress-bar.active .progress-dot {
    opacity: 1;
  }
</style>

<div class="card-header">
  <div class="card-title-group">
    <div class="card-icon net-icon">
      <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
        <path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"></path>
      </svg>
    </div>
    <div>
      <h2 class="card-title">حركة الشبكة</h2>
      <span class="card-sub">NETWORK TELEMETRY</span>
    </div>
  </div>
</div>

<div class="network-body">
  <!-- Download Telemetry -->
  <div class="net-direction-box net-download">
    <div class="net-dir-header">
      <div class="net-icon-badge dl-badge">
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <polyline points="19 12 12 19 5 12"></polyline>
        </svg>
      </div>
      <span class="arabic-label">سرعة التنزيل DL</span>
    </div>
    <div class="net-val-row">
      <span class="huge-number net-dl-number" id="network_download_mbps">--</span>
      <span class="huge-unit">Mbps</span>
    </div>
    <div class="metric-row net-metric-sub">
      <div class="metric-info">
        <span class="arabic-label">نشاط التنزيل</span>
      </div>
      <div class="progress-track">
        <div class="progress-bar dl-bar" id="network_download_bar" style="width: 0%;">
          <span class="progress-dot"></span>
        </div>
      </div>
    </div>
  </div>

  <!-- Upload Telemetry -->
  <div class="net-direction-box net-upload">
    <div class="net-dir-header">
      <div class="net-icon-badge ul-badge">
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none">
          <line x1="12" y1="19" x2="12" y2="5"></line>
          <polyline points="5 12 12 5 19 12"></polyline>
        </svg>
      </div>
      <span class="arabic-label">سرعة الرفع UL</span>
    </div>
    <div class="net-val-row">
      <span class="huge-number net-ul-number" id="network_upload_mbps">--</span>
      <span class="huge-unit">Mbps</span>
    </div>
    <div class="metric-row net-metric-sub">
      <div class="metric-info">
        <span class="arabic-label">نشاط الرفع</span>
      </div>
      <div class="progress-track">
        <div class="progress-bar ul-bar" id="network_upload_bar" style="width: 0%;">
          <span class="progress-dot"></span>
        </div>
      </div>
    </div>
  </div>
</div>
`;

export class DashboardNetwork extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.dom = {
      dl_val: this.shadowRoot.getElementById('network_download_mbps'),
      dl_bar: this.shadowRoot.getElementById('network_download_bar'),
      ul_val: this.shadowRoot.getElementById('network_upload_mbps'),
      ul_bar: this.shadowRoot.getElementById('network_upload_bar'),
    };

    this.targetValues = {
      network_download_mbps: null,
      network_upload_mbps: null,
    };

    this.currentValues = {
      network_download_mbps: null,
      network_upload_mbps: null,
    };

    this.onStateChange = this.onStateChange.bind(this);
    this.tick = this.tick.bind(this);
    this.isRunning = false;
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
    if (delta.network_download_mbps !== undefined) this.targetValues.network_download_mbps = delta.network_download_mbps;
    if (delta.network_upload_mbps !== undefined) this.targetValues.network_upload_mbps = delta.network_upload_mbps;
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
        if (Math.abs(diff) < 0.05) {
          if (current !== target) {
            current = target;
            needsRender = true;
          }
        } else {
          current += diff * 0.2;
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
    this.updateMetric(this.dom.dl_val, this.dom.dl_bar, this.currentValues.network_download_mbps, 0, 500, 1);
    this.updateMetric(this.dom.ul_val, this.dom.ul_bar, this.currentValues.network_upload_mbps, 0, 100, 1);
  }

  updateMetric(textEl, barEl, value, min, max, decimals) {
    if (!textEl) return;
    const text = (value === null || value === undefined) ? '--' : value.toFixed(decimals);
    if (textEl.textContent !== text) {
      textEl.textContent = text;
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

customElements.define('dashboard-network', DashboardNetwork);
