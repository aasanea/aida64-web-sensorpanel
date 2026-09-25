import { EventBus } from '../store/event_bus.js';

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
</style>

<div class="card-flipper" id="flipper">
  <!-- FRONT FACE -->
  <div class="card-face card-front">
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
        <span>استوديو الصوت والعرض المتقدم</span>
      </button>
    </div>

    <!-- Operational Wings -->
    <div class="operational-wings">
      <!-- Left Wing: Display & Gaming Hub -->
      <div class="wing wing-display">
        <div class="wing-header">
          <span class="wing-tag">🎮 محرك العرض والألعاب</span>
          <span class="wing-status">HDR1000 // G-SYNC</span>
        </div>

        <div class="display-hub-content">
          <!-- Live Real-Time FPS: huge 27px+ emerald Orbitron numbers -->
          <div class="fps-hero-capsule" title="معدل الإطارات الفعلي المباشر">
            <div class="fps-label-row">
              <span class="fps-label">معدل الإطارات الحقيقي</span>
              <span class="fps-status-live">مباشر REAL-TIME</span>
            </div>
            <div class="fps-val-row" dir="ltr">
              <span class="fps-num" id="fps">--</span>
              <span class="fps-unit">FPS</span>
            </div>
          </div>

          <!-- Display Metrics Triad -->
          <div class="display-triad-grid">
            <!-- Screen Refresh Rate -->
            <div class="telemetry-pill hz-pill" title="تردد تحديث الشاشة الفعلي">
              <div class="pill-info">
                <span class="pill-icon">🖥️</span>
                <span class="pill-label">التردد</span>
              </div>
              <div class="pill-val-group" dir="ltr">
                <span class="pill-val" id="display_hz">--</span>
                <span class="pill-unit">Hz</span>
              </div>
            </div>

            <!-- Frametime / Latency -->
            <div class="telemetry-pill frametime-pill" title="زمن الإطار الفعلي">
              <div class="pill-info">
                <span class="pill-icon">⏱️</span>
                <span class="pill-label">زمن الإطار</span>
              </div>
              <div class="pill-val-group" dir="ltr">
                <span class="pill-val" id="frametime_ms">4.1</span>
                <span class="pill-unit">ms</span>
              </div>
            </div>

            <!-- Display Resolution -->
            <div class="telemetry-pill res-pill" title="دقة العرض الحالية">
              <div class="pill-info">
                <span class="pill-icon">📐</span>
                <span class="pill-label">دقة الشاشة</span>
              </div>
              <div class="pill-val-group" dir="ltr">
                <span class="pill-val res-val" id="display_res">3840x2160 4K HDR</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Wing: Audio & Sonar Mixer Hub -->
      <div class="wing wing-audio">
        <div class="wing-header">
          <span class="wing-tag">🎛️ مكسر قنوات Sonar</span>
          <!-- Live Mic Status capsule -->
          <div class="mic-badge mic-live" id="mic-status-badge" title="حالة كتم الميكروفون المباشرة">
            <span class="mic-dot"></span>
            <span class="mic-title">🎙️ المايك:</span>
            <span id="mic-status-text">مباشر 🟢</span>
          </div>
        </div>

        <div class="audio-hub-content">
          <!-- Master Audio Header Capsule -->
          <div class="master-audio-box" title="مستوى الصوت العام الرئيسي">
            <div class="master-audio-top">
              <div class="master-title-group">
                <span class="master-icon" id="master-vol-icon">🔊</span>
                <span class="master-label">الصوت العام (Master)</span>
              </div>
              <div class="master-val-group" dir="ltr">
                <span class="master-val" id="display_volume">--</span>
                <span class="master-unit">%</span>
              </div>
            </div>
            <div class="master-track">
              <div class="channel-fill fill-master" id="mixer-bar-master" style="width: 0%;"></div>
            </div>
          </div>

          <!-- 4 Sonar Virtual Channels directly visible on the front face -->
          <div class="sonar-channels-quad">
            <!-- Game Channel -->
            <div class="channel-card channel-game">
              <div class="channel-header-mini">
                <div class="ch-left">
                  <span class="ch-icon">🎮</span>
                  <span class="ch-name">Game</span>
                </div>
                <span class="ch-val" id="mixer-val-game" dir="ltr">--%</span>
              </div>
              <div class="ch-track">
                <div class="channel-fill fill-game" id="mixer-bar-game" style="width: 0%;"></div>
              </div>
            </div>

            <!-- Chat Channel -->
            <div class="channel-card channel-chat">
              <div class="channel-header-mini">
                <div class="ch-left">
                  <span class="ch-icon">💬</span>
                  <span class="ch-name">Chat</span>
                </div>
                <span class="ch-val" id="mixer-val-chat" dir="ltr">--%</span>
              </div>
              <div class="ch-track">
                <div class="channel-fill fill-chat" id="mixer-bar-chat" style="width: 0%;"></div>
              </div>
            </div>

            <!-- Media Channel -->
            <div class="channel-card channel-media">
              <div class="channel-header-mini">
                <div class="ch-left">
                  <span class="ch-icon">🎵</span>
                  <span class="ch-name">Media</span>
                </div>
                <span class="ch-val" id="mixer-val-media" dir="ltr">--%</span>
              </div>
              <div class="ch-track">
                <div class="channel-fill fill-media" id="mixer-bar-media" style="width: 0%;"></div>
              </div>
            </div>

            <!-- Aux Channel -->
            <div class="channel-card channel-aux">
              <div class="channel-header-mini">
                <div class="ch-left">
                  <span class="ch-icon">🎚️</span>
                  <span class="ch-name">Aux</span>
                </div>
                <span class="ch-val" id="mixer-val-aux" dir="ltr">--%</span>
              </div>
              <div class="ch-track">
                <div class="channel-fill fill-aux" id="mixer-bar-aux" style="width: 0%;"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Strip -->
    <div class="bottom-media-strip">
      <div class="strip-left">
        <div class="spectrum-visualizer" title="طيف الصوت التفاعلي">
          <span class="spectrum-bar sb-1"></span>
          <span class="spectrum-bar sb-2"></span>
          <span class="spectrum-bar sb-3"></span>
          <span class="spectrum-bar sb-4"></span>
          <span class="spectrum-bar sb-5"></span>
          <span class="spectrum-bar sb-6"></span>
          <span class="spectrum-bar sb-7"></span>
          <span class="spectrum-bar sb-8"></span>
        </div>
        <div class="strip-media-meta">
          <span class="strip-media-title">SteelSeries Sonar AI Engine</span>
          <span class="strip-media-desc">Spatial Audio 7.1 Virtual Surround & ClearCast AI Active</span>
        </div>
      </div>
      <div class="strip-right">
        <span class="sonar-status-pill connected" id="sonar-pill">Sonar ⚡</span>
      </div>
    </div>
  </div>

  <!-- BACK FACE (3D Flip Studio Card) -->
  <div class="card-face card-back">
    <div class="card-header">
      <div class="card-title-group">
        <div class="card-icon display-icon">
          <span style="font-size: 16px;">🎛️</span>
        </div>
        <div>
          <h2 class="card-title">استوديو الصوت ومحرك العرض المتقدم</h2>
          <span class="card-sub">A/V STUDIO LAB // DEEP TELEMETRY & HARDWARE CONTROLS</span>
        </div>
      </div>
      <button class="flip-btn btn-back" id="flip-to-front" title="العودة لشاشة القيادة">
        <span>↩️</span>
        <span>عودة</span>
      </button>
    </div>

    <div class="back-sections-grid">
      <!-- Section A: Sonar AI Studio -->
      <div class="studio-section studio-audio">
        <div class="section-title-bar">
          <div class="sec-title-left">
            <span class="sec-icon">🎙️</span>
            <span class="sec-heading">استوديو الصوت ومعالجة الذكاء الاصطناعي</span>
          </div>
          <span class="sec-badge">SONAR AI</span>
        </div>

        <!-- 1. ClearCast AI Noise Cancellation -->
        <div class="studio-card ai-noise-card">
          <div class="studio-card-header">
            <div class="card-label-group">
              <span class="card-emoji">🛡️</span>
              <span class="card-primary-label">عزل الضوضاء الذكي ClearCast AI</span>
            </div>
            <span class="status-badge-green" id="clearcast-badge">نشط ⚡ 98% خفض التشويش</span>
          </div>
          <div class="ai-meter-track">
            <div class="ai-meter-fill" style="width: 98%;"></div>
          </div>
          <div class="studio-card-caption">
            معالجة عصبية بالذكاء الاصطناعي لعزل التشويش والضوضاء بنسبة 98%
          </div>
        </div>

        <!-- 2. EQ Presets Matrix -->
        <div class="studio-card eq-matrix-card">
          <div class="studio-card-header">
            <div class="card-label-group">
              <span class="card-emoji">🎚️</span>
              <span class="card-primary-label">بروفايلات المعادل النشطة (EQ Matrix)</span>
            </div>
            <span class="matrix-status">PARAMETRIC</span>
          </div>
          <div class="eq-presets-row">
            <div class="eq-pill active">
              <span class="eq-pill-name">Warzone Footsteps Focus</span>
              <span class="eq-pill-type">🎮 تنافسي</span>
            </div>
            <div class="eq-pill">
              <span class="eq-pill-name">Broadcast Voice Clarity</span>
              <span class="eq-pill-type">🎙️ صوت نقي</span>
            </div>
            <div class="eq-pill">
              <span class="eq-pill-name">Hi-Res Immersion</span>
              <span class="eq-pill-type">🎵 96kHz</span>
            </div>
          </div>
        </div>

        <!-- 3. Output Routing & Spatial Audio -->
        <div class="studio-card routing-card">
          <div class="studio-card-header">
            <div class="card-label-group">
              <span class="card-emoji">🎧</span>
              <span class="card-primary-label">التوجيه والصوت المحيطي (Spatial Audio)</span>
            </div>
            <span class="status-badge-cyan">360° SURROUND</span>
          </div>
          <div class="routing-details-grid">
            <div class="routing-item">
              <span class="route-label">الصوت المحيطي:</span>
              <span class="route-val">Spatial Audio 7.1 Virtual Surround (مفعّل)</span>
            </div>
            <div class="routing-item">
              <span class="route-label">سماعة الرأس:</span>
              <span class="route-val">Headset Arctis Nova Pro Wireless</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Section B: Display Pipeline Lab -->
      <div class="studio-section studio-display">
        <div class="section-title-bar">
          <div class="sec-title-left">
            <span class="sec-icon">🖥️</span>
            <span class="sec-heading">مختبر محرك العرض وإشارة الفيديو</span>
          </div>
          <span class="sec-badge">VIDEO LAB</span>
        </div>

        <!-- 1. Video Signal Specs -->
        <div class="studio-card video-specs-card">
          <div class="studio-card-header">
            <div class="card-label-group">
              <span class="card-emoji">🎨</span>
              <span class="card-primary-label">مواصفات إشارة الفيديو (Signal Specs)</span>
            </div>
            <span class="status-badge-purple">10-BIT HDR</span>
          </div>
          <div class="specs-pills-row">
            <div class="spec-pill">
              <span class="spec-prop">عمق الألوان</span>
              <span class="spec-data">10-bit (1.07B colors)</span>
            </div>
            <div class="spec-pill">
              <span class="spec-prop">النطاق اللوني</span>
              <span class="spec-data">RGB 4:4:4 Full Range</span>
            </div>
            <div class="spec-pill">
              <span class="spec-prop">المدى الديناميكي</span>
              <span class="spec-data">DisplayHDR 1000</span>
            </div>
          </div>
        </div>

        <!-- 2. Frame Dynamics -->
        <div class="studio-card frame-dynamics-card">
          <div class="studio-card-header">
            <div class="card-label-group">
              <span class="card-emoji">⚡</span>
              <span class="card-primary-label">ديناميكية الإطارات ومزامنة الشاشة (VRR)</span>
            </div>
            <span class="status-badge-green">VRR ACTIVE</span>
          </div>
          <div class="dynamics-grid">
            <div class="dynamic-cell">
              <span class="dyn-label">مزامنة الشاشة</span>
              <span class="dyn-val dyn-highlight">NVIDIA G-Sync Active</span>
              <span class="dyn-sub">VRR 48 - 240 Hz</span>
            </div>
            <div class="dynamic-cell">
              <span class="dyn-label">زمن تأخير الإطار</span>
              <span class="dyn-val dyn-cyan" id="back-frametime-val">4.1 ms</span>
              <span class="dyn-sub">Ultra-Low Latency</span>
            </div>
            <div class="dynamic-cell">
              <span class="dyn-label">أدنى إطارات 1% Low</span>
              <span class="dyn-val dyn-green">165 FPS</span>
              <span class="dyn-sub">Solid Pacing</span>
            </div>
          </div>
        </div>

        <!-- 3. Interface & Bandwidth -->
        <div class="studio-card interface-card">
          <div class="studio-card-header">
            <div class="card-label-group">
              <span class="card-emoji">🔌</span>
              <span class="card-primary-label">الواجهة الفيزيائية والنطاق الترددي</span>
            </div>
            <span class="status-badge-cyan">32.4 Gbps</span>
          </div>
          <div class="bandwidth-meter-box">
            <div class="bw-info-row">
              <span class="bw-port">DisplayPort 1.4a DSC</span>
              <span class="bw-speed">32.4 Gbps</span>
            </div>
            <div class="bw-track">
              <div class="bw-fill" style="width: 78%;"></div>
            </div>
            <div class="bw-caption">
              نطاق ترددي فائق بدقة 4K ومعدل 240Hz مع دعم كامل لمكتبة HDR10 و 10-Bit
            </div>
          </div>
        </div>
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
      frametime_ms: 4.1,
      display_res: '3840x2160 4K HDR',
      sonar_connected: false,
      audio_mic_muted: false,
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
      frametime_ms: 4.1,
    };

    this.onStateChange = this.onStateChange.bind(this);
    this.toggleFlip = this.toggleFlip.bind(this);
    this.tick = this.tick.bind(this);
    this.isRunning = false;
  }

  connectedCallback() {
    this.unsubscribe = EventBus.on('state-changed', this.onStateChange);
    this.unsubscribeData = EventBus.on('telemetry:data', this.onStateChange);

    // Flip interaction
    if (this.dom.flipToBack) {
      this.dom.flipToBack.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleFlip();
      });
    }
    if (this.dom.flipToFront) {
      this.dom.flipToFront.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleFlip();
      });
    }

    this.addEventListener('click', (e) => {
      if (e.target && (e.target.closest('button') || e.target.closest('.flip-btn'))) return;
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

  toggleFlip() {
    this.classList.toggle('flipped');
  }

  onStateChange(delta) {
    if (delta.fps !== undefined) {
      this.targetValues.fps = delta.fps;
      if (this.targetValues.fps > 0) {
        this.targetValues.frametime_ms = parseFloat((1000 / this.targetValues.fps).toFixed(1));
      }
    }
    if (delta.frametime_ms !== undefined) {
      this.targetValues.frametime_ms = delta.frametime_ms;
    } else if (delta.frametime !== undefined) {
      this.targetValues.frametime_ms = delta.frametime;
    } else if (delta.gpu_frametime !== undefined) {
      this.targetValues.frametime_ms = delta.gpu_frametime;
    }

    if (delta.display_hz !== undefined) this.targetValues.display_hz = delta.display_hz;

    // Master volume preference: Sonar master volume if active, else display_volume
    if (delta.audio_master_volume !== undefined && delta.audio_master_volume !== null && delta.audio_master_volume > 0) {
      this.targetValues.display_volume = delta.audio_master_volume;
    } else if (delta.display_volume !== undefined && delta.display_volume !== null) {
      this.targetValues.display_volume = delta.display_volume;
    }

    if (delta.display_res !== undefined && delta.display_res) {
      this.targetValues.display_res = delta.display_res;
      if (this.dom.res) this.dom.res.textContent = delta.display_res;
    }

    // Sonar connection status
    if (delta.sonar_connected !== undefined) {
      this.targetValues.sonar_connected = Boolean(delta.sonar_connected);
      this.updateSonarPill(this.targetValues.sonar_connected);
    }

    // Microphone status
    if (delta.audio_mic_muted !== undefined) {
      this.targetValues.audio_mic_muted = Boolean(delta.audio_mic_muted);
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
  }

  updateSonarPill(connected) {
    if (!this.dom.sonarPill) return;
    if (connected) {
      this.dom.sonarPill.textContent = 'Sonar ⚡';
      this.dom.sonarPill.className = 'sonar-status-pill connected';
    } else {
      this.dom.sonarPill.textContent = 'Sonar ⚪';
      this.dom.sonarPill.className = 'sonar-status-pill';
    }
  }

  updateMicBadge(isMuted) {
    if (!this.dom.micBadge || !this.dom.micText) return;
    if (isMuted) {
      this.dom.micBadge.className = 'mic-badge mic-muted';
      this.dom.micText.textContent = 'مكتوم 🔇';
    } else {
      this.dom.micBadge.className = 'mic-badge mic-live';
      this.dom.micText.textContent = 'مباشر 🟢';
    }
  }

  renderMixerChannels() {
    const updateChannel = (barEl, valEl, vol, isMuted) => {
      if (!barEl) return;
      const effectiveVol = (vol === null || vol === undefined) ? 0 : Math.round(vol);
      if (valEl) {
        valEl.textContent = (vol === null || vol === undefined) ? '--%' : `${effectiveVol}%`;
      }
      barEl.style.width = `${Math.min(100, Math.max(0, effectiveVol))}%`;

      if (isMuted) {
        barEl.classList.add('muted-fill');
      } else {
        barEl.classList.remove('muted-fill');
      }
    };

    // Master
    updateChannel(
      this.dom.barMaster,
      null,
      this.targetValues.audio_master_volume ?? this.targetValues.display_volume,
      this.targetValues.audio_master_muted
    );

    // Game
    updateChannel(
      this.dom.barGame,
      this.dom.valGame,
      this.targetValues.audio_game_volume,
      this.targetValues.audio_game_muted
    );

    // Chat
    updateChannel(
      this.dom.barChat,
      this.dom.valChat,
      this.targetValues.audio_chat_volume,
      this.targetValues.audio_chat_muted
    );

    // Media
    updateChannel(
      this.dom.barMedia,
      this.dom.valMedia,
      this.targetValues.audio_media_volume,
      this.targetValues.audio_media_muted
    );

    // Aux
    updateChannel(
      this.dom.barAux,
      this.dom.valAux,
      this.targetValues.audio_aux_volume,
      this.targetValues.audio_aux_muted
    );
  }

  tick() {
    if (!this.isRunning) return;

    let needsRender = false;

    for (const key of ['fps', 'display_hz', 'display_volume', 'frametime_ms']) {
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
    this.updateText(this.dom.fps, this.currentValues.fps, 0);
    this.updateText(this.dom.hz, this.currentValues.display_hz, 0);
    this.updateText(this.dom.volume, this.currentValues.display_volume, 0);
    this.updateText(this.dom.frametime, this.currentValues.frametime_ms, 1);

    if (this.dom.backFrametime) {
      const ft = this.currentValues.frametime_ms !== null ? this.currentValues.frametime_ms.toFixed(1) : '4.1';
      this.dom.backFrametime.textContent = `${ft} ms`;
    }

    // Master volume icon logic
    if (this.dom.masterVolIcon) {
      const isMuted = this.targetValues.audio_master_muted || this.currentValues.display_volume === 0;
      if (isMuted) {
        this.dom.masterVolIcon.textContent = '🔇';
      } else if (this.currentValues.display_volume && this.currentValues.display_volume < 40) {
        this.dom.masterVolIcon.textContent = '🔉';
      } else {
        this.dom.masterVolIcon.textContent = '🔊';
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
