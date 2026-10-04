import { EventBus } from '../store/event_bus.js';

const template = document.createElement('template');
template.innerHTML = `
<style>
  :host {
    display: block;
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    contain: layout style;
  }

  /* 3D Card Flipper Mechanics */
  .card-flipper {
    position: relative;
    width: 100%;
    height: 100%;
    transform-style: preserve-3d;
    transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  :host(.flipped) .card-flipper {
    transform: rotateY(180deg);
  }

  .card-face {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    padding: 12px 16px;
    box-sizing: border-box;
    -webkit-backface-visibility: hidden;
    backface-visibility: hidden;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .card-front {
    transform: rotateY(0deg);
    z-index: 2;
  }

  .card-back {
    transform: rotateY(180deg);
    z-index: 1;
    background: rgba(10, 15, 29, 0.96);
  }

  :host(.flipped) .card-front {
    pointer-events: none;
  }

  :host(:not(.flipped)) .card-back {
    pointer-events: none;
  }

  /* Typography & Core Styles */
  .arabic-label {
    font-family: var(--font-arabic, 'Cairo', sans-serif);
    font-size: 14px;
    font-weight: 700;
    color: var(--text-pure-white, #FFFFFF);
    line-height: 1.2;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }

  .huge-number {
    font-family: var(--font-numbers, monospace);
    font-size: 42px;
    font-weight: 800;
    line-height: 1;
    direction: ltr;
    display: inline-block;
    font-variant-numeric: tabular-nums;
  }

  .huge-unit {
    font-family: var(--font-display, sans-serif);
    font-size: 18px;
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
    gap: 8px;
  }

  .card-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .net-icon {
    color: var(--neon-cyan, #22D3EE);
  }

  .card-title {
    font-family: var(--font-arabic, 'Cairo', sans-serif);
    font-size: 21px;
    font-weight: 800;
    color: var(--text-pure-white, #FFFFFF);
    line-height: 1.2;
    margin: 0;
  }

  .card-sub {
    font-family: var(--font-numbers, monospace);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 1px;
    color: #94A3B8;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* Flip Button */
  .btn-flip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    border-radius: 8px;
    background: rgba(34, 211, 238, 0.08);
    border: 1px solid rgba(34, 211, 238, 0.25);
    color: var(--neon-cyan, #22D3EE);
    font-family: var(--font-arabic, sans-serif);
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    white-space: nowrap;
  }

  .btn-flip:hover {
    background: rgba(34, 211, 238, 0.2);
    border-color: var(--neon-cyan, #22D3EE);
    box-shadow: 0 0 12px rgba(34, 211, 238, 0.35);
    transform: translateY(-1px);
  }

  .btn-flip.btn-back {
    background: rgba(168, 85, 247, 0.1);
    border-color: rgba(168, 85, 247, 0.3);
    color: var(--neon-purple, #C084FC);
  }

  .btn-flip.btn-back:hover {
    background: rgba(168, 85, 247, 0.25);
    border-color: var(--neon-purple, #A855F7);
    box-shadow: 0 0 12px rgba(168, 85, 247, 0.35);
  }

  /* Ping Badge */
  .ping-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 2px 7px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    font-family: var(--font-numbers, monospace);
    font-size: 12px;
    font-weight: 700;
    color: #E2E8F0;
    direction: ltr;
  }

  .ping-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #10B981;
    box-shadow: 0 0 6px #10B981;
  }

  /* FRONT FACE: Network Body */
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
    position: relative;
    overflow: hidden;
  }

  .net-dir-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .net-dir-title-group {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .net-icon-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
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
    justify-content: space-between;
    direction: ltr;
  }

  .net-dl-number {
    color: var(--text-pure-white, #FFFFFF);
    text-shadow: 0 0 16px rgba(34, 211, 238, 0.3);
  }

  .net-ul-number {
    color: var(--text-pure-white, #FFFFFF);
    text-shadow: 0 0 16px rgba(168, 85, 247, 0.3);
  }

  .net-val-row .huge-unit {
    color: #94A3B8;
  }

  /* SVG Sparkline Wave */
  .sparkline-svg {
    width: 100px;
    height: 24px;
    overflow: visible;
  }

  .sparkline-path-dl {
    fill: none;
    stroke: var(--neon-cyan, #22D3EE);
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
    filter: drop-shadow(0 0 4px rgba(34, 211, 238, 0.6));
  }

  .sparkline-path-ul {
    fill: none;
    stroke: var(--neon-purple, #A855F7);
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
    filter: drop-shadow(0 0 4px rgba(168, 85, 247, 0.6));
  }

  .metric-row {
    display: flex;
    flex-direction: column;
    gap: 3px;
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

  /* BACK FACE: Top Apps List */
  .apps-list-container {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding-right: 2px;
  }

  .app-item-card {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 5px 8px;
    background: rgba(255, 255, 255, 0.025);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 7px;
    transition: background 0.2s ease;
  }

  .app-item-card:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(34, 211, 238, 0.2);
  }

  .app-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .app-name-group {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .app-icon {
    font-size: 14px;
    flex-shrink: 0;
  }

  .app-name {
    font-family: var(--font-arabic, sans-serif);
    font-size: 13px;
    font-weight: 700;
    color: #F8FAFC;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .app-conn-badge {
    font-family: var(--font-numbers, monospace);
    font-size: 10px;
    padding: 1px 5px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.06);
    color: #94A3B8;
    margin-right: 4px;
    direction: ltr;
  }

  .app-rates-group {
    display: flex;
    align-items: center;
    gap: 8px;
    direction: ltr;
    font-family: var(--font-numbers, monospace);
    font-size: 12px;
    font-weight: 700;
  }

  .app-dl-rate {
    color: var(--neon-cyan, #22D3EE);
  }

  .app-ul-rate {
    color: var(--neon-purple, #C084FC);
  }

  .app-bar-track {
    width: 100%;
    height: 3px;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 1.5px;
    overflow: hidden;
  }

  .app-bar-fill {
    height: 100%;
    border-radius: 1.5px;
    background: linear-gradient(90deg, var(--neon-cyan, #22D3EE), var(--neon-purple, #A855F7));
    transition: width 0.3s ease;
  }

  .empty-apps-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 100%;
    color: #94A3B8;
    font-family: var(--font-arabic, sans-serif);
    font-size: 13px;
  }

  /* Back Face Metadata Footer Strip */
  .back-footer-strip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 6px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    font-family: var(--font-numbers, monospace);
    font-size: 11px;
    color: #94A3B8;
    direction: ltr;
  }

  .meta-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .meta-val {
    color: #E2E8F0;
    font-weight: 700;
  }
</style>

<div class="card-flipper" id="card-flipper">
  <!-- FRONT FACE: Real-time Speeds & Live Graphs -->
  <div class="card-face card-front">
    <div class="card-header">
      <div class="card-title-group">
        <div class="card-icon net-icon">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
            <path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"></path>
          </svg>
        </div>
        <div>
          <h2 class="card-title">حركة الشبكة</h2>
          <span class="card-sub">NETWORK TELEMETRY</span>
        </div>
      </div>
      <div class="header-actions">
        <div class="ping-badge" id="ping-badge" title="زمن استجابة الشبكة (Ping)">
          <span class="ping-dot" id="ping-dot"></span>
          <span id="ping-value">-- ms</span>
        </div>
        <button class="btn-flip" id="btn-flip-apps" type="button" title="عرض أعلى البرامج استهلاكاً للإنترنت">
          <span>📶</span>
          <span>أعلى البرامج</span>
        </button>
      </div>
    </div>

    <div class="network-body">
      <!-- Download Telemetry -->
      <div class="net-direction-box net-download">
        <div class="net-dir-header">
          <div class="net-dir-title-group">
            <div class="net-icon-badge dl-badge">
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <polyline points="19 12 12 19 5 12"></polyline>
              </svg>
            </div>
            <span class="arabic-label">سرعة التنزيل DL</span>
          </div>
          <!-- Real-time Sparkline SVG -->
          <svg class="sparkline-svg" viewBox="0 0 100 24" id="sparkline-dl">
            <path class="sparkline-path-dl" d="M 0 22 L 100 22" id="sparkline-path-dl"></path>
          </svg>
        </div>
        <div class="net-val-row">
          <span class="huge-number net-dl-number" id="network_download_mbps">--</span>
          <span class="huge-unit">Mbps</span>
        </div>
        <div class="metric-row net-metric-sub">
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
          <div class="net-dir-title-group">
            <div class="net-icon-badge ul-badge">
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none">
                <line x1="12" y1="19" x2="12" y2="5"></line>
                <polyline points="5 12 12 5 19 12"></polyline>
              </svg>
            </div>
            <span class="arabic-label">سرعة الرفع UL</span>
          </div>
          <!-- Real-time Sparkline SVG -->
          <svg class="sparkline-svg" viewBox="0 0 100 24" id="sparkline-ul">
            <path class="sparkline-path-ul" d="M 0 22 L 100 22" id="sparkline-path-ul"></path>
          </svg>
        </div>
        <div class="net-val-row">
          <span class="huge-number net-ul-number" id="network_upload_mbps">--</span>
          <span class="huge-unit">Mbps</span>
        </div>
        <div class="metric-row net-metric-sub">
          <div class="progress-track">
            <div class="progress-bar ul-bar" id="network_upload_bar" style="width: 0%;">
              <span class="progress-dot"></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- BACK FACE: Top Bandwidth Consuming Applications -->
  <div class="card-face card-back">
    <div class="card-header">
      <div class="card-title-group">
        <div class="card-icon" style="color: var(--neon-purple, #A855F7);">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
            <line x1="8" y1="21" x2="16" y2="21"></line>
            <line x1="12" y1="17" x2="12" y2="21"></line>
          </svg>
        </div>
        <div>
          <h2 class="card-title" style="font-size: 19px;">أعلى البرامج استهلاكاً</h2>
          <span class="card-sub" style="font-size: 11px;">LIVE PROCESS BANDWIDTH</span>
        </div>
      </div>
      <div class="header-actions">
        <button class="btn-flip btn-back" id="btn-flip-back" type="button" title="العودة لمؤشرات السرعة الرئيسية">
          <span>↩</span>
          <span>السرعات</span>
        </button>
      </div>
    </div>

    <!-- Active Apps List Container -->
    <div class="apps-list-container" id="apps-list-container">
      <div class="empty-apps-state">
        <span>📡</span>
        <span>جاري رصد البرامج المتصلة بالإنترنت...</span>
      </div>
    </div>

    <!-- Metadata Footer Strip -->
    <div class="back-footer-strip">
      <div class="meta-chip" title="عنوان IP المحلي">
        <span>LAN:</span>
        <span class="meta-val" id="meta-local-ip">--</span>
      </div>
      <div class="meta-chip" title="سرعة ربط المنفذ">
        <span>LINK:</span>
        <span class="meta-val" id="meta-link-speed">--</span>
      </div>
      <div class="meta-chip" title="إجمالي استهلاك الجلسة">
        <span>TOT:</span>
        <span class="meta-val" id="meta-session-data">--</span>
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
      cardFlipper: this.shadowRoot.getElementById('card-flipper'),
      btnFlipApps: this.shadowRoot.getElementById('btn-flip-apps'),
      btnFlipBack: this.shadowRoot.getElementById('btn-flip-back'),
      dl_val: this.shadowRoot.getElementById('network_download_mbps'),
      dl_bar: this.shadowRoot.getElementById('network_download_bar'),
      ul_val: this.shadowRoot.getElementById('network_upload_mbps'),
      ul_bar: this.shadowRoot.getElementById('network_upload_bar'),
      sparkline_dl: this.shadowRoot.getElementById('sparkline-path-dl'),
      sparkline_ul: this.shadowRoot.getElementById('sparkline-path-ul'),
      ping_val: this.shadowRoot.getElementById('ping-value'),
      ping_dot: this.shadowRoot.getElementById('ping-dot'),
      apps_container: this.shadowRoot.getElementById('apps-list-container'),
      meta_local_ip: this.shadowRoot.getElementById('meta-local-ip'),
      meta_link_speed: this.shadowRoot.getElementById('meta-link-speed'),
      meta_session_data: this.shadowRoot.getElementById('meta-session-data'),
    };

    this.targetValues = {
      network_download_mbps: null,
      network_upload_mbps: null,
    };

    this.currentValues = {
      network_download_mbps: null,
      network_upload_mbps: null,
    };

    // Sparkline history buffers (20 samples)
    this.historyDL = new Array(20).fill(0);
    this.historyUL = new Array(20).fill(0);
    this._lastSparklineTime = 0;

    // Cache to prevent unnecessary DOM re-renders of apps list
    this._lastAppsSignature = '';

    this.onStateChange = this.onStateChange.bind(this);
    this.tick = this.tick.bind(this);
    this.isRunning = false;
  }

  connectedCallback() {
    // 3D Flip button handlers
    if (this.dom.btnFlipApps) {
      this.dom.btnFlipApps.addEventListener('click', (e) => {
        e.stopPropagation();
        this.classList.add('flipped');
      });
    }

    if (this.dom.btnFlipBack) {
      this.dom.btnFlipBack.addEventListener('click', (e) => {
        e.stopPropagation();
        this.classList.remove('flipped');
      });
    }

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

    // Ping Telemetry
    if (delta.network_ping_ms !== undefined) {
      this.updatePing(delta.network_ping_ms);
    }

    // Top Apps Telemetry
    if (delta.network_top_processes !== undefined) {
      this.renderTopApps(delta.network_top_processes);
    }

    // Metadata Telemetry
    if (delta.network_local_ip !== undefined && this.dom.meta_local_ip) {
      this.dom.meta_local_ip.textContent = delta.network_local_ip || '--';
    }

    if (delta.network_link_speed_mbps !== undefined && this.dom.meta_link_speed) {
      const spd = delta.network_link_speed_mbps;
      if (spd >= 1000) {
        this.dom.meta_link_speed.textContent = `${(spd / 1000).toFixed(0)}G`;
      } else if (spd > 0) {
        this.dom.meta_link_speed.textContent = `${spd}M`;
      } else {
        this.dom.meta_link_speed.textContent = '--';
      }
    }

    if ((delta.network_total_dl_gb !== undefined || delta.network_total_ul_gb !== undefined) && this.dom.meta_session_data) {
      const dl = delta.network_total_dl_gb || 0;
      const ul = delta.network_total_ul_gb || 0;
      this.dom.meta_session_data.textContent = `${dl.toFixed(1)}G↓ / ${ul.toFixed(1)}G↑`;
    }
  }

  updatePing(ping) {
    if (!this.dom.ping_val || !this.dom.ping_dot) return;
    if (ping === null || ping === undefined) {
      this.dom.ping_val.textContent = '-- ms';
      this.dom.ping_dot.style.background = '#64748B';
      this.dom.ping_dot.style.boxShadow = 'none';
      return;
    }

    this.dom.ping_val.textContent = `${Math.round(ping)} ms`;
    if (ping < 70) {
      this.dom.ping_dot.style.background = '#10B981';
      this.dom.ping_dot.style.boxShadow = '0 0 6px #10B981';
    } else if (ping < 160) {
      this.dom.ping_dot.style.background = '#F59E0B';
      this.dom.ping_dot.style.boxShadow = '0 0 6px #F59E0B';
    } else {
      this.dom.ping_dot.style.background = '#EF4444';
      this.dom.ping_dot.style.boxShadow = '0 0 6px #EF4444';
    }
  }

  renderTopApps(apps) {
    if (!this.dom.apps_container) return;
    if (!apps || !apps.length) {
      this.dom.apps_container.innerHTML = `
        <div class="empty-apps-state">
          <span>📡</span>
          <span>لا توجد اتصالات نشطة للبرامج حالياً</span>
        </div>
      `;
      this._lastAppsSignature = '';
      return;
    }

    // Check signature to avoid DOM re-creations when stable
    const sig = apps.map(a => `${a.name}:${a.total_kbps}:${a.connections}`).join('|');
    if (sig === this._lastAppsSignature) return;
    this._lastAppsSignature = sig;

    const maxRate = Math.max(...apps.map(a => a.total_kbps || 0), 1.0);

    const html = apps.map(app => {
      const dlText = this._formatRate(app.dl_kbps);
      const ulText = this._formatRate(app.ul_kbps);
      const percent = Math.min(100, Math.max(8, Math.round((app.total_kbps / maxRate) * 100)));

      return `
        <div class="app-item-card">
          <div class="app-header-row">
            <div class="app-name-group">
              <span class="app-icon">${app.icon || '🌐'}</span>
              <span class="app-name" title="${app.raw_name || app.name}">${app.name}</span>
              ${app.connections ? `<span class="app-conn-badge">${app.connections}c</span>` : ''}
            </div>
            <div class="app-rates-group">
              <span class="app-dl-rate">↓${dlText}</span>
              <span class="app-ul-rate">↑${ulText}</span>
            </div>
          </div>
          <div class="app-bar-track">
            <div class="app-bar-fill" style="width: ${percent}%;"></div>
          </div>
        </div>
      `;
    }).join('');

    this.dom.apps_container.innerHTML = html;
  }

  _formatRate(kbps) {
    if (!kbps || kbps < 0.1) return '0K';
    if (kbps >= 1024) {
      return `${(kbps / 1024).toFixed(1)}M`;
    }
    return `${Math.round(kbps)}K`;
  }

  tick(timestamp) {
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

    // Update Sparklines at ~5 Hz (every 200ms)
    if (!this._lastSparklineTime || timestamp - this._lastSparklineTime > 200) {
      this._lastSparklineTime = timestamp;
      this._updateSparklines();
    }

    requestAnimationFrame(this.tick);
  }

  _updateSparklines() {
    const curDL = this.currentValues.network_download_mbps || 0;
    const curUL = this.currentValues.network_upload_mbps || 0;

    this.historyDL.shift();
    this.historyDL.push(curDL);

    this.historyUL.shift();
    this.historyUL.push(curUL);

    if (this.dom.sparkline_dl) {
      this.dom.sparkline_dl.setAttribute('d', this._generateSvgPath(this.historyDL, 100, 24));
    }
    if (this.dom.sparkline_ul) {
      this.dom.sparkline_ul.setAttribute('d', this._generateSvgPath(this.historyUL, 100, 24));
    }
  }

  _generateSvgPath(data, width, height) {
    const max = Math.max(...data, 2.0); // Minimum scale floor of 2 Mbps
    const step = width / (data.length - 1);
    const padding = 2;
    const plotH = height - padding * 2;

    const points = data.map((val, idx) => {
      const x = (idx * step).toFixed(1);
      const ratio = Math.min(1, Math.max(0, val / max));
      const y = (height - padding - ratio * plotH).toFixed(1);
      return `${x},${y}`;
    });

    return `M ${points.join(' L ')}`;
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
