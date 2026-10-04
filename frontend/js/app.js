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
  // Gauge Specs (Circular Temperature Rings)
  cpu_temp:           { decimals: 0, min: 0, max: 100, unit: '°C', type: 'ring', ringId: 'cpu-temp-ring', radius: 75, circumference: 471.24, descId: 'cpu-temp-desc' },
  gpu_temp:           { decimals: 0, min: 0, max: 100, unit: '°C', type: 'ring', ringId: 'gpu-temp-ring', radius: 75, circumference: 471.24, descId: 'gpu-temp-desc' },

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

// Ensure circumference is calculated or populated for gauge/ring specs (2 * PI * r)
Object.values(SENSOR_SPECS).forEach(spec => {
  if (spec.type === 'ring' || spec.ringId || spec.radius) {
    const r = typeof spec.radius === 'number' ? spec.radius : 75;
    spec.circumference = typeof spec.circumference === 'number' ? spec.circumference : parseFloat((2 * Math.PI * r).toFixed(2));
  }
});

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

// Helper: HTML escaping for safe interpolation (XSS prevention)
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Helper: Dirty-checking text update to prevent layout thrashing
function updateText(el, val) {
  if (el && el._lastText !== val) {
    el.textContent = val;
    el._lastText = val;
  }
}

// Helper: DOM lookup with component shadow DOM fallback
function findDomElement(id) {
  if (!id || typeof id !== 'string') return null;
  try {
    const el = document.getElementById(id);
    if (el) return el;

    // Gracefully handle encapsulated web component shadow roots
    const queue = [document];
    while (queue.length > 0) {
      const root = queue.shift();
      if (!root || typeof root.querySelectorAll !== 'function') continue;
      const hosts = root.querySelectorAll('*');
      for (let i = 0; i < hosts.length; i++) {
        const sr = hosts[i].shadowRoot;
        if (sr) {
          if (typeof sr.getElementById === 'function') {
            const found = sr.getElementById(id);
            if (found) return found;
          }
          queue.push(sr);
        }
      }
    }
  } catch (err) {
    console.warn(`[domCache] Failed lookup for ID "${id}":`, err);
  }
  return null;
}

// Helper: Multi-element query with component shadow DOM fallback
function findDomElements(selector) {
  if (!selector || typeof selector !== 'string') return [];
  try {
    const directMatches = Array.from(document.querySelectorAll(selector));
    if (directMatches.length > 0) return directMatches;

    const results = [];
    const queue = [document];
    while (queue.length > 0) {
      const root = queue.shift();
      if (!root || typeof root.querySelectorAll !== 'function') continue;
      const hosts = root.querySelectorAll('*');
      for (let i = 0; i < hosts.length; i++) {
        const sr = hosts[i].shadowRoot;
        if (sr) {
          if (typeof sr.querySelectorAll === 'function') {
            const matches = sr.querySelectorAll(selector);
            if (matches.length > 0) results.push(...matches);
          }
          queue.push(sr);
        }
      }
    }
    return results;
  } catch (err) {
    console.warn(`[domCache] Failed selector lookup "${selector}":`, err);
    return [];
  }
}

