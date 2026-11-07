import { renderSonarPanel } from './sonar-panel.js?v=20261103.audio11';
import { displayReadings } from './av-readings.js?v=20261103.av1';
import { broadcastView, playingPrograms } from './broadcast-view.js?v=20261103.audio11';
import { animationAlpha, connectFlipFaces, updateTelemetryStatus, updateText } from './component-utils.js?v=20261007.3';
import { EventBus } from '../store/event_bus.js?v=20261007.3';

const template = document.createElement('template');
template.innerHTML = `
<style>
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
    transition: transform 0.65s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  :host(.flipped) .card-flipper {
    transform: rotateY(180deg);
  }

  .card-face {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    padding: 10px 14px;
    box-sizing: border-box;
    -webkit-backface-visibility: hidden;
    backface-visibility: hidden;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 8px;
    overflow: hidden;
  }

  .card-front {
    transform: rotateY(0deg);
    z-index: 2;
  }

  .card-back {
    transform: rotateY(180deg);
    z-index: 1;
    background: rgba(10, 15, 30, 0.94);
    border-radius: var(--glass-radius, 20px);
  }

  /* Card Header */
  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
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
    width: 32px;
    height: 32px;
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .display-icon {
    color: var(--neon-cyan, #22D3EE);
    box-shadow: 0 0 10px rgba(34, 211, 238, 0.2);
  }

  .card-title {
    font-family: var(--font-arabic, 'Cairo', sans-serif);
    font-size: 24px;
    font-weight: 800;
    color: var(--text-pure-white, #FFFFFF);
    line-height: 1.2;
    margin: 0;
    letter-spacing: 0.2px;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
  }

  .card-sub {
    font-family: var(--font-numbers, monospace);
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 1px;
    color: #94A3B8;
  }

  .flip-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(34, 211, 238, 0.3);
    border-radius: 20px;
    padding: 4px 14px;
    color: #F1F5F9;
    font-family: var(--font-arabic, 'Cairo', sans-serif);
    font-size: 14px;
    font-weight: 800;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    white-space: nowrap;
    user-select: none;
  }

  .flip-btn:hover {
    background: rgba(34, 211, 238, 0.15);
    border-color: var(--neon-cyan, #22D3EE);
    color: #FFFFFF;
    box-shadow: 0 0 12px rgba(34, 211, 238, 0.4);
    transform: translateY(-1px);
  }

  .flip-btn.btn-back {
    border-color: rgba(124, 92, 255, 0.4);
  }

  .flip-btn.btn-back:hover {
    background: rgba(124, 92, 255, 0.2);
    border-color: var(--neon-violet, #7C5CFF);
    box-shadow: 0 0 12px rgba(124, 92, 255, 0.4);
  }

  /* Operational Wings (Front Face Split) */
  .operational-wings {
    display: grid;
    grid-template-columns: 1fr 1.22fr;
    gap: 12px;
    flex: 1;
    align-items: stretch;
    min-height: 0;
  }

  .wing {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    padding: 8px 10px;
    box-sizing: border-box;
    transition: border-color 0.2s ease, background 0.2s ease;
  }

  .wing:hover {
    background: rgba(255, 255, 255, 0.035);
    border-color: rgba(255, 255, 255, 0.09);
  }

  .wing-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }

  .wing-tag {
    font-family: var(--font-arabic, 'Cairo', sans-serif);
    font-size: 17px;
    font-weight: 800;
    color: var(--text-pure-white, #FFFFFF);
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .wing-status {
    font-family: var(--font-numbers, monospace);
    font-size: 11px;
    font-weight: 700;
    color: var(--text-muted, #94A3B8);
    letter-spacing: 0.5px;
  }

  /* Left Wing: Display & Gaming Hub */
  .display-hub-content {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
    justify-content: space-between;
  }

  .fps-hero-capsule {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 14px;
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(6, 182, 212, 0.05));
    border: 1px solid rgba(16, 185, 129, 0.25);
    border-radius: 10px;
    box-shadow: inset 0 0 12px rgba(16, 185, 129, 0.08);
  }

  .fps-label-row {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .fps-label {
    font-family: var(--font-arabic, 'Cairo', sans-serif);
    font-size: 19px;
    font-weight: 800;
    color: var(--text-pure-white, #FFFFFF);
  }

  .fps-status-live {
    font-family: var(--font-numbers, monospace);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.8px;
    color: var(--neon-green, #10B981);
  }

  .fps-val-row {
    display: flex;
    align-items: baseline;
    gap: 5px;
    direction: ltr;
  }

  .fps-num {
    font-family: var(--font-numbers, 'Orbitron', monospace);
    font-size: 48px;
    font-weight: 900;
    color: var(--neon-green, #10B981);
    line-height: 1;
    text-shadow: 0 0 20px rgba(16, 185, 129, 0.5);
    font-variant-numeric: tabular-nums;
  }

  .fps-unit {
    font-family: var(--font-display, sans-serif);
    font-size: 20px;
    font-weight: 800;
    color: var(--neon-green, #10B981);
  }

  .display-triad-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 5px;
  }

  .telemetry-pill {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 5px 10px;
    background: rgba(255, 255, 255, 0.025);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
  }

  .telemetry-pill.res-pill {
    grid-column: span 2;
  }

  .pill-info {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .pill-icon {
    font-size: 15px;
  }

  .pill-label {
    font-family: var(--font-arabic, 'Cairo', sans-serif);
    font-size: 16px;
    font-weight: 800;
    color: #F8FAFC;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }

  .pill-val-group {
    display: flex;
    align-items: baseline;
    gap: 3px;
    direction: ltr;
  }

  .pill-val {
    font-family: var(--font-numbers, monospace);
    font-size: 22px;
    font-weight: 800;
    color: var(--text-pure-white, #FFFFFF);
    font-variant-numeric: tabular-nums;
  }

  .pill-unit {
    font-family: var(--font-display, sans-serif);
    font-size: 15px;
    font-weight: 700;
    color: var(--neon-cyan, #22D3EE);
  }

  .res-val {
    font-size: 16px;
    font-weight: 800;
    letter-spacing: 0.5px;
    color: #E2E8F0;
  }

  /* Right Wing: Audio & Sonar Mixer Hub */
  .audio-hub-content {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
    justify-content: space-between;
  }

  /* Live Mic Status Badge */
  .mic-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 10px;
    border-radius: 6px;
    font-family: var(--font-arabic, 'Cairo', sans-serif);
    font-size: 15px;
    font-weight: 800;
    transition: all 0.3s ease;
  }

  .mic-live {
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.45);
    color: #34D399;
    box-shadow: 0 0 10px rgba(16, 185, 129, 0.25);
  }

  .mic-muted {
    background: rgba(239, 68, 68, 0.2);
    border: 1px solid rgba(239, 68, 68, 0.55);
    color: #F87171;
    box-shadow: 0 0 10px rgba(239, 68, 68, 0.3);
  }

  .mic-dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    display: inline-block;
    flex-shrink: 0;
  }

  .mic-live .mic-dot {
    background: #10B981;
    box-shadow: 0 0 6px #10B981;
    animation: mic-pulse 1.8s infinite ease-in-out;
  }

  .mic-muted .mic-dot {
    background: #EF4444;
    box-shadow: 0 0 6px #EF4444;
  }

  @keyframes mic-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.35; transform: scale(0.85); }
  }

  /* Master Audio Box */
  .master-audio-box {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 5px 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 8px;
  }

  .master-audio-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .master-title-group {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .master-icon {
    font-size: 18px;
  }

  .master-label {
    font-family: var(--font-arabic, 'Cairo', sans-serif);
    font-size: 18px;
    font-weight: 800;
    color: var(--text-pure-white, #FFFFFF);
  }

  .master-val-group {
    display: flex;
    align-items: baseline;
    gap: 3px;
    direction: ltr;
  }

  .master-val {
    font-family: var(--font-numbers, monospace);
    font-size: 40px;
    font-weight: 900;
    color: var(--text-pure-white, #FFFFFF);
    font-variant-numeric: tabular-nums;
    line-height: 1;
    text-shadow: 0 0 16px rgba(248, 250, 255, 0.25);
  }

  .master-unit {
    font-family: var(--font-display, sans-serif);
    font-size: 18px;
    font-weight: 700;
    color: var(--neon-cyan, #22D3EE);
  }

  .master-track {
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.08);
    overflow: hidden;
    margin-top: 2px;
  }

  /* 4 Sonar Virtual Channels Quad */
  .sonar-channels-quad {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .channel-card {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 4px 8px;
    background: rgba(255, 255, 255, 0.025);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 6px;
  }

  .channel-header-mini {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .ch-left {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .ch-icon {
    font-size: 14px;
  }

  .ch-name {
    font-family: var(--font-arabic, 'Cairo', sans-serif);
    font-size: 14px;
    font-weight: 800;
    color: #E2E8F0;
  }

  .ch-val {
    font-family: var(--font-numbers, monospace);
    font-size: 16px;
    font-weight: 800;
    color: #FFFFFF;
    font-variant-numeric: tabular-nums;
  }

  .ch-track {
    width: 100%;
    height: 5px;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.06);
    overflow: hidden;
  }

  .channel-fill {
    height: 100%;
    width: 0%;
    border-radius: 2px;
    transition: width 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .fill-master {
    background: linear-gradient(90deg, var(--neon-cyan, #22D3EE), var(--neon-violet, #7C5CFF));
    box-shadow: 0 0 8px rgba(34, 211, 238, 0.4);
  }

  .fill-game {
    background: linear-gradient(90deg, #22D3EE, #06B6D4);
    box-shadow: 0 0 6px rgba(34, 211, 238, 0.4);
  }

  .fill-chat {
    background: linear-gradient(90deg, #10B981, #059669);
    box-shadow: 0 0 6px rgba(16, 185, 129, 0.4);
  }

  .fill-media {
    background: linear-gradient(90deg, #EC4899, #DB2777);
    box-shadow: 0 0 6px rgba(236, 72, 153, 0.4);
  }

  .fill-aux {
    background: linear-gradient(90deg, #3B82F6, #2563EB);
    box-shadow: 0 0 6px rgba(59, 130, 246, 0.4);
  }

  .channel-fill.muted-fill {
    background: #64748B !important;
    box-shadow: none !important;
  }

  /* Keep both Sonar paths inside the fixed kiosk card. */
  .wing { min-height: 0; overflow: hidden; }
  .audio-hub-content { min-height: 0; overflow: auto; }
  .wing-audio .sonar-note { display: none; }
  .wing-audio .sonar-mode { font-size: 10px; line-height: 1; margin-bottom: 5px; }
  .wing-audio .sonar-channel { padding: 4px 6px; }
  .wing-audio .sonar-channel b { font-size: 11px; line-height: 1.1; margin-bottom: 3px; }
  .wing-audio .sonar-level { line-height: 1.1; font-size: 10px; }
  .wing-audio .sonar-level strong { font-size: 13px; line-height: 1.1; }

  /* Bottom Strip */
  .bottom-media-strip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 10px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    flex-shrink: 0;
  }

  .strip-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .spectrum-visualizer {
    display: flex;
    align-items: flex-end;
    gap: 3px;
    height: 16px;
    padding-bottom: 1px;
  }

  .spectrum-bar {
    width: 3px;
    border-radius: 2px;
    background: var(--neon-cyan, #22D3EE);
    animation: eq-bounce 1.2s ease-in-out infinite alternate;
  }

  .sb-1 { height: 35%; animation-delay: 0.1s; background: #22D3EE; }
  .sb-2 { height: 80%; animation-delay: 0.3s; background: #06B6D4; }
  .sb-3 { height: 55%; animation-delay: 0.5s; background: #10B981; }
  .sb-4 { height: 95%; animation-delay: 0.2s; background: #34D399; }
  .sb-5 { height: 70%; animation-delay: 0.4s; background: #EC4899; }
  .sb-6 { height: 45%; animation-delay: 0.6s; background: #F43F5E; }
  .sb-7 { height: 85%; animation-delay: 0.15s; background: #8B5CF6; }
  .sb-8 { height: 60%; animation-delay: 0.35s; background: #3B82F6; }

  @keyframes eq-bounce {
    0% { transform: scaleY(0.25); }
    50% { transform: scaleY(1); }
    100% { transform: scaleY(0.35); }
  }

  .strip-media-meta {
    display: flex;
    flex-direction: column;
    line-height: 1.15;
  }

  .strip-media-title {
    font-family: var(--font-arabic, 'Cairo', sans-serif);
    font-size: 14px;
    font-weight: 800;
    color: #F1F5F9;
  }

  .strip-media-desc {
    font-family: var(--font-numbers, monospace);
    font-size: 11px;
    font-weight: 700;
    color: #94A3B8;
  }

  .sonar-status-pill {
    font-size: 13px;
    font-family: var(--font-numbers, monospace);
    font-weight: 800;
    padding: 3px 10px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #94A3B8;
    transition: all 0.2s ease;
  }

  .sonar-status-pill.connected {
    color: var(--neon-cyan, #22D3EE);
    border-color: rgba(34, 211, 238, 0.4);
    background: rgba(34, 211, 238, 0.08);
    box-shadow: 0 0 8px rgba(34, 211, 238, 0.2);
  }

  /* Back Face (A/V Studio Lab) */
  .back-sections-grid {
    overflow-y: auto;
    scrollbar-width: thin;
    align-items: start;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    flex: 1;
    min-height: 0;
  }

  .studio-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
    justify-content: space-between;
  }

  .section-title-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 4px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  }

  .sec-title-left {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .sec-icon {
    font-size: 16px;
  }

  .sec-heading {
    font-family: var(--font-arabic, 'Cairo', sans-serif);
    font-size: 16px;
    font-weight: 800;
    color: #F8FAFC;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }

  .sec-badge {
    font-family: var(--font-numbers, monospace);
    font-size: 11px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.05);
    color: #94A3B8;
  }

  .studio-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 5px 10px;
    background: rgba(255, 255, 255, 0.025);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 8px;
  }

  .studio-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .card-label-group {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .card-emoji {
    font-size: 14px;
  }

  .card-primary-label {
    font-family: var(--font-arabic, 'Cairo', sans-serif);
    font-size: 15px;
    font-weight: 800;
    color: #F8FAFC;
  }

  .status-badge-green {
    font-family: var(--font-arabic, 'Cairo', sans-serif);
    font-size: 12px;
    font-weight: 800;
    padding: 2px 7px;
    border-radius: 4px;
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.4);
    color: #34D399;
  }

  .status-badge-cyan {
    font-family: var(--font-numbers, monospace);
    font-size: 12px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 4px;
    background: rgba(34, 211, 238, 0.12);
    border: 1px solid rgba(34, 211, 238, 0.35);
    color: var(--neon-cyan, #22D3EE);
  }

  .status-badge-purple {
    font-family: var(--font-numbers, monospace);
    font-size: 12px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 4px;
    background: rgba(124, 92, 255, 0.15);
    border: 1px solid rgba(124, 92, 255, 0.4);
    color: #A78BFA;
  }

  .matrix-status {
    font-family: var(--font-numbers, monospace);
    font-size: 11px;
    font-weight: 700;
    color: #64748B;
  }

  .ai-meter-track {
    width: 100%;
    height: 4px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 2px;
    overflow: hidden;
  }

  .ai-meter-fill {
    height: 100%;
    background: linear-gradient(90deg, #10B981, #22D3EE);
    box-shadow: 0 0 6px rgba(16, 185, 129, 0.4);
    border-radius: 2px;
  }

  .studio-card-caption {
    font-family: var(--font-arabic, 'Cairo', sans-serif);
    font-size: 10px;
    color: #94A3B8;
    line-height: 1.2;
  }

  /* EQ Presets Row */
  .eq-presets-row {
    display: flex;
    align-items: center;
    gap: 5px;
    flex-wrap: nowrap;
  }

  .eq-pill {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    padding: 3px 4px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 6px;
    text-align: center;
    transition: all 0.2s ease;
  }

  .eq-pill.active {
    background: rgba(34, 211, 238, 0.1);
    border-color: var(--neon-cyan, #22D3EE);
    box-shadow: 0 0 8px rgba(34, 211, 238, 0.2);
  }

  .eq-pill-name {
    font-family: var(--font-numbers, sans-serif);
    font-size: 13px;
    font-weight: 800;
    color: #F8FAFC;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .eq-pill-type {
    font-family: var(--font-arabic, 'Cairo', sans-serif);
    font-size: 11px;
    font-weight: 700;
    color: #94A3B8;
  }

  .eq-pill.active .eq-pill-type {
    color: var(--neon-cyan, #22D3EE);
  }

  /* Routing Grid */
  .routing-details-grid {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .routing-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 13px;
    line-height: 1.25;
  }

  .route-label {
    font-family: var(--font-arabic, 'Cairo', sans-serif);
    color: #94A3B8;
    font-weight: 800;
  }

  .route-val {
    font-family: var(--font-numbers, sans-serif);
    font-size: 13px;
    font-weight: 800;
    color: #E2E8F0;
    direction: ltr;
  }

  /* Video Specs Pills */
  .specs-pills-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4px;
  }

  .spec-pill {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 3px 4px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 6px;
    text-align: center;
  }

  .spec-prop {
    font-family: var(--font-arabic, 'Cairo', sans-serif);
    font-size: 12px;
    font-weight: 700;
    color: #94A3B8;
  }

  .spec-data {
    font-family: var(--font-numbers, sans-serif);
    font-size: 13px;
    font-weight: 800;
    color: #F8FAFC;
    white-space: nowrap;
  }

  /* Dynamics Grid */
  .dynamics-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4px;
  }

  .dynamic-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 3px 4px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 6px;
    text-align: center;
  }

  .dyn-label {
    font-family: var(--font-arabic, 'Cairo', sans-serif);
    font-size: 12px;
    font-weight: 700;
    color: #94A3B8;
  }

  .dyn-val {
    font-family: var(--font-numbers, monospace);
    font-size: 15px;
    font-weight: 900;
    color: #FFFFFF;
    margin: 1px 0;
  }

  .dyn-highlight {
    color: #34D399;
  }

  .dyn-cyan {
    color: var(--neon-cyan, #22D3EE);
  }

  .dyn-green {
    color: var(--neon-green, #10B981);
  }

  .dyn-sub {
    font-family: var(--font-numbers, monospace);
    font-size: 10px;
    font-weight: 700;
    color: #64748B;
  }

  /* Bandwidth Meter */
  .bandwidth-meter-box {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .bw-info-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 13px;
  }

  .bw-port {
    font-family: var(--font-numbers, sans-serif);
    color: #E2E8F0;
    font-weight: 800;
    font-size: 13px;
  }

  .bw-speed {
    font-family: var(--font-numbers, monospace);
    color: var(--neon-cyan, #22D3EE);
    font-weight: 800;
    font-size: 13px;
  }

  .bw-track {
    width: 100%;
    height: 4px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 2px;
    overflow: hidden;
  }

  .bw-fill {
    height: 100%;
    background: linear-gradient(90deg, #3B82F6, #22D3EE);
    box-shadow: 0 0 6px rgba(34, 211, 238, 0.35);
    border-radius: 2px;
  }

  .bw-caption {
    font-family: var(--font-arabic, 'Cairo', sans-serif);
    font-size: 9px;
    color: #94A3B8;
    line-height: 1.2;
  }

  .studio-footer-hint {
    font-family: var(--font-arabic, 'Cairo', sans-serif);
    font-size: 11px;
    color: #64748B;
    text-align: center;
    margin-top: 2px;
    flex-shrink: 0;
  }

  .mic-live, .sonar-status-pill.connected, .status-badge-green { color: var(--status-normal); background: var(--status-surface); border-color: currentColor; }
  .mic-muted { color: var(--status-critical); background: var(--status-surface); border-color: currentColor; }
  .mic-live .mic-dot, .mic-muted .mic-dot { background: currentColor; }
  .card-back .sonar-live{line-height:1.1}
  .card-back .sonar-mode{font-size:10px;line-height:1.1;margin-bottom:5px}
  .card-back .sonar-channel{padding:5px 7px}
  .card-back .sonar-channel b{line-height:1;margin-bottom:4px}
  .card-back .sonar-level,.card-back .sonar-level strong{line-height:1.1}
  .card-back .sonar-note{line-height:1.2}

  /* A/V card only: keep the existing surfaces, accents and dimensions. */
  .quick-audio { gap:8px; overflow:hidden; box-shadow:none; justify-content:center; }
  .quick-signal { padding:8px 10px; border:1px solid var(--border-glass,rgba(255,255,255,.08)); border-radius:8px; background:rgba(255,255,255,.025); }
  .quick-heading { display:flex; justify-content:space-between; align-items:center; gap:8px; font-size:15px; line-height:1.5; }
  .quick-heading span { font-size:13px; color:var(--text-secondary,#94a3b8); white-space:nowrap; }
  .quick-device { font-size:12px; line-height:1.7; color:var(--text-secondary,#94a3b8); overflow:hidden; white-space:nowrap; text-overflow:ellipsis; margin:3px 0; }
  .quick-legend,.diagnostic-note { color:var(--text-secondary,#94a3b8); font-size:11px; line-height:1.6; margin:0; }
  .diagnostic-row { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:7px 0; border-bottom:1px solid rgba(255,255,255,.06); font-size:12px; }
  .diagnostic-row b { direction:ltr; font:700 13px var(--font-numbers,monospace); }
  .unavailable-summary { padding:8px 10px; border:1px solid var(--border-glass,rgba(255,255,255,.08)); border-radius:8px; font-size:12px; color:var(--text-secondary,#94a3b8); }
  .unavailable-summary summary { cursor:pointer; font-weight:700; }
  .unavailable-summary p { margin:6px 0 0; line-height:1.7; }
  .flip-btn:focus-visible,summary:focus-visible { outline:2px solid var(--neon-cyan,#22d3ee); outline-offset:3px; }
  @media(prefers-reduced-motion:reduce) { .card-flipper { transition:none; } .mic-dot { animation:none; } }

  /* Front: four distinct audio roles, with display limited to measured FPS. */
  .operational-wings{grid-template-columns:minmax(145px,.22fr) minmax(0,1fr);gap:10px}
  .wing-display{justify-content:center;gap:10px}.wing-display .wing-header{justify-content:center;margin:0}
  .wing-display .wing-tag{font-size:14px}.wing-display .display-hub-content{justify-content:center;flex:0}
  .wing-display .fps-hero-capsule{flex-direction:column;justify-content:center;gap:20px;padding:15px 6px;min-height:155px}
  .wing-display .fps-label{font-size:14px;text-align:center}.wing-display .fps-status-live{text-align:center;font-size:10px}.wing-display .fps-num{font-size:42px}.wing-display .fps-unit{font-size:14px}
  .audio-overview{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:minmax(0,1fr) minmax(0,1fr);gap:9px;min-height:0}
  .audio-tile{--tile-accent:var(--neon-cyan,#22d3ee);min-width:0;min-height:0;border:1px solid var(--border-glass,rgba(255,255,255,.09));border-radius:12px;background:rgba(255,255,255,.025);padding:9px 11px;display:flex;flex-direction:column;gap:5px;overflow:hidden;box-sizing:border-box}
  .audio-tile-head{display:flex;align-items:center;gap:9px;min-width:0}.audio-symbol{display:grid;place-items:center;flex:0 0 46px;width:46px;height:46px;color:var(--tile-accent);border:1px solid color-mix(in srgb,var(--tile-accent) 35%,transparent);border-radius:10px;background:color-mix(in srgb,var(--tile-accent) 9%,transparent)}
  .audio-symbol svg{width:29px;height:29px;stroke:currentColor;stroke-width:1.8;fill:none;stroke-linecap:round;stroke-linejoin:round}
  .audio-tile-heading{min-width:0;flex:1}.audio-tile-heading b{display:block;font-size:20px;line-height:1.35;font-weight:800}.audio-tile-heading small{display:block;font-size:12px;color:var(--text-secondary,#94a3b8);line-height:1.4}
  .audio-gain{font:800 32px var(--font-numbers,monospace);direction:ltr;white-space:nowrap;color:var(--tile-accent)}
  .audio-tile-state{display:flex;align-items:center;gap:6px;font-size:15px;font-weight:700;line-height:1.3;color:var(--text-secondary,#94a3b8)}
  .audio-tile-state::before{content:'';width:6px;height:6px;flex:0 0 6px;border-radius:50%;background:currentColor}
  .audio-tile[data-state="live"] .audio-tile-state{color:var(--status-normal,#00e6aa)}.audio-tile[data-state="muted"] .audio-tile-state{color:var(--status-critical,#ff6275)}
  .audio-device{font-size:17px;font-weight:700;line-height:1.35;color:var(--text-primary,#f1f5f9);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;direction:ltr;text-align:right}
  .audio-tile audio-signal-meter{margin-top:auto}.listening-tile{--tile-accent:var(--status-normal,#00e6aa)}.sources-tile{--tile-accent:var(--neon-yellow,#facc15);padding-top:7px;padding-bottom:7px}
  .playing-programs{display:flex;gap:10px;overflow-x:auto;align-items:center;min-height:64px;margin-top:auto;scrollbar-width:thin;overflow-y:hidden;font-size:14px;color:var(--text-secondary,#94a3b8)}
  .program-chip{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;flex:0 0 64px;min-width:64px;box-sizing:border-box;border:1px solid var(--border-glass,rgba(255,255,255,.1));border-radius:10px;background:rgba(255,255,255,.035);padding:2px 7px;color:var(--text-primary,#fff)}
  .program-chip[data-excluded="true"]{border-color:var(--text-secondary,#94a3b8)}
  .program-chip audio-signal-meter{width:44px;margin-top:1px;flex:0 0 6px}
  .logo-missing{font-size:10px;text-align:center;line-height:1.2;width:44px;height:44px;display:grid;place-items:center;color:var(--text-secondary,#94a3b8)}
  .broadcast-panel{--tile-accent:var(--neon-violet,#a78bfa)}.broadcast-label{font-size:15px;font-weight:800;line-height:1.35;color:var(--tile-accent)}
  .broadcast-panel[data-state="muted"] .broadcast-label,.broadcast-panel[data-state="blocked"] .broadcast-label{color:var(--status-critical,#ff6275)}.broadcast-panel[data-state="sending"] .broadcast-label{color:var(--status-normal,#00e6aa)}.broadcast-panel[data-state="unknown"] .broadcast-label{color:var(--status-warning,#ffc85a)}
  .broadcast-rail{height:5px;min-height:5px;border-radius:4px;background:rgba(255,255,255,.08);overflow:hidden;direction:ltr;margin-top:auto}.broadcast-rail i{display:block;height:100%;width:0;background:var(--tile-accent);transition:width .12s}.broadcast-panel[data-state="muted"] .broadcast-rail i{background:var(--status-critical,#ff6275)}
  .broadcast-detail{font-size:12px;line-height:1.35;color:var(--text-secondary,#94a3b8);overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
  .audio-symbol.rode-symbol{background:linear-gradient(145deg,#e7e4dc,#999a9a);overflow:hidden;position:relative}.rode-symbol img{width:40px;height:46px;object-fit:contain;display:block}.program-logo{width:42px;height:42px;object-fit:contain;display:block;flex:0 0 42px;filter:drop-shadow(0 1px 4px rgba(0,0,0,.25))}
  @media(max-height:800px){.audio-tile{padding:6px 8px;gap:3px}.audio-tile-heading b{font-size:18px}.audio-symbol{width:38px;height:38px;flex-basis:38px}.audio-symbol svg{width:26px;height:26px}.rode-symbol img{width:33px;height:38px}.audio-gain{font-size:28px}.audio-device{font-size:15px}}
</style>

<div class="card-flipper" id="flipper">
  <!-- FRONT FACE -->
  <div class="card-face card-front" aria-hidden="false">
    <div class="card-header">
      <div class="card-title-group">
        <div class="card-icon display-icon">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
            <rect x="2" y="3" width="20" height="14" rx="2"></rect>
            <line x1="8" y1="21" x2="16" y2="21"></line>
            <line x1="12" y1="17" x2="12" y2="21"></line>
          </svg>
        </div>
        <div>
          <h2 class="card-title">مركز الصوت والعرض المتقدم</h2>
          <span class="card-sub">A/V & MEDIA COMMAND HUD // STEELSERIES SONAR</span>
        </div>
      </div>
      <button class="flip-btn" id="flip-to-back" title="فتح استوديو الصوت والعرض المتقدم">
        <span>🎛️</span>
        <span>تفاصيل الصوت والعرض</span>
      </button>
    </div>

    <div class="operational-wings">
      <section class="wing wing-display" aria-label="الإطارات المقاسة">
        <div class="wing-header"><span class="wing-tag">🎮 الإطارات</span></div>
        <div class="display-hub-content">
          <div class="fps-hero-capsule" title="معدل الإطارات المقاس من المصدر">
            <div class="fps-label-row"><span class="fps-label">معدل الإطارات المقاس</span><span class="fps-status-live" id="fps-source">المصدر غير متاح</span></div>
            <div class="fps-val-row" dir="ltr"><span class="fps-num" id="fps">--</span><span class="fps-unit">FPS</span></div>
          </div>
        </div>
      </section>
      <div class="audio-overview">
        <section class="audio-tile mic-tile" id="mic-overview" data-state="unknown" aria-label="الميكروفون">
          <div class="audio-tile-head"><span class="audio-symbol rode-symbol"><img src="/assets/audio/rode-podmic-usb.webp" alt="RØDE PodMic USB" width="40" height="46"></span><div class="audio-tile-heading"><b>الميكروفون</b><small>صوتك · مستقل عن بث البرامج</small></div><strong class="audio-gain" id="quick-mic-gain" title="ضبط قناة المايك في Sonar">—</strong></div>
          <div class="audio-tile-state" id="mic-overview-status">الحالة غير متاحة</div>
          <div class="audio-device" id="quick-input-device">مصدر المايك غير متاح</div>
          <audio-signal-meter data-quick-mic route="input" signal-only></audio-signal-meter>
        </section>
        <section class="audio-tile listening-tile" id="listening-overview" data-state="unknown" aria-label="صوت سماعك الشخصي">
          <div class="audio-tile-head"><span class="audio-symbol" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 14v-3a9 9 0 0 1 18 0v3"/><rect x="3" y="12" width="4" height="9" rx="2"/><rect x="17" y="12" width="4" height="9" rx="2"/></svg></span><div class="audio-tile-heading"><b>صوت سماعك</b><small>المخرج الذي تستمع منه الآن</small></div><strong class="audio-gain" id="quick-master-gain" title="ضبط مستوى الاستماع في Sonar">—</strong></div>
          <div class="audio-tile-state" id="listening-overview-status">الحالة غير متاحة</div>
          <div class="audio-device" id="quick-output-device">مخرج الاستماع غير متاح</div>
          <audio-signal-meter route="monitoring" signal-only></audio-signal-meter>
        </section>
        <section class="audio-tile sources-tile" aria-label="مصادر الصوت النشطة">
          <div class="audio-tile-head"><span class="audio-symbol" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 10v4M7 6v12M12 2v20M17 6v12M21 10v4"/></svg></span><div class="audio-tile-heading"><b>الصوت يأتي من</b><small>شعار البرنامج · قوة الإشارة الآن</small></div></div>
          <div id="playing-programs" class="playing-programs" aria-live="polite">جارٍ قراءة البرامج…</div>
        </section>
        <section class="audio-tile broadcast-panel" id="broadcast-panel" data-state="unknown" aria-label="بث صوت البرامج إلى Discord">
          <div class="audio-tile-head"><span class="audio-symbol" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="10" r="2"/><path d="M8.5 6.5a5 5 0 0 0 0 7M15.5 6.5a5 5 0 0 1 0 7M5 3a10 10 0 0 0 0 14M19 3a10 10 0 0 1 0 14M12 12v10M8 22h8"/></svg></span><div class="audio-tile-heading"><b>بث البرامج</b><small>إلى Discord · العجلة الثانية</small></div><strong class="audio-gain" id="broadcast-percent">—</strong></div>
          <div id="broadcast-label" class="broadcast-label" role="status">حالة البث غير متاحة</div>
          <div class="broadcast-detail" id="broadcast-detail">Discord مستثنى · المايك مستقل</div>
          <div class="broadcast-rail" role="meter" aria-label="مستوى بث البرامج فقط" aria-valuemin="0" aria-valuemax="100"><i id="broadcast-fill"></i></div>
        </section>
      </div>
    </div>
  </div>

  <!-- BACK FACE (3D Flip Studio Card) -->
  <div class="card-face card-back" inert aria-hidden="true">
    <div class="card-header">
      <div class="card-title-group">
        <div class="card-icon display-icon">
          <span style="font-size: 16px;">🎛️</span>
        </div>
        <div>
          <h2 class="card-title">استوديو الصوت ومحرك العرض المتقدم</h2>
          <span class="card-sub">SONAR PATHS / DISPLAY SOURCES</span>
        </div>
      </div>
      <button class="flip-btn btn-back" id="flip-to-front" title="العودة لشاشة القيادة">
        <span>↩️</span>
        <span>عودة</span>
      </button>
    </div>

    <div class="back-sections-grid" tabindex="0" role="region" aria-label="تفاصيل الصوت والعرض، قابلة للتمرير">
      <!-- Section A: Sonar AI Studio -->
      <div class="studio-section studio-audio">
        <div class="section-title-bar">
          <div class="sec-title-left">
            <span class="sec-icon">🎙️</span>
            <span class="sec-heading">مسارات Sonar الحية</span>
          </div>
          <span class="sec-badge">SONAR AI</span>
        </div>

        <div class="studio-card"><div data-sonar-back-panel></div></div>
        <details class="unavailable-summary"><summary>خصائص صوت غير مقاسة</summary><p>ClearCast AI والصوت المحيطي والبروفايلات غير متاحة من المصدر الحالي. لا تدل هذه الحالة على أنها متوقفة.</p></details>
      </div>

      <!-- Section B: Display Pipeline Lab -->
      <div class="studio-section studio-display">
        <div class="section-title-bar">
          <div class="sec-title-left">
            <span class="sec-icon">🖥️</span>
            <span class="sec-heading">قياسات العرض ومعلومات المصدر</span>
          </div>
          <span class="sec-badge">VIDEO LAB</span>
        </div>

        <div class="studio-card av-diagnostics">
          <div class="diagnostic-row"><span>مصدر FPS</span><b id="back-fps-source">غير متاح</b></div>
          <div class="diagnostic-row"><span>الإطارات المقاسة</span><b id="back-fps">—</b></div>
          <div class="diagnostic-row"><span>تردد شاشة المصدر</span><b id="back-hz">—</b></div>
          <div class="diagnostic-row"><span>دقة شاشة المصدر</span><b id="back-res">—</b></div>
          <div class="diagnostic-row"><span>زمن الإطار</span><b id="back-frametime-val">— ms</b></div>
          <div class="diagnostic-note" id="back-frametime-source">غير متاح</div>
          <p class="diagnostic-note">زمن الإطار المحسوب = 1000 ÷ FPS؛ ليس قياسًا لتأخير الاستجابة أو انتظام الإطارات.</p>
        </div>
        <details class="unavailable-summary"><summary>خصائص عرض غير مقاسة</summary><p>HDR وVRR وعمق الألوان والنطاق اللوني و1% Low وواجهة التوصيل وعرض النطاق: لا تتوفر لها قياسات موثوقة حاليًا.</p></details>
      </div>
    </div>
  </div>
</div>
`;

