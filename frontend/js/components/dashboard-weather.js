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
  .prayer-icon {
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

  /* Prayer Grid */
  .slot-prayer-grid {
    display: flex;
    flex-direction: column;
    gap: 7px;
    flex: 1;
    justify-content: space-around;
  }

  .prayer-capsule {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 14px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: 12px;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
    transition: all 0.25s ease;
    width: 100%;
    box-sizing: border-box;
    min-width: 0;
  }

  .prayer-capsule:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(34, 211, 238, 0.3);
  }

  .weather-capsule {
    background: linear-gradient(135deg, rgba(251, 191, 36, 0.08) 0%, rgba(255, 255, 255, 0.03) 100%);
    border-color: rgba(251, 191, 36, 0.3);
    box-shadow: 0 0 14px rgba(251, 191, 36, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  .weather-capsule .weather-icon {
    font-size: 20px;
    display: inline-block;
    transform: translateY(1px);
    filter: drop-shadow(0 0 10px rgba(251, 191, 36, 0.8));
  }

  .weather-capsule .weather-desc {
    font-family: var(--font-arabic, 'Cairo', sans-serif);
    font-size: 12px;
    font-weight: 700;
    color: #FDE68A;
    background: rgba(251, 191, 36, 0.15);
    border: 1px solid rgba(251, 191, 36, 0.3);
    padding: 1px 8px;
    border-radius: 6px;
    margin-inline-start: 6px;
  }

  .weather-capsule .weather-temp-val {
    font-family: var(--font-numbers, monospace);
    font-size: 24px;
    font-weight: 900;
    color: #F8FAFF;
    letter-spacing: 0.5px;
    text-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
  }

  .vital-unit {
    font-family: var(--font-display, sans-serif);
    font-size: 14px;
    font-weight: 800;
    color: var(--neon-cyan, #22D3EE);
  }

  .next-prayer-capsule {
    background: linear-gradient(135deg, rgba(34, 211, 238, 0.08) 0%, rgba(255, 255, 255, 0.03) 100%);
    border-color: rgba(34, 211, 238, 0.3);
    box-shadow: 0 0 14px rgba(34, 211, 238, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  .next-prayer-capsule .countdown-val {
    font-family: var(--font-numbers, monospace);
    font-size: 24px;
    font-weight: 900;
    color: var(--neon-cyan, #22D3EE);
    letter-spacing: 1px;
    text-shadow: 0 0 14px rgba(34, 211, 238, 0.45);
  }

  .prev-prayer-capsule .elapsed-val {
    font-family: var(--font-numbers, monospace);
    font-size: 20px;
    font-weight: 800;
    color: var(--neon-yellow, #FACC15);
    letter-spacing: 0.8px;
  }

  .capsule-label-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .vital-icon {
    font-size: 17px;
  }

  .vital-label {
    font-family: var(--font-arabic, 'Cairo', sans-serif);
    font-size: 16px;
    font-weight: 800;
    color: #F8FAFC;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }

  .badge-val-group {
    display: flex;
    align-items: baseline;
    gap: 4px;
    direction: ltr;
  }

  .prayer-times-strip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 5px;
    width: 100%;
    box-sizing: border-box;
  }

  .prayer-pill {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: 4px 2px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.025);
    border: 1px solid rgba(255, 255, 255, 0.06);
    transition: all 0.25s ease;
    min-width: 0;
  }

  .prayer-pill-name {
    font-family: var(--font-arabic, 'Cairo', sans-serif);
    font-size: 13px;
    font-weight: 700;
    color: #94A3B8;
    white-space: nowrap;
  }

  .prayer-pill-time {
    font-family: var(--font-numbers, monospace);
    font-size: 13px;
    font-weight: 800;
    color: #F8FAFC;
    direction: ltr;
    letter-spacing: 0.5px;
  }

  .prayer-pill.active-next {
    background: rgba(34, 211, 238, 0.15);
    border-color: rgba(34, 211, 238, 0.4);
    box-shadow: 0 0 12px rgba(34, 211, 238, 0.2);
  }

  .prayer-pill.active-next .prayer-pill-name {
    color: var(--neon-cyan, #22D3EE);
    font-weight: 900;
  }

  .prayer-pill.active-next .prayer-pill-time {
    color: #FFFFFF;
    font-weight: 900;
    text-shadow: 0 0 8px rgba(34, 211, 238, 0.5);
  }
</style>

<div class="card-header">
  <div class="card-title-group">
    <div class="card-icon prayer-icon">
      <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
        <path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"></path>
      </svg>
    </div>
    <div>
      <h2 class="card-title">مواقيت الصلاة والطقس</h2>
      <span class="card-sub">RIYADH & PRAYERS</span>
    </div>
  </div>
</div>

<div class="slot-prayer-grid">
  <!-- Row 0: Riyadh Live Weather Capsule -->
  <div class="vital-badge prayer-capsule weather-capsule" id="riyadh-weather-badge" title="طقس الرياض الآن">
    <div class="capsule-label-group">
      <span class="weather-icon" id="riyadh_weather_icon">☀️</span>
      <span class="vital-label">طقس الرياض</span>
      <span class="weather-desc" id="riyadh_weather_desc">مشمس</span>
    </div>
    <div class="badge-val-group" dir="ltr">
      <span class="vital-val weather-temp-val" id="riyadh_temp">--</span>
      <span class="vital-unit">°C</span>
    </div>
  </div>

  <!-- Row 1: Next Prayer Hero Countdown -->
  <div class="vital-badge prayer-capsule next-prayer-capsule" title="الوقت المتبقي على الصلاة القادمة">
    <div class="capsule-label-group">
      <span class="vital-icon">⏳</span>
      <span class="vital-label">متبقي على <span id="next_prayer_name">--</span></span>
    </div>
    <div class="badge-val-group" dir="ltr">
      <span class="vital-val countdown-val" id="next_prayer_countdown">--:--:--</span>
    </div>
  </div>

  <!-- Row 2: Previous Prayer Elapsed Time -->
  <div class="vital-badge prayer-capsule prev-prayer-capsule" title="الوقت المنقضي منذ الصلاة السابقة">
    <div class="capsule-label-group">
      <span class="vital-icon">⌛</span>
      <span class="vital-label">مضى على <span id="prev_prayer_name">--</span></span>
    </div>
    <div class="badge-val-group" dir="ltr">
      <span class="vital-val elapsed-val" id="prev_prayer_elapsed">--:--:--</span>
    </div>
  </div>

  <!-- Row 3: Daily Prayer Times Strip -->
  <div class="prayer-times-strip">
    <div class="prayer-pill" id="pill-fajr">
      <span class="prayer-pill-name">الفجر</span>
      <span class="prayer-pill-time" id="prayer_fajr">--:--</span>
    </div>
    <div class="prayer-pill" id="pill-dhuhr">
      <span class="prayer-pill-name">الظهر</span>
      <span class="prayer-pill-time" id="prayer_dhuhr">--:--</span>
    </div>
    <div class="prayer-pill" id="pill-asr">
      <span class="prayer-pill-name">العصر</span>
      <span class="prayer-pill-time" id="prayer_asr">--:--</span>
    </div>
    <div class="prayer-pill" id="pill-maghrib">
      <span class="prayer-pill-name">المغرب</span>
      <span class="prayer-pill-time" id="prayer_maghrib">--:--</span>
    </div>
    <div class="prayer-pill" id="pill-isha">
      <span class="prayer-pill-name">العشاء</span>
      <span class="prayer-pill-time" id="prayer_isha">--:--</span>
    </div>
  </div>
</div>
`;

function formatSecondsToHMS(totalSecs) {
  if (totalSecs === null || totalSecs === undefined || isNaN(totalSecs)) return '--:--:--';
  const s = Math.max(0, Math.floor(totalSecs));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function format12h(timeStr) {
  if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) return timeStr;
  const parts = timeStr.trim().split(':');
  let h = parseInt(parts[0], 10);
  const m = parts[1].substring(0, 2);
  if (isNaN(h)) return timeStr;
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m}`;
}

export class DashboardWeather extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.dom = {
      weather_icon: this.shadowRoot.getElementById('riyadh_weather_icon'),
      weather_desc: this.shadowRoot.getElementById('riyadh_weather_desc'),
      weather_temp: this.shadowRoot.getElementById('riyadh_temp'),
      next_name: this.shadowRoot.getElementById('next_prayer_name'),
      next_countdown: this.shadowRoot.getElementById('next_prayer_countdown'),
      prev_name: this.shadowRoot.getElementById('prev_prayer_name'),
      prev_elapsed: this.shadowRoot.getElementById('prev_prayer_elapsed'),
      fajr: this.shadowRoot.getElementById('prayer_fajr'),
      dhuhr: this.shadowRoot.getElementById('prayer_dhuhr'),
      asr: this.shadowRoot.getElementById('prayer_asr'),
      maghrib: this.shadowRoot.getElementById('prayer_maghrib'),
      isha: this.shadowRoot.getElementById('prayer_isha'),
      pills: {
        'الفجر': this.shadowRoot.getElementById('pill-fajr'),
        'الظهر': this.shadowRoot.getElementById('pill-dhuhr'),
        'العصر': this.shadowRoot.getElementById('pill-asr'),
        'المغرب': this.shadowRoot.getElementById('pill-maghrib'),
        'العشاء': this.shadowRoot.getElementById('pill-isha'),
      }
    };

    this.timerState = {
      nextSecsBase: null,
      prevSecsBase: null,
      lastUpdateMs: null,
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

  onStateChange(data) {
    if (data.riyadh_temp !== undefined && this.dom.weather_temp) {
      this.dom.weather_temp.textContent = (data.riyadh_temp !== null) ? data.riyadh_temp : '--';
    }
    if (data.riyadh_weather_desc && this.dom.weather_desc) {
      this.dom.weather_desc.textContent = data.riyadh_weather_desc;
    }
    if (data.riyadh_weather_icon && this.dom.weather_icon) {
      this.dom.weather_icon.textContent = data.riyadh_weather_icon;
    }

    if (data.prayer_fajr && this.dom.fajr) this.dom.fajr.textContent = format12h(data.prayer_fajr);
    if (data.prayer_dhuhr && this.dom.dhuhr) this.dom.dhuhr.textContent = format12h(data.prayer_dhuhr);
    if (data.prayer_asr && this.dom.asr) this.dom.asr.textContent = format12h(data.prayer_asr);
    if (data.prayer_maghrib && this.dom.maghrib) this.dom.maghrib.textContent = format12h(data.prayer_maghrib);
    if (data.prayer_isha && this.dom.isha) this.dom.isha.textContent = format12h(data.prayer_isha);

    if (data.next_prayer_name && this.dom.next_name) {
      this.dom.next_name.textContent = data.next_prayer_name;
      Object.entries(this.dom.pills).forEach(([pName, pEl]) => {
        if (pEl) {
          if (pName === data.next_prayer_name) pEl.classList.add('active-next');
          else pEl.classList.remove('active-next');
        }
      });
    }

    if (data.prev_prayer_name && this.dom.prev_name) {
      this.dom.prev_name.textContent = data.prev_prayer_name;
    }

    if (data.next_prayer_seconds !== undefined && data.next_prayer_seconds !== null) {
      this.timerState.nextSecsBase = data.next_prayer_seconds;
      this.timerState.lastUpdateMs = Date.now();
    }
    if (data.prev_prayer_seconds !== undefined && data.prev_prayer_seconds !== null) {
      this.timerState.prevSecsBase = data.prev_prayer_seconds;
      this.timerState.lastUpdateMs = Date.now();
    }
  }

  tick() {
    if (!this.isRunning) return;

    if (this.timerState.lastUpdateMs) {
      const elapsed = (Date.now() - this.timerState.lastUpdateMs) / 1000.0;
      if (this.timerState.nextSecsBase !== null && this.dom.next_countdown) {
        const curNext = Math.max(0, this.timerState.nextSecsBase - elapsed);
        this.dom.next_countdown.textContent = formatSecondsToHMS(curNext);
      }
      if (this.timerState.prevSecsBase !== null && this.dom.prev_elapsed) {
        const curPrev = this.timerState.prevSecsBase + elapsed;
        this.dom.prev_elapsed.textContent = formatSecondsToHMS(curPrev);
      }
    }

    requestAnimationFrame(this.tick);
  }
}

customElements.define('dashboard-weather', DashboardWeather);
