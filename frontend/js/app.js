/**
 * AIDA64 Glassmorphism 2.0 Dashboard - Core Frontend Application
 * Architecture: EventBus + 60 FPS requestAnimationFrame Renderer + WebSocket/HTTP Fallback
 */

import { EventBus } from './store/event_bus.js';
import { StateManager } from './store/state_manager.js';
import './components/dashboard-header.js';
import './components/dashboard-cpu.js';
import './components/dashboard-gpu.js';
import './components/dashboard-ram.js';
import './components/dashboard-vram.js';
import './components/dashboard-storage.js';
import './components/dashboard-thermals.js';
import './components/dashboard-network.js';
import './components/dashboard-display.js';
import './components/dashboard-weather.js';
import './components/dashboard-appointments.js';
import './components/dashboard-matches.js';
import { GaugePicker } from './components/gauge-style-picker.js';

// Expose EventBus, StateManager, and GaugePicker globally
if (typeof window !== 'undefined') {
  window.EventBus = EventBus;
  window.StateManager = StateManager;
  window.GaugePicker = GaugePicker;
}

// ============================================================================
// 2. Sensor Configuration & State Definitions (45 Sensors)
// ============================================================================
const SENSOR_SPECS = {
  // Network Telemetry
  network_download_mbps: { decimals: 1, min: 0, max: 500, unit: 'Mbps', type: 'bar', barId: 'network_download_bar', extraTextId: 'dl_bar_val' },
  network_upload_mbps:   { decimals: 1, min: 0, max: 100, unit: 'Mbps', type: 'bar', barId: 'network_upload_bar', extraTextId: 'ul_bar_val' },

  // Header Vitals & Quick Telemetry
  fps:                { decimals: 0, min: 0, max: 500, unit: 'FPS', type: 'number' },
  total_power:        { decimals: 0, min: 0, max: 1000, unit: 'W', type: 'number' },
  max_temp:           { decimals: 0, min: 0, max: 120, unit: '°C', type: 'number' },
  display_hz:         { decimals: 0, min: 0, max: 500, unit: 'Hz', type: 'number' },
  display_volume:     { decimals: 0, min: 0, max: 100, unit: '%', type: 'number' }
};

// Global Animation State
const telemetryState = {
  targets: {},
  currents: {}
};

// Initialize all state slots to null
Object.keys(SENSOR_SPECS).forEach(key => {
  telemetryState.targets[key] = null;
  telemetryState.currents[key] = null;
});

// Cache for DOM nodes to eliminate DOM lookups during 60 FPS loop
const domCache = {
  elements: {},
  bars: {},
  rings: {},
  extras: {},
  statusBadge: null,
  statusDot: null,
  statusText: null,
  statusPing: null,
  systemClock: null,
  fullscreenBtn: null
};

// Helper: Color Shift based on Temperature
function getTemperatureColor(temp) {
  if (temp === null || isNaN(temp)) {
    return 'rgba(255, 255, 255, 0.15)';
  }
  if (temp < 50) return '#22D3EE'; // Cyan (<50°C)
  if (temp < 70) return '#FACC15'; // Yellow (50-70°C)
  if (temp < 85) return '#FB923C'; // Orange (70-85°C)
  return '#EF4444';                // Red (>85°C)
}

// Helper: Arabic Temperature Descriptors
function getTemperatureDesc(temp) {
  if (temp === null || isNaN(temp)) return '--';
  if (temp < 45) return 'بارد';
  if (temp < 65) return 'مثالي';
  if (temp < 75) return 'طبيعي';
  if (temp < 85) return 'مرتفع';
  return 'حرج!';
}

// Prayer Countdown State & Formatter
const prayerTimerState = {
  nextSecsBase: null,
  prevSecsBase: null,
  lastUpdateMs: null
};

// Appointments Countdown State
const appointmentTimerState = {
  nextSecsBase: null,
  isOngoing: false,
  lastUpdateMs: null
};

