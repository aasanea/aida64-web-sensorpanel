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
    padding: 4px 12px;
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

  /* Header Styles matching 24px / 100cm Readability standard */
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2px;
    flex-shrink: 0;
  }

  .header-titles {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .card-title {
    font-family: var(--font-arabic);
    font-size: 24px;
    font-weight: 800;
    color: #FFFFFF;
    letter-spacing: 0.3px;
    line-height: 1.2;
    display: flex;
    align-items: center;
    gap: 8px;
    text-shadow: 0 0 12px rgba(255, 255, 255, 0.2);
  }

  .card-subtitle {
    font-family: var(--font-numbers);
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 1px;
    color: var(--neon-cyan);
    opacity: 0.95;
    text-shadow: 0 0 10px rgba(34, 211, 238, 0.4);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .btn-flip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 10px;
    font-family: var(--font-arabic);
    font-size: 15px;
    font-weight: 800;
    color: #FFFFFF;
    cursor: pointer;
    backdrop-filter: blur(8px);
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    white-space: nowrap;
  }

  .btn-flip:hover {
    background: rgba(34, 211, 238, 0.15);
    border-color: var(--neon-cyan);
    color: var(--neon-cyan);
    box-shadow: 0 0 14px rgba(34, 211, 238, 0.4);
    transform: translateY(-1px);
  }

  /* FRONT FACE: Filter Strip */
  .filter-strip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 2px 8px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    margin-bottom: 2px;
    flex-shrink: 0;
    gap: 8px;
  }

  .filter-buttons {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .filter-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: var(--text-muted);
    font-family: var(--font-arabic);
    font-size: 14px;
    font-weight: 800;
    padding: 2px 9px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .filter-btn.active {
    background: rgba(34, 211, 238, 0.2);
    border-color: var(--neon-cyan);
    color: #FFFFFF;
    box-shadow: 0 0 8px rgba(34, 211, 238, 0.35);
  }

  .filter-btn.upcoming-filter.active {
    background: rgba(245, 158, 11, 0.25);
    border-color: #F59E0B;
    color: #FDE68A;
    box-shadow: 0 0 8px rgba(245, 158, 11, 0.4);
  }

  .filter-btn.live-filter.active {
    background: rgba(239, 68, 68, 0.25);
    border-color: #EF4444;
    color: #FCA5A5;
    box-shadow: 0 0 8px rgba(239, 68, 68, 0.4);
  }

  .round-meta-tag {
    font-family: var(--font-arabic);
    font-size: 13px;
    font-weight: 800;
    color: var(--neon-yellow);
    display: flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  /* Matches List Container */
  .matches-scroll-container {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-right: 2px;
    min-height: 0;
  }

  .matches-scroll-container::-webkit-scrollbar {
    width: 4px;
  }
  .matches-scroll-container::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.02);
    border-radius: 4px;
  }
  .matches-scroll-container::-webkit-scrollbar-thumb {
    background: rgba(34, 211, 238, 0.3);
    border-radius: 4px;
  }

  /* Match Card Item - Compact & Highly Readable */
  .match-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 2px 8px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 8px;
    transition: all 0.2s ease;
    gap: 6px;
    flex-shrink: 0;
  }

  .match-item:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(34, 211, 238, 0.35);
  }

  .match-item.is-live {
    border-color: rgba(239, 68, 68, 0.5);
    background: radial-gradient(ellipse at 50% 50%, rgba(239, 68, 68, 0.1) 0%, rgba(255, 255, 255, 0.02) 100%);
    box-shadow: inset 0 0 14px rgba(239, 68, 68, 0.2);
  }

  .match-item.is-upcoming-item {
    border-color: rgba(245, 158, 11, 0.3);
  }

  .team-cell {
    display: flex;
    align-items: center;
    gap: 7px;
    flex: 1;
    min-width: 0;
  }

  .team-cell.home {
    justify-content: flex-start;
  }

  .team-cell.away {
    justify-content: flex-end;
    text-align: left;
  }

  .team-logo {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    object-fit: contain;
    background: rgba(255, 255, 255, 0.06);
    padding: 2px;
    flex-shrink: 0;
  }

  .team-name {
    font-family: var(--font-arabic);
    font-size: 18px;
    font-weight: 800;
    color: #FFFFFF;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Day Separator between dates */
  .day-separator {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 3px 0 2px 0;
    flex-shrink: 0;
  }

  .day-sep-line {
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.15), transparent);
  }

  .day-sep-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 1px 9px;
    background: rgba(18, 22, 34, 0.92);
    border: 1px solid rgba(34, 211, 238, 0.3);
    border-radius: 20px;
    font-family: var(--font-arabic);
    font-size: 12.5px;
    font-weight: 800;
    color: var(--neon-cyan);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .day-sep-badge.is-today {
    border-color: var(--neon-yellow);
    color: var(--neon-yellow);
    background: rgba(30, 24, 15, 0.95);
    box-shadow: 0 0 10px rgba(245, 158, 11, 0.35);
  }

  /* Score & Center Status */
  .score-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-width: 135px;
    flex-shrink: 0;
  }

  .match-meta-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    margin-bottom: 1px;
    flex-wrap: wrap;
  }

  .match-comp-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-family: var(--font-arabic);
    font-size: 11px;
    font-weight: 800;
    padding: 1.5px 6px;
    border-radius: 5px;
    white-space: nowrap;
    line-height: 1.1;
    background: rgba(34, 211, 238, 0.12);
    color: var(--neon-cyan);
    border: 1px solid rgba(34, 211, 238, 0.3);
  }

  .comp-flag-icon {
    display: inline-block;
    vertical-align: middle;
    border-radius: 2px;
    flex-shrink: 0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  }

  .comp-flag-icon.round-emblem {
    border-radius: 50%;
  }

  .match-comp-badge.comp-saudi {
    background: rgba(16, 185, 129, 0.15);
    color: #34D399;
    border-color: rgba(16, 185, 129, 0.35);
  }

  .match-comp-badge.comp-epl {
    background: rgba(168, 85, 247, 0.15);
    color: #C084FC;
    border-color: rgba(168, 85, 247, 0.35);
  }

  .match-comp-badge.comp-laliga {
    background: rgba(249, 115, 22, 0.15);
    color: #FB923C;
    border-color: rgba(249, 115, 22, 0.35);
  }

  .match-comp-badge.comp-seriea {
    background: rgba(14, 165, 233, 0.15);
    color: #38BDF8;
    border-color: rgba(14, 165, 233, 0.35);
  }

  .match-comp-badge.comp-bundes {
    background: rgba(239, 68, 68, 0.15);
    color: #F87171;
    border-color: rgba(239, 68, 68, 0.35);
  }

  .match-comp-badge.comp-ligue1 {
    background: rgba(132, 204, 22, 0.15);
    color: #A3E635;
    border-color: rgba(132, 204, 22, 0.35);
  }

  .match-comp-badge.comp-ucl {
    background: rgba(59, 130, 246, 0.15);
    color: #60A5FA;
    border-color: rgba(59, 130, 246, 0.35);
  }

  .match-comp-badge.comp-afc {
    background: rgba(234, 179, 8, 0.15);
    color: #FACC15;
    border-color: rgba(234, 179, 8, 0.35);
  }

  .match-comp-badge.comp-saudi-nt {
    background: rgba(16, 185, 129, 0.25);
    color: #34D399;
    border-color: #10B981;
    font-weight: 900;
    box-shadow: 0 0 8px rgba(16, 185, 129, 0.4);
  }

  .match-channel-badge {
    font-family: var(--font-numbers), var(--font-arabic);
    font-size: 10.5px;
    font-weight: 800;
    padding: 1px 5px;
    border-radius: 4px;
    background: rgba(245, 158, 11, 0.12);
    color: #FBBF24;
    border: 1px solid rgba(245, 158, 11, 0.35);
    white-space: nowrap;
    line-height: 1.1;
  }

  .score-numbers {
    font-family: var(--font-numbers);
    font-size: 22px;
    font-weight: 900;
    color: #FFFFFF;
    letter-spacing: 2px;
    font-variant-numeric: tabular-nums;
    line-height: 1;
    text-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
  }

  .score-numbers.live-score {
    color: var(--neon-green);
    text-shadow: 0 0 14px rgba(16, 185, 129, 0.65);
  }

  .score-numbers.upcoming-score {
    color: var(--neon-yellow);
    font-size: 20px;
    letter-spacing: 1px;
    text-shadow: 0 0 10px rgba(245, 158, 11, 0.5);
  }

  .match-status-badge {
    font-family: var(--font-arabic);
    font-size: 11px;
    font-weight: 800;
    padding: 1px 5px;
    border-radius: 4px;
    margin-top: 1px;
    white-space: nowrap;
    line-height: 1.1;
  }

  .status-live {
    background: rgba(239, 68, 68, 0.25);
    color: #F87171;
    border: 1px solid rgba(239, 68, 68, 0.45);
  }

  .status-ended {
    background: rgba(255, 255, 255, 0.06);
    color: var(--text-muted);
  }

  .status-upcoming {
    background: rgba(245, 158, 11, 0.2);
    color: #FBBF24;
    border: 1px solid rgba(245, 158, 11, 0.4);
  }

  /* BACK FACE: Segmented Tournament Tabs (Mirrors User's Uploaded Design) */
  .tournament-segmented-control {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #141721;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    padding: 3px;
    margin-bottom: 6px;
    flex-shrink: 0;
    gap: 4px;
  }

  .tournament-tab {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    background: transparent;
    border: none;
    outline: none;
    color: var(--text-muted);
    font-family: var(--font-arabic);
    font-size: 16px;
    font-weight: 800;
    padding: 6px 12px;
    border-radius: 9px;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    text-align: center;
    white-space: nowrap;
  }

  .tournament-tab:hover {
    color: #FFFFFF;
    background: rgba(255, 255, 255, 0.04);
  }

  .tournament-tab.active {
    background: rgba(255, 255, 255, 0.14);
    color: #FFFFFF;
    font-weight: 900;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }

  .standings-legend {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 3px 8px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 6px;
    margin-bottom: 4px;
    flex-shrink: 0;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-arabic);
    font-size: 13px;
    font-weight: 800;
    color: var(--text-muted);
  }

  .legend-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .legend-dot.afc {
    background: var(--neon-green);
    box-shadow: 0 0 6px var(--neon-green);
  }

  .legend-dot.relegation {
    background: var(--neon-red);
    box-shadow: 0 0 6px var(--neon-red);
  }

  .table-container {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    min-height: 0;
  }

  .table-container::-webkit-scrollbar {
    width: 5px;
  }
  .table-container::-webkit-scrollbar-thumb {
    background: rgba(34, 211, 238, 0.3);
    border-radius: 4px;
  }

  .standings-table {
    width: 100%;
    border-collapse: collapse;
    text-align: right;
  }

  .standings-table th {
    position: sticky;
    top: 0;
    background: #0d131f;
    font-family: var(--font-arabic);
    font-size: 15px;
    font-weight: 800;
    color: var(--text-muted);
    padding: 4px 6px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    z-index: 2;
  }

  .standings-table td {
    padding: 4px 6px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    vertical-align: middle;
  }

  .standings-table tr:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .col-rank {
    font-family: var(--font-numbers);
    font-size: 16px;
    font-weight: 800;
    color: var(--text-muted);
    text-align: center;
    width: 28px;
  }

  .rank-top {
    color: var(--neon-yellow) !important;
    text-shadow: 0 0 8px rgba(234, 179, 8, 0.5);
  }

  .rank-afc {
    color: var(--neon-green) !important;
    text-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
  }

  .rank-relegation {
    color: var(--neon-red) !important;
  }

  .team-cell-table {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .table-logo {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    object-fit: contain;
  }

  .table-team-name {
    font-family: var(--font-arabic);
    font-size: 17px;
    font-weight: 800;
    color: #FFFFFF;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .col-num {
    font-family: var(--font-numbers);
    font-size: 16px;
    font-weight: 700;
    color: #E2E8F0;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .col-pts {
    font-family: var(--font-numbers);
    font-size: 20px;
    font-weight: 900;
    color: var(--neon-cyan);
    text-align: center;
    text-shadow: 0 0 8px rgba(34, 211, 238, 0.4);
    font-variant-numeric: tabular-nums;
    width: 36px;
  }

  /* King's Cup Match Item in Back Face */
  .cup-match-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    margin-bottom: 5px;
    gap: 8px;
  }

  .qualified-badge {
    display: inline-block;
    color: var(--neon-green);
    font-size: 12px;
    margin-right: 4px;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-muted);
    font-family: var(--font-arabic);
    font-size: 17px;
    font-weight: 700;
    gap: 8px;
  }
