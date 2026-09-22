import { EventBus } from '../store/event_bus.js';

const template = document.createElement('template');
template.innerHTML = `
<style>
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

  /* 3D Card Flipper Mechanics (Mirrors CPU Component 1:1) */
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

  :host(.flipped) .card-front {
    pointer-events: none;
  }

  :host(.flipped) .card-back {
    pointer-events: auto;
  }

  /* Typography (Mirrors CPU Component 1:1 for 100cm Readability) */
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
    color: var(--neon-violet);
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
    font-variant-numeric: tabular-nums;
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

  /* Body Split (Circular Ring + Stacked Metrics) */
  .card-body-split {
    display: grid;
    grid-template-columns: 145px 1fr;
    gap: 16px;
    align-items: center;
    flex: 1;
    min-height: 0;
  }

  /* SVG Circular Temperature Rings */
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
    padding: 1px 8px;
    border-radius: 4px;
    border: 1px solid transparent;
    transition: all 0.3s ease;
  }

  /* Performance Bars Stack (Front Face) */
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
    font-variant-numeric: tabular-nums;
  }
  .metric-unit {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 700;
    color: var(--neon-cyan);
    direction: ltr;
  }

  /* VRAM Group High-Contrast Formatting */
  .vram-num-group {
    display: flex;
    align-items: baseline;
    gap: 4px;
    direction: ltr;
  }
  .metric-sep {
    font-family: var(--font-display);
    font-size: 20px;
    color: #94A3B8;
    margin: 0 1px;
  }
  .metric-val-total {
    font-family: var(--font-numbers);
    font-size: 21px;
    font-weight: 700;
    color: #CBD5E1;
    font-variant-numeric: tabular-nums;
  }
  .metric-pct-tag {
    font-family: var(--font-numbers);
    font-size: 14px;
    font-weight: 800;
    color: var(--neon-cyan);
    background: rgba(34, 211, 238, 0.12);
    border: 1px solid rgba(34, 211, 238, 0.3);
    padding: 1px 6px;
    border-radius: 4px;
    margin-inline-start: 6px;
    font-variant-numeric: tabular-nums;
  }

  /* Progress Tracks & Bars */
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
  .progress-bar-vram {
    background: linear-gradient(90deg, var(--neon-cyan), var(--neon-purple, #C084FC));
    box-shadow: 0 0 10px rgba(192, 132, 252, 0.35);
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

  /* Micro Telemetry Strip (Bottom of Front Face) */
  .micro-telemetry-strip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-top: 4px;
    padding: 3px 10px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    user-select: none;
    flex-shrink: 0;
  }
  .micro-telemetry-strip:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: var(--neon-cyan);
    box-shadow: 0 0 10px var(--neon-cyan);
  }
  .strip-items-group {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .strip-pill {
    display: flex;
    align-items: baseline;
    gap: 4px;
    direction: ltr;
  }
  .strip-pill-label {
    font-family: var(--font-numbers);
    font-size: 11px;
    font-weight: 700;
    color: #94A3B8;
  }
  .strip-pill-val {
    font-family: var(--font-numbers);
    font-size: 13px;
    font-weight: 800;
    color: var(--text-pure-white);
    font-variant-numeric: tabular-nums;
  }
  .strip-pill-unit {
    font-family: var(--font-display);
    font-size: 10px;
    font-weight: 700;
    color: var(--neon-cyan);
  }
  .strip-hint {
    font-family: var(--font-arabic);
    font-size: 12px;
    font-weight: 800;
    color: #94A3B8;
    margin-right: auto;
    transition: color 0.2s;
  }
  .micro-telemetry-strip:hover .strip-hint {
    color: var(--neon-cyan);
  }

  /* Back Face Deep Telemetry Grid (2 Columns x 3 Rows) */
  .telemetry-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 7px;
    flex: 1;
    min-height: 0;
    margin: 4px 0;
  }
  .telemetry-tile {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 6px 10px;
    background: rgba(255, 255, 255, 0.025);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    box-sizing: border-box;
  }
  .telemetry-tile:hover {
    border-color: var(--neon-cyan);
    background: rgba(255, 255, 255, 0.05);
    transform: translateY(-1px);
    box-shadow: 0 0 10px rgba(34, 211, 238, 0.15);
  }
  .tile-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    line-height: 1;
  }
  .tile-label {
    font-family: var(--font-arabic);
    font-size: 14px;
    font-weight: 800;
    color: #FFFFFF;
  }
  .tile-sub {
    font-family: var(--font-numbers);
    font-size: 10px;
    font-weight: 800;
    color: #94A3B8;
    letter-spacing: 0.5px;
  }
  .tile-val-group {
    display: flex;
    align-items: baseline;
    gap: 4px;
    direction: ltr;
    margin: 2px 0;
  }
  .tile-num {
    font-family: var(--font-numbers);
    font-size: 24px;
    font-weight: 800;
    color: var(--text-pure-white);
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .tile-unit {
    font-family: var(--font-display);
    font-size: 14px;
    font-weight: 700;
    color: var(--neon-cyan);
    direction: ltr;
  }
  .tile-bar-track {
    width: 100%;
    height: 3px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 2px;
    overflow: hidden;
    direction: ltr;
  }
  .tile-bar-fill {
    height: 100%;
    width: 0%;
    background: linear-gradient(90deg, var(--neon-cyan), var(--neon-violet));
    border-radius: 2px;
    transition: width 0.15s ease, background-color 0.2s ease;
  }

  /* Back Face Hardware Footer */
  .card-footer-strip {
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-numbers);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.8px;
    color: #64748B;
    padding-top: 3px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    flex-shrink: 0;
  }

  /* Critical Thermal Alert Internal Styling (ISA-18.2 Compliance) */
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
  <!-- FRONT FACE (Mission-Critical Metrics for 100cm Readability) -->
  <div class="card-face card-front">
    <div class="card-header">
      <div class="card-title-group">
        <div class="card-icon gpu-icon">
          <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2" fill="none">
            <rect x="2" y="6" width="20" height="12" rx="2"></rect>
            <circle cx="8" cy="12" r="2.5"></circle>
            <circle cx="16" cy="12" r="2.5"></circle>
            <path d="M6 18v2M10 18v2M14 18v2M18 18v2"></path>
          </svg>
        </div>
        <div>
          <h2 class="card-title">معالج الرسوميات</h2>
          <span class="card-sub">GPU & VRAM MASTER</span>
        </div>
      </div>
      <div class="header-actions">
        <div class="card-badge" title="حرارة البقعة الساخنة">
          <span class="badge-label">البقعة الساخنة</span>
          <span class="badge-val-group" dir="ltr">
            <span class="badge-value" id="gpu_hotspot_temp">--</span>
            <span class="badge-unit">°C</span>
          </span>
        </div>
        <button class="btn-flip-toggle" id="btn-flip-details" type="button" title="عرض تفاصيل كرت الشاشة والذاكرة">
          <span>🎛️ تفاصيل الذاكرة والتردد</span>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
          </svg>
        </button>
      </div>
    </div>

    <div class="card-body-split">
      <!-- Circular Temperature Ring -->
      <div class="gauge-circular-container">
        <div class="svg-ring-wrapper">
          <svg class="temp-ring-svg" viewBox="0 0 180 180">
            <circle class="ring-bg" cx="90" cy="90" r="75"></circle>
            <circle class="ring-progress" id="gpu-temp-ring" cx="90" cy="90" r="75"></circle>
          </svg>
          <div class="ring-center-content">
            <span class="arabic-ring-label">حرارة المعالج</span>
            <div class="temp-val-wrapper">
              <span class="huge-number" id="gpu_temp">--</span>
              <span class="huge-unit">°C</span>
            </div>
            <span class="status-descriptor" id="gpu-temp-desc">مثالي</span>
          </div>
        </div>
      </div>

      <!-- Performance Bars Stack -->
      <div class="metrics-stack">
        <!-- GPU Utilization Bar -->
        <div class="metric-row">
          <div class="metric-info">
            <span class="arabic-label">نسبة الاستهلاك</span>
            <span class="metric-num-group">
              <span class="metric-val" id="gpu_load">--</span>
              <span class="metric-unit">%</span>
            </span>
          </div>
          <div class="progress-track">
            <div class="progress-bar" id="gpu_load_bar" style="width: 0%;">
              <span class="progress-dot"></span>
            </div>
          </div>
        </div>

        <!-- Integrated VRAM Bar (GB Used / Total + Load %) -->
        <div class="metric-row">
          <div class="metric-info">
            <span class="arabic-label">ذاكرة الفيديو VRAM</span>
            <div class="vram-num-group">
              <span class="metric-val" id="vram_used_gb">--</span>
              <span class="metric-sep">/</span>
              <span class="metric-val-total" id="vram_total_gb">--</span>
              <span class="metric-unit">GB</span>
              <span class="metric-pct-tag" id="vram_used_percent">--%</span>
            </div>
          </div>
          <div class="progress-track">
            <div class="progress-bar progress-bar-vram" id="vram_used_percent_bar" style="width: 0%;">
              <span class="progress-dot"></span>
            </div>
          </div>
        </div>

        <!-- GPU Core Clock Speed Bar -->
        <div class="metric-row">
          <div class="metric-info">
            <span class="arabic-label">التردد MHz</span>
            <span class="metric-num-group">
              <span class="metric-val" id="gpu_clock">--</span>
              <span class="metric-unit">MHz</span>
            </span>
          </div>
          <div class="progress-track">
            <div class="progress-bar" id="gpu_clock_bar" style="width: 0%;">
              <span class="progress-dot"></span>
            </div>
          </div>
        </div>

        <!-- GPU Power Bar -->
        <div class="metric-row">
          <div class="metric-info">
            <span class="arabic-label">الطاقة W</span>
            <span class="metric-num-group">
              <span class="metric-val" id="gpu_power">--</span>
              <span class="metric-unit">W</span>
            </span>
          </div>
          <div class="progress-track">
            <div class="progress-bar" id="gpu_power_bar" style="width: 0%;">
              <span class="progress-dot"></span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Micro Telemetry Strip (Bottom Quick Glance & Flip Trigger) -->
    <div class="micro-telemetry-strip" id="micro-telemetry-strip" title="انقر لقلب البطاقة وعرض تفاصيل كرت الشاشة والذاكرة الكاملة">
      <div class="strip-items-group">
        <div class="strip-pill">
          <span class="strip-pill-label">VRAM:</span>
          <span class="strip-pill-val" id="vram_temp_strip">--</span>
          <span class="strip-pill-unit">°C</span>
        </div>
        <div class="strip-pill">
          <span class="strip-pill-label">Clock:</span>
          <span class="strip-pill-val" id="vram_speed_strip">--</span>
          <span class="strip-pill-unit">MHz</span>
        </div>
        <div class="strip-pill">
          <span class="strip-pill-label">Fan:</span>
          <span class="strip-pill-val" id="gpu_fan_strip">--</span>
          <span class="strip-pill-unit">RPM</span>
        </div>
        <div class="strip-pill">
          <span class="strip-pill-label">Volt:</span>
          <span class="strip-pill-val" id="gpu_voltage_strip">--</span>
          <span class="strip-pill-unit">mV</span>
        </div>
      </div>
      <span class="strip-hint">المزيد من التفاصيل 🎛️</span>
    </div>
  </div>

  <!-- BACK FACE (Deep Telemetry on Flip) -->
  <div class="card-face card-back">
    <div class="card-header">
      <div class="card-title-group">
        <div class="card-icon gpu-icon">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
            <rect x="2" y="6" width="20" height="12" rx="2"></rect>
            <circle cx="8" cy="12" r="2.5"></circle>
            <circle cx="16" cy="12" r="2.5"></circle>
            <path d="M6 18v2M10 18v2M14 18v2M18 18v2"></path>
          </svg>
        </div>
        <div>
          <h2 class="card-title">تفاصيل كرت الشاشة والذاكرة</h2>
          <span class="card-sub">GPU & VRAM TELEMETRY</span>
        </div>
      </div>
      <button class="btn-flip-toggle btn-back" id="btn-flip-back" type="button" title="العودة للواجهة الرئيسية">
        <span>عودة ↩️</span>
      </button>
    </div>

    <!-- 6 Deep Telemetry Tiles (2 Columns x 3 Rows Grid) -->
    <div class="telemetry-grid">
      <!-- Tile 1: GPU Hotspot Temperature -->
      <div class="telemetry-tile">
        <div class="tile-header">
          <span class="tile-label">حرارة البقعة الساخنة</span>
          <span class="tile-sub">HOTSPOT</span>
        </div>
        <div class="tile-val-group">
          <span class="tile-num" id="gpu_hotspot_back">--</span>
          <span class="tile-unit">°C</span>
        </div>
        <div class="tile-bar-track">
          <div class="tile-bar-fill" id="gpu_hotspot_bar" style="width: 0%;"></div>
        </div>
      </div>

      <!-- Tile 2: VRAM Junction / Chip Temperature -->
      <div class="telemetry-tile">
        <div class="tile-header">
          <span class="tile-label">حرارة رقاقات الذاكرة</span>
          <span class="tile-sub">VRAM TEMP</span>
        </div>
        <div class="tile-val-group">
          <span class="tile-num" id="vram_temp">--</span>
          <span class="tile-unit">°C</span>
        </div>
        <div class="tile-bar-track">
          <div class="tile-bar-fill" id="vram_temp_bar" style="width: 0%;"></div>
        </div>
      </div>

      <!-- Tile 3: VRAM Memory Clock -->
      <div class="telemetry-tile">
        <div class="tile-header">
          <span class="tile-label">تردد ذاكرة الفيديو</span>
          <span class="tile-sub">VRAM CLOCK</span>
        </div>
        <div class="tile-val-group">
          <span class="tile-num" id="vram_speed_mhz">--</span>
          <span class="tile-unit">MHz</span>
        </div>
        <div class="tile-bar-track">
          <div class="tile-bar-fill" id="vram_speed_bar" style="width: 0%;"></div>
        </div>
      </div>

      <!-- Tile 4: Cooling Fan Speed -->
      <div class="telemetry-tile">
        <div class="tile-header">
          <span class="tile-label">المروحة RPM</span>
          <span class="tile-sub">FAN SPEED</span>
        </div>
        <div class="tile-val-group">
          <span class="tile-num" id="gpu_fan_rpm">--</span>
          <span class="tile-unit">RPM</span>
        </div>
        <div class="tile-bar-track">
          <div class="tile-bar-fill" id="gpu_fan_rpm_bar" style="width: 0%;"></div>
        </div>
      </div>

      <!-- Tile 5: Core Voltage -->
      <div class="telemetry-tile">
        <div class="tile-header">
          <span class="tile-label">فولتية النواة</span>
          <span class="tile-sub">CORE VOLT</span>
        </div>
        <div class="tile-val-group">
          <span class="tile-num" id="gpu_voltage_mv">--</span>
          <span class="tile-unit">mV</span>
        </div>
        <div class="tile-bar-track">
          <div class="tile-bar-fill" id="gpu_voltage_bar" style="width: 0%;"></div>
        </div>
      </div>

      <!-- Tile 6: Power Status / Board Power -->
      <div class="telemetry-tile">
        <div class="tile-header">
          <span class="tile-label">استهلاك طاقة الكرت</span>
          <span class="tile-sub">BOARD POWER</span>
        </div>
        <div class="tile-val-group">
          <span class="tile-num" id="gpu_power_back">--</span>
          <span class="tile-unit">W</span>
        </div>
        <div class="tile-bar-track">
          <div class="tile-bar-fill" id="gpu_power_bar_back" style="width: 0%;"></div>
        </div>
      </div>
    </div>

    <!-- Back Face Hardware Footer -->
    <div class="card-footer-strip">
      <span>NVIDIA GEFORCE RTX 4080 • AD103 GPU • 16GB GDDR6X 256-BIT • TELEMETRY MATRIX</span>
    </div>
  </div>
</div>
`;

