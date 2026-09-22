import { EventBus } from '../store/event_bus.js';

const THEMES = [
  { id: 'default', name: 'Cyan Glass', icon: '🌊', color: '#22D3EE' },
  { id: 'oled', name: 'OLED Black', icon: '🖤', color: '#38BDF8' },
  { id: 'cyberpunk', name: 'Cyberpunk', icon: '⚡', color: '#FFE600' },
  { id: 'emerald', name: 'Emerald', icon: '🍃', color: '#00FF66' }
];

const template = document.createElement('template');
template.innerHTML = `
<style>
  :host {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 14px;
    background: var(--glass-bg, rgba(255, 255, 255, 0.02));
    backdrop-filter: var(--glass-blur, blur(16px));
    -webkit-backdrop-filter: var(--glass-blur, blur(16px));
    border: var(--glass-border, 1px solid rgba(255, 255, 255, 0.06));
    border-radius: 14px;
    box-shadow: var(--glass-shadow, inset 0 1px 0 rgba(255, 255, 255, 0.1));
    transform: translateZ(0);
    -webkit-backface-visibility: hidden;
    backface-visibility: hidden;
    flex-shrink: 0;
    gap: 16px;
    box-sizing: border-box;
    width: 100%;
  }

  .header-right-group {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  /* Prominent Enlarged Date Badge */
  .date-group-badge {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 4px 12px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(34, 211, 238, 0.25);
    border-radius: 16px;
    font-family: var(--font-numbers, 'Rajdhani', sans-serif);
    font-size: 20px;
    color: var(--text-pure-white, #FFFFFF);
    letter-spacing: 0.5px;
    box-shadow: 0 0 15px rgba(34, 211, 238, 0.1);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .date-icon {
    font-size: 19px;
  }

  .date-sep {
    color: rgba(255, 255, 255, 0.3);
    font-size: 15px;
  }

  .date-hijri {
    color: var(--neon-cyan, #22D3EE);
    font-size: 20px;
    font-weight: 800;
    text-shadow: 0 0 10px rgba(34, 211, 238, 0.4);
  }

  .date-greg {
    color: var(--text-pure-white, #FFFFFF);
    font-size: 18px;
    font-weight: 700;
    opacity: 0.95;
  }

  /* Weekdays Strip (7 Days of the Week) */
  .weekdays-strip {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 3px 6px;
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
    flex-shrink: 0;
    overflow: visible;
  }

  .weekday-pill {
    position: relative;
    font-family: var(--font-arabic, 'Cairo', sans-serif);
    font-size: 11.5px;
    font-weight: 600;
    color: rgba(248, 250, 255, 0.36);
    padding: 3px 6px;
    border-radius: 8px;
    border: 1.5px solid transparent;
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    white-space: nowrap;
    user-select: none;
    line-height: 1.2;
  }

  /* Active Day: Magnifying Lens Aesthetic (عدسة مكبرة متوهجة) */
  .weekday-pill.active-day {
    position: relative;
    z-index: 5;
    font-size: 16.5px;
    font-weight: 800;
    color: #FFFFFF;
    padding: 5px 14px;
    margin: 0 5px;
    border-radius: 13px;
    background: radial-gradient(ellipse at 50% 20%, rgba(255, 255, 255, 0.32) 0%, rgba(34, 211, 238, 0.3) 40%, rgba(124, 92, 255, 0.22) 100%);
    border: 2px solid var(--neon-cyan, #22D3EE);
    box-shadow: 
      0 0 18px rgba(34, 211, 238, 0.55),
      0 4px 12px rgba(0, 0, 0, 0.4),
      inset 0 2px 4px rgba(255, 255, 255, 0.6),
      inset 0 -1px 3px rgba(0, 0, 0, 0.4);
    text-shadow: 
      0 0 10px rgba(34, 211, 238, 0.8),
      0 2px 4px rgba(0, 0, 0, 0.6);
    transform: scale(1.15) translateY(-1px);
    letter-spacing: 0.5px;
  }

  /* 12-Hour System Clock (Guaranteed Non-Wrapping Single Line & Absolute Dead-Center Anchor) */
  .clock-display {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    font-family: var(--font-numbers, 'Rajdhani', sans-serif);
    font-size: 36px;
    font-weight: 800;
    letter-spacing: 1.5px;
    color: var(--text-pure-white, #FFFFFF);
    text-shadow: 0 0 16px rgba(248, 250, 255, 0.3);
    direction: ltr;
    white-space: nowrap !important;
    display: inline-flex;
    align-items: baseline;
    justify-content: center;
    width: 240px;
    min-width: 240px;
    max-width: 240px;
    font-variant-numeric: tabular-nums;
    font-feature-settings: "tnum" 1;
    pointer-events: none;
    z-index: 10;
  }

  .clock-ampm {
    font-size: 22px;
    font-weight: 700;
    color: var(--neon-cyan, #22D3EE);
    margin-left: 6px;
    vertical-align: baseline;
  }

  /* Header Telemetry Group */
  .header-telemetry-group {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }

  /* Header Actions & Status Badge */
  .header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 6px 14px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 30px;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    font-size: 13px;
    font-family: var(--font-arabic, 'Cairo', sans-serif);
    font-weight: 600;
    direction: ltr;
    transition: all 0.3s ease;
  }

  .status-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background-color: var(--neon-yellow, #FACC15);
    box-shadow: 0 0 8px var(--neon-yellow, #FACC15);
    transition: all 0.3s ease;
  }

  .status-badge.live .status-dot {
    background-color: var(--neon-green, #10B981);
    box-shadow: 0 0 10px var(--neon-green, #10B981), 0 0 20px var(--neon-green, #10B981);
    animation: pulse-glow 2s infinite ease-in-out;
  }

  .status-badge.polling .status-dot {
    background-color: var(--neon-cyan, #22D3EE);
    box-shadow: 0 0 8px var(--neon-cyan, #22D3EE);
  }

  .status-badge.reconnecting .status-dot {
    background-color: var(--neon-orange, #FB923C);
    box-shadow: 0 0 8px var(--neon-orange, #FB923C);
    animation: blink-fast 1s infinite;
  }

  .status-badge.offline .status-dot {
    background-color: var(--neon-red, #EF4444);
    box-shadow: 0 0 8px var(--neon-red, #EF4444);
  }

  .status-ping {
    font-family: var(--font-numbers, 'Rajdhani', sans-serif);
    font-size: 11px;
    color: var(--neon-cyan, #22D3EE);
    direction: ltr;
  }

  @keyframes pulse-glow {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.2); opacity: 0.75; }
  }

  @keyframes blink-fast {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.2; }
  }

  /* Theme Switcher Button */
  .theme-toggle-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    color: var(--text-pure-white, #FFFFFF);
    cursor: pointer;
    font-family: var(--font-arabic, 'Cairo', sans-serif);
    font-size: 13px;
    font-weight: 700;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    user-select: none;
  }

  .theme-toggle-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: var(--neon-cyan, #22D3EE);
    color: var(--neon-cyan, #22D3EE);
    transform: translateY(-1px);
  }

  .theme-indicator-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: var(--theme-accent, #22D3EE);
    box-shadow: 0 0 8px var(--theme-accent, #22D3EE);
    transition: background-color 0.3s ease, box-shadow 0.3s ease;
  }

  .theme-label-text {
    direction: rtl;
    white-space: nowrap;
  }

  .kiosk-toggle-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    color: var(--text-pure-white, #FFFFFF);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .kiosk-toggle-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: var(--neon-cyan, #22D3EE);
    color: var(--neon-cyan, #22D3EE);
    transform: translateY(-1px);
  }

  /* Live Auto-Update Badge Pill */
  .update-badge {
    display: none;
    align-items: center;
    gap: 7px;
    padding: 5px 12px;
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.16) 0%, rgba(234, 88, 12, 0.22) 100%);
    border: 1.5px solid rgba(251, 191, 36, 0.65);
    border-radius: 20px;
    color: #FDE68A;
    font-family: var(--font-arabic, 'Cairo', sans-serif);
    font-size: 12.5px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 0 12px rgba(245, 158, 11, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.2);
    transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
    animation: update-pulse-glow 2.5s infinite ease-in-out;
    user-select: none;
    white-space: nowrap;
  }

  .update-badge:hover {
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.32) 0%, rgba(234, 88, 12, 0.38) 100%);
    border-color: #FCD34D;
    box-shadow: 0 0 20px rgba(245, 158, 11, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.4);
    transform: translateY(-1px) scale(1.03);
    color: #FFFFFF;
  }

  .update-badge-icon {
    font-size: 14px;
    filter: drop-shadow(0 0 6px rgba(251, 191, 36, 0.8));
    animation: bolt-flicker 1.8s infinite alternate;
  }

  @keyframes update-pulse-glow {
    0%, 100% {
      box-shadow: 0 0 10px rgba(245, 158, 11, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2);
    }
    50% {
      box-shadow: 0 0 20px rgba(245, 158, 11, 0.65), 0 0 35px rgba(245, 158, 11, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.4);
    }
  }

  @keyframes bolt-flicker {
    0% { opacity: 0.85; transform: scale(0.95); }
    100% { opacity: 1; transform: scale(1.15); }
  }
</style>

<!-- 1. Right: Prominent Enlarged Date Badge & Display Info -->
<div class="header-right-group">
  <!-- Prominent Enlarged Date Badge -->
  <div class="date-group-badge">
    <span class="date-icon">📅</span>
    <span class="date-item date-hijri" id="date_hijri">--/--/--</span>
    <span class="date-sep">•</span>
    <span class="date-item date-greg" id="date_gregorian">--/--/--</span>
  </div>

  <!-- Weekdays Strip (7 Days of the Week) -->
  <div class="weekdays-strip" id="weekdays-strip" aria-label="أيام الأسبوع">
    <span class="weekday-pill" data-day="6">السبت</span>
    <span class="weekday-pill" data-day="0">الأحد</span>
    <span class="weekday-pill" data-day="1">الأثنين</span>
    <span class="weekday-pill" data-day="2">الثلاثاء</span>
    <span class="weekday-pill" data-day="3">الأربعاء</span>
    <span class="weekday-pill" data-day="4">الخميس</span>
    <span class="weekday-pill" data-day="5">الجمعة</span>
  </div>
</div>

<!-- 2. Center: 12-Hour Clock Display (Standalone, Unwrapped, Dead Center) -->
<div class="clock-display" id="system-clock">--:--:-- <span class="clock-ampm">--</span></div>

<!-- 3. Left: Connection Status & Fullscreen -->
<div class="header-telemetry-group">
  <div class="header-actions">
    <!-- Live Connection Status Badge -->
    <div class="status-badge" id="status-badge" dir="ltr">
      <span class="status-dot" id="status-dot"></span>
      <span class="status-text" id="status-text">جاري الاتصال...</span>
      <span class="status-ping" id="status-ping">-- ms</span>
    </div>

    <!-- Live Auto-Update Badge Pill -->
    <button class="update-badge" id="btn-update-badge" title="تحديث جديد متوفر" aria-label="تحديث جديد متوفر">
      <span class="update-badge-icon">⚡</span>
      <span class="update-badge-text" id="update-badge-text">تحديث متوفر</span>
    </button>

    <!-- Theme Switcher Button -->
    <button class="theme-toggle-btn" id="btn-theme-toggle" title="تبديل النمط المظهري" aria-label="تبديل النمط">
      <span class="theme-indicator-dot" id="theme-dot"></span>
      <span class="theme-label-text" id="theme-text">🌊 Cyan Glass</span>
    </button>

    <!-- Fullscreen Button -->
    <button class="kiosk-toggle-btn" id="btn-fullscreen" title="ملء الشاشة Kiosk Mode" aria-label="ملء الشاشة">
      <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
      </svg>
    </button>
  </div>
</div>
`;