</style>

<div class="card-flipper">
  <!-- FRONT FACE: Today, Live & Upcoming Matches -->
  <div class="card-face card-front">
    <div class="card-header">
      <div class="header-titles">
        <div class="card-title">
          <span>⚽</span>
          <span>مباريات اليوم والكرة السعودية</span>
        </div>
        <div class="card-subtitle">TODAY & UPCOMING MATCHES</div>
      </div>
      <div class="header-actions">
        <button class="btn-flip" id="btn-flip-standings">
          <span>🏆</span>
          <span>جدول الترتيب</span>
        </button>
      </div>
    </div>

    <!-- Filter Strip with Upcoming Matches Tab -->
    <div class="filter-strip">
      <div class="filter-buttons">
        <button class="filter-btn upcoming-filter active" id="filter-upcoming">المباريات القادمة ⏳</button>
        <button class="filter-btn" id="filter-saudi">
          <svg class="comp-flag-icon" viewBox="0 0 20 14" width="15" height="10"><rect width="20" height="14" rx="2" fill="#00843D"/><path d="M4 4.2h12M4.5 6.2h11M5 8.2h10" stroke="#FFFFFF" stroke-width="1.1" stroke-linecap="round"/><path d="M4 10.5h12M5 9.5l-1.5 1 1.5 1" stroke="#FFFFFF" stroke-width="0.9" stroke-linecap="round" fill="none"/></svg>
          <span>دوري روشن</span>
        </button>
        <button class="filter-btn" id="filter-all">الكل</button>
        <button class="filter-btn live-filter" id="filter-live">مباشر 🔴</button>
      </div>
      <div class="round-meta-tag" id="round-meta-text">
        <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#10B981;box-shadow:0 0 8px #10B981;margin-left:4px;"></span>
        <span id="round-title-label">الجولة القادمة</span>
      </div>
    </div>

    <div class="matches-scroll-container" id="matches-container">
      <div class="empty-state">
        <span>⏳</span>
        <span>جاري جلب جدول المباريات...</span>
      </div>
    </div>
  </div>

  <!-- BACK FACE: Tournament Standings (Roshn League, AFC Elite, King's Cup) -->
  <div class="card-face card-back">
    <div class="card-header">
      <div class="header-titles">
        <div class="card-title">
          <span>🏆</span>
          <span>جدول الترتيب والبطولات</span>
        </div>
        <div class="card-subtitle">TOURNAMENT STANDINGS & BRACKETS</div>
      </div>
      <div class="header-actions">
        <button class="btn-flip" id="btn-flip-matches">
          <span>↩️</span>
          <span>عودة للمباريات</span>
        </button>
      </div>
    </div>

    <!-- Segmented Tournament Control (Matching User's Uploaded Style Exactly) -->
    <div class="tournament-segmented-control">
      <button class="tournament-tab active" id="tab-roshn">
        <svg class="comp-flag-icon" viewBox="0 0 20 14" width="16" height="11"><rect width="20" height="14" rx="2" fill="#00843D"/><path d="M4 4.2h12M4.5 6.2h11M5 8.2h10" stroke="#FFFFFF" stroke-width="1.1" stroke-linecap="round"/><path d="M4 10.5h12M5 9.5l-1.5 1 1.5 1" stroke="#FFFFFF" stroke-width="0.9" stroke-linecap="round" fill="none"/></svg>
        <span>دوري روشن</span>
      </button>
      <button class="tournament-tab" id="tab-afc">
        <svg class="comp-flag-icon round-emblem" viewBox="0 0 16 16" width="14" height="14"><circle cx="8" cy="8" r="7.5" fill="#1E1B4B" stroke="#F59E0B" stroke-width="1.2"/><circle cx="8" cy="8" r="5" fill="#F59E0B"/><path d="M8 3.5 L8.8 6.5 L12 6.5 L9.4 8.4 L10.4 11.5 L8 9.5 L5.6 11.5 L6.6 8.4 L4 6.5 L7.2 6.5 Z" fill="#FFFFFF"/></svg>
        <span>نخبة آسيا</span>
      </button>
      <button class="tournament-tab" id="tab-king">
        <svg class="comp-flag-icon" viewBox="0 0 20 14" width="16" height="11"><rect width="20" height="14" rx="2" fill="#00843D"/><path d="M4 4.2h12M4.5 6.2h11M5 8.2h10" stroke="#FFFFFF" stroke-width="1.1" stroke-linecap="round"/><path d="M4 10.5h12M5 9.5l-1.5 1 1.5 1" stroke="#FFFFFF" stroke-width="0.9" stroke-linecap="round" fill="none"/></svg>
        <span>كأس الملك</span>
      </button>
    </div>

    <div class="standings-legend" id="standings-legend">
      <div class="legend-item">
        <div class="legend-dot afc"></div>
        <span id="legend-text-top">المراكز المؤهلة (1-3)</span>
      </div>
      <div class="legend-item" id="legend-item-bottom">
        <div class="legend-dot relegation"></div>
        <span>مراكز الهبوط (16-18)</span>
      </div>
    </div>

    <div class="table-container" id="tournament-content-container">
      <table class="standings-table" id="standings-table">
        <thead>
          <tr>
            <th style="width: 28px; text-align: center;">#</th>
            <th>النادي</th>
            <th style="width: 32px; text-align: center;">ل</th>
            <th style="width: 36px; text-align: center;">فارق</th>
            <th style="width: 40px; text-align: center;">نقاط</th>
          </tr>
        </thead>
        <tbody id="standings-tbody">
          <tr>
            <td colspan="5" style="text-align: center; padding: 20px; color: var(--text-muted);">
              جاري تحميل جدول الترتيب...
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Container for King's Cup Bracket/Matches -->
      <div id="kings-cup-container" style="display: none; padding-top: 4px;"></div>
    </div>
  </div>
</div>
`;

const FLAGS = {
  saudi: `<svg class="comp-flag-icon" viewBox="0 0 20 14" width="16" height="11"><rect width="20" height="14" rx="2" fill="#00843D"/><path d="M4 4.2h12M4.5 6.2h11M5 8.2h10" stroke="#FFFFFF" stroke-width="1.1" stroke-linecap="round"/><path d="M4 10.5h12M5 9.5l-1.5 1 1.5 1" stroke="#FFFFFF" stroke-width="0.9" stroke-linecap="round" fill="none"/></svg>`,
  gcc: `<svg class="comp-flag-icon round-emblem" viewBox="0 0 16 16" width="14" height="14"><circle cx="8" cy="8" r="7.5" fill="#047857" stroke="#F59E0B" stroke-width="1.3"/><circle cx="8" cy="8" r="5.6" fill="#065F46" stroke="#10B981" stroke-width="0.6"/><path d="M6 4.5 C6.8 3.8 8.8 4 9.6 4.8 C10.4 5.6 11 6.8 10.4 8.2 C9.8 9.2 9 10 8.2 10.6 C7.5 11.2 7 12.2 6 12 C5.2 11.8 4.8 10.8 5.2 9.5 C5.6 8.2 5.2 6.5 6 4.5 Z" fill="#FBBF24"/><circle cx="8" cy="8" r="1.1" fill="#FFFFFF"/></svg>`,
  england: `<svg class="comp-flag-icon" viewBox="0 0 20 14" width="16" height="11"><rect width="20" height="14" rx="2" fill="#FFFFFF"/><rect x="8.5" y="0" width="3" height="14" fill="#CF081F"/><rect x="0" y="5.5" width="20" height="3" fill="#CF081F"/></svg>`,
  spain: `<svg class="comp-flag-icon" viewBox="0 0 20 14" width="16" height="11"><rect width="20" height="3.5" rx="2" fill="#AA151B"/><rect y="3.5" width="20" height="7" fill="#F1BF00"/><rect y="10.5" width="20" height="3.5" rx="2" fill="#AA151B"/><circle cx="5" cy="7" r="1.8" fill="#AA151B"/></svg>`,
  italy: `<svg class="comp-flag-icon" viewBox="0 0 20 14" width="16" height="11"><rect width="6.6" height="14" rx="2" fill="#009246"/><rect x="6.6" width="6.8" height="14" fill="#FFFFFF"/><rect x="13.4" width="6.6" height="14" rx="2" fill="#CE2B37"/></svg>`,
  germany: `<svg class="comp-flag-icon" viewBox="0 0 20 14" width="16" height="11"><rect width="20" height="4.6" rx="2" fill="#000000"/><rect y="4.6" width="20" height="4.8" fill="#DD0000"/><rect y="9.4" width="20" height="4.6" rx="2" fill="#FFCE00"/></svg>`,
  france: `<svg class="comp-flag-icon" viewBox="0 0 20 14" width="16" height="11"><rect width="6.6" height="14" rx="2" fill="#002395"/><rect x="6.6" width="6.8" height="14" fill="#FFFFFF"/><rect x="13.4" width="6.6" height="14" rx="2" fill="#ED2939"/></svg>`,
  ucl: `<svg class="comp-flag-icon round-emblem" viewBox="0 0 16 16" width="14" height="14"><circle cx="8" cy="8" r="7.5" fill="#0B132B" stroke="#38BDF8" stroke-width="1.2"/><g fill="#FFFFFF"><polygon points="8,2.2 8.5,3.6 10,3.6 8.8,4.5 9.3,5.9 8,5 6.7,5.9 7.2,4.5 6,3.6 7.5,3.6"/><polygon points="12,5.5 12.4,6.6 13.5,6.6 12.6,7.3 13,8.4 12,7.7 11,8.4 11.4,7.3 10.5,6.6 11.6,6.6"/><polygon points="4,5.5 4.4,6.6 5.5,6.6 4.6,7.3 5,8.4 4,7.7 3,8.4 3.4,7.3 2.5,6.6 3.6,6.6"/><polygon points="10.5,10.5 10.9,11.6 12,11.6 11.1,12.3 11.5,13.4 10.5,12.7 9.5,13.4 9.9,12.3 9,11.6 10.1,11.6"/><polygon points="5.5,10.5 5.9,11.6 7,11.6 6.1,12.3 6.5,13.4 5.5,12.7 4.5,13.4 4.9,12.3 4,11.6 5.1,11.6"/></g></svg>`,
  afc: `<svg class="comp-flag-icon round-emblem" viewBox="0 0 16 16" width="14" height="14"><circle cx="8" cy="8" r="7.5" fill="#1E1B4B" stroke="#F59E0B" stroke-width="1.2"/><circle cx="8" cy="8" r="5" fill="#F59E0B"/><path d="M8 3.5 L8.8 6.5 L12 6.5 L9.4 8.4 L10.4 11.5 L8 9.5 L5.6 11.5 L6.6 8.4 L4 6.5 L7.2 6.5 Z" fill="#FFFFFF"/></svg>`,
  world_cup: `<svg class="comp-flag-icon round-emblem" viewBox="0 0 16 16" width="14" height="14"><circle cx="8" cy="8" r="7.5" fill="#1E293B" stroke="#F59E0B" stroke-width="1.2"/><path d="M5.5 4.5 h5 v2.5 c0 1.5 -1 2.5 -2.5 2.5 s-2.5 -1 -2.5 -2.5 z" fill="#F59E0B"/><rect x="7.3" y="9.5" width="1.4" height="2.2" fill="#F59E0B"/><rect x="5.5" y="11.7" width="5" height="1.5" rx="0.5" fill="#F59E0B"/></svg>`,
};

function getCompMeta(m) {
  const cId = m.competition_id;
  const cName = m.competition_name || '';
  const isSaudiNT = m.is_saudi_nt || (m.home_id === 5087 || m.away_id === 5087);
  const isGulfCup = cId === 5452 || cName.includes('الخليج');
  const isRoshn = cId === 649 || m.is_roshn || cName.includes('روشن');
  const isKingsCup = cId === 5501 || cName.includes('الملك');
  const isSuperCup = cId === 5502 || cName.includes('السوبر');
  const isEpl = cId === 7 || cName.includes('الإنجليزي');
  const isLaLiga = cId === 11 || cName.includes('الإسباني');
  const isSerieA = cId === 17 || cName.includes('الإيطالي');
  const isBundes = cId === 25 || cName.includes('الألماني');
  const isLigue1 = cId === 35 || cName.includes('الفرنسي');
  const isUcl = cId === 572 || cName.includes('أبطال أوروبا');
  const isAfc = cId === 623 || cName.includes('آسيا') || cName.includes('النخبة');
  const isWorldCup = cId === 5930 || cName.includes('العالم');

  if (isGulfCup) {
    return { flag: FLAGS.gcc, badgeClass: 'comp-saudi-nt' };
  }
  if (isSaudiNT) {
    return { flag: FLAGS.saudi, badgeClass: 'comp-saudi-nt' };
  }
  if (isRoshn || isKingsCup || isSuperCup || m.is_saudi) {
    return { flag: FLAGS.saudi, badgeClass: 'comp-saudi' };
  }
  if (isEpl) {
    return { flag: FLAGS.england, badgeClass: 'comp-epl' };
  }
  if (isLaLiga) {
    return { flag: FLAGS.spain, badgeClass: 'comp-laliga' };
  }
  if (isSerieA) {
    return { flag: FLAGS.italy, badgeClass: 'comp-seriea' };
  }
  if (isBundes) {
    return { flag: FLAGS.germany, badgeClass: 'comp-bundes' };
  }
  if (isLigue1) {
    return { flag: FLAGS.france, badgeClass: 'comp-ligue1' };
  }
  if (isUcl) {
    return { flag: FLAGS.ucl, badgeClass: 'comp-ucl' };
  }
  if (isAfc) {
    return { flag: FLAGS.afc, badgeClass: 'comp-afc' };
  }
  if (isWorldCup) {
    return { flag: FLAGS.world_cup, badgeClass: 'comp-ucl' };
  }
  return { flag: '', badgeClass: '' };
}

export class DashboardMatches extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));
    this._pollTimer = null;
    this._currentFilter = 'upcoming'; // Default to Upcoming Matches as requested
    this._currentTab = 'roshn'; // Default to Roshn Saudi League on Back Face
    this._cachedMatchesData = null;
    this._cachedStandingsData = null;
  }

  connectedCallback() {
    this._btnFlipStandings = this.shadowRoot.getElementById('btn-flip-standings');
    this._btnFlipMatches = this.shadowRoot.getElementById('btn-flip-matches');
    this._matchesContainer = this.shadowRoot.getElementById('matches-container');
    this._standingsTbody = this.shadowRoot.getElementById('standings-tbody');
    this._standingsTable = this.shadowRoot.getElementById('standings-table');
    this._kingsCupContainer = this.shadowRoot.getElementById('kings-cup-container');
    this._standingsLegend = this.shadowRoot.getElementById('standings-legend');
    this._legendTextTop = this.shadowRoot.getElementById('legend-text-top');
    this._legendItemBottom = this.shadowRoot.getElementById('legend-item-bottom');
    this._roundTitleLabel = this.shadowRoot.getElementById('round-title-label');

    // Front Face Filters
    this._filterUpcoming = this.shadowRoot.getElementById('filter-upcoming');
    this._filterSaudi = this.shadowRoot.getElementById('filter-saudi');
    this._filterAll = this.shadowRoot.getElementById('filter-all');
    this._filterLive = this.shadowRoot.getElementById('filter-live');

    // Back Face Tournament Tabs
    this._tabRoshn = this.shadowRoot.getElementById('tab-roshn');
    this._tabAfc = this.shadowRoot.getElementById('tab-afc');
    this._tabKing = this.shadowRoot.getElementById('tab-king');

    if (this._btnFlipStandings) {
      this._btnFlipStandings.addEventListener('click', (e) => {
        e.stopPropagation();
        this.classList.add('flipped');
      });
    }

    if (this._btnFlipMatches) {
      this._btnFlipMatches.addEventListener('click', (e) => {
        e.stopPropagation();
        this.classList.remove('flipped');
      });
    }

    // Front Face Filter Listeners
    const filters = [
      { btn: this._filterUpcoming, id: 'upcoming' },
      { btn: this._filterSaudi, id: 'saudi' },
      { btn: this._filterAll, id: 'all' },
      { btn: this._filterLive, id: 'live' },
    ];

    filters.forEach(({ btn, id }) => {
      if (btn) {
        btn.addEventListener('click', () => {
          filters.forEach(f => f.btn.classList.remove('active'));
          btn.classList.add('active');
          this._currentFilter = id;
          if (this._cachedMatchesData) {
            this.renderMatches(this._cachedMatchesData);
          }
        });
      }
    });

    // Back Face Tournament Tab Listeners (دوري روشن / نخبة آسيا / كأس الملك)
    const tabs = [
      { btn: this._tabRoshn, id: 'roshn' },
      { btn: this._tabAfc, id: 'afc' },
      { btn: this._tabKing, id: 'king' },
    ];

    tabs.forEach(({ btn, id }) => {
      if (btn) {
        btn.addEventListener('click', () => {
          tabs.forEach(t => t.btn.classList.remove('active'));
          btn.classList.add('active');
          this._currentTab = id;
          if (this._cachedStandingsData) {
            this.renderTournaments(this._cachedStandingsData);
          }
        });
      }
    });

    // Initial Fetch
    this.fetchData();

    // Periodic Refresh every 30s
    this._pollTimer = setInterval(() => this.fetchData(), 30000);
  }

  disconnectedCallback() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  async fetchData() {
    try {
      const [matchesRes, standingsRes] = await Promise.all([
        fetch('/api/matches/today').catch(() => null),
        fetch('/api/matches/saudi-standings').catch(() => null)
      ]);

      if (matchesRes && matchesRes.ok) {
        const matchesData = await matchesRes.json();
        this._cachedMatchesData = matchesData;
        this.renderMatches(matchesData);
      }

      if (standingsRes && standingsRes.ok) {
        const standingsData = await standingsRes.json();
        this._cachedStandingsData = standingsData;
        this.renderTournaments(standingsData);
      }
    } catch (err) {
      console.warn('DashboardMatches fetch error:', err);
    }
  }

  renderMatches(data) {
    if (!this._matchesContainer) return;

    const allMatches = data.matches || [];
    const saudiMatches = data.saudi_matches || (data.saudi_round?.matches) || allMatches.filter(m => m.is_saudi);
    const upcomingMatches = data.upcoming_matches || [];
    const saudiRound = data.saudi_round || {};

    let displayList = [];
    if (this._currentFilter === 'upcoming') {
      displayList = upcomingMatches.length > 0 ? upcomingMatches : allMatches.filter(m => !m.is_ended && !m.is_live);
      this._roundTitleLabel.textContent = 'المباريات القادمة - أقوى المواجهات';
    } else if (this._currentFilter === 'saudi') {
      const roshnOnly = (saudiMatches || []).filter(m => (m.competition_id === 649 || m.is_roshn) && !m.is_saudi_nt);
      displayList = roshnOnly.length > 0 ? roshnOnly : allMatches.filter(m => (m.competition_id === 649 || m.is_roshn) && !m.is_saudi_nt);
      const rName = saudiRound.round_name ? `دوري روشن - ${saudiRound.round_name}` : 'دوري روشن السعودي';
      this._roundTitleLabel.textContent = rName;
    } else if (this._currentFilter === 'live') {
      displayList = allMatches.filter(m => m.is_live);
      this._roundTitleLabel.textContent = 'مباريات جارية الآن مباشرة 🔴';
    } else {
      // 'all' (الكل)
      displayList = allMatches;
      this._roundTitleLabel.textContent = 'أشهر 5 دوريات بالعالم والكرة السعودية 🌍';
    }

    if (displayList.length === 0) {
      this._matchesContainer.innerHTML = `
        <div class="empty-state">
          <span>⚽</span>
          <span>لا توجد مباريات في هذا التصنيف حالياً</span>
        </div>
      `;
      return;
    }

    let lastDateKey = null;
    const now = new Date();
    const todayKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');

    // 1. Determine Anchor Index (Today's matches, live matches, or the first upcoming match)
    let anchorIdx = displayList.findIndex(m => m.is_live || (m.date_key && m.date_key === todayKey));
    if (anchorIdx === -1) {
      anchorIdx = displayList.findIndex(m => !m.is_ended);
    }
    if (anchorIdx === -1) {
      anchorIdx = 0;
    }

    let anchorPlaced = false;
    const htmlParts = [];

    for (let idx = 0; idx < displayList.length; idx++) {
      const m = displayList[idx];
      const matchDateKey = m.date_key || (m.start_time ? m.start_time.slice(0, 10) : '');

      let separatorAnchorAttr = '';
      if (!anchorPlaced && idx === anchorIdx) {
        separatorAnchorAttr = 'id="today-anchor"';
        anchorPlaced = true;
      }

      if (matchDateKey && matchDateKey !== lastDateKey) {
        lastDateKey = matchDateKey;
        const isToday = matchDateKey === todayKey;
        const dayText = m.day_label || matchDateKey;
        const badgeLabel = isToday ? `اليوم • ${dayText}` : dayText;

        htmlParts.push(`
          <div class="day-separator" ${separatorAnchorAttr}>
            <div class="day-sep-line"></div>
            <div class="day-sep-badge ${isToday ? 'is-today' : ''}">
              <span>📅</span>
              <span>${badgeLabel}</span>
            </div>
            <div class="day-sep-line"></div>
          </div>
        `);
      }

      let matchAnchorAttr = '';
      if (!anchorPlaced && idx === anchorIdx) {
        matchAnchorAttr = 'id="today-anchor"';
        anchorPlaced = true;
      }

      const isLive = m.is_live;
      const isEnded = m.is_ended;
      const isUpcoming = !isLive && !isEnded;
      
      let scoreHtml = '';
      let statusBadge = '';

      if (isLive) {
        scoreHtml = `<div class="score-numbers live-score">${m.home_score ?? 0} - ${m.away_score ?? 0}</div>`;
        statusBadge = `<div class="match-status-badge status-live">🔴 مباشر ${m.status_text || ''}</div>`;
      } else if (isEnded) {
        scoreHtml = `<div class="score-numbers">${m.home_score ?? 0} - ${m.away_score ?? 0}</div>`;
        statusBadge = `<div class="match-status-badge status-ended">${m.status_text || 'انتهت'}</div>`;
      } else {
        const timeStr = m.start_time_display || '--:--';
        scoreHtml = `<div class="score-numbers upcoming-score">${timeStr}</div>`;
        statusBadge = `<div class="match-status-badge status-upcoming">⏳ ${m.status_text || 'قادمة'}</div>`;
      }

      const { flag: flagSvg, badgeClass: specificCompClass } = getCompMeta(m);
      let compBadgeClass = 'match-comp-badge';
      if (specificCompClass) {
        compBadgeClass += ` ${specificCompClass}`;
      }

      let compLabel = m.competition_name || '';
      // Strip any duplicate emoji or country code prefix
      compLabel = compLabel.replace(/^[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1F6FF}\u{2600}-\u{26FF}\s]+/u, '').trim();

      const compBadge = compLabel ? `<span class="${compBadgeClass}">${flagSvg}<span>${compLabel}</span></span>` : '';
      const channelBadge = m.channel ? `<span class="match-channel-badge">📺 ${m.channel}</span>` : '';

      htmlParts.push(`
        <div class="match-item ${isLive ? 'is-live' : ''} ${isUpcoming ? 'is-upcoming-item' : ''}" ${matchAnchorAttr}>
          <div class="team-cell home">
            <img class="team-logo" src="${m.home_logo}" alt="${m.home_name}" onerror="this.style.opacity=0.3">
            <span class="team-name">${m.home_name}</span>
          </div>

          <div class="score-cell">
            <div class="match-meta-row">
              ${compBadge}
              ${channelBadge}
            </div>
            ${scoreHtml}
            ${statusBadge}
          </div>

          <div class="team-cell away">
            <span class="team-name">${m.away_name}</span>
            <img class="team-logo" src="${m.away_logo}" alt="${m.away_name}" onerror="this.style.opacity=0.3">
          </div>
        </div>
      `);
    }

    this._matchesContainer.innerHTML = htmlParts.join('');
    this._scrollToAnchor();
  }

  _scrollToAnchor() {
    requestAnimationFrame(() => {
      if (!this._matchesContainer) return;
      const anchor = this._matchesContainer.querySelector('#today-anchor');
      if (anchor) {
        this._matchesContainer.scrollTop = anchor.offsetTop - this._matchesContainer.offsetTop;
      }
    });
  }

  renderTournaments(data) {
    if (!this._standingsTable || !this._kingsCupContainer) return;

    if (this._currentTab === 'roshn') {
      // 1. Roshn Saudi League Standings
      this._standingsTable.style.display = 'table';
      this._kingsCupContainer.style.display = 'none';
      this._standingsLegend.style.display = 'flex';
      this._legendTextTop.textContent = 'دوري أبطال آسيا للنخبة (1-3)';
      this._legendItemBottom.style.display = 'flex';

      const standings = data.roshn?.standings || data.standings || [];
      this.renderTableRows(standings, true);
    } else if (this._currentTab === 'afc') {
      // 2. AFC Champions League Elite Standings
      this._standingsTable.style.display = 'table';
      this._kingsCupContainer.style.display = 'none';
      this._standingsLegend.style.display = 'flex';
      this._legendTextTop.textContent = 'المراكز المؤهلة لثمن النهائي (1-8)';
      this._legendItemBottom.style.display = 'none';

      const afcStandings = data.afc?.standings || [];
      this.renderTableRows(afcStandings, false, 8);
    } else if (this._currentTab === 'king') {
      // 3. King's Cup Matches / Bracket
      this._standingsTable.style.display = 'none';
      this._kingsCupContainer.style.display = 'block';
      this._standingsLegend.style.display = 'none';

      const kingMatches = data.king?.matches || [];
      this.renderKingCupMatches(kingMatches);
    }
  }

  renderTableRows(standings, isRoshn = true, qualifyCutoff = 3) {
    if (standings.length === 0) {
      this._standingsTbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 20px; color: var(--text-muted);">
            لا توجد بيانات ترتيب متاحة حالياً
          </td>
        </tr>
      `;
      return;
    }

    this._standingsTbody.innerHTML = standings.map(row => {
      const pos = row.position;
      let rankClass = 'col-rank';
      if (pos === 1) rankClass += ' rank-top';
      else if (pos <= qualifyCutoff) rankClass += ' rank-afc';
      else if (isRoshn && pos >= 16) rankClass += ' rank-relegation';

      const goalDiff = row.goal_diff > 0 ? `+${row.goal_diff}` : `${row.goal_diff}`;

      return `
        <tr>
          <td class="${rankClass}">${pos}</td>
          <td>
            <div class="team-cell-table">
              <img class="table-logo" src="${row.team_logo}" alt="${row.team_name}" onerror="this.style.opacity=0.3">
              <span class="table-team-name">${row.team_name}</span>
            </div>
          </td>
          <td class="col-num">${row.played}</td>
          <td class="col-num" style="color: ${row.goal_diff > 0 ? 'var(--neon-green)' : (row.goal_diff < 0 ? 'var(--neon-red)' : '#E2E8F0')};">${goalDiff}</td>
          <td class="col-pts">${row.points}</td>
        </tr>
      `;
    }).join('');
  }

  renderKingCupMatches(matches) {
    if (matches.length === 0) {
      this._kingsCupContainer.innerHTML = `
        <div class="empty-state">
          <span>🏆</span>
          <span>لا توجد مباريات مسجلة لكأس خادم الحرمين الشريفين حالياً</span>
        </div>
      `;
      return;
    }

    this._kingsCupContainer.innerHTML = matches.map(m => {
      const homeScore = m.home_score ?? '-';
      const awayScore = m.away_score ?? '-';
      const stageText = m.stage_name || 'كأس الملك';
      const homeQualified = m.home_qualified ? '<span class="qualified-badge">✓ تأهل</span>' : '';
      const awayQualified = m.away_qualified ? '<span class="qualified-badge">✓ تأهل</span>' : '';

      return `
        <div class="cup-match-item">
          <div class="team-cell home">
            <img class="team-logo" src="${m.home_logo}" alt="${m.home_name}" onerror="this.style.opacity=0.3">
            <span class="team-name">${homeQualified}${m.home_name}</span>
          </div>

          <div class="score-cell">
            <div class="score-numbers" style="font-size: 24px;">${homeScore} - ${awayScore}</div>
            <div class="match-status-badge status-ended">${stageText}</div>
          </div>

          <div class="team-cell away">
            <span class="team-name">${m.away_name}${awayQualified}</span>
            <img class="team-logo" src="${m.away_logo}" alt="${m.away_name}" onerror="this.style.opacity=0.3">
          </div>
        </div>
      `;
    }).join('');
  }
}

customElements.define('dashboard-matches', DashboardMatches);
