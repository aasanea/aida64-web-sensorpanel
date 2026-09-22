import { EventBus } from '../store/event_bus.js';
import { GaugeEngine } from './gauge-styles-engine.js';
import { GaugePicker } from './gauge-style-picker.js';

const template = document.createElement('template');
template.innerHTML = `
<style>
  @import url('css/gauge-styles.css');
  /* Local Component Styles */
  :host {
    display: block;
    position: relative;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    perspective: 1200px;
    contain: layout style;
    padding: 0 !important;
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
    padding: 10px 16px;
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
  }

  /* Typography (Mirrors GPU Component 1:1) */
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
    font-size: 52px;
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
    font-size: 22px;
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
    color: var(--neon-cyan);
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
  
  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* Badges */
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
  .badge-val-group {
    display: inline-flex;
    align-items: baseline;
    gap: 4px;
    direction: ltr;
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

  /* Flip Buttons */
  .btn-flip-toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--glass-border);
    color: var(--neon-cyan);
    font-family: var(--font-arabic);
    font-size: 13px;
    font-weight: 800;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    user-select: none;
  }
  .btn-flip-toggle:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: var(--neon-cyan);
    box-shadow: 0 0 10px var(--neon-cyan);
    transform: translateY(-1px);
  }
  .btn-flip-toggle.btn-back {
    color: var(--neon-violet);
    border-color: var(--glass-border);
  }
  .btn-flip-toggle.btn-back:hover {
    border-color: var(--neon-violet);
    box-shadow: 0 0 10px var(--neon-violet);
  }

  /* Body Split (Mirrors GPU Grid 1:1) */
  .card-body-split {
    display: grid;
    grid-template-columns: 145px 1fr;
    gap: 16px;
    align-items: center;
    flex: 1;
    min-height: 0;
  }

  /* SVG Circular Temperature Rings (Mirrors GPU 1:1) */
  .gauge-circular-container {
    display: flex;
    justify-content: center;
    align-items: center;
  }
  .svg-ring-wrapper {
    position: relative;
    width: 135px;
    height: 135px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .temp-ring-svg {
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
    overflow: visible;
  }
  .ring-bg {
    fill: none;
    stroke: rgba(255, 255, 255, 0.06);
    stroke-width: 3px;
  }
  .ring-progress {
    fill: none;
    stroke: var(--neon-cyan);
    stroke-width: 3px;
    stroke-linecap: round;
    stroke-dasharray: 471.24;
    stroke-dashoffset: 471.24;
    will-change: stroke-dashoffset;
    transition: stroke 0.3s ease;
    filter: drop-shadow(0 0 6px var(--neon-cyan));
  }

  .ring-center-content {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }
  .arabic-ring-label {
    font-family: var(--font-arabic);
    font-size: 17px;
    font-weight: 800;
    opacity: 0.95;
    margin-bottom: 2px;
    color: #F1F5F9;
  }
  .temp-val-wrapper {
    display: flex;
    align-items: baseline;
    justify-content: center;
    direction: ltr;
  }
  .temp-val-wrapper .huge-number {
    font-size: 52px;
    font-weight: 800;
  }
  .temp-val-wrapper .huge-unit {
    font-size: 22px;
    font-weight: 700;
  }
  .status-descriptor {
    font-family: var(--font-arabic);
    font-size: 16px;
    font-weight: 800;
    color: var(--neon-cyan);
    letter-spacing: 0.5px;
    margin-top: 2px;
  }

  /* Performance Bars Stack (Mirrors GPU 1:1) */
  .metrics-stack {
    display: flex;
    flex-direction: column;
    gap: 5px;
    justify-content: center;
  }
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
    direction: ltr;
  }

  /* Progress Tracks & Bars (Mirrors GPU 1:1) */
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
  .progress-bar.pump-bar {
    background: linear-gradient(90deg, #06B6D4, #3B82F6);
    box-shadow: 0 0 10px rgba(6, 182, 212, 0.4);
  }
  .progress-bar.pump-bar .progress-dot {
    box-shadow: 0 0 8px #06B6D4, 0 0 16px #3B82F6;
  }

  /* Micro Heatmap Strip (20 Cores on Front Face) */
  .micro-cores-strip {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
    padding: 3px 8px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    user-select: none;
    flex-shrink: 0;
  }
  .micro-cores-strip:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: var(--neon-cyan);
    box-shadow: 0 0 10px var(--neon-cyan);
  }
  .strip-group {
    display: flex;
    align-items: center;
    gap: 5px;
    flex: 1;
  }
  .strip-tag {
    font-family: var(--font-numbers);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.5px;
    padding: 1px 5px;
    border-radius: 4px;
    line-height: 1;
  }
  .strip-tag.p-tag {
    color: var(--neon-cyan);
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid var(--neon-cyan);
  }
  .strip-tag.e-tag {
    color: var(--neon-violet);
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid var(--neon-violet);
  }
  .strip-bars-container {
    display: flex;
    align-items: flex-end;
    gap: 3px;
    height: 12px;
    flex: 1;
  }
  .mini-core-bar {
    flex: 1;
    min-width: 3px;
    height: 15%;
    border-radius: 2px;
    background: var(--neon-cyan);
    transition: height 0.25s ease, background-color 0.25s ease;
  }
  .mini-core-bar.e-core-bar {
    background: var(--neon-violet);
  }
  .strip-sep {
    width: 1px;
    height: 12px;
    background: rgba(255, 255, 255, 0.15);
    margin: 0 2px;
  }
  .strip-hint {
    font-family: var(--font-arabic);
    font-size: 11px;
    font-weight: 700;
    color: #94A3B8;
    margin-right: auto;
    transition: color 0.2s;
  }
  .micro-cores-strip:hover .strip-hint {
    color: var(--neon-cyan);
  }

  /* Back Face Detailed Matrix */
  .cores-matrix-content {
    display: flex;
    flex-direction: column;
    gap: 5px;
    flex: 1;
    min-height: 0;
    justify-content: space-between;
  }
  .core-group-row {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 1;
    min-height: 0;
  }
  .core-group-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    line-height: 1;
  }
  .core-group-badge {
    font-family: var(--font-numbers);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.5px;
    padding: 2px 7px;
    border-radius: 5px;
  }
  .core-group-badge.p-badge {
    color: var(--neon-cyan);
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--neon-cyan);
  }
  .core-group-badge.e-badge {
    color: var(--neon-violet);
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--neon-violet);
  }
  .core-group-badge.plat-badge {
    color: var(--neon-orange, #FB923C);
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--neon-orange, #FB923C);
  }
  .core-group-avg {
    font-family: var(--font-arabic);
    font-size: 11px;
    font-weight: 700;
    color: #94A3B8;
    direction: rtl;
  }
  .p-cores-grid {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 4px;
    flex: 1;
  }
  .e-cores-grid {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    gap: 3px;
    flex: 1;
  }
  .core-cell {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 3px 4px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 6px;
    box-sizing: border-box;
    transition: border-color 0.2s, background-color 0.2s;
    min-width: 0;
  }
  .core-cell:hover {
    border-color: var(--neon-cyan);
    background: rgba(255, 255, 255, 0.06);
  }
  .core-cell-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    line-height: 1;
    gap: 2px;
    overflow: hidden;
    white-space: nowrap;
  }
  .core-cell-name {
    font-family: var(--font-numbers);
    font-size: 10px;
    font-weight: 800;
    color: #94A3B8;
  }
  .core-cell-temp {
    font-family: var(--font-numbers);
    font-size: 10px;
    font-weight: 800;
    color: var(--neon-cyan);
    direction: ltr;
  }
  .e-core-cell .core-cell-temp {
    color: var(--neon-violet);
  }
  .core-cell-load {
    font-family: var(--font-numbers);
    font-size: 12px;
    font-weight: 800;
    color: #FFFFFF;
    line-height: 1;
    direction: ltr;
    margin: 1px 0;
  }
  .core-cell-bar-track {
    width: 100%;
    height: 3px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 2px;
    overflow: hidden;
  }
  .core-cell-bar-fill {
    height: 100%;
    width: 0%;
    background: var(--neon-cyan);
    border-radius: 2px;
    transition: width 0.25s ease, background-color 0.25s ease;
  }
  .e-core-cell .core-cell-bar-fill {
    background: var(--neon-violet);
  }

  /* Platform & Thermals Grid */
  .platform-section {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 1;
    min-height: 0;
  }
  .platform-grid {
    display: grid;
    grid-template-columns: repeat(8, minmax(0, 1fr));
    gap: 4px;
    flex: 1;
  }
  @media (max-width: 600px) {
    .platform-grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }
  .platform-cell {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 3px 5px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 6px;
    box-sizing: border-box;
    transition: border-color 0.2s, background-color 0.2s;
    min-width: 0;
  }
  .platform-cell:hover {
    border-color: var(--neon-orange, #FB923C);
    background: rgba(255, 255, 255, 0.06);
  }
  .platform-cell-top {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    line-height: 1;
    overflow: hidden;
    white-space: nowrap;
  }
  .platform-cell-name {
    font-family: var(--font-arabic);
    font-size: 10px;
    font-weight: 700;
    color: #94A3B8;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .platform-cell-val-group {
    display: flex;
    align-items: baseline;
    gap: 2px;
    direction: ltr;
    margin: 2px 0 0 0;
  }
  .platform-cell-val {
    font-family: var(--font-numbers);
    font-size: 13px;
    font-weight: 800;
    color: #FFFFFF;
    line-height: 1;
  }
  .platform-cell-unit {
    font-family: var(--font-display);
    font-size: 10px;
    font-weight: 700;
    color: var(--neon-cyan);
  }
  .platform-cell-unit.unit-orange {
    color: var(--neon-orange, #FB923C);
  }
  .platform-cell-unit.unit-amber {
    color: #FBBF24;
  }
  .cores-footer-strip {
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-numbers);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.8px;
    color: #64748B;
    padding-top: 2px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    flex-shrink: 0;
  }

  /* Critical Thermal Alert Internal Styling (Mirrors GPU 1:1) */
  :host(.critical-thermal) .huge-number {
    color: #FF4D4D !important;
    text-shadow: 0 0 24px rgba(239, 68, 68, 0.7) !important;
  }
  :host(.critical-thermal) .card-icon {
    color: #EF4444 !important;
    border-color: rgba(239, 68, 68, 0.4) !important;
    background: rgba(239, 68, 68, 0.12) !important;
    box-shadow: 0 0 12px rgba(239, 68, 68, 0.3) !important;
  }
  :host(.critical-thermal) .temp-ring-svg circle.ring-progress {
    stroke: #EF4444 !important;
    filter: drop-shadow(0 0 10px rgba(239, 68, 68, 0.8)) !important;
  }
  :host(.critical-thermal) .status-descriptor {
    background: rgba(239, 68, 68, 0.2) !important;
    border-color: rgba(239, 68, 68, 0.4) !important;
    color: #FF4D4D !important;
    animation: blink-soft 1.5s infinite ease-in-out;
  }
  @keyframes blink-soft {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.65; transform: scale(1.05); }
  }
</style>

<div class="card-flipper" id="card-flipper">
  <!-- FRONT FACE -->
  <div class="card-face card-front">
    <div class="card-header">
      <div class="card-title-group">
        <div class="card-icon cpu-icon">
          <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2" fill="none">
            <rect x="4" y="4" width="16" height="16" rx="2"></rect>
            <rect x="9" y="9" width="6" height="6"></rect>
            <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"></path>
          </svg>
        </div>
        <div>
          <h2 class="card-title">المعالج المركزي</h2>
          <span class="card-sub">CPU MASTER TELEMETRY</span>
        </div>
      </div>
      <div class="header-actions">
        <div class="card-badge">
          <span class="badge-label">البقعة الساخنة</span>
          <span class="badge-val-group" dir="ltr">
            <span class="badge-value" id="cpu_hotspot_temp">--</span>
            <span class="badge-unit">°C</span>
          </span>
        </div>
        <button class="btn-flip-toggle" id="btn-flip-cores" type="button" title="عرض مصفوفة الأنوية واللوحة">
          <span>🎛️ مصفوفة الأنوية واللوحة</span>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2">
            <rect x="3" y="3" width="7" height="7" rx="1.5"></rect>
            <rect x="14" y="3" width="7" height="7" rx="1.5"></rect>
            <rect x="3" y="14" width="7" height="7" rx="1.5"></rect>
            <rect x="14" y="14" width="7" height="7" rx="1.5"></rect>
          </svg>
        </button>
      </div>
    </div>

    <div class="card-body-split">
      <!-- Dynamic Circular Temperature Gauge (Right-click to customize) -->
      <div class="gauge-circular-container" id="cpu-gauge-wrapper" data-gauge-id="cpu" title="انقر بزر الفأرة الأيمن لتغيير شكل العداد">
        <div id="cpu-dynamic-gauge" class="gauge-dynamic-root" data-gauge-id="cpu"></div>
      </div>

      <!-- Performance Bars Stack -->
      <div class="metrics-stack">
        <!-- CPU Utilization Bar -->
        <div class="metric-row">
          <div class="metric-info">
            <span class="arabic-label">نسبة الاستهلاك</span>
            <span class="metric-num-group">
              <span class="metric-val" id="cpu_load">--</span>
              <span class="metric-unit">%</span>
            </span>
          </div>
          <div class="progress-track">
            <div class="progress-bar" id="cpu_load_bar" style="width: 0%;">
              <span class="progress-dot"></span>
            </div>
          </div>
        </div>

        <!-- CPU Clock Speed Bar -->
        <div class="metric-row">
          <div class="metric-info">
            <span class="arabic-label">التردد MHz</span>
            <span class="metric-num-group">
              <span class="metric-val" id="cpu_clock">--</span>
              <span class="metric-unit">MHz</span>
            </span>
          </div>
          <div class="progress-track">
            <div class="progress-bar" id="cpu_clock_bar" style="width: 0%;">
              <span class="progress-dot"></span>
            </div>
          </div>
        </div>

        <!-- CPU Power Bar -->
        <div class="metric-row">
          <div class="metric-info">
            <span class="arabic-label">الطاقة W</span>
            <span class="metric-num-group">
              <span class="metric-val" id="cpu_power">--</span>
              <span class="metric-unit">W</span>
            </span>
          </div>
          <div class="progress-track">
            <div class="progress-bar" id="cpu_power_bar" style="width: 0%;">
              <span class="progress-dot"></span>
            </div>
          </div>
        </div>

        <!-- Water Cooling Pump RPM Bar -->
        <div class="metric-row">
          <div class="metric-info">
            <span class="arabic-label">💧 مضخة التبريد PUMP</span>
            <span class="metric-num-group">
              <span class="metric-val" id="pump_rpm">--</span>
              <span class="metric-unit">RPM</span>
            </span>
          </div>
          <div class="progress-track">
            <div class="progress-bar pump-bar" id="pump_rpm_bar" style="width: 0%;">
              <span class="progress-dot"></span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Micro Heatmap Strip (20 Cores) -->
    <div class="micro-cores-strip" id="micro-cores-strip" title="انقر لقلب البطاقة وعرض تفاصيل الـ 20 نواة">
      <div class="strip-group">
        <span class="strip-tag p-tag">8P</span>
        <div class="strip-bars-container" id="p-mini-bars"></div>
      </div>
      <div class="strip-sep"></div>
      <div class="strip-group">
        <span class="strip-tag e-tag">12E</span>
        <div class="strip-bars-container" id="e-mini-bars"></div>
      </div>
      <span class="strip-hint">مصفوفة الأنوية 🔲</span>
    </div>
  </div>

  <!-- BACK FACE (Detailed 20-Core Matrix & Platform Thermals) -->
  <div class="card-face card-back">
    <div class="card-header">
      <div class="card-title-group">
        <div class="card-icon cpu-icon">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
            <rect x="3" y="3" width="7" height="7" rx="1.5"></rect>
            <rect x="14" y="3" width="7" height="7" rx="1.5"></rect>
            <rect x="3" y="14" width="7" height="7" rx="1.5"></rect>
            <rect x="14" y="14" width="7" height="7" rx="1.5"></rect>
          </svg>
        </div>
        <div>
          <h2 class="card-title">مصفوفة الأنوية واللوحة</h2>
          <span class="card-sub">20-CORE HYBRID MATRIX & PLATFORM TELEMETRY</span>
        </div>
      </div>
      <button class="btn-flip-toggle btn-back" id="btn-flip-back" type="button" title="العودة للواجهة الرئيسية">
        <span>الرئيسية ↩</span>
      </button>
    </div>

    <div class="cores-matrix-content">
      <!-- Row 1: 8 P-Cores -->
      <div class="core-group-row">
        <div class="core-group-header">
          <span class="core-group-badge p-badge">أنوية الأداء (P-Cores 1-8)</span>
          <span class="core-group-avg" id="p-cores-avg">متوسط: --% | --°C</span>
        </div>
        <div class="p-cores-grid" id="p-cores-grid"></div>
      </div>

      <!-- Row 2: 12 E-Cores -->
      <div class="core-group-row">
        <div class="core-group-header">
          <span class="core-group-badge e-badge">أنوية الكفاءة (E-Cores 9-20)</span>
          <span class="core-group-avg" id="e-cores-avg">متوسط: --% | --°C</span>
        </div>
        <div class="e-cores-grid" id="e-cores-grid"></div>
      </div>

      <!-- Row 3: Platform & Thermals -->
      <div class="core-group-row platform-section">
        <div class="core-group-header">
          <span class="core-group-badge plat-badge">الحرارة واللوحة (Platform & Thermals)</span>
          <span class="core-group-avg" id="platform-summary">مستشعرات اللوحة والجهد</span>
        </div>
        <div class="platform-grid" id="platform-grid">
          <!-- VRM Temperature -->
          <div class="platform-cell" title="حرارة منظم الجهد VRM Temperature">
            <div class="platform-cell-top">
              <span class="platform-cell-name">🎛️ منظم VRM</span>
            </div>
            <div class="platform-cell-val-group" dir="ltr">
              <span class="platform-cell-val" id="vrm_temp">--</span>
              <span class="platform-cell-unit">°C</span>
            </div>
          </div>

          <!-- Motherboard Temperature -->
          <div class="platform-cell" title="حرارة اللوحة الأم Motherboard Temperature">
            <div class="platform-cell-top">
              <span class="platform-cell-name">🖥️ اللوحة الأم</span>
            </div>
            <div class="platform-cell-val-group" dir="ltr">
              <span class="platform-cell-val" id="motherboard_temp">--</span>
              <span class="platform-cell-unit">°C</span>
            </div>
          </div>

          <!-- Chipset / PCH Temperature -->
          <div class="platform-cell" title="حرارة شريحة اللوحة Chipset / PCH Temperature">
            <div class="platform-cell-top">
              <span class="platform-cell-name">💎 الشريحة PCH</span>
            </div>
            <div class="platform-cell-val-group" dir="ltr">
              <span class="platform-cell-val" id="pch_temp">--</span>
              <span class="platform-cell-unit">°C</span>
            </div>
          </div>

          <!-- NVMe SSD Temperature -->
          <div class="platform-cell" title="حرارة التخزين السريع NVMe SSD Temperature">
            <div class="platform-cell-top">
              <span class="platform-cell-name">💾 التخزين NVMe</span>
            </div>
            <div class="platform-cell-val-group" dir="ltr">
              <span class="platform-cell-val" id="nvme_temp">--</span>
              <span class="platform-cell-unit">°C</span>
            </div>
          </div>

          <!-- Core Voltage -->
          <div class="platform-cell" title="فولتية أنوية المعالج Core Voltage">
            <div class="platform-cell-top">
              <span class="platform-cell-name">⚡ الفولتية VCORE</span>
            </div>
            <div class="platform-cell-val-group" dir="ltr">
              <span class="platform-cell-val" id="cpu_voltage">--</span>
              <span class="platform-cell-unit unit-amber">V</span>
            </div>
          </div>

          <!-- CPU Fan -->
          <div class="platform-cell" title="سرعة مروحة المعالج CPU Fan RPM">
            <div class="platform-cell-top">
              <span class="platform-cell-name">🌀 مروحة CPU</span>
            </div>
            <div class="platform-cell-val-group" dir="ltr">
              <span class="platform-cell-val" id="cpu_fan_rpm">--</span>
              <span class="platform-cell-unit">RPM</span>
            </div>
          </div>

          <!-- CPU Package Hotspot -->
          <div class="platform-cell" title="حرارة البقعة القصوى للمعالج CPU Hotspot">
            <div class="platform-cell-top">
              <span class="platform-cell-name">🔥 البقعة الساخنة</span>
            </div>
            <div class="platform-cell-val-group" dir="ltr">
              <span class="platform-cell-val" id="back_cpu_hotspot_temp">--</span>
              <span class="platform-cell-unit unit-orange">°C</span>
            </div>
          </div>

          <!-- Total System Power -->
          <div class="platform-cell" title="طاقة النظام الإجمالية Total System Power">
            <div class="platform-cell-top">
              <span class="platform-cell-name">⚡ طاقة النظام</span>
            </div>
            <div class="platform-cell-val-group" dir="ltr">
              <span class="platform-cell-val" id="total_power">--</span>
              <span class="platform-cell-unit unit-amber">W</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="cores-footer-strip">
      <span>INTEL CORE ULTRA 7 265KF • LION COVE (8P) + SKYMONT (12E) • ARROW LAKE PLATFORM</span>
    </div>
  </div>
</div>
`;