export class DashboardGPU extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));
    
    this.currentValues = {
      gpu_temp: null,
      gpu_load: null,
      gpu_clock: null,
      gpu_power: null,
      gpu_voltage_mv: null,
      gpu_fan_rpm: null,
      gpu_hotspot_temp: null,
      vram_used_percent: null,
      vram_used_gb: null,
      vram_total_gb: null,
      vram_speed_mhz: null,
      vram_temp: null
    };
    
    this.targetValues = {
      gpu_temp: null,
      gpu_load: null,
      gpu_clock: null,
      gpu_power: null,
      gpu_voltage_mv: null,
      gpu_fan_rpm: null,
      gpu_hotspot_temp: null,
      vram_used_percent: null,
      vram_used_gb: null,
      vram_total_gb: null,
      vram_speed_mhz: null,
      vram_temp: null
    };

    this.isFlipped = false;
    this.isRunning = false;

    // Front Face DOM Nodes
    this.dom = {
      gpu_temp: this.shadowRoot.getElementById('gpu_temp'),
      'gpu-temp-ring': this.shadowRoot.getElementById('gpu-temp-ring'),
      'gpu-temp-desc': this.shadowRoot.getElementById('gpu-temp-desc'),
      
      gpu_load: this.shadowRoot.getElementById('gpu_load'),
      gpu_load_bar: this.shadowRoot.getElementById('gpu_load_bar'),
      
      vram_used_gb: this.shadowRoot.getElementById('vram_used_gb'),
      vram_total_gb: this.shadowRoot.getElementById('vram_total_gb'),
      vram_used_percent: this.shadowRoot.getElementById('vram_used_percent'),
      vram_used_percent_bar: this.shadowRoot.getElementById('vram_used_percent_bar'),

      gpu_clock: this.shadowRoot.getElementById('gpu_clock'),
      gpu_clock_bar: this.shadowRoot.getElementById('gpu_clock_bar'),
      
      gpu_power: this.shadowRoot.getElementById('gpu_power'),
      gpu_power_bar: this.shadowRoot.getElementById('gpu_power_bar'),
      
      gpu_hotspot_temp: this.shadowRoot.getElementById('gpu_hotspot_temp'),

      // Micro Telemetry Strip Elements
      vram_temp_strip: this.shadowRoot.getElementById('vram_temp_strip'),
      vram_speed_strip: this.shadowRoot.getElementById('vram_speed_strip'),
      gpu_fan_strip: this.shadowRoot.getElementById('gpu_fan_strip'),
      gpu_voltage_strip: this.shadowRoot.getElementById('gpu_voltage_strip'),
      microTelemetryStrip: this.shadowRoot.getElementById('micro-telemetry-strip'),

      // Flip Controls
      btnFlipDetails: this.shadowRoot.getElementById('btn-flip-details'),
      btnFlipBack: this.shadowRoot.getElementById('btn-flip-back'),

      // Back Face Telemetry Elements
      gpu_hotspot_back: this.shadowRoot.getElementById('gpu_hotspot_back'),
      gpu_hotspot_bar: this.shadowRoot.getElementById('gpu_hotspot_bar'),

      vram_temp: this.shadowRoot.getElementById('vram_temp'),
      vram_temp_bar: this.shadowRoot.getElementById('vram_temp_bar'),

      vram_speed_mhz: this.shadowRoot.getElementById('vram_speed_mhz'),
      vram_speed_bar: this.shadowRoot.getElementById('vram_speed_bar'),

      gpu_fan_rpm: this.shadowRoot.getElementById('gpu_fan_rpm'),
      gpu_fan_rpm_bar: this.shadowRoot.getElementById('gpu_fan_rpm_bar'),

      gpu_voltage_mv: this.shadowRoot.getElementById('gpu_voltage_mv'),
      gpu_voltage_bar: this.shadowRoot.getElementById('gpu_voltage_bar'),

      gpu_power_back: this.shadowRoot.getElementById('gpu_power_back'),
      gpu_power_bar_back: this.shadowRoot.getElementById('gpu_power_bar_back')
    };

    // Thermal Alert & Hysteresis State (ISA-18.2 Standard)
    this.isCritical = false;
    this.lastCriticalTransitionTime = 0;
    this.HYSTERESIS_ON = 85;
    this.HYSTERESIS_OFF = 82;
    this.HOTSPOT_ON = 95;
    this.HOTSPOT_OFF = 90;
    this.MIN_HOLD_MS = 1500;

    this.onStateChange = this.onStateChange.bind(this);
    this.tick = this.tick.bind(this);
  }

  connectedCallback() {
    this.unsubscribe = EventBus.on('state-changed', this.onStateChange);
    this.unsubscribeData = EventBus.on('telemetry:data', this.onStateChange);

    if (window.stateManager && window.stateManager.currentState) {
      this.onStateChange(window.stateManager.currentState);
    }

    if (this.dom.btnFlipDetails) {
      this.dom.btnFlipDetails.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleFlip(true);
      });
    }

    if (this.dom.microTelemetryStrip) {
      this.dom.microTelemetryStrip.addEventListener('click', (e) => {
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

    // Flip on clicking the card itself (excluding buttons/interactive elements)
    this.addEventListener('click', (e) => {
      if (e.composedPath().some(el => el.tagName === 'BUTTON' || (el.classList && el.classList.contains('btn-flip-toggle')))) {
        return;
      }
      this.toggleFlip();
    });

    this.isRunning = true;
    requestAnimationFrame(this.tick);
  }

  disconnectedCallback() {
    this.isRunning = false;
    if (this.unsubscribe) this.unsubscribe();
    if (this.unsubscribeData) this.unsubscribeData();
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

  getTemperatureColor(temp) {
    if (temp === null || isNaN(temp)) return 'rgba(255, 255, 255, 0.15)';
    if (temp < 60) return '#22D3EE'; // var(--neon-cyan) - مثالي
    if (temp < 80) return '#10B981'; // var(--neon-green) - جيدة
    return '#EF4444';                // var(--neon-red)   - حرجة
  }

  getTemperatureDesc(temp) {
    if (temp === null || isNaN(temp)) return '--';
    if (temp < 60) return 'مثالي';
    if (temp < 80) return 'جيدة';
    return 'حرجة';
  }

  render() {
    const temp = this.currentValues.gpu_temp;
    const hotspot = this.currentValues.gpu_hotspot_temp;

    // Header Hotspot badge
    this.updateText(this.dom.gpu_hotspot_temp, hotspot, 0);

    // Circular Temperature Ring
    this.updateText(this.dom.gpu_temp, temp, 0);
    this.updateRing(this.dom['gpu-temp-ring'], temp, 0, 100, 471.24);
    
    if (this.dom['gpu-temp-desc']) {
      const desc = this.getTemperatureDesc(temp);
      const color = this.getTemperatureColor(temp);
      if (this.dom['gpu-temp-desc'].textContent !== desc) {
        this.dom['gpu-temp-desc'].textContent = desc;
      }
      this.dom['gpu-temp-desc'].style.color = color;
    }

    // Front Face Mission-Critical Bars
    this.updateBar(this.dom.gpu_load, this.dom.gpu_load_bar, this.currentValues.gpu_load, 0, 100, 0);
    
    // Integrated VRAM (GB used / total + load %)
    this.updateText(this.dom.vram_used_gb, this.currentValues.vram_used_gb, 1);
    this.updateText(this.dom.vram_total_gb, this.currentValues.vram_total_gb, 1);
    this.updateTextWithSuffix(this.dom.vram_used_percent, this.currentValues.vram_used_percent, 0, '%');
    this.updateBar(null, this.dom.vram_used_percent_bar, this.currentValues.vram_used_percent, 0, 100, 0);

    this.updateBar(this.dom.gpu_clock, this.dom.gpu_clock_bar, this.currentValues.gpu_clock, 0, 3000, 0);
    this.updateBar(this.dom.gpu_power, this.dom.gpu_power_bar, this.currentValues.gpu_power, 0, 450, 0);

    // Front Face Micro Telemetry Strip
    this.updateText(this.dom.vram_temp_strip, this.currentValues.vram_temp, 0);
    this.updateText(this.dom.vram_speed_strip, this.currentValues.vram_speed_mhz, 0);
    this.updateText(this.dom.gpu_fan_strip, this.currentValues.gpu_fan_rpm, 0);
    this.updateText(this.dom.gpu_voltage_strip, this.currentValues.gpu_voltage_mv, 0);

    // Back Face Deep Telemetry
    this.updateTile(this.dom.gpu_hotspot_back, this.dom.gpu_hotspot_bar, hotspot, 0, 110, 0, 90);
    this.updateTile(this.dom.vram_temp, this.dom.vram_temp_bar, this.currentValues.vram_temp, 0, 110, 0, 90);
    this.updateTile(this.dom.vram_speed_mhz, this.dom.vram_speed_bar, this.currentValues.vram_speed_mhz, 0, 25000, 0);
    this.updateTile(this.dom.gpu_fan_rpm, this.dom.gpu_fan_rpm_bar, this.currentValues.gpu_fan_rpm, 0, 3500, 0);
    this.updateTile(this.dom.gpu_voltage_mv, this.dom.gpu_voltage_bar, this.currentValues.gpu_voltage_mv, 500, 1250, 0);
    this.updateTile(this.dom.gpu_power_back, this.dom.gpu_power_bar_back, this.currentValues.gpu_power, 0, 450, 0);

    // Critical Thermal Alarm Evaluation (Hysteresis & Hold Time)
    this.updateThermalAlarm(temp, hotspot);
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
        component: 'gpu', 
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

  updateTextWithSuffix(element, value, decimals, suffix = '') {
    if (!element) return;
    const text = (value === null || value === undefined) ? '--' : 
                 `${decimals > 0 ? value.toFixed(decimals) : Math.round(value).toString()}${suffix}`;
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

  updateTile(textEl, barEl, value, min, max, decimals, warnThreshold = null) {
    if (textEl) {
      this.updateText(textEl, value, decimals);
      if (warnThreshold !== null && value !== null && value >= warnThreshold) {
        textEl.style.color = '#FF4D4D';
      } else if (textEl.style.color) {
        textEl.style.color = '';
      }
    }
    if (!barEl) return;

    if (value === null || value === undefined) {
      if (barEl.style.width !== '0%') {
        barEl.style.width = '0%';
      }
      return;
    }

    const ratio = Math.min(1, Math.max(0, (value - min) / (max - min)));
    const percent = Math.round(ratio * 100);
    const widthStr = `${percent}%`;

    if (barEl.style.width !== widthStr) {
      barEl.style.width = widthStr;
    }

    if (warnThreshold !== null && value >= warnThreshold) {
      barEl.style.background = '#EF4444';
      barEl.style.boxShadow = '0 0 8px rgba(239, 68, 68, 0.6)';
    } else if (barEl.style.background && barEl.style.background.includes('rgb(239')) {
      barEl.style.background = '';
      barEl.style.boxShadow = '';
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

customElements.define('dashboard-gpu', DashboardGPU);
