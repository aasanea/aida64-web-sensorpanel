/**
 * AIDA64 Web SensorPanel - Interactive Gauge Style Contextual Picker
 * Right-Click activation, 10-style visual preview grid, Web Audio feedback, and localStorage persistence
 */

import { GAUGE_STYLES } from './gauge-styles-engine.js';
import { EventBus } from '../store/event_bus.js';

export class GaugePicker {
  static init() {
    if (this._initialized) return;
    this._initialized = true;
    this._activeGaugeId = 'cpu';
    this._currentSelectedStyle = 'tachometer';
    this._applyToAll = false;

    this._createModalElements();
    this._bindGlobalEvents();
  }

  static getSavedStyle(gaugeId) {
    try {
      const global = localStorage.getItem('aida_gauge_style_global');
      if (global) return global;
      const specific = localStorage.getItem(`aida_gauge_style_${gaugeId}`);
      if (specific) return specific;
    } catch (e) {}
    return 'tachometer'; // Default recommended style
  }

  static open(gaugeId = 'cpu') {
    this._activeGaugeId = gaugeId;
    this._currentSelectedStyle = this.getSavedStyle(gaugeId);

    // Update active highlight in cards
    const cards = this._backdrop.querySelectorAll('.gauge-choice-card');
    cards.forEach(c => {
      const isSelected = c.getAttribute('data-style-id') === this._currentSelectedStyle;
      c.classList.toggle('active', isSelected);
    });

    const titleTarget = this._activeGaugeId === 'cpu' ? 'المعالج (CPU)' : 'كرت الشاشة (GPU)';
    const targetLabel = this._backdrop.querySelector('#picker-target-desc');
    if (targetLabel) targetLabel.textContent = `العداد المستهدف: ${titleTarget}`;

    this._backdrop.classList.add('active');
    this._playSoftBeep(659.25); // E5
  }

  static close() {
    if (this._backdrop) {
      this._backdrop.classList.remove('active');
    }
  }

  // --- Private Helpers ---

  static _createModalElements() {
    let backdrop = document.getElementById('gauge-picker-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'gauge-picker-backdrop';
      backdrop.className = 'gauge-picker-backdrop';

      const modal = document.createElement('div');
      modal.className = 'gauge-picker-modal';

      // Header
      modal.innerHTML = `
        <div class="gauge-picker-header">
          <div class="gauge-picker-title-group">
            <span class="gauge-picker-icon">🎛️</span>
            <div>
              <div class="gauge-picker-title">تخصيص نمط العداد الحراري</div>
              <div class="gauge-picker-sub" id="picker-target-desc">اختر من بين 10 تصميمات هندسية متطورة</div>
            </div>
          </div>
          <button class="gauge-picker-close" id="gauge-picker-close-btn" aria-label="Close">✕</button>
        </div>

        <div class="gauge-styles-grid" id="gauge-styles-grid"></div>

        <div class="gauge-picker-footer">
          <label class="gauge-scope-toggle">
            <input type="checkbox" id="gauge-apply-all-chk">
            <span>تطبيق هذا النمط على جميع العدادات (المعالج والكرت)</span>
          </label>
          <button class="gauge-btn-apply" id="gauge-btn-apply">اعتماد النمط ✨</button>
        </div>
      `;

      backdrop.appendChild(modal);
      document.body.appendChild(backdrop);
    }

    this._backdrop = backdrop;

    // Populate the 10 cards
    const grid = backdrop.querySelector('#gauge-styles-grid');
    grid.innerHTML = '';
    GAUGE_STYLES.forEach(style => {
      const card = document.createElement('div');
      card.className = 'gauge-choice-card';
      card.setAttribute('data-style-id', style.id);
      card.innerHTML = `
        <div class="gauge-choice-icon">${style.icon}</div>
        <div class="gauge-choice-info">
          <span class="gauge-choice-name-ar">${style.nameAr}</span>
          <span class="gauge-choice-name-en">${style.nameEn}</span>
        </div>
        <div class="gauge-choice-radio"></div>
      `;

      card.addEventListener('click', () => {
        this._currentSelectedStyle = style.id;
        grid.querySelectorAll('.gauge-choice-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        this._playSoftBeep(880); // A5
      });

      grid.appendChild(card);
    });

    // Close button
    const closeBtn = backdrop.querySelector('#gauge-picker-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', () => this.close());

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) this.close();
    });

    // Apply button
    const applyBtn = backdrop.querySelector('#gauge-btn-apply');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        const applyAllChk = backdrop.querySelector('#gauge-apply-all-chk');
        const applyAll = applyAllChk ? applyAllChk.checked : false;

        this._applySelection(this._activeGaugeId, this._currentSelectedStyle, applyAll);
        this.close();
        this._playSuccessChime();
      });
    }
  }

  static _applySelection(gaugeId, styleId, applyAll) {
    try {
      if (applyAll) {
        localStorage.setItem('aida_gauge_style_global', styleId);
        localStorage.setItem('aida_gauge_style_cpu', styleId);
        localStorage.setItem('aida_gauge_style_gpu', styleId);
      } else {
        localStorage.removeItem('aida_gauge_style_global');
        localStorage.setItem(`aida_gauge_style_${gaugeId}`, styleId);
      }
    } catch (e) {}

    // Dispatch global EventBus
    EventBus.emit('gauge:style-changed', {
      gaugeId,
      styleId,
      applyAll
    });

    window.dispatchEvent(new CustomEvent('gauge:style-changed', {
      detail: { gaugeId, styleId, applyAll }
    }));
  }

  static _bindGlobalEvents() {
    // Intercept right click on all dynamic gauges
    document.addEventListener('contextmenu', (e) => {
      const gaugeEl = e.target.closest('.gauge-dynamic-root, .gauge-circular-container, [data-gauge-id]');
      if (gaugeEl) {
        e.preventDefault();
        e.stopPropagation();
        const gaugeId = gaugeEl.getAttribute('data-gauge-id') || (gaugeEl.id && gaugeEl.id.includes('gpu') ? 'gpu' : 'cpu');
        this.open(gaugeId);
      }
    });

    // Escape key closes modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._backdrop?.classList.contains('active')) {
        this.close();
      }
    });
  }

  static _playSoftBeep(freq = 600) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch (e) {}
  }

  static _playSuccessChime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.05);
        gain.gain.setValueAtTime(0.05, ctx.currentTime + i * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.05 + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.05);
        osc.stop(ctx.currentTime + i * 0.05 + 0.15);
      });
    } catch (e) {}
  }
}

if (typeof window !== 'undefined') {
  window.GaugePicker = GaugePicker;
}