export class DashboardCPU extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));
    
    this.currentValues = {
      cpu_temp: null,
      cpu_load: null,
      cpu_clock: null,
      cpu_power: null,
      pump_rpm: null,
      cpu_voltage: null,
      cpu_fan_rpm: null,
      cpu_hotspot_temp: null,
      vrm_temp: null,
      motherboard_temp: null,
      pch_temp: null,
      nvme_temp: null,
      total_power: null
    };
    
    this.targetValues = {
      cpu_temp: null,
      cpu_load: null,
      cpu_clock: null,
      cpu_power: null,
      pump_rpm: null,
      cpu_voltage: null,
      cpu_fan_rpm: null,
      cpu_hotspot_temp: null,
      vrm_temp: null,
      motherboard_temp: null,
      pch_temp: null,
      nvme_temp: null,
      total_power: null
    };

    this.cpuCores = null;
    this.isFlipped = false;
    this.isRunning = false;

    this.dom = {
      cpu_temp: this.shadowRoot.getElementById('cpu_temp'),
      'cpu-temp-ring': this.shadowRoot.getElementById('cpu-temp-ring'),
      'cpu-temp-desc': this.shadowRoot.getElementById('cpu-temp-desc'),
      
      cpu_load: this.shadowRoot.getElementById('cpu_load'),
      cpu_load_bar: this.shadowRoot.getElementById('cpu_load_bar'),
      
      cpu_clock: this.shadowRoot.getElementById('cpu_clock'),
      cpu_clock_bar: this.shadowRoot.getElementById('cpu_clock_bar'),
      
      cpu_power: this.shadowRoot.getElementById('cpu_power'),
      cpu_power_bar: this.shadowRoot.getElementById('cpu_power_bar'),
      
      pump_rpm: this.shadowRoot.getElementById('pump_rpm'),
      pump_rpm_bar: this.shadowRoot.getElementById('pump_rpm_bar'),
      
      cpu_voltage: this.shadowRoot.getElementById('cpu_voltage'),
      cpu_fan_rpm: this.shadowRoot.getElementById('cpu_fan_rpm'),
      
      cpu_hotspot_temp: this.shadowRoot.getElementById('cpu_hotspot_temp'),
      back_cpu_hotspot_temp: this.shadowRoot.getElementById('back_cpu_hotspot_temp'),

      vrm_temp: this.shadowRoot.getElementById('vrm_temp'),
      motherboard_temp: this.shadowRoot.getElementById('motherboard_temp'),
      pch_temp: this.shadowRoot.getElementById('pch_temp'),
      nvme_temp: this.shadowRoot.getElementById('nvme_temp'),
      total_power: this.shadowRoot.getElementById('total_power'),
      platformSummary: this.shadowRoot.getElementById('platform-summary'),

      btnFlipCores: this.shadowRoot.getElementById('btn-flip-cores'),
      btnFlipBack: this.shadowRoot.getElementById('btn-flip-back'),
      microCoresStrip: this.shadowRoot.getElementById('micro-cores-strip'),
      pMiniBarsContainer: this.shadowRoot.getElementById('p-mini-bars'),
      eMiniBarsContainer: this.shadowRoot.getElementById('e-mini-bars'),
      pCoresGrid: this.shadowRoot.getElementById('p-cores-grid'),
      eCoresGrid: this.shadowRoot.getElementById('e-cores-grid'),
      pCoresAvg: this.shadowRoot.getElementById('p-cores-avg'),
      eCoresAvg: this.shadowRoot.getElementById('e-cores-avg')
    };

    // Thermal Alert & Hysteresis State (ISA-18.2 Standard)
    this.isCritical = false;
    this.lastCriticalTransitionTime = 0;
    this.HYSTERESIS_ON = 85;
    this.HYSTERESIS_OFF = 82;
    this.HOTSPOT_ON = 95;
    this.HOTSPOT_OFF = 90;
    this.MIN_HOLD_MS = 1500;

    this.coreDom = {
      miniBars: [],
      cells: []
    };

    this.buildCoreDOMElements();

    this.onStateChange = this.onStateChange.bind(this);
    this.tick = this.tick.bind(this);
  }

  buildCoreDOMElements() {
    // 8 P-Core Mini Bars
    for (let i = 1; i <= 8; i++) {
      const bar = document.createElement('div');
      bar.className = 'mini-core-bar p-core-bar';
      bar.id = `p-mini-${i}`;
      bar.title = `P-Core ${i}: --% | --°C`;
      this.dom.pMiniBarsContainer.appendChild(bar);
      this.coreDom.miniBars.push(bar);
    }

    // 12 E-Core Mini Bars
    for (let i = 9; i <= 20; i++) {
      const bar = document.createElement('div');
      bar.className = 'mini-core-bar e-core-bar';
      bar.id = `e-mini-${i}`;
      bar.title = `E-Core ${i - 8}: --% | --°C`;
      this.dom.eMiniBarsContainer.appendChild(bar);
      this.coreDom.miniBars.push(bar);
    }

    // 8 P-Cores Back Grid Cells
    for (let i = 1; i <= 8; i++) {
      const cell = document.createElement('div');
      cell.className = 'core-cell p-core-cell';
      cell.innerHTML = `
        <div class="core-cell-top">
          <span class="core-cell-name">P${i}</span>
          <span class="core-cell-temp" id="p-temp-${i}">--°</span>
        </div>
        <div class="core-cell-load" id="p-load-${i}">--%</div>
        <div class="core-cell-bar-track">
          <div class="core-cell-bar-fill" id="p-bar-${i}"></div>
        </div>
      `;
      this.dom.pCoresGrid.appendChild(cell);
      this.coreDom.cells.push({
        temp: cell.querySelector(`#p-temp-${i}`),
        load: cell.querySelector(`#p-load-${i}`),
        bar: cell.querySelector(`#p-bar-${i}`)
      });
    }

    // 12 E-Cores Back Grid Cells
    for (let i = 9; i <= 20; i++) {
      const cell = document.createElement('div');
      cell.className = 'core-cell e-core-cell';
      cell.innerHTML = `
        <div class="core-cell-top">
          <span class="core-cell-name">E${i - 8}</span>
          <span class="core-cell-temp" id="e-temp-${i}">--°</span>
        </div>
        <div class="core-cell-load" id="e-load-${i}">--%</div>
        <div class="core-cell-bar-track">
          <div class="core-cell-bar-fill" id="e-bar-${i}"></div>
        </div>
      `;
      this.dom.eCoresGrid.appendChild(cell);
      this.coreDom.cells.push({
        temp: cell.querySelector(`#e-temp-${i}`),
        load: cell.querySelector(`#e-load-${i}`),
        bar: cell.querySelector(`#e-bar-${i}`)
      });
    }
  }

  connectedCallback() {
    this.unsubscribe = EventBus.on('state-changed', this.onStateChange);
    this.unsubscribeData = EventBus.on('telemetry:data', (data) => {
      this.onStateChange(data);
      if (data && data.cpu_cores) {
        this.cpuCores = data.cpu_cores;
        this.renderCores();
      }
    });

    if (window.stateManager && window.stateManager.currentState) {
      this.onStateChange(window.stateManager.currentState);
      if (window.stateManager.currentState.cpu_cores) {
        this.cpuCores = window.stateManager.currentState.cpu_cores;
        this.renderCores();
      }
    }

    // Dynamic Gauge Setup
    this._currentGaugeStyle = GaugePicker.getSavedStyle('cpu');
    this._gaugeMount = this.shadowRoot.getElementById('cpu-dynamic-gauge');
    if (this._gaugeMount) {
      GaugeEngine.renderGaugeSvg(this._currentGaugeStyle, this._gaugeMount, {
        title: 'حرارة المعالج',
        gaugeId: 'cpu',
        unit: '°C'
      });
    }

    const gaugeWrapper = this.shadowRoot.getElementById('cpu-gauge-wrapper');
    if (gaugeWrapper) {
      gaugeWrapper.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.GaugePicker?.open('cpu');
      });
    }

    this._onStyleChanged = (detail) => {
      if (detail.applyAll || detail.gaugeId === 'cpu') {
        this._currentGaugeStyle = detail.styleId;
        if (this._gaugeMount) {
          GaugeEngine.renderGaugeSvg(this._currentGaugeStyle, this._gaugeMount, {
            title: 'حرارة المعالج',
            gaugeId: 'cpu',
            unit: '°C'
          });
          const temp = this.currentValues.cpu_temp;
          if (temp !== null && !isNaN(temp)) {
            const desc = this.getTemperatureDesc(temp);
            GaugeEngine.updateGaugeSvg(this._currentGaugeStyle, this._gaugeMount, temp, 20, 100, desc);
          }
        }
      }
    };
    this.unsubscribeStyle = EventBus.on('gauge:style-changed', this._onStyleChanged);

    if (this.dom.btnFlipCores) {
      this.dom.btnFlipCores.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleFlip(true);
      });
    }
    if (this.dom.microCoresStrip) {
      this.dom.microCoresStrip.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleFlip(true);
      });
    }
    if (this.dom.btnFlipBack) {
      this.dom.btnFlipBack.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleFlip(false);
      });
    }

    this.isRunning = true;
    requestAnimationFrame(this.tick);
  }

  disconnectedCallback() {
    this.isRunning = false;
    if (this.unsubscribe) this.unsubscribe();
    if (this.unsubscribeData) this.unsubscribeData();
    if (this.unsubscribeStyle) this.unsubscribeStyle();
  }

  toggleFlip(forceState) {
    this.isFlipped = (typeof forceState === 'boolean') ? forceState : !this.isFlipped;
    this.classList.toggle('flipped', this.isFlipped);
  }

  onStateChange(delta) {
    if (!delta) return;
    for (const key in this.targetValues) {
      if (delta[key] !== undefined) {
        this.targetValues[key] = delta[key];
      }
    }
    if (delta.cpu_cores !== undefined) {
      this.cpuCores = delta.cpu_cores;
      this.renderCores();
    }
  }

  tick() {
    if (!this.isRunning) return;
    
    let needsRender = false;

    for (const key in this.currentValues) {
      const target = this.targetValues[key];
      let current = this.currentValues[key];

      if (target === null || target === undefined) {
        if (current !== null) {
          current = null;
          needsRender = true;
        }
      } else if (current === null || isNaN(current)) {
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

  getTemperatureColor(temp, defaultColor = 'var(--neon-cyan)') {
    if (temp === null || isNaN(temp)) return defaultColor;
    if (temp < 70) return defaultColor;
    if (temp < 85) return 'var(--neon-orange, #FB923C)';
    return 'var(--neon-red, #EF4444)';
  }

  updateTempColor(element, temp, defaultColor = '#FFFFFF') {
    if (!element) return;
    const color = (temp === null || isNaN(temp)) ? defaultColor :
                  (temp < 65 ? defaultColor :
                   temp < 80 ? 'var(--neon-orange, #FB923C)' : 'var(--neon-red, #EF4444)');
    if (element.style.color !== color) {
      element.style.color = color;
    }
  }

  getTemperatureDesc(temp) {
    if (temp === null || isNaN(temp)) return '--';
    if (temp < 45) return 'بارد';
    if (temp < 65) return 'مثالي';
    if (temp < 75) return 'طبيعي';
    if (temp < 85) return 'مرتفع';
    return 'حرج!';
  }

  render() {
    // Hotspot (Front & Back)
    this.updateText(this.dom.cpu_hotspot_temp, this.currentValues.cpu_hotspot_temp, 0);
    this.updateText(this.dom.back_cpu_hotspot_temp, this.currentValues.cpu_hotspot_temp, 0);
    this.updateTempColor(this.dom.back_cpu_hotspot_temp, this.currentValues.cpu_hotspot_temp);

    // CPU Dynamic Gauge
    const temp = this.currentValues.cpu_temp;
    if (this._gaugeMount && temp !== null && !isNaN(temp)) {
      const desc = this.getTemperatureDesc(temp);
      GaugeEngine.updateGaugeSvg(this._currentGaugeStyle, this._gaugeMount, temp, 20, 100, desc);
    }

    // Front Face Bars
    this.updateBar(this.dom.cpu_load, this.dom.cpu_load_bar, this.currentValues.cpu_load, 0, 100, 0);
    this.updateBar(this.dom.cpu_clock, this.dom.cpu_clock_bar, this.currentValues.cpu_clock, 0, 6000, 0);
    this.updateBar(this.dom.cpu_power, this.dom.cpu_power_bar, this.currentValues.cpu_power, 0, 250, 0);
    this.updateBar(this.dom.pump_rpm, this.dom.pump_rpm_bar, this.currentValues.pump_rpm, 0, 4500, 0);

    // Back Face: Platform & Thermals
    this.updateText(this.dom.vrm_temp, this.currentValues.vrm_temp, 0);
    this.updateTempColor(this.dom.vrm_temp, this.currentValues.vrm_temp);

    this.updateText(this.dom.motherboard_temp, this.currentValues.motherboard_temp, 0);
    this.updateTempColor(this.dom.motherboard_temp, this.currentValues.motherboard_temp);

    this.updateText(this.dom.pch_temp, this.currentValues.pch_temp, 0);
    this.updateTempColor(this.dom.pch_temp, this.currentValues.pch_temp);

    this.updateText(this.dom.nvme_temp, this.currentValues.nvme_temp, 0);
    this.updateTempColor(this.dom.nvme_temp, this.currentValues.nvme_temp);

    this.updateText(this.dom.cpu_voltage, this.currentValues.cpu_voltage, 3);
    this.updateText(this.dom.cpu_fan_rpm, this.currentValues.cpu_fan_rpm, 0);
    this.updateText(this.dom.total_power, this.currentValues.total_power, 0);

    // Platform Summary Text (Highest node temp)
    if (this.dom.platformSummary) {
      const pTemps = [
        this.currentValues.vrm_temp,
        this.currentValues.motherboard_temp,
        this.currentValues.pch_temp,
        this.currentValues.nvme_temp
      ].filter(t => t !== null && !isNaN(t));

      if (pTemps.length > 0) {
        const maxPlat = Math.round(Math.max(...pTemps));
        this.dom.platformSummary.textContent = `أعلى حرارة: ${maxPlat}°C`;
      } else {
        this.dom.platformSummary.textContent = 'مستشعرات اللوحة والجهد';
      }
    }

    // Critical Thermal Alarm Evaluation (Hysteresis & Hold Time)
    this.updateThermalAlarm(temp, this.currentValues.cpu_hotspot_temp);
  }

  renderCores() {
    if (!this.cpuCores || !Array.isArray(this.cpuCores)) return;

    let pLoadSum = 0, pTempSum = 0, pCount = 0;
    let eLoadSum = 0, eTempSum = 0, eCount = 0;

    for (let i = 0; i < this.cpuCores.length; i++) {
      const core = this.cpuCores[i];
      const load = (core.load !== null && !isNaN(core.load)) ? Math.min(100, Math.max(0, core.load)) : 0;
      const temp = (core.temp !== null && !isNaN(core.temp)) ? core.temp : null;
      const defaultColor = core.type === 'P' ? 'var(--neon-cyan)' : 'var(--neon-violet)';
      const color = this.getTemperatureColor(temp, defaultColor);

      if (core.type === 'P') {
        pLoadSum += load;
        if (temp !== null) pTempSum += temp;
        pCount++;
      } else {
        eLoadSum += load;
        if (temp !== null) eTempSum += temp;
        eCount++;
      }

      // Update Front Mini-Bar
      const miniBar = this.coreDom.miniBars[i];
      if (miniBar) {
        const heightPct = Math.max(15, load);
        miniBar.style.height = `${heightPct}%`;
        miniBar.style.backgroundColor = color;
        const tag = core.type === 'P' ? `P-Core ${core.id}` : `E-Core ${core.id - 8}`;
        miniBar.title = `${tag}: ${Math.round(load)}% | ${temp !== null ? Math.round(temp) : '--'}°C`;
      }

      // Update Back Matrix Detail Cell
      const cell = this.coreDom.cells[i];
      if (cell) {
        cell.load.textContent = `${Math.round(load)}%`;
        cell.temp.textContent = temp !== null ? `${Math.round(temp)}°` : '--°';
        cell.temp.style.color = color;
        cell.bar.style.width = `${load}%`;
        cell.bar.style.backgroundColor = color;
      }
    }

    // Averages on Back Face
    if (this.dom.pCoresAvg && pCount > 0) {
      const avgLoad = Math.round(pLoadSum / pCount);
      const avgTemp = pTempSum > 0 ? Math.round(pTempSum / pCount) : '--';
      this.dom.pCoresAvg.textContent = `متوسط: ${avgLoad}% | ${avgTemp}°C`;
    }
    if (this.dom.eCoresAvg && eCount > 0) {
      const avgLoad = Math.round(eLoadSum / eCount);
      const avgTemp = eTempSum > 0 ? Math.round(eTempSum / eCount) : '--';
      this.dom.eCoresAvg.textContent = `متوسط: ${avgLoad}% | ${avgTemp}°C`;
    }
  }

  updateThermalAlarm(temp, hotspot) {
    const now = Date.now();
    const timeSinceTransition = now - this.lastCriticalTransitionTime;

    let nextState = this.isCritical;
    if (!this.isCritical) {
      if ((temp !== null && !isNaN(temp) && temp >= this.HYSTERESIS_ON) || 
          (hotspot !== null && !isNaN(hotspot) && hotspot >= this.HOTSPOT_ON)) {
        nextState = true;
      }
    } else {
      if (timeSinceTransition >= this.MIN_HOLD_MS) {
        const tempCool = (temp === null || isNaN(temp) || temp < this.HYSTERESIS_OFF);
        const hotspotCool = (hotspot === null || isNaN(hotspot) || hotspot < this.HOTSPOT_OFF);
        if (tempCool && hotspotCool) {
          nextState = false;
        }
      }
    }

    if (nextState !== this.isCritical) {
      this.isCritical = nextState;
      this.lastCriticalTransitionTime = now;
      this.classList.toggle('critical-thermal', this.isCritical);
      EventBus.emit('thermal:critical', { 
        component: 'cpu', 
        temp, 
        hotspot, 
        isCritical: this.isCritical 
      });
    }
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
    this.updateText(textEl, value, decimals);
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

  updateRing(ringEl, value, min, max, circumference) {
    if (!ringEl) return;
    if (value === null || value === undefined) {
      ringEl.style.strokeDashoffset = circumference;
      ringEl.style.stroke = 'rgba(255, 255, 255, 0.08)';
      ringEl.style.filter = 'none';
      return;
    }
    const ratio = Math.min(1, Math.max(0, (value - min) / (max - min)));
    const offset = (circumference * (1 - ratio)).toFixed(2);
    const color = this.getTemperatureColor(value);

    ringEl.style.strokeDashoffset = offset;
    ringEl.style.stroke = color;
    ringEl.style.filter = `drop-shadow(0 0 6px ${color})`;
  }
}

customElements.define('dashboard-cpu', DashboardCPU);