export class DashboardDisplay extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.dom = {
      flipper: this.shadowRoot.getElementById('flipper'),
      flipToBack: this.shadowRoot.getElementById('flip-to-back'),
      flipToFront: this.shadowRoot.getElementById('flip-to-front'),
      fps: this.shadowRoot.getElementById('fps'),
      hz: this.shadowRoot.getElementById('display_hz'),
      volume: this.shadowRoot.getElementById('display_volume'),
      masterVolIcon: this.shadowRoot.getElementById('master-vol-icon'),
      res: this.shadowRoot.getElementById('display_res'),
      frametime: this.shadowRoot.getElementById('frametime_ms'),
      backFrametime: this.shadowRoot.getElementById('back-frametime-val'),
      frametimeSource: this.shadowRoot.getElementById('frametime-source'),
      backFrametimeSource: this.shadowRoot.getElementById('back-frametime-source'),
      sonarPill: this.shadowRoot.getElementById('sonar-pill'),
      micBadge: this.shadowRoot.getElementById('mic-status-badge'),
      micText: this.shadowRoot.getElementById('mic-status-text'),

      // Sonar Mixer channels
      barMaster: this.shadowRoot.getElementById('mixer-bar-master'),
      barGame: this.shadowRoot.getElementById('mixer-bar-game'),
      valGame: this.shadowRoot.getElementById('mixer-val-game'),
      barChat: this.shadowRoot.getElementById('mixer-bar-chat'),
      valChat: this.shadowRoot.getElementById('mixer-val-chat'),
      barMedia: this.shadowRoot.getElementById('mixer-bar-media'),
      valMedia: this.shadowRoot.getElementById('mixer-val-media'),
      barAux: this.shadowRoot.getElementById('mixer-bar-aux'),
      valAux: this.shadowRoot.getElementById('mixer-val-aux'),
    };

    this.targetValues = {
      fps: null,
      display_hz: null,
      display_volume: null,
      frametime_ms: null,
      system_volume: null,
      display_res: null,
      sonar_connected: false,
      audio_mic_muted: null,
      audio_mic_volume: null,
      audio_master_volume: null,
      audio_master_muted: false,
      audio_game_volume: null,
      audio_game_muted: false,
      audio_chat_volume: null,
      audio_chat_muted: false,
      audio_media_volume: null,
      audio_media_muted: false,
      audio_aux_volume: null,
      audio_aux_muted: false,
    };

    this.currentValues = {
      fps: null,
      display_hz: null,
      display_volume: null,
      frametime_ms: null,
    };

    this.onStateChange = this.onStateChange.bind(this);
    this.toggleFlip = this.toggleFlip.bind(this);
    this.tick = this.tick.bind(this);
    this.handleFlipBtnClick = this.handleFlipBtnClick.bind(this);
    this.handleCardClick = this.handleCardClick.bind(this);
    this.isRunning = false;
  }

  connectedCallback() {
    if (this.isRunning) return;
    this.previousTimestamp = null;
    this.events?.abort();
    this.events = new AbortController();
    connectFlipFaces(this);
    this.unsubscribe = EventBus.on('state-changed', this.onStateChange);
    this.onStateChange(window.stateManager?.currentState || {});
    this.updateMicBadge(this.targetValues.audio_mic_muted);
    this.updateSonarPill(this.targetValues.sonar_connected);


    // Flip interaction
    if (this.dom.flipToBack) {
      this.dom.flipToBack.addEventListener('click', this.handleFlipBtnClick, { signal: this.events.signal });
    }
    if (this.dom.flipToFront) {
      this.dom.flipToFront.addEventListener('click', this.handleFlipBtnClick, { signal: this.events.signal });
    }

    EventBus.on('audio-levels', sample => { this.audioSample = sample; this.updateQuickAudio(); this.updateBroadcastView(); }, { signal: this.events.signal });
    EventBus.on('audio-meter:source', () => this.updateQuickAudio(), { signal: this.events.signal });

    this.isRunning = true;
    this.rafId = requestAnimationFrame(this.tick);
  }

  disconnectedCallback() {
    cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.previousTimestamp = null;
    this.events?.abort();
    this.flipObserver?.disconnect();
    this.isRunning = false;
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    if (this.dom.flipToBack) {
      this.dom.flipToBack.removeEventListener('click', this.handleFlipBtnClick);
    }
    if (this.dom.flipToFront) {
      this.dom.flipToFront.removeEventListener('click', this.handleFlipBtnClick);
    }
    this.removeEventListener('click', this.handleCardClick);
  }

  handleFlipBtnClick(e) {
    if (e) e.stopPropagation();
    this.toggleFlip();
  }

  handleCardClick(e) {
    if(e.composedPath().some(node=>node.tagName==='AUDIO-SIGNAL-METER'||node.tagName==='SELECT'||node.tagName==='BUTTON'))return;
    this.toggleFlip();
  }

  toggleFlip() {
    this.classList.toggle('flipped');
  }

  onStateChange(delta) {
    if (!delta || typeof delta !== 'object') return;
    updateTelemetryStatus(this, delta, ['fps', 'display_hz', 'display_volume']);
    const state = this.telemetrySnapshot;
    const reading = displayReadings(state);
    this.displayReading = reading;
    this.targetValues.fps = reading.fps;
    if(reading.fps==null || this.currentValues.fps==null)this.currentValues.fps=reading.fps;
    if(this.dom.fps)this.dom.fps.title=reading.fps==null?'قراءة FPS غير متاحة':`قراءة المصدر: ${reading.fps} FPS`;
    this.targetValues.display_hz = this.currentValues.display_hz = reading.hz;
    this.frameTimeSource = reading.frameTimeSource;
    this.targetValues.frametime_ms = this.currentValues.frametime_ms = reading.frameTime;
    this.dataset.frameTimeSource = this.frameTimeSource;
    const sourceLabel = this.frameTimeSource === 'measured' ? 'مقاس من المصدر' : this.frameTimeSource === 'derived' ? 'متوسط نظري من FPS' : 'غير متاح';
    updateText(this.dom.frametimeSource, this.frameTimeSource === 'derived' ? 'زمن إطار نظري' : this.frameTimeSource === 'measured' ? 'زمن إطار مقاس' : 'زمن الإطار غير متاح');
    updateText(this.dom.backFrametimeSource, sourceLabel);
    updateText(this.shadowRoot.getElementById('fps-source'), reading.fps == null ? 'لا توجد قراءة FPS موثوقة' : `المصدر: ${reading.source}`);
    for (const [id, value] of Object.entries({'back-fps-source':reading.source || 'غير متاح','back-fps':reading.fps == null ? '—' : `${reading.fps} FPS`,'back-hz':reading.hz == null ? '—' : `${reading.hz} Hz`,'back-res':state.display_res || 'غير متاح'})) updateText(this.shadowRoot.getElementById(id),value);

    if ('display_volume' in delta) this.targetValues.system_volume = delta.display_volume;
    const master = state.audio_master_volume;
    this.targetValues.display_volume = master ?? null;
    if ('display_res' in delta && this.dom.res) {
      this.targetValues.display_res = delta.display_res;
      this.dom.res.textContent = delta.display_res ?? '--';
    }

    // Sonar connection status
    if (delta.sonar_connected !== undefined) {
      this.targetValues.sonar_connected = Boolean(delta.sonar_connected);
      this.updateSonarPill(this.targetValues.sonar_connected);
    }

    // Microphone status
    if (delta.audio_mic_muted !== undefined) {
      this.targetValues.audio_mic_muted = delta.audio_mic_muted;
      this.updateMicBadge(this.targetValues.audio_mic_muted);
    }
    if (delta.audio_mic_volume !== undefined) {
      this.targetValues.audio_mic_volume = delta.audio_mic_volume;
    }

    // Channel values
    if (delta.audio_master_volume !== undefined) this.targetValues.audio_master_volume = delta.audio_master_volume;
    if (delta.audio_master_muted !== undefined) this.targetValues.audio_master_muted = delta.audio_master_muted;
    if (delta.audio_game_volume !== undefined) this.targetValues.audio_game_volume = delta.audio_game_volume;
    if (delta.audio_game_muted !== undefined) this.targetValues.audio_game_muted = delta.audio_game_muted;
    if (delta.audio_chat_volume !== undefined) this.targetValues.audio_chat_volume = delta.audio_chat_volume;
    if (delta.audio_chat_muted !== undefined) this.targetValues.audio_chat_muted = delta.audio_chat_muted;
    if (delta.audio_media_volume !== undefined) this.targetValues.audio_media_volume = delta.audio_media_volume;
    if (delta.audio_media_muted !== undefined) this.targetValues.audio_media_muted = delta.audio_media_muted;
    if (delta.audio_aux_volume !== undefined) this.targetValues.audio_aux_volume = delta.audio_aux_volume;
    if (delta.audio_aux_muted !== undefined) this.targetValues.audio_aux_muted = delta.audio_aux_muted;

    this.renderMixerChannels();
    this.updateQuickAudio();
    this.updateBroadcastView();
    this.render();
  }

  updateSonarPill(connected) {
    if (!this.dom.sonarPill) return;
    if (connected) {
      this.dom.sonarPill.textContent = 'Sonar متصل';
      this.dom.sonarPill.className = 'sonar-status-pill connected';
    } else {
      this.dom.sonarPill.textContent = 'Sonar غير متاح';
      this.dom.sonarPill.className = 'sonar-status-pill';
    }
  }

  updateMicBadge(isMuted) {
    if (!this.dom.micBadge || !this.dom.micText) return;
    if (isMuted == null) {
      this.dom.micBadge.className = 'mic-badge';
      this.dom.micText.textContent = 'غير متاح';
    } else if (isMuted) {
      this.dom.micBadge.className = 'mic-badge mic-muted';
      this.dom.micText.textContent = 'مكتوم 🔇';
    } else {
      this.dom.micBadge.className = 'mic-badge mic-live';
      this.dom.micText.textContent = 'غير مكتوم 🟢';
    }
  }

  updateQuickAudio() {
    const state=this.telemetrySnapshot || {},sample=this.audioSample;
    const valid=sample && performance.now()-(sample.receivedAt ?? -Infinity)<(sample.maxAgeMs || 300) && state.telemetry_status!=='stale';
    const meta=state.sonar_source || state.telemetry_sources?.sonar;
    const age=meta?.observed_at ? Math.max(0,Date.now()/1000-meta.observed_at):null;
    const fresh=state.sonar_connected && !['stale','unavailable'].includes(meta?.status) && state.telemetry_status!=='stale' && (age==null || age<=2);
    const micRoute=this.shadowRoot.querySelector('[data-quick-mic]')?.route || 'input';
    for(const [id,route] of [['quick-output-device','monitoring'],['quick-input-device',micRoute]]) {
      const data=valid?sample.routes?.[route]:null;
      const fullLabel=data?.status==='live'?data.name:'مصدر الإشارة غير متاح';
      const label=fullLabel.replace(/^(?:Desktop Microphone|Microphone|Speakers|Headphones|Headset)\s*\((.*)\)$/i,'$1');
      const node=this.shadowRoot.getElementById(id);if(node){updateText(node,label);node.title=fullLabel;}
    }
    const micPath=state.sonar_mode==='stream'?'streaming':'classic',listenPath=state.sonar_mode==='stream'?'monitoring':'classic';
    const mic=fresh?state.sonar_channels?.mic?.[micPath]:null,listen=fresh?state.sonar_channels?.master?.[listenPath]:null;
    for(const [id,value] of [['quick-mic-gain',mic],['quick-master-gain',listen]])updateText(this.shadowRoot.getElementById(id),value?.volume==null?'—':`${Math.round(value.volume)}%`);
    const controller=state.audio_broadcast;
    const discordFresh=controller?.available && controller.discord_ready && Number.isFinite(controller.observed_at) && Math.abs(Date.now()/1000-controller.observed_at)<3;
    const discordBlocked=discordFresh && (controller.discord_muted===true || controller.discord_deafened===true || controller.server_muted===true || controller.server_blocked===true);
    const wrongInput=discordFresh && controller.stream_input_id && controller.discord_input_id!==controller.stream_input_id;
    const micMuted=mic?.muted===true || discordBlocked;
    const micKnown=typeof mic?.muted==='boolean';
    const micText=!micKnown?'حالة المايك غير متاحة':wrongInput?'مدخل Discord خارج Sonar':micMuted?(mic?.muted?'مكتوم في Sonar':'الإرسال متوقف في Discord'):discordFresh?'غير مكتوم في Discord':'غير مكتوم في Sonar';
    updateText(this.shadowRoot.getElementById('mic-overview-status'),micText);
    const micTile=this.shadowRoot.getElementById('mic-overview');if(micTile)micTile.dataset.state=!micKnown||wrongInput?'unknown':micMuted?'muted':'live';
    const listenSignal=valid?sample.routes?.monitoring:null;
    const listenKnown=typeof listen?.muted==='boolean';
    const listenText=!listenKnown?'حالة الاستماع غير متاحة':listen.muted?'الاستماع مكتوم':listenSignal?.status!=='live'?'قياس الإشارة غير متاح':listenSignal.peak>0.0001?'صوت يعمل الآن':'لا إشارة الآن';
    updateText(this.shadowRoot.getElementById('listening-overview-status'),listenText);
    const listenTile=this.shadowRoot.getElementById('listening-overview');if(listenTile)listenTile.dataset.state=!listenKnown?'unknown':listen.muted?'muted':listenSignal?.status==='live'?'live':'unknown';
    this.updateSonarPill(fresh);
    this.updateMicBadge(fresh?state.audio_mic_muted:null);
  }

  updateBroadcastView() {
    const sample=this.audioSample || {},state=this.telemetrySnapshot || {};
    const recent=sample.applicationsAvailable===true && performance.now()-(sample.receivedAt ?? -Infinity)<(sample.maxAgeMs || 300) && state.telemetry_status!=='stale';
    const apps=recent?(sample.applications || []):[];
    const view=broadcastView(state.audio_broadcast,apps,recent?sample.routes:{},Date.now()/1000,recent);
    const programs=playingPrograms(apps),escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const signature=JSON.stringify(programs.map(a=>[a.name,a.executable,a.icon_url,a.excluded,a.in_program_bus]));
    const list=this.shadowRoot.getElementById('playing-programs');
    if(list && (signature!==this.programSignature || recent!==this.programRecent)){
      list.innerHTML=programs.length?programs.map(app=>{
        const icon=typeof app.icon_url==='string' && /^\/assets\/audio\/apps\/[a-f0-9]{24}\.png$/.test(app.icon_url)?app.icon_url:null;
        const description=`${app.name} · ذروة الإشارة اللحظية من Windows${app.excluded?' · مستثنى من بث البرامج':''}`;
        return `<span class="program-chip" data-excluded="${!!app.excluded}" title="${escape(description)}" aria-label="${escape(description)}">${icon?`<img class="program-logo" src="${icon}" alt="${escape(app.name)}" width="44" height="44"><audio-signal-meter application="${icon}" signal-only compact></audio-signal-meter>`:'<span class="logo-missing">شعار غير متاح</span>'}</span>`;
      }).join(''):(recent?'لا يوجد صوت برامج الآن':'قياس البرامج غير متاح');
      this.programSignature=signature;this.programRecent=recent;
    }
    const panel=this.shadowRoot.getElementById('broadcast-panel');if(!panel)return;
    panel.dataset.state=view.code;updateText(this.shadowRoot.getElementById('broadcast-label'),view.label);updateText(this.shadowRoot.getElementById('broadcast-detail'),view.detail);
    updateText(this.shadowRoot.getElementById('broadcast-percent'),view.volume==null?'—':`${view.volume}%`);
    this.shadowRoot.getElementById('broadcast-fill').style.width=`${Math.max(0,Math.min(100,view.volume??0))}%`;
    const rail=this.shadowRoot.querySelector('.broadcast-rail');if(view.volume==null)rail.removeAttribute('aria-valuenow');else rail.setAttribute('aria-valuenow',String(view.volume));
  }

  renderMixerChannels() {
    for(const target of this.shadowRoot?.querySelectorAll('[data-sonar-back-panel]') || [])renderSonarPanel(target,this.telemetrySnapshot || {},{detailed:true,liveInGrid:false});
  }

  tick(timestamp) {
    if (!this.isRunning) return;
    const alpha = animationAlpha(this, timestamp);

    let needsRender = false;

    for (const key of ['fps','display_volume']) {
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
          current += diff * alpha;
          needsRender = true;
        }
      }
      this.currentValues[key] = current;
    }

    if (needsRender) {
      this.render();
    }

    this.rafId = requestAnimationFrame(this.tick);
  }

  render() {
    this.updateText(this.dom.fps, this.currentValues.fps, 0);
    this.updateText(this.dom.hz, this.currentValues.display_hz, 0);
    this.updateText(this.dom.volume, this.currentValues.display_volume, 0);
    this.updateText(this.dom.frametime, this.currentValues.frametime_ms, 1);

    if (this.dom.backFrametime) {
      const ft = this.currentValues.frametime_ms !== null ? this.currentValues.frametime_ms.toFixed(1) : '--';
      updateText(this.dom.backFrametime, `${ft} ms`);
    }

    // Master volume icon logic
    if (this.dom.masterVolIcon) {
      const isMuted = this.targetValues.audio_master_muted || this.currentValues.display_volume === 0;
      if (isMuted) {
        updateText(this.dom.masterVolIcon, '🔇');
      } else if (this.currentValues.display_volume && this.currentValues.display_volume < 40) {
        updateText(this.dom.masterVolIcon, '🔉');
      } else {
        updateText(this.dom.masterVolIcon, '🔊');
      }
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
}

customElements.define('dashboard-display', DashboardDisplay);