export class DashboardHeader extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.dom = {
      dateHijri: this.shadowRoot.getElementById('date_hijri'),
      dateGregorian: this.shadowRoot.getElementById('date_gregorian'),
      weekdaysStrip: this.shadowRoot.getElementById('weekdays-strip'),
      weekdayPills: this.shadowRoot.querySelectorAll('.weekday-pill'),
      systemClock: this.shadowRoot.getElementById('system-clock'),
      statusBadge: this.shadowRoot.getElementById('status-badge'),
      statusDot: this.shadowRoot.getElementById('status-dot'),
      statusText: this.shadowRoot.getElementById('status-text'),
      statusPing: this.shadowRoot.getElementById('status-ping'),
      updateBadge: this.shadowRoot.getElementById('btn-update-badge'),
      updateBadgeText: this.shadowRoot.getElementById('update-badge-text'),
      fullscreenBtn: this.shadowRoot.getElementById('btn-fullscreen'),
      themeToggleBtn: this.shadowRoot.getElementById('btn-theme-toggle'),
      themeDot: this.shadowRoot.getElementById('theme-dot'),
      themeText: this.shadowRoot.getElementById('theme-text'),
    };

    this._lastActiveDay = null;
    this.timerId = null;
    this._updateData = null;
    this.updateCheckTimer = null;

    this.onConnectionStatus = this.onConnectionStatus.bind(this);
    this.onConnectionPing = this.onConnectionPing.bind(this);
    this.onTelemetryData = this.onTelemetryData.bind(this);
    this.toggleFullscreen = this.toggleFullscreen.bind(this);
    this.cycleTheme = this.cycleTheme.bind(this);
    this.openUpdateModal = this.openUpdateModal.bind(this);
    this.closeUpdateModal = this.closeUpdateModal.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this.copyUpdateCommand = this.copyUpdateCommand.bind(this);
  }

  connectedCallback() {
    this.unsubStatus = EventBus.on('connection:status', this.onConnectionStatus);
    this.unsubPing = EventBus.on('connection:ping', this.onConnectionPing);
    this.unsubData = EventBus.on('telemetry:data', this.onTelemetryData);
    this.unsubState = EventBus.on('state-changed', this.onTelemetryData);

    if (this.dom.fullscreenBtn) {
      this.dom.fullscreenBtn.addEventListener('click', this.toggleFullscreen);
    }

    if (this.dom.themeToggleBtn) {
      this.dom.themeToggleBtn.addEventListener('click', this.cycleTheme);
    }

    if (this.dom.updateBadge) {
      this.dom.updateBadge.addEventListener('click', this.openUpdateModal);
    }

    window.addEventListener('keydown', this._onKeyDown);

    this.initTheme();
    this.updateClock();
    this.updateWeekdays();

    this.timerId = setInterval(() => {
      this.updateClock();
      this.updateWeekdays();
    }, 1000);

    // Check for system updates after 3 seconds
    this.updateCheckTimer = setTimeout(() => {
      this.checkForUpdates();
    }, 3000);
  }

  disconnectedCallback() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    if (this.updateCheckTimer) {
      clearTimeout(this.updateCheckTimer);
      this.updateCheckTimer = null;
    }
    window.removeEventListener('keydown', this._onKeyDown);
    if (this.unsubStatus) this.unsubStatus();
    if (this.unsubPing) this.unsubPing();
    if (this.unsubData) this.unsubData();
    if (this.unsubState) this.unsubState();

    if (this.dom.fullscreenBtn) {
      this.dom.fullscreenBtn.removeEventListener('click', this.toggleFullscreen);
    }

    if (this.dom.themeToggleBtn) {
      this.dom.themeToggleBtn.removeEventListener('click', this.cycleTheme);
    }

    if (this.dom.updateBadge) {
      this.dom.updateBadge.removeEventListener('click', this.openUpdateModal);
    }

    this.destroyModalPortal();
  }

  initTheme() {
    let savedThemeId = 'default';
    try {
      savedThemeId = localStorage.getItem('aida64_theme') || 'default';
    } catch (e) {}

    const theme = THEMES.find(t => t.id === savedThemeId) || THEMES[0];
    if (theme.id === 'default') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme.id);
    }
    this.updateThemeUI(theme);
  }

  cycleTheme(e) {
    const currentThemeId = document.documentElement.getAttribute('data-theme') || 'default';
    const currentIndex = THEMES.findIndex(t => t.id === currentThemeId);
    const nextIndex = (currentIndex + 1) % THEMES.length;
    const nextTheme = THEMES[nextIndex];

    // Determine click coordinates for CSS View Transitions ripple
    let x = '85%';
    let y = '30px';
    if (e && e.clientX !== undefined) {
      x = `${e.clientX}px`;
      y = `${e.clientY}px`;
    }
    document.documentElement.style.setProperty('--click-x', x);
    document.documentElement.style.setProperty('--click-y', y);

    const applyTheme = () => {
      if (nextTheme.id === 'default') {
        document.documentElement.removeAttribute('data-theme');
      } else {
        document.documentElement.setAttribute('data-theme', nextTheme.id);
      }
      try {
        localStorage.setItem('aida64_theme', nextTheme.id);
      } catch (err) {}
      this.updateThemeUI(nextTheme);
      EventBus.emit('theme:changed', nextTheme.id);
    };

    // Use CSS View Transitions API with graceful fallback
    if (document.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.startViewTransition(() => {
        applyTheme();
      });
    } else {
      applyTheme();
    }
  }

  updateThemeUI(theme) {
    if (!this.dom.themeText || !this.dom.themeDot) return;
    this.dom.themeText.textContent = `${theme.icon} ${theme.name}`;
    this.dom.themeDot.style.backgroundColor = theme.color;
    this.dom.themeDot.style.boxShadow = `0 0 8px ${theme.color}`;
  }

  updateClock() {
    if (!this.dom.systemClock) return;
    const now = new Date();
    let hours = now.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const hoursStr = String(hours).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    this.dom.systemClock.innerHTML = `${hoursStr}:${minutes}:${seconds}&nbsp;<span class="clock-ampm">${ampm}</span>`;
  }

  updateWeekdays() {
    if (!this.dom.weekdayPills || this.dom.weekdayPills.length === 0) return;
    const currentDay = new Date().getDay(); // 0: Sunday, 1: Monday, ..., 6: Saturday
    if (this._lastActiveDay === currentDay) return;
    this._lastActiveDay = currentDay;

    this.dom.weekdayPills.forEach(pill => {
      const day = parseInt(pill.getAttribute('data-day'), 10);
      if (day === currentDay) {
        pill.classList.add('active-day');
      } else {
        pill.classList.remove('active-day');
      }
    });
  }

  onConnectionStatus({ mode, text }) {
    if (!this.dom.statusBadge || !this.dom.statusText) return;
    this.dom.statusBadge.className = `status-badge ${mode}`;
    this.dom.statusText.textContent = text;
    if (mode === 'offline' && this.dom.statusPing) {
      this.dom.statusPing.textContent = '-- ms';
    }
  }

  onConnectionPing(ms) {
    if (this.dom.statusPing) {
      this.dom.statusPing.textContent = `${ms} ms`;
    }
  }

  onTelemetryData(data) {
    if (!data || typeof data !== 'object') return;
    if (data.date_gregorian && this.dom.dateGregorian) {
      this.dom.dateGregorian.textContent = data.date_gregorian;
    }
    if (data.date_hijri && this.dom.dateHijri) {
      this.dom.dateHijri.textContent = data.date_hijri;
    }
  }

  async checkForUpdates() {
    try {
      const res = await fetch('/api/system/check-update');
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.update_available) {
        this._updateData = data;
        this.showUpdateBadge(data);
      }
    } catch (err) {
      console.debug('Update check skipped or failed:', err);
    }
  }

  showUpdateBadge(data) {
    if (!this.dom.updateBadge || !this.dom.updateBadgeText) return;
    const ver = data.latest_version ? (data.latest_version.startsWith('v') ? data.latest_version : `v${data.latest_version}`) : '';
    this.dom.updateBadgeText.textContent = `⚡ تحديث جديد ${ver} متوفر`;
    this.dom.updateBadge.style.display = 'inline-flex';
  }

  ensureModalPortal() {
    let portal = document.getElementById('aida-update-modal-portal');
    if (!portal) {
      portal = document.createElement('div');
      portal.id = 'aida-update-modal-portal';
      portal.innerHTML = `
        <style>
          .aida-update-backdrop {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(4, 8, 16, 0.78);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1);
            direction: rtl;
            box-sizing: border-box;
            padding: 16px;
          }
          .aida-update-backdrop.open {
            opacity: 1;
            pointer-events: auto;
          }
          .aida-update-card {
            width: 100%;
            max-width: 540px;
            max-height: 90vh;
            display: flex;
            flex-direction: column;
            background: rgba(15, 23, 42, 0.94);
            border: 1.5px solid rgba(245, 158, 11, 0.5);
            box-shadow: 0 24px 60px rgba(0, 0, 0, 0.8), 0 0 35px rgba(245, 158, 11, 0.25);
            border-radius: 20px;
            overflow: hidden;
            transform: scale(0.92) translateY(12px);
            transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            color: #F8FAFC;
            font-family: var(--font-arabic, 'Cairo', sans-serif);
          }
          .aida-update-backdrop.open .aida-update-card {
            transform: scale(1) translateY(0);
          }
          .aida-modal-header {
            padding: 16px 22px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            background: rgba(255, 255, 255, 0.02);
          }
          .aida-modal-title-group {
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .aida-modal-title {
            font-size: 17.5px;
            font-weight: 800;
            color: #FFFFFF;
            margin: 0;
          }
          .aida-modal-version-tag {
            font-family: var(--font-numbers, 'Rajdhani', sans-serif);
            font-size: 13px;
            font-weight: 700;
            color: #FCD34D;
            background: rgba(245, 158, 11, 0.18);
            border: 1px solid rgba(245, 158, 11, 0.4);
            padding: 2px 9px;
            border-radius: 12px;
          }
          .aida-modal-close-btn {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 10px;
            color: rgba(255, 255, 255, 0.75);
            width: 32px;
            height: 32px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            transition: all 0.2s ease;
          }
          .aida-modal-close-btn:hover {
            background: rgba(239, 68, 68, 0.2);
            border-color: rgba(239, 68, 68, 0.6);
            color: #EF4444;
          }
          .aida-modal-body {
            padding: 18px 22px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 14px;
            font-size: 13.5px;
            line-height: 1.6;
          }
          .aida-ver-row {
            display: flex;
            align-items: center;
            justify-content: space-around;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.07);
            border-radius: 12px;
            padding: 10px 14px;
          }
          .aida-ver-box {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 3px;
          }
          .aida-ver-lbl {
            font-size: 11px;
            color: rgba(255, 255, 255, 0.5);
          }
          .aida-ver-num {
            font-family: var(--font-numbers, 'Rajdhani', sans-serif);
            font-size: 17px;
            font-weight: 700;
          }
          .aida-ver-num.curr { color: rgba(255, 255, 255, 0.85); }
          .aida-ver-num.new { color: #34D399; text-shadow: 0 0 10px rgba(52, 211, 153, 0.4); }
          .aida-release-notes {
            background: rgba(0, 0, 0, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            padding: 12px 14px;
            max-height: 160px;
            overflow-y: auto;
            font-size: 12.5px;
            color: rgba(255, 255, 255, 0.75);
            white-space: pre-wrap;
            word-break: break-word;
          }
          .aida-instructions-card {
            background: rgba(34, 211, 238, 0.06);
            border: 1px solid rgba(34, 211, 238, 0.25);
            border-radius: 12px;
            padding: 12px 14px;
            font-size: 12.5px;
            color: #E2E8F0;
          }
          .aida-instructions-card code {
            font-family: Consolas, monospace;
            background: rgba(0, 0, 0, 0.45);
            border: 1px solid rgba(34, 211, 238, 0.3);
            padding: 2px 7px;
            border-radius: 6px;
            color: #22D3EE;
            direction: ltr;
            display: inline-block;
          }
          .aida-copy-btn {
            background: rgba(34, 211, 238, 0.15);
            border: 1px solid rgba(34, 211, 238, 0.4);
            color: #22D3EE;
            border-radius: 6px;
            padding: 3px 8px;
            font-size: 11px;
            font-family: var(--font-arabic, 'Cairo', sans-serif);
            cursor: pointer;
            margin-right: 8px;
            transition: all 0.2s ease;
          }
          .aida-copy-btn:hover {
            background: rgba(34, 211, 238, 0.3);
          }
          .aida-modal-footer {
            padding: 14px 22px;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 10px;
            background: rgba(255, 255, 255, 0.02);
          }
          .aida-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 8px 16px;
            border-radius: 10px;
            font-family: var(--font-arabic, 'Cairo', sans-serif);
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
            text-decoration: none;
            transition: all 0.2s ease;
          }
          .aida-btn-sec {
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.12);
            color: #FFFFFF;
          }
          .aida-btn-sec:hover { background: rgba(255, 255, 255, 0.14); }
          .aida-btn-pri {
            background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%);
            border: 1px solid rgba(251, 191, 36, 0.65);
            color: #FFFFFF;
            box-shadow: 0 0 15px rgba(245, 158, 11, 0.35);
          }
          .aida-btn-pri:hover {
            background: linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%);
            box-shadow: 0 0 22px rgba(245, 158, 11, 0.55);
            transform: translateY(-1px);
          }
        </style>
        <div class="aida-update-backdrop" id="aida-update-backdrop">
          <div class="aida-update-card" role="dialog" aria-modal="true">
            <div class="aida-modal-header">
              <div class="aida-modal-title-group">
                <span style="font-size: 20px;">⚡</span>
                <h3 class="aida-modal-title">تحديث جديد متوفر</h3>
                <span class="aida-modal-version-tag" id="aida-modal-ver-tag">v--</span>
              </div>
              <button class="aida-modal-close-btn" id="aida-modal-close" aria-label="إغلاق">✕</button>
            </div>
            <div class="aida-modal-body">
              <div class="aida-ver-row">
                <div class="aida-ver-box">
                  <span class="aida-ver-lbl">الإصدار المثبت</span>
                  <span class="aida-ver-num curr" id="aida-modal-curr-ver">v1.0.0</span>
                </div>
                <span style="color: rgba(255,255,255,0.3); font-size: 18px;">➜</span>
                <div class="aida-ver-box">
                  <span class="aida-ver-lbl">الإصدار المتاح</span>
                  <span class="aida-ver-num new" id="aida-modal-new-ver">v--</span>
                </div>
              </div>

              <div style="font-weight: 700; color: #FFFFFF; font-size: 13px;" id="aida-modal-rel-name">ملاحظات الإصدار:</div>
              <div class="aida-release-notes" id="aida-modal-rel-notes">جاري فحص تفاصيل التحديث...</div>

              <div class="aida-instructions-card">
                <strong>💡 طريقة التحديث التلقائي:</strong><br>
                لتحديث لوحة التحكم بنقرة واحدة والحفاظ على كافة الإعدادات والملفات:<br>
                <div style="margin-top: 6px; display: flex; align-items: center; gap: 8px;">
                  <code>scripts\\update.bat</code>
                  <button class="aida-copy-btn" id="aida-btn-copy-cmd">نسخ الأمر</button>
                </div>
              </div>
            </div>
            <div class="aida-modal-footer">
              <button class="aida-btn aida-btn-sec" id="aida-modal-dismiss">إغلاق</button>
              <a class="aida-btn aida-btn-pri" id="aida-modal-dl-link" href="#" target="_blank" rel="noopener noreferrer">
                <span>⬇️</span> تحميل الحزمة (GitHub)
              </a>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(portal);

      const closeBtn = portal.querySelector('#aida-modal-close');
      const dismissBtn = portal.querySelector('#aida-modal-dismiss');
      const backdrop = portal.querySelector('#aida-update-backdrop');
      const copyBtn = portal.querySelector('#aida-btn-copy-cmd');

      if (closeBtn) closeBtn.addEventListener('click', this.closeUpdateModal);
      if (dismissBtn) dismissBtn.addEventListener('click', this.closeUpdateModal);
      if (backdrop) {
        backdrop.addEventListener('click', (e) => {
          if (e.target === backdrop) this.closeUpdateModal();
        });
      }
      if (copyBtn) copyBtn.addEventListener('click', this.copyUpdateCommand);
    }
    return portal;
  }

  openUpdateModal() {
    const portal = this.ensureModalPortal();
    if (!portal) return;

    const data = this._updateData || {};
    const ver = data.latest_version || 'v--';
    const tag = ver.startsWith('v') ? ver : `v${ver}`;

    const verTag = portal.querySelector('#aida-modal-ver-tag');
    const currVer = portal.querySelector('#aida-modal-curr-ver');
    const newVer = portal.querySelector('#aida-modal-new-ver');
    const relName = portal.querySelector('#aida-modal-rel-name');
    const relNotes = portal.querySelector('#aida-modal-rel-notes');
    const dlLink = portal.querySelector('#aida-modal-dl-link');
    const backdrop = portal.querySelector('#aida-update-backdrop');

    if (verTag) verTag.textContent = tag;
    if (currVer) currVer.textContent = `v${data.current_version || '1.0.0'}`;
    if (newVer) newVer.textContent = tag;
    if (relName) {
      relName.textContent = data.release_name ? `ملاحظات الإصدار (${data.release_name}):` : 'ملاحظات الإصدار:';
    }
    if (relNotes) {
      relNotes.textContent = data.release_notes || 'لا توجد ملاحظات إضافية لهذا الإصدار.';
    }
    if (dlLink) {
      dlLink.href = data.download_url || data.html_url || 'https://github.com/aasanea/aida64-web-sensorpanel/releases';
    }
    if (backdrop) {
      backdrop.classList.add('open');
    }
  }

  closeUpdateModal() {
    const portal = document.getElementById('aida-update-modal-portal');
    if (portal) {
      const backdrop = portal.querySelector('#aida-update-backdrop');
      if (backdrop) {
        backdrop.classList.remove('open');
      }
    }
  }

  copyUpdateCommand(e) {
    const text = 'scripts\\update.bat';
    navigator.clipboard.writeText(text).then(() => {
      const btn = e && e.target;
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = 'تم النسخ! ✓';
        setTimeout(() => { btn.textContent = orig; }, 2000);
      }
    }).catch(err => {
      console.warn('Failed to copy command:', err);
    });
  }

  destroyModalPortal() {
    const portal = document.getElementById('aida-update-modal-portal');
    if (portal && portal.parentNode) {
      portal.parentNode.removeChild(portal);
    }
  }

  _onKeyDown(e) {
    if (e.key === 'Escape') {
      this.closeUpdateModal();
    }
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.warn('Fullscreen request failed:', err);
      });
    } else {
      document.exitFullscreen().catch(err => {
        console.warn('Exit fullscreen failed:', err);
      });
    }
  }
}

customElements.define('dashboard-header', DashboardHeader);