function formatSecondsToHMS(totalSecs) {
  if (totalSecs === null || totalSecs === undefined || isNaN(totalSecs)) return '--:--:--';
  const s = Math.max(0, Math.floor(totalSecs));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function renderAppointmentsList(items, container) {
  if (!container) return;
  if (!items || items.length === 0) {
    container.innerHTML = '<div class="apt-empty-state">✨ لا توجد مواعيد مسجلة لليوم</div>';
    return;
  }
  let html = '';
  items.forEach(item => {
    const statusClass = `status-${item.status || 'upcoming'}`;
    const categoryClass = `category-${item.category || 'work'}`;
    html += `
      <div class="apt-item ${statusClass}">
        <div class="apt-item-main">
          <span class="apt-item-time" dir="rtl"><bdi>${item.time_12h || item.time}</bdi></span>
          <span class="apt-item-title">${item.title}</span>
        </div>
        <div class="apt-item-badges">
          <span class="apt-category-pill ${categoryClass}">${item.category_label || item.category}</span>
          <span class="apt-item-status-pill ${statusClass}">${item.status_label || item.status}</span>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}


// ============================================================================
// 4. Smooth 60 FPS Render Engine (requestAnimationFrame without DOM Thrashing)
// ============================================================================
class TelemetryRenderer {
  constructor() {
    this.isRunning = false;
    this.cacheDomReferences();
    this.bindEvents();
  }

  cacheDomReferences() {
    // Cache text containers for 24 sensors
    Object.keys(SENSOR_SPECS).forEach(key => {
      const el = document.getElementById(key);
      if (el) {
        domCache.elements[key] = el;
        el._lastText = null;
      }

      const spec = SENSOR_SPECS[key];

      // Progress bars
      if (spec.barId) {
        const bar = document.getElementById(spec.barId);
        if (bar) {
          domCache.bars[key] = bar;
          bar._lastPercent = null;
        }
      }

      // Circular rings
      if (spec.ringId) {
        const ring = document.getElementById(spec.ringId);
        if (ring) {
          domCache.rings[key] = ring;
          ring._lastOffset = null;
          ring._lastStroke = null;
        }
      }

      // Extra text elements (like duplicate metrics in headers or secondary fields)
      if (spec.extraTextId) {
        const extra = document.getElementById(spec.extraTextId);
        if (extra) {
          domCache.extras[key] = extra;
          extra._lastText = null;
        }
      }

      if (spec.metricId) {
        const metricEl = document.getElementById(spec.metricId);
        if (metricEl) {
          domCache.extras[spec.metricId] = metricEl;
          metricEl._lastText = null;
        }
      }

      // Descriptor
      if (spec.descId) {
        const descEl = document.getElementById(spec.descId);
        if (descEl) {
          domCache.extras[spec.descId] = descEl;
          descEl._lastText = null;
        }
      }
    });

    // Top bar & Status Elements
    domCache.statusBadge = document.getElementById('status-badge');
    domCache.statusDot = document.getElementById('status-dot');
    domCache.statusText = document.getElementById('status-text');
    domCache.statusPing = document.getElementById('status-ping');
    domCache.systemClock = document.getElementById('system-clock');
    domCache.fullscreenBtn = document.getElementById('btn-fullscreen');
    domCache.dateGregorian = document.getElementById('date_gregorian');
    domCache.dateHijri = document.getElementById('date_hijri');
    domCache.displayRes = document.getElementById('display_res');

    // Weekdays Strip DOM Elements
    domCache.weekdaysStrip = document.getElementById('weekdays-strip');
    domCache.weekdayPills = document.querySelectorAll('.weekday-pill');

    // Riyadh Weather & Prayer DOM Elements
    domCache.riyadhTemp = document.getElementById('riyadh_temp');
    domCache.riyadhWeatherDesc = document.getElementById('riyadh_weather_desc');
    domCache.riyadhWeatherIcon = document.getElementById('riyadh_weather_icon');
    domCache.nextPrayerName = document.getElementById('next_prayer_name');
    domCache.nextPrayerCountdown = document.getElementById('next_prayer_countdown');
    domCache.prevPrayerName = document.getElementById('prev_prayer_name');
    domCache.prevPrayerElapsed = document.getElementById('prev_prayer_elapsed');
    domCache.prayerFajr = document.getElementById('prayer_fajr');
    domCache.prayerDhuhr = document.getElementById('prayer_dhuhr');
    domCache.prayerAsr = document.getElementById('prayer_asr');
    domCache.prayerMaghrib = document.getElementById('prayer_maghrib');
    domCache.prayerIsha = document.getElementById('prayer_isha');
    domCache.prayerPills = {
      'الفجر': document.getElementById('pill-fajr'),
      'الظهر': document.getElementById('pill-dhuhr'),
      'العصر': document.getElementById('pill-asr'),
      'المغرب': document.getElementById('pill-maghrib'),
      'العشاء': document.getElementById('pill-isha')
    };

    // Appointments DOM Elements
    domCache.aptRemainingCount = document.getElementById('apt_remaining_count');
    domCache.aptHeroCategory = document.getElementById('apt_hero_category');
    domCache.aptHeroStatusDot = document.getElementById('apt_hero_status_dot');
    domCache.aptHeroStatusLabel = document.getElementById('apt_hero_status_label');
    domCache.aptHeroTitle = document.getElementById('apt_hero_title');
    domCache.aptHeroTime = document.getElementById('apt_hero_time');
    domCache.aptHeroLocation = document.getElementById('apt_hero_location');
    domCache.aptCountdownLabel = document.getElementById('apt_countdown_label');
    domCache.aptHeroCountdown = document.getElementById('apt_hero_countdown');
    domCache.aptTimelineList = document.getElementById('apt-timeline-list');
  }

  bindEvents() {
    // Update incoming targets on event
    EventBus.on('telemetry:data', (data) => {
      if (!data || typeof data !== 'object') return;
      Object.keys(SENSOR_SPECS).forEach(key => {
        if (key in data) {
          const val = data[key];
          // Missing sensors MUST be null, never NaN or 0
          telemetryState.targets[key] = (val !== null && typeof val === 'number') ? val : null;
        }
      });

      // String Telemetry updates (Hijri/Gregorian dates, Display resolution)
      if (data.date_gregorian && domCache.dateGregorian && domCache.dateGregorian._lastText !== data.date_gregorian) {
        domCache.dateGregorian.textContent = data.date_gregorian;
        domCache.dateGregorian._lastText = data.date_gregorian;
      }
      if (data.date_hijri && domCache.dateHijri && domCache.dateHijri._lastText !== data.date_hijri) {
        domCache.dateHijri.textContent = data.date_hijri;
        domCache.dateHijri._lastText = data.date_hijri;
      }
      if (data.display_res && domCache.displayRes && domCache.displayRes._lastText !== data.display_res) {
        domCache.displayRes.textContent = data.display_res;
        domCache.displayRes._lastText = data.display_res;
      }

      // Riyadh Weather & Prayer Times Updates
      if (data.riyadh_temp !== undefined && domCache.riyadhTemp) {
        domCache.riyadhTemp.textContent = (data.riyadh_temp !== null) ? data.riyadh_temp : '--';
      }
      if (data.riyadh_weather_desc && domCache.riyadhWeatherDesc) {
        domCache.riyadhWeatherDesc.textContent = data.riyadh_weather_desc;
      }
      if (data.riyadh_weather_icon && domCache.riyadhWeatherIcon) {
        domCache.riyadhWeatherIcon.textContent = data.riyadh_weather_icon;
      }
      const format12h = (timeStr) => {
        if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) return timeStr;
        const parts = timeStr.trim().split(':');
        let h = parseInt(parts[0], 10);
        const m = parts[1].substring(0, 2);
        if (isNaN(h)) return timeStr;
        h = h % 12;
        if (h === 0) h = 12;
        return `${h}:${m}`;
      };

      if (data.prayer_fajr && domCache.prayerFajr) domCache.prayerFajr.textContent = format12h(data.prayer_fajr);
      if (data.prayer_dhuhr && domCache.prayerDhuhr) domCache.prayerDhuhr.textContent = format12h(data.prayer_dhuhr);
      if (data.prayer_asr && domCache.prayerAsr) domCache.prayerAsr.textContent = format12h(data.prayer_asr);
      if (data.prayer_maghrib && domCache.prayerMaghrib) domCache.prayerMaghrib.textContent = format12h(data.prayer_maghrib);
      if (data.prayer_isha && domCache.prayerIsha) domCache.prayerIsha.textContent = format12h(data.prayer_isha);

      if (data.next_prayer_name && domCache.nextPrayerName) {
        domCache.nextPrayerName.textContent = data.next_prayer_name;
        if (domCache.prayerPills) {
          Object.entries(domCache.prayerPills).forEach(([pName, pEl]) => {
            if (pEl) {
              if (pName === data.next_prayer_name) pEl.classList.add('active-next');
              else pEl.classList.remove('active-next');
            }
          });
        }
      }
      if (data.prev_prayer_name && domCache.prevPrayerName) {
        domCache.prevPrayerName.textContent = data.prev_prayer_name;
      }

      if (data.next_prayer_seconds !== undefined && data.next_prayer_seconds !== null) {
        prayerTimerState.nextSecsBase = data.next_prayer_seconds;
        prayerTimerState.lastUpdateMs = Date.now();
      }
      if (data.prev_prayer_seconds !== undefined && data.prev_prayer_seconds !== null) {
        prayerTimerState.prevSecsBase = data.prev_prayer_seconds;
        prayerTimerState.lastUpdateMs = Date.now();
      }

      // Daily Appointments Telemetry Updates
      if (data.appointments_remaining !== undefined && domCache.aptRemainingCount) {
        domCache.aptRemainingCount.textContent = (data.appointments_remaining !== null) ? data.appointments_remaining : '--';
      }

      if (data.next_appointment_title) {
        if (domCache.aptHeroTitle) domCache.aptHeroTitle.textContent = data.next_appointment_title;
        if (domCache.aptHeroTime && data.next_appointment_time) domCache.aptHeroTime.textContent = data.next_appointment_time;
        if (domCache.aptHeroCategory && data.next_appointment_category_label) {
          domCache.aptHeroCategory.textContent = data.next_appointment_category_label;
          domCache.aptHeroCategory.className = `apt-category-pill category-${data.next_appointment_category || 'work'}`;
        }
        if (data.next_appointment_ongoing) {
          if (domCache.aptHeroStatusLabel) domCache.aptHeroStatusLabel.textContent = 'جاري الآن';
          if (domCache.aptHeroStatusDot) domCache.aptHeroStatusDot.className = 'apt-status-indicator pulse-green';
          if (domCache.aptCountdownLabel) domCache.aptCountdownLabel.textContent = 'منذ البدء';
          appointmentTimerState.isOngoing = true;
        } else {
          if (domCache.aptHeroStatusLabel) domCache.aptHeroStatusLabel.textContent = 'الموعد القادم';
          if (domCache.aptHeroStatusDot) domCache.aptHeroStatusDot.className = 'apt-status-indicator pulse-cyan';
          if (domCache.aptCountdownLabel) domCache.aptCountdownLabel.textContent = 'متبقي';
          appointmentTimerState.isOngoing = false;
        }
        if (domCache.aptHeroLocation) {
          if (data.next_appointment_location) {
            domCache.aptHeroLocation.textContent = data.next_appointment_location;
            if (domCache.aptHeroLocation.parentElement) domCache.aptHeroLocation.parentElement.style.display = 'inline-flex';
          } else {
            if (domCache.aptHeroLocation.parentElement) domCache.aptHeroLocation.parentElement.style.display = 'none';
          }
        }
        if (data.next_appointment_seconds !== undefined && data.next_appointment_seconds !== null) {
          appointmentTimerState.nextSecsBase = data.next_appointment_seconds;
          appointmentTimerState.lastUpdateMs = Date.now();
        }
      } else if (data.appointments_count !== undefined) {
        if (domCache.aptHeroTitle) domCache.aptHeroTitle.textContent = 'لا توجد مواعيد متبقية لليوم';
        if (domCache.aptHeroTime) domCache.aptHeroTime.textContent = '--:--';
        if (domCache.aptHeroCountdown) domCache.aptHeroCountdown.textContent = '00:00:00';
        if (domCache.aptHeroStatusLabel) domCache.aptHeroStatusLabel.textContent = 'مكتمل';
        if (domCache.aptHeroStatusDot) domCache.aptHeroStatusDot.className = 'apt-status-indicator';
      }

      if (Array.isArray(data.today_appointments) && domCache.aptTimelineList) {
        renderAppointmentsList(data.today_appointments, domCache.aptTimelineList);
      }
    });

    // Connection Status Updates
    EventBus.on('connection:status', ({ mode, text }) => {
      if (!domCache.statusBadge || !domCache.statusText) return;
      
      domCache.statusBadge.className = `status-badge ${mode}`;
      domCache.statusText.textContent = text;
      
      if (mode === 'offline') {
        if (domCache.statusPing) domCache.statusPing.textContent = '-- ms';
      }
    });

    // Ping update
    EventBus.on('connection:ping', (ms) => {
      if (domCache.statusPing) {
        domCache.statusPing.textContent = `${ms} ms`;
      }
    });

    // Fullscreen Toggle
    if (domCache.fullscreenBtn) {
      domCache.fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(err => {
            console.warn('Fullscreen request failed:', err);
          });
        } else {
          document.exitFullscreen().catch(err => {
            console.warn('Exit fullscreen failed:', err);
          });
        }
      });
    }

    // System Clock, Weekdays, Prayer & Appointments Countdowns Updater
    this.updateClock();
    this.updateWeekdays();
    this.updatePrayerCountdowns();
    this.updateAppointmentCountdown();
    setInterval(() => {
      this.updateClock();
      this.updateWeekdays();
      this.updatePrayerCountdowns();
      this.updateAppointmentCountdown();
    }, 1000);
  }

  updateWeekdays() {
    if (!domCache.weekdayPills || domCache.weekdayPills.length === 0) return;
    const currentDay = new Date().getDay(); // 0: Sunday, 1: Monday, ..., 6: Saturday
    if (this._lastActiveDay === currentDay) return;
    this._lastActiveDay = currentDay;

    domCache.weekdayPills.forEach(pill => {
      const day = parseInt(pill.getAttribute('data-day'), 10);
      if (day === currentDay) {
        pill.classList.add('active-day');
      } else {
        pill.classList.remove('active-day');
      }
    });
  }

  updateClock() {
    if (domCache.systemClock) {
      const now = new Date();
      let hours = now.getHours();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // 0 becomes 12
      const hoursStr = String(hours).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      domCache.systemClock.innerHTML = `${hoursStr}:${minutes}:${seconds}&nbsp;<span class="clock-ampm">${ampm}</span>`;
    }
  }

  updatePrayerCountdowns() {
    if (!prayerTimerState.lastUpdateMs) return;
    const elapsedSinceUpdate = (Date.now() - prayerTimerState.lastUpdateMs) / 1000.0;

    if (prayerTimerState.nextSecsBase !== null && domCache.nextPrayerCountdown) {
      const curNext = Math.max(0, prayerTimerState.nextSecsBase - elapsedSinceUpdate);
      domCache.nextPrayerCountdown.textContent = formatSecondsToHMS(curNext);
    }

    if (prayerTimerState.prevSecsBase !== null && domCache.prevPrayerElapsed) {
      const curPrev = prayerTimerState.prevSecsBase + elapsedSinceUpdate;
      domCache.prevPrayerElapsed.textContent = formatSecondsToHMS(curPrev);
    }
  }

  updateAppointmentCountdown() {
    if (!appointmentTimerState.lastUpdateMs || !domCache.aptHeroCountdown) return;
    const elapsedSinceUpdate = (Date.now() - appointmentTimerState.lastUpdateMs) / 1000.0;
    if (appointmentTimerState.nextSecsBase !== null) {
      if (appointmentTimerState.isOngoing) {
        const cur = appointmentTimerState.nextSecsBase + elapsedSinceUpdate;
        domCache.aptHeroCountdown.textContent = formatSecondsToHMS(cur);
      } else {
        const cur = Math.max(0, appointmentTimerState.nextSecsBase - elapsedSinceUpdate);
        domCache.aptHeroCountdown.textContent = formatSecondsToHMS(cur);
      }
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    const tick = () => {
      this.renderFrame();
      if (this.isRunning) {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  }

  renderFrame() {
    const keys = Object.keys(SENSOR_SPECS);
    const len = keys.length;

    for (let i = 0; i < len; i++) {
      const key = keys[i];
      const spec = SENSOR_SPECS[key];
      const target = telemetryState.targets[key];
      let current = telemetryState.currents[key];

      // Handle NULL values cleanly (shows "--" if null, never NaN or 0)
      if (target === null || target === undefined) {
        telemetryState.currents[key] = null;
        this.renderNullState(key, spec);
        continue;
      }

      // Smooth Lerp Transition: current += (target - current) * 0.15
      if (current === null) {
        current = target;
      } else {
        const diff = target - current;
        if (Math.abs(diff) < 0.04) {
          current = target;
        } else {
          current += diff * 0.15;
        }
      }
      telemetryState.currents[key] = current;

      this.renderActiveState(key, spec, current);
    }
  }

  renderNullState(key, spec) {
    const el = domCache.elements[key];
    if (el && el._lastText !== '--') {
      el.textContent = '--';
      el._lastText = '--';
    }

    // Secondary extra text
    if (spec.extraTextId && domCache.extras[key]) {
      const extra = domCache.extras[key];
      if (extra._lastText !== '--') {
        extra.textContent = '--';
        extra._lastText = '--';
      }
    }

    if (spec.metricId && domCache.extras[spec.metricId]) {
      const metricEl = domCache.extras[spec.metricId];
      if (metricEl._lastText !== '--') {
        metricEl.textContent = '--';
        metricEl._lastText = '--';
      }
    }

    // Reset Progress Bar
    const bar = domCache.bars[key];
    if (bar && bar._lastPercent !== 0) {
      bar.style.width = '0%';
      bar.classList.remove('active');
      bar._lastPercent = 0;
    }

    // Reset Circular Ring
    const ring = domCache.rings[key];
    if (ring && ring._lastOffset !== spec.circumference) {
      ring.style.strokeDashoffset = spec.circumference;
      ring.style.stroke = 'rgba(255, 255, 255, 0.08)';
      ring.style.filter = 'none';
      ring._lastOffset = spec.circumference;
    }

    // Descriptor
    if (spec.descId && domCache.extras[spec.descId]) {
      const descEl = domCache.extras[spec.descId];
      if (descEl._lastText !== '--') {
        descEl.textContent = '--';
        descEl._lastText = '--';
      }
    }
  }

  renderActiveState(key, spec, current) {
    // 1. Format numerical display
    const formatted = spec.decimals > 0 ? current.toFixed(spec.decimals) : Math.round(current).toString();

    // 2. DOM text update only if changed (prevents DOM thrashing)
    const el = domCache.elements[key];
    if (el && el._lastText !== formatted) {
      el.textContent = formatted;
      el._lastText = formatted;
    }

    // Extra text nodes
    if (spec.extraTextId && domCache.extras[key]) {
      const extra = domCache.extras[key];
      if (extra._lastText !== formatted) {
        extra.textContent = formatted;
        extra._lastText = formatted;
      }
    }

    if (spec.metricId && domCache.extras[spec.metricId]) {
      const metricEl = domCache.extras[spec.metricId];
      if (metricEl._lastText !== formatted) {
        metricEl.textContent = formatted;
        metricEl._lastText = formatted;
      }
    }

    // 3. Progress Bar update (Ultra-thin 4px with glowing dot)
    const bar = domCache.bars[key];
    if (bar) {
      const ratio = Math.min(1, Math.max(0, (current - spec.min) / (spec.max - spec.min)));
      const percent = Math.round(ratio * 100);

      if (bar._lastPercent !== percent) {
        bar.style.width = `${percent}%`;
        if (percent > 0) {
          bar.classList.add('active');
        } else {
          bar.classList.remove('active');
        }
        bar._lastPercent = percent;
      }
    }

    // 4. Circular Temperature Ring update (Color Shift & Stroke Dashoffset)
    const ring = domCache.rings[key];
    if (ring) {
      const ratio = Math.min(1, Math.max(0, (current - spec.min) / (spec.max - spec.min)));
      const offset = (spec.circumference * (1 - ratio)).toFixed(2);
      const color = getTemperatureColor(current);

      if (ring._lastOffset !== offset) {
        ring.style.strokeDashoffset = offset;
        ring._lastOffset = offset;
      }

      if (ring._lastStroke !== color) {
        ring.style.stroke = color;
        ring.style.filter = `drop-shadow(0 0 6px ${color})`;
        ring._lastStroke = color;
      }

      // Update temperature descriptor
      if (spec.descId && domCache.extras[spec.descId]) {
        const descEl = domCache.extras[spec.descId];
        const desc = getTemperatureDesc(current);
        if (descEl._lastText !== desc) {
          descEl.textContent = desc;
          descEl.style.color = color;
          descEl._lastText = desc;
        }
      }
    }
  }
}

// ============================================================================
// 5. Application Bootstrap
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('%c[AIDA64 GLASS 2.0] Initializing Dashboard...', 'color: #22D3EE; font-weight: bold;');

  // Initialize 60 FPS Render Engine
  const renderer = new TelemetryRenderer();
  renderer.start();

  // Initialize State Manager
  const stateManager = new StateManager();
  stateManager.start();
  window.stateManager = stateManager;

  // Initialize Dynamic Gauge Style Context Picker
  GaugePicker.init();

  console.log('%c[AIDA64 GLASS 2.0] Frontend Ready. Listening on WebSocket & Polling.', 'color: #10B981; font-weight: bold;');
});