function renderAppointmentsList(items, container) {
  if (!container) return;
  if (!items || items.length === 0) {
    container.innerHTML = '<div class="apt-empty-state">✨ لا توجد مواعيد مسجلة لليوم</div>';
    return;
  }
  let html = '';
  items.forEach(item => {
    const status = escapeHtml(item.status || 'upcoming');
    const category = escapeHtml(item.category || 'work');
    const statusClass = `status-${status}`;
    const categoryClass = `category-${category}`;
    const timeText = escapeHtml(item.time_12h || item.time || '');
    const titleText = escapeHtml(item.title || '');
    const catLabel = escapeHtml(item.category_label || item.category || '');
    const statusLabel = escapeHtml(item.status_label || item.status || '');
    html += `
      <div class="apt-item ${statusClass}">
        <div class="apt-item-main">
          <span class="apt-item-time" dir="rtl"><bdi>${timeText}</bdi></span>
          <span class="apt-item-title">${titleText}</span>
        </div>
        <div class="apt-item-badges">
          <span class="apt-category-pill ${categoryClass}">${catLabel}</span>
          <span class="apt-item-status-pill ${statusClass}">${statusLabel}</span>
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
    this.rafId = null;
    this.timerId = null;
    this.unsubscribers = [];
    this._onFullscreenClick = null;
    this.cacheDomReferences();
    this.bindEvents();
  }

  cacheDomReferences() {
    // Cache text containers for 24 sensors
    Object.keys(SENSOR_SPECS).forEach(key => {
      const el = findDomElement(key);
      if (el) {
        domCache.elements[key] = el;
        el._lastText = null;
      }

      const spec = SENSOR_SPECS[key];

      // Progress bars
      if (spec.barId) {
        const bar = findDomElement(spec.barId);
        if (bar) {
          domCache.bars[key] = bar;
          bar._lastPercent = null;
        }
      }

      // Circular rings
      if (spec.ringId) {
        const ring = findDomElement(spec.ringId);
        if (ring) {
          domCache.rings[key] = ring;
          ring._lastOffset = null;
          ring._lastStroke = null;
        }
      }

      // Extra text elements (like duplicate metrics in headers or secondary fields)
      if (spec.extraTextId) {
        const extra = findDomElement(spec.extraTextId);
        if (extra) {
          domCache.extras[key] = extra;
          extra._lastText = null;
        }
      }

      if (spec.metricId) {
        const metricEl = findDomElement(spec.metricId);
        if (metricEl) {
          domCache.extras[spec.metricId] = metricEl;
          metricEl._lastText = null;
        }
      }

      // Descriptor
      if (spec.descId) {
        const descEl = findDomElement(spec.descId);
        if (descEl) {
          domCache.extras[spec.descId] = descEl;
          descEl._lastText = null;
        }
      }
    });

    // Top bar & Status Elements
    domCache.statusBadge = findDomElement('status-badge');
    domCache.statusDot = findDomElement('status-dot');
    domCache.statusText = findDomElement('status-text');
    domCache.statusPing = findDomElement('status-ping');
    domCache.systemClock = findDomElement('system-clock');
    domCache.fullscreenBtn = findDomElement('btn-fullscreen');
    domCache.dateGregorian = findDomElement('date_gregorian');
    domCache.dateHijri = findDomElement('date_hijri');
    domCache.displayRes = findDomElement('display_res');

    // Weekdays Strip DOM Elements
    domCache.weekdaysStrip = findDomElement('weekdays-strip');
    domCache.weekdayPills = findDomElements('.weekday-pill');

    // Riyadh Weather & Prayer DOM Elements
    domCache.riyadhTemp = findDomElement('riyadh_temp');
    domCache.riyadhWeatherDesc = findDomElement('riyadh_weather_desc');
    domCache.riyadhWeatherIcon = findDomElement('riyadh_weather_icon');
    domCache.nextPrayerName = findDomElement('next_prayer_name');
    domCache.nextPrayerCountdown = findDomElement('next_prayer_countdown');
    domCache.prevPrayerName = findDomElement('prev_prayer_name');
    domCache.prevPrayerElapsed = findDomElement('prev_prayer_elapsed');
    domCache.prayerFajr = findDomElement('prayer_fajr');
    domCache.prayerDhuhr = findDomElement('prayer_dhuhr');
    domCache.prayerAsr = findDomElement('prayer_asr');
    domCache.prayerMaghrib = findDomElement('prayer_maghrib');
    domCache.prayerIsha = findDomElement('prayer_isha');
    domCache.prayerPills = {
      'الفجر': findDomElement('pill-fajr'),
      'الظهر': findDomElement('pill-dhuhr'),
      'العصر': findDomElement('pill-asr'),
      'المغرب': findDomElement('pill-maghrib'),
      'العشاء': findDomElement('pill-isha')
    };

    // Appointments DOM Elements
    domCache.aptRemainingCount = findDomElement('apt_remaining_count');
    domCache.aptHeroCategory = findDomElement('apt_hero_category');
    domCache.aptHeroStatusDot = findDomElement('apt_hero_status_dot');
    domCache.aptHeroStatusLabel = findDomElement('apt_hero_status_label');
    domCache.aptHeroTitle = findDomElement('apt_hero_title');
    domCache.aptHeroTime = findDomElement('apt_hero_time');
    domCache.aptHeroLocation = findDomElement('apt_hero_location');
    domCache.aptCountdownLabel = findDomElement('apt_countdown_label');
    domCache.aptHeroCountdown = findDomElement('apt_hero_countdown');
    domCache.aptTimelineList = findDomElement('apt-timeline-list');
  }

  bindEvents() {
    // Update incoming targets on event
    const unsubTelemetry = EventBus.on('telemetry:data', (data) => {
      if (!data || typeof data !== 'object') return;
      Object.keys(SENSOR_SPECS).forEach(key => {
        if (key in data) {
          const val = data[key];
          // Missing sensors MUST be null, never NaN or 0
          telemetryState.targets[key] = (val !== null && typeof val === 'number') ? val : null;
        }
      });

      // String Telemetry updates (Hijri/Gregorian dates, Display resolution)
      if (data.date_gregorian && domCache.dateGregorian) {
        updateText(domCache.dateGregorian, data.date_gregorian);
      }
      if (data.date_hijri && domCache.dateHijri) {
        updateText(domCache.dateHijri, data.date_hijri);
      }
      if (data.display_res && domCache.displayRes) {
        updateText(domCache.displayRes, data.display_res);
      }

      // Riyadh Weather & Prayer Times Updates
      if (data.riyadh_temp !== undefined && domCache.riyadhTemp) {
        updateText(domCache.riyadhTemp, (data.riyadh_temp !== null) ? String(data.riyadh_temp) : '--');
      }
      if (data.riyadh_weather_desc && domCache.riyadhWeatherDesc) {
        updateText(domCache.riyadhWeatherDesc, data.riyadh_weather_desc);
      }
      if (data.riyadh_weather_icon && domCache.riyadhWeatherIcon) {
        updateText(domCache.riyadhWeatherIcon, data.riyadh_weather_icon);
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

      if (data.prayer_fajr && domCache.prayerFajr) updateText(domCache.prayerFajr, format12h(data.prayer_fajr));
      if (data.prayer_dhuhr && domCache.prayerDhuhr) updateText(domCache.prayerDhuhr, format12h(data.prayer_dhuhr));
      if (data.prayer_asr && domCache.prayerAsr) updateText(domCache.prayerAsr, format12h(data.prayer_asr));
      if (data.prayer_maghrib && domCache.prayerMaghrib) updateText(domCache.prayerMaghrib, format12h(data.prayer_maghrib));
      if (data.prayer_isha && domCache.prayerIsha) updateText(domCache.prayerIsha, format12h(data.prayer_isha));

      if (data.next_prayer_name && domCache.nextPrayerName) {
        updateText(domCache.nextPrayerName, data.next_prayer_name);
        if (domCache.prayerPills) {
          Object.entries(domCache.prayerPills).forEach(([pName, pEl]) => {
            if (pEl && pEl.classList) {
              if (pName === data.next_prayer_name) pEl.classList.add('active-next');
              else pEl.classList.remove('active-next');
            }
          });
        }
      }
      if (data.prev_prayer_name && domCache.prevPrayerName) {
        updateText(domCache.prevPrayerName, data.prev_prayer_name);
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
        updateText(domCache.aptRemainingCount, (data.appointments_remaining !== null) ? String(data.appointments_remaining) : '--');
      }

      if (data.next_appointment_title) {
        if (domCache.aptHeroTitle) updateText(domCache.aptHeroTitle, data.next_appointment_title);
        if (domCache.aptHeroTime && data.next_appointment_time) updateText(domCache.aptHeroTime, data.next_appointment_time);
        if (domCache.aptHeroCategory && data.next_appointment_category_label) {
          updateText(domCache.aptHeroCategory, data.next_appointment_category_label);
          const catClass = `apt-category-pill category-${data.next_appointment_category || 'work'}`;
          if (domCache.aptHeroCategory.className !== catClass) domCache.aptHeroCategory.className = catClass;
        }
        if (data.next_appointment_ongoing) {
          if (domCache.aptHeroStatusLabel) updateText(domCache.aptHeroStatusLabel, 'جاري الآن');
          if (domCache.aptHeroStatusDot && domCache.aptHeroStatusDot.className !== 'apt-status-indicator pulse-green') {
            domCache.aptHeroStatusDot.className = 'apt-status-indicator pulse-green';
          }
          if (domCache.aptCountdownLabel) updateText(domCache.aptCountdownLabel, 'منذ البدء');
          appointmentTimerState.isOngoing = true;
        } else {
          if (domCache.aptHeroStatusLabel) updateText(domCache.aptHeroStatusLabel, 'الموعد القادم');
          if (domCache.aptHeroStatusDot && domCache.aptHeroStatusDot.className !== 'apt-status-indicator pulse-cyan') {
            domCache.aptHeroStatusDot.className = 'apt-status-indicator pulse-cyan';
          }
          if (domCache.aptCountdownLabel) updateText(domCache.aptCountdownLabel, 'متبقي');
          appointmentTimerState.isOngoing = false;
        }
        if (domCache.aptHeroLocation) {
          if (data.next_appointment_location) {
            updateText(domCache.aptHeroLocation, data.next_appointment_location);
            if (domCache.aptHeroLocation.parentElement && domCache.aptHeroLocation.parentElement.style.display !== 'inline-flex') {
              domCache.aptHeroLocation.parentElement.style.display = 'inline-flex';
            }
          } else {
            if (domCache.aptHeroLocation.parentElement && domCache.aptHeroLocation.parentElement.style.display !== 'none') {
              domCache.aptHeroLocation.parentElement.style.display = 'none';
            }
          }
        }
        if (data.next_appointment_seconds !== undefined && data.next_appointment_seconds !== null) {
          appointmentTimerState.nextSecsBase = data.next_appointment_seconds;
          appointmentTimerState.lastUpdateMs = Date.now();
        }
      } else if (data.appointments_count !== undefined) {
        if (domCache.aptHeroTitle) updateText(domCache.aptHeroTitle, 'لا توجد مواعيد متبقية لليوم');
        if (domCache.aptHeroTime) updateText(domCache.aptHeroTime, '--:--');
        if (domCache.aptHeroCountdown) updateText(domCache.aptHeroCountdown, '00:00:00');
        if (domCache.aptHeroStatusLabel) updateText(domCache.aptHeroStatusLabel, 'مكتمل');
        if (domCache.aptHeroStatusDot && domCache.aptHeroStatusDot.className !== 'apt-status-indicator') {
          domCache.aptHeroStatusDot.className = 'apt-status-indicator';
        }
      }

      if (Array.isArray(data.today_appointments) && domCache.aptTimelineList) {
        renderAppointmentsList(data.today_appointments, domCache.aptTimelineList);
      }
    });

    // Connection Status Updates
    const unsubStatus = EventBus.on('connection:status', ({ mode, text }) => {
      if (!domCache.statusBadge || !domCache.statusText) return;
      
      const badgeClass = `status-badge ${mode}`;
      if (domCache.statusBadge.className !== badgeClass) {
        domCache.statusBadge.className = badgeClass;
      }
      updateText(domCache.statusText, text);
      
      if (mode === 'offline') {
        if (domCache.statusPing) updateText(domCache.statusPing, '-- ms');
      }
    });

    // Ping update
    const unsubPing = EventBus.on('connection:ping', (ms) => {
      if (domCache.statusPing) {
        updateText(domCache.statusPing, `${ms} ms`);
      }
    });

    this.unsubscribers.push(unsubTelemetry, unsubStatus, unsubPing);

    // Fullscreen Toggle
    if (domCache.fullscreenBtn) {
      this._onFullscreenClick = () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(err => {
            console.warn('Fullscreen request failed:', err);
          });
        } else {
          document.exitFullscreen().catch(err => {
            console.warn('Exit fullscreen failed:', err);
          });
        }
      };
      domCache.fullscreenBtn.addEventListener('click', this._onFullscreenClick);
    }

    // System Clock, Weekdays, Prayer & Appointments Countdowns Updater
    this.updateClock();
    this.updateWeekdays();
    this.updatePrayerCountdowns();
    this.updateAppointmentCountdown();
    this.timerId = setInterval(() => {
      this.updateClock();
      this.updateWeekdays();
      this.updatePrayerCountdowns();
      this.updateAppointmentCountdown();
    }, 1000);
  }

  updateWeekdays() {
    if (!domCache.weekdayPills || domCache.weekdayPills.length === 0) {
      domCache.weekdayPills = findDomElements('.weekday-pill');
    }
    if (!domCache.weekdayPills || domCache.weekdayPills.length === 0) return;
    const currentDay = new Date().getDay(); // 0: Sunday, 1: Monday, ..., 6: Saturday
    if (this._lastActiveDay === currentDay) return;
    this._lastActiveDay = currentDay;

    domCache.weekdayPills.forEach(pill => {
      if (!pill || typeof pill.getAttribute !== 'function') return;
      const day = parseInt(pill.getAttribute('data-day'), 10);
      if (day === currentDay) {
        pill.classList?.add('active-day');
      } else {
        pill.classList?.remove('active-day');
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
      const clockHtml = `${hoursStr}:${minutes}:${seconds}&nbsp;<span class="clock-ampm">${ampm}</span>`;
      if (domCache.systemClock._lastHtml !== clockHtml) {
        domCache.systemClock.innerHTML = clockHtml;
        domCache.systemClock._lastHtml = clockHtml;
      }
    }
  }

  updatePrayerCountdowns() {
    if (!prayerTimerState.lastUpdateMs) return;
    const elapsedSinceUpdate = (Date.now() - prayerTimerState.lastUpdateMs) / 1000.0;

    if (prayerTimerState.nextSecsBase !== null && domCache.nextPrayerCountdown) {
      const curNext = Math.max(0, prayerTimerState.nextSecsBase - elapsedSinceUpdate);
      updateText(domCache.nextPrayerCountdown, formatSecondsToHMS(curNext));
    }

    if (prayerTimerState.prevSecsBase !== null && domCache.prevPrayerElapsed) {
      const curPrev = prayerTimerState.prevSecsBase + elapsedSinceUpdate;
      updateText(domCache.prevPrayerElapsed, formatSecondsToHMS(curPrev));
    }
  }

  updateAppointmentCountdown() {
    if (!appointmentTimerState.lastUpdateMs || !domCache.aptHeroCountdown) return;
    const elapsedSinceUpdate = (Date.now() - appointmentTimerState.lastUpdateMs) / 1000.0;
    if (appointmentTimerState.nextSecsBase !== null) {
      if (appointmentTimerState.isOngoing) {
        const cur = appointmentTimerState.nextSecsBase + elapsedSinceUpdate;
        updateText(domCache.aptHeroCountdown, formatSecondsToHMS(cur));
      } else {
        const cur = Math.max(0, appointmentTimerState.nextSecsBase - elapsedSinceUpdate);
        updateText(domCache.aptHeroCountdown, formatSecondsToHMS(cur));
      }
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    const tick = () => {
      this.renderFrame();
      if (this.isRunning) {
        this.rafId = requestAnimationFrame(tick);
      }
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop() {
    this.isRunning = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  destroy() {
    this.stop();
    this.unsubscribers.forEach(unsub => {
      if (typeof unsub === 'function') unsub();
    });
    this.unsubscribers = [];
    if (this._onFullscreenClick && domCache.fullscreenBtn) {
      domCache.fullscreenBtn.removeEventListener('click', this._onFullscreenClick);
      this._onFullscreenClick = null;
    }
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
    let el = domCache.elements[key];
    if (!el) {
      el = findDomElement(key);
      if (el) {
        domCache.elements[key] = el;
        el._lastText = null;
      }
    }
    if (el && el._lastText !== '--') {
      el.textContent = '--';
      el._lastText = '--';
    }

    // Secondary extra text
    if (spec.extraTextId) {
      let extra = domCache.extras[key];
      if (!extra) {
        extra = findDomElement(spec.extraTextId);
        if (extra) {
          domCache.extras[key] = extra;
          extra._lastText = null;
        }
      }
      if (extra && extra._lastText !== '--') {
        extra.textContent = '--';
        extra._lastText = '--';
      }
    }

    if (spec.metricId) {
      let metricEl = domCache.extras[spec.metricId];
      if (!metricEl) {
        metricEl = findDomElement(spec.metricId);
        if (metricEl) {
          domCache.extras[spec.metricId] = metricEl;
          metricEl._lastText = null;
        }
      }
      if (metricEl && metricEl._lastText !== '--') {
        metricEl.textContent = '--';
        metricEl._lastText = '--';
      }
    }

    // Reset Progress Bar
    let bar = domCache.bars[key];
    if (!bar && spec.barId) {
      bar = findDomElement(spec.barId);
      if (bar) {
        domCache.bars[key] = bar;
        bar._lastPercent = null;
      }
    }
    if (bar && bar._lastPercent !== 0) {
      bar.style.width = '0%';
      bar.classList.remove('active');
      bar._lastPercent = 0;
    }

    // Reset Circular Ring
    let ring = domCache.rings[key];
    if (!ring && spec.ringId) {
      ring = findDomElement(spec.ringId);
      if (ring) {
        domCache.rings[key] = ring;
        ring._lastOffset = null;
        ring._lastStroke = null;
      }
    }
    const circumference = (typeof spec.circumference === 'number' && !isNaN(spec.circumference))
      ? spec.circumference
      : (spec.radius ? parseFloat((2 * Math.PI * spec.radius).toFixed(2)) : 471.24);
    if (ring && ring._lastOffset !== circumference) {
      ring.style.strokeDashoffset = circumference;
      ring.style.stroke = 'rgba(255, 255, 255, 0.08)';
      ring.style.filter = 'none';
      ring._lastOffset = circumference;
    }

    // Descriptor
    if (spec.descId) {
      let descEl = domCache.extras[spec.descId];
      if (!descEl) {
        descEl = findDomElement(spec.descId);
        if (descEl) {
          domCache.extras[spec.descId] = descEl;
          descEl._lastText = null;
        }
      }
      if (descEl && descEl._lastText !== '--') {
        descEl.textContent = '--';
        descEl._lastText = '--';
      }
    }
  }

  renderActiveState(key, spec, current) {
    // 1. Format numerical display
    const formatted = spec.decimals > 0 ? current.toFixed(spec.decimals) : Math.round(current).toString();

    // 2. DOM text update only if changed (prevents DOM thrashing)
    let el = domCache.elements[key];
    if (!el) {
      el = findDomElement(key);
      if (el) {
        domCache.elements[key] = el;
        el._lastText = null;
      }
    }
    if (el && el._lastText !== formatted) {
      el.textContent = formatted;
      el._lastText = formatted;
    }

    // Extra text nodes
    if (spec.extraTextId) {
      let extra = domCache.extras[key];
      if (!extra) {
        extra = findDomElement(spec.extraTextId);
        if (extra) {
          domCache.extras[key] = extra;
          extra._lastText = null;
        }
      }
      if (extra && extra._lastText !== formatted) {
        extra.textContent = formatted;
        extra._lastText = formatted;
      }
    }

    if (spec.metricId) {
      let metricEl = domCache.extras[spec.metricId];
      if (!metricEl) {
        metricEl = findDomElement(spec.metricId);
        if (metricEl) {
          domCache.extras[spec.metricId] = metricEl;
          metricEl._lastText = null;
        }
      }
      if (metricEl && metricEl._lastText !== formatted) {
        metricEl.textContent = formatted;
        metricEl._lastText = formatted;
      }
    }

    // 3. Progress Bar update (Ultra-thin 4px with glowing dot)
    let bar = domCache.bars[key];
    if (!bar && spec.barId) {
      bar = findDomElement(spec.barId);
      if (bar) {
        domCache.bars[key] = bar;
        bar._lastPercent = null;
      }
    }
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
    let ring = domCache.rings[key];
    if (!ring && spec.ringId) {
      ring = findDomElement(spec.ringId);
      if (ring) {
        domCache.rings[key] = ring;
        ring._lastOffset = null;
        ring._lastStroke = null;
      }
    }
    if (ring) {
      const ratio = Math.min(1, Math.max(0, (current - spec.min) / (spec.max - spec.min)));
      const circumference = (typeof spec.circumference === 'number' && !isNaN(spec.circumference))
        ? spec.circumference
        : (spec.radius ? parseFloat((2 * Math.PI * spec.radius).toFixed(2)) : 471.24);
      const offset = (circumference * (1 - ratio)).toFixed(2);
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
      if (spec.descId) {
        let descEl = domCache.extras[spec.descId];
        if (!descEl) {
          descEl = findDomElement(spec.descId);
          if (descEl) {
            domCache.extras[spec.descId] = descEl;
            descEl._lastText = null;
          }
        }
        if (descEl) {
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
}

// ============================================================================
// 5. Application Bootstrap
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('%c[AIDA64 GLASS 2.0] Initializing Dashboard...', 'color: #22D3EE; font-weight: bold;');

  // Initialize 60 FPS Render Engine
  const renderer = new TelemetryRenderer();
  renderer.start();
  window.telemetryRenderer = renderer;

  // Initialize State Manager
  const stateManager = new StateManager();
  stateManager.start();
  window.stateManager = stateManager;

  // Initialize Dynamic Gauge Style Context Picker
  GaugePicker.init();

  console.log('%c[AIDA64 GLASS 2.0] Frontend Ready. Listening on WebSocket & Polling.', 'color: #10B981; font-weight: bold;');
});
