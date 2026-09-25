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
  .appointments-icon {
    color: var(--neon-yellow, #FACC15);
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
    color: var(--text-muted, #94A3B8);
  }

  .header-actions-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .apt-manage-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 8px;
    background: rgba(34, 211, 238, 0.1);
    border: 1px solid rgba(34, 211, 238, 0.25);
    color: var(--neon-cyan, #22D3EE);
    font-family: var(--font-arabic, 'Cairo', sans-serif);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .apt-manage-btn:hover {
    background: rgba(34, 211, 238, 0.22);
    border-color: rgba(34, 211, 238, 0.5);
    box-shadow: 0 0 10px rgba(34, 211, 238, 0.3);
    transform: translateY(-1px);
  }

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
    font-family: var(--font-arabic, 'Cairo', sans-serif);
    font-weight: 800;
    color: var(--text-pure-white, #F8FAFC);
    font-size: 17px;
  }
  .badge-val-group {
    display: flex;
    align-items: baseline;
    gap: 4px;
    direction: ltr;
  }
  .badge-value {
    font-family: var(--font-numbers, monospace);
    font-weight: 800;
    font-size: 22px;
    color: var(--text-pure-white, #FFFFFF);
  }
  .badge-unit {
    font-family: var(--font-arabic, 'Cairo', sans-serif);
    font-size: 15px;
    font-weight: 800;
    color: var(--neon-cyan, #22D3EE);
  }

  /* Appointments Body */
  .appointments-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
    min-height: 0;
    justify-content: space-between;
  }

  /* Hero Next Appointment Banner */
  .apt-hero-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 5px 12px;
    border-radius: 12px;
    background: linear-gradient(135deg, rgba(251, 191, 36, 0.08) 0%, rgba(34, 211, 238, 0.05) 100%);
    border: 1px solid rgba(251, 191, 36, 0.25);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
  }

  .apt-hero-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
    flex: 1;
  }

  .apt-hero-tag-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .apt-category-pill {
    font-family: var(--font-arabic, 'Cairo', sans-serif);
    font-size: 13px;
    font-weight: 700;
    padding: 1px 9px;
    border-radius: 6px;
    background: rgba(34, 211, 238, 0.15);
    color: var(--neon-cyan, #22D3EE);
    border: 1px solid rgba(34, 211, 238, 0.3);
    white-space: nowrap;
  }

  .apt-category-pill.category-work {
    background: rgba(56, 189, 248, 0.15);
    color: #38BDF8;
    border-color: rgba(56, 189, 248, 0.35);
  }
  .apt-category-pill.category-meeting {
    background: rgba(192, 132, 252, 0.15);
    color: #C084FC;
    border-color: rgba(192, 132, 252, 0.35);
  }
  .apt-category-pill.category-urgent {
    background: rgba(248, 113, 113, 0.15);
    color: #F87171;
    border-color: rgba(248, 113, 113, 0.35);
  }
  .apt-category-pill.category-personal {
    background: rgba(52, 211, 153, 0.15);
    color: #34D399;
    border-color: rgba(52, 211, 153, 0.35);
  }
  .apt-category-pill.category-health {
    background: rgba(251, 146, 60, 0.15);
    color: #FB923C;
    border-color: rgba(251, 146, 60, 0.35);
  }

  .apt-status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--neon-cyan, #22D3EE);
    box-shadow: 0 0 6px var(--neon-cyan, #22D3EE);
  }

  .apt-status-indicator.pulse-cyan {
    animation: pulse-dot 2s infinite ease-in-out;
  }

  .apt-status-indicator.pulse-green {
    background: #10B981;
    box-shadow: 0 0 6px #10B981;
    animation: pulse-dot 1.5s infinite ease-in-out;
  }

  @keyframes pulse-dot {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(0.85); }
  }

  .apt-status-label {
    font-family: var(--font-arabic, 'Cairo', sans-serif);
    font-size: 14px;
    font-weight: 700;
    color: #CBD5E1;
  }

  .apt-hero-title {
    font-family: var(--font-arabic, 'Cairo', sans-serif);
    font-size: 17px;
    font-weight: 800;
    color: var(--text-pure-white, #FFFFFF);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin: 0;
    max-width: 320px;
  }

  .apt-hero-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font-arabic, 'Cairo', sans-serif);
    font-size: 13px;
    color: var(--text-muted, #94A3B8);
  }

  .apt-meta-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .apt-meta-icon {
    font-size: 13px;
  }

  .apt-meta-sep {
    color: rgba(255, 255, 255, 0.25);
    font-size: 11px;
  }

  .apt-hero-countdown-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3px 10px;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.08);
    min-width: 105px;
  }

  .apt-hero-countdown-box .countdown-sub-label {
    font-family: var(--font-arabic, 'Cairo', sans-serif);
    font-size: 13px;
    font-weight: 700;
    color: var(--text-muted, #94A3B8);
  }

  .apt-hero-countdown-box .countdown-hero-digits {
    font-family: var(--font-numbers, monospace);
    font-size: 24px;
    font-weight: 800;
    color: var(--neon-cyan, #22D3EE);
    font-variant-numeric: tabular-nums;
    direction: ltr;
    text-shadow: 0 0 12px rgba(34, 211, 238, 0.35);
  }

  /* Timeline List */
  .apt-timeline-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-height: 0;
    max-height: 165px;
    overflow-y: auto;
    padding-left: 2px;
  }

  .apt-timeline-list::-webkit-scrollbar {
    width: 3px;
  }

  .apt-timeline-list::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
  }

  .apt-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 3px 10px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.025);
    border: 1px solid rgba(255, 255, 255, 0.05);
    transition: all 0.2s ease;
  }

  .apt-item:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .apt-item.status-ongoing {
    border-color: rgba(34, 211, 238, 0.35);
    background: rgba(34, 211, 238, 0.06);
  }

  .apt-item.status-completed {
    opacity: 0.5;
  }

  .apt-item-main {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
    flex: 1;
  }

  .apt-item-time {
    font-family: var(--font-arabic, 'Cairo', sans-serif);
    font-size: 15px;
    font-weight: 700;
    color: var(--text-pure-white, #E2E8F0);
    min-width: 68px;
    direction: rtl;
    text-align: right;
    white-space: nowrap;
  }

  .apt-item-title {
    font-family: var(--font-arabic, 'Cairo', sans-serif);
    font-size: 15px;
    font-weight: 700;
    color: var(--text-pure-white, #F8FAFC);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .apt-item-badges {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .apt-item-status-pill {
    font-family: var(--font-arabic, 'Cairo', sans-serif);
    font-size: 12px;
    font-weight: 700;
    padding: 1px 8px;
    border-radius: 4px;
  }

  .apt-item-status-pill.status-upcoming {
    background: rgba(148, 163, 184, 0.12);
    color: #94A3B8;
  }

  .apt-item-status-pill.status-ongoing {
    background: rgba(34, 211, 238, 0.18);
    color: var(--neon-cyan, #22D3EE);
    border: 1px solid rgba(34, 211, 238, 0.35);
  }

  .apt-item-status-pill.status-completed {
    background: rgba(255, 255, 255, 0.04);
    color: #64748B;
  }

  .apt-empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 20px;
    font-family: var(--font-arabic, 'Cairo', sans-serif);
    font-size: 16px;
    font-weight: 700;
    color: #94A3B8;
    border: 1px dashed rgba(255, 255, 255, 0.1);
    border-radius: 8px;
  }

  /* Native HTML5 Dialog Modal in Top Layer */
  dialog.apt-dialog {
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 20px;
    background: linear-gradient(135deg, rgba(25, 33, 56, 0.98) 0%, rgba(15, 23, 42, 0.99) 100%);
    box-shadow: 0 25px 70px rgba(0, 0, 0, 0.85), 0 0 40px rgba(34, 211, 238, 0.2);
    color: #FFFFFF;
    width: 90vw;
    max-width: 580px;
    max-height: 85vh;
    padding: 0;
    margin: auto;
    overflow: hidden;
    animation: modal-pop 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  dialog.apt-dialog::backdrop {
    background: rgba(11, 16, 32, 0.85);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
  }

  @keyframes modal-pop {
    from { transform: scale(0.94); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  .apt-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.02);
  }

  .modal-title-wrap {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .modal-icon { font-size: 20px; }
  .modal-title {
    font-family: var(--font-arabic, 'Cairo', sans-serif);
    font-size: 20px;
    font-weight: 800;
    color: #FFFFFF;
    margin: 0;
  }

  .modal-close-btn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #94A3B8;
    font-size: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }
  .modal-close-btn:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.4);
    color: #EF4444;
  }

  .apt-modal-content {
    padding: 20px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .form-section-title {
    font-family: var(--font-arabic, 'Cairo', sans-serif);
    font-size: 16px;
    font-weight: 800;
    color: var(--neon-cyan, #22D3EE);
    margin: 0 0 12px 0;
  }

  .form-row {
    display: flex;
    gap: 12px;
    margin-bottom: 12px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .flex-1 { flex: 1; }
  .flex-2 { flex: 2; }

  .form-label {
    font-family: var(--font-arabic, 'Cairo', sans-serif);
    font-size: 13px;
    font-weight: 700;
    color: #CBD5E1;
  }

  .form-input {
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    padding: 8px 12px;
    color: #F8FAFC;
    font-family: var(--font-arabic, 'Cairo', sans-serif);
    font-size: 14px;
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .form-input:focus {
    border-color: var(--neon-cyan, #22D3EE);
    box-shadow: 0 0 10px rgba(34, 211, 238, 0.2);
  }

  .form-select {
    cursor: pointer;
    background: #0F172A;
  }

  .form-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 4px;
    gap: 12px;
  }

  .btn-submit-apt {
    background: linear-gradient(135deg, #06B6D4 0%, #3B82F6 100%);
    color: #FFFFFF;
    border: none;
    border-radius: 8px;
    padding: 9px 20px;
    font-family: var(--font-arabic, 'Cairo', sans-serif);
    font-size: 14px;
    font-weight: 800;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(6, 182, 212, 0.3);
    transition: all 0.2s ease;
  }

  .btn-submit-apt:hover {
    box-shadow: 0 6px 20px rgba(6, 182, 212, 0.5);
    transform: translateY(-1px);
  }

  .form-feedback {
    font-family: var(--font-arabic, 'Cairo', sans-serif);
    font-size: 13px;
    font-weight: 700;
  }
  .form-feedback.success { color: #10B981; }
  .form-feedback.error { color: #EF4444; }

  .apt-manage-items {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 200px;
    overflow-y: auto;
  }

  .apt-manage-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 10px;
    gap: 10px;
  }

  .manage-item-info {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
    flex: 1;
  }

  .manage-item-time {
    font-family: var(--font-numbers, monospace);
    font-size: 14px;
    font-weight: 800;
    color: var(--neon-cyan, #22D3EE);
    min-width: 55px;
    direction: ltr;
  }

  .manage-item-title {
    font-family: var(--font-arabic, 'Cairo', sans-serif);
    font-size: 14px;
    font-weight: 700;
    color: #F8FAFC;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .btn-delete-apt {
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #F87171;
    border-radius: 6px;
    padding: 4px 10px;
    cursor: pointer;
    font-family: var(--font-arabic, 'Cairo', sans-serif);
    font-size: 12px;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 4px;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .btn-delete-apt:hover {
    background: rgba(239, 68, 68, 0.3);
    border-color: rgba(239, 68, 68, 0.6);
    color: #FFFFFF;
  }
</style>

<div class="card-header">
  <div class="card-title-group">
    <div class="card-icon appointments-icon">
      <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
      </svg>
    </div>
    <div>
      <h2 class="card-title">المواعيد اليومية</h2>
      <span class="card-sub">DAILY SCHEDULE</span>
    </div>
  </div>
  <div class="header-actions-group">
    <button class="apt-manage-btn" id="btn-open-modal" title="إدارة وإضافة المواعيد">
      <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
      <span>إدارة المواعيد</span>
    </button>
    <div class="card-badge" id="appointments-badge">
      <span class="badge-label">متبقي لليوم</span>
      <span class="badge-val-group" dir="ltr">
        <span class="badge-value" id="apt_remaining_count">--</span>
        <span class="badge-unit">مواعيد</span>
      </span>
    </div>
  </div>
</div>

<div class="appointments-body">
  <!-- Hero Section: Next Appointment & Countdown -->
  <div class="apt-hero-banner" id="apt-hero-banner">
    <div class="apt-hero-info">
      <div class="apt-hero-tag-row">
        <span class="apt-category-pill" id="apt_hero_category">عمل</span>
        <span class="apt-status-indicator pulse-cyan" id="apt_hero_status_dot"></span>
        <span class="apt-status-label" id="apt_hero_status_label">الموعد القادم</span>
      </div>
      <h3 class="apt-hero-title" id="apt_hero_title">جاري تحميل المواعيد...</h3>
      <div class="apt-hero-meta">
        <span class="apt-meta-item">
          <span class="apt-meta-icon">🕒</span>
          <span id="apt_hero_time">--:--</span>
        </span>
        <span class="apt-meta-sep">•</span>
        <span class="apt-meta-item" id="apt_hero_location_wrapper">
          <span class="apt-meta-icon">📍</span>
          <span id="apt_hero_location">--</span>
        </span>
      </div>
    </div>

    <div class="apt-hero-countdown-box">
      <span class="countdown-sub-label" id="apt_countdown_label">متبقي</span>
      <span class="countdown-hero-digits" id="apt_hero_countdown">--:--:--</span>
    </div>
  </div>

  <!-- Appointments Scrollable List -->
  <div class="apt-timeline-list" id="apt-timeline-list">
    <!-- Dynamically populated via JS -->
  </div>
</div>

<!-- HTML5 Top-Layer Dialog -->
<dialog class="apt-dialog" id="apt-dialog">
  <div class="apt-modal-header">
    <div class="modal-title-wrap">
      <span class="modal-icon">📅</span>
      <h3 class="modal-title">إدارة المواعيد اليومية</h3>
    </div>
    <button class="modal-close-btn" id="btn-close-modal" title="إغلاق">✕</button>
  </div>

  <div class="apt-modal-content">
    <!-- Section 1: Add Form -->
    <form class="apt-add-form" id="apt-form">
      <h4 class="form-section-title">✨ إضافة موعد جديد</h4>
      <div class="form-row">
        <div class="form-group flex-2">
          <label class="form-label" for="input-title">عنوان الموعد</label>
          <input class="form-input" id="input-title" type="text" placeholder="مثال: جلسة عمل برمجية" required />
        </div>
        <div class="form-group flex-1">
          <label class="form-label" for="input-time">الوقت (24h)</label>
          <input class="form-input" id="input-time" type="time" required />
        </div>
      </div>

      <div class="form-row">
        <div class="form-group flex-1">
          <label class="form-label" for="input-category">التصنيف</label>
          <select class="form-input form-select" id="input-category">
            <option value="work" data-label="عمل">عمل (Work)</option>
            <option value="meeting" data-label="اجتماع">اجتماع (Meeting)</option>
            <option value="personal" data-label="شخصي">شخصي (Personal)</option>
            <option value="urgent" data-label="هام">هام (Urgent)</option>
            <option value="health" data-label="صحة">صحة (Health)</option>
          </select>
        </div>
        <div class="form-group flex-2">
          <label class="form-label" for="input-location">المكان أو المنصة (اختياري)</label>
          <input class="form-input" id="input-location" type="text" placeholder="مثال: المكتب / Zoom / المنزل" />
        </div>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn-submit-apt" id="btn-submit-apt">
          <span>+ إضافة الموعد الآن</span>
        </button>
        <span class="form-feedback" id="form-feedback"></span>
      </div>
    </form>

    <!-- Section 2: Manage List -->
    <div class="apt-manage-list-section">
      <h4 class="form-section-title">📋 مواعيد اليوم المسجلة</h4>
      <div class="apt-manage-items" id="apt-manage-items">
        <!-- Populated via JS -->
      </div>
    </div>
  </div>
</dialog>
`;

function formatSecondsToHMS(totalSecs) {
  if (totalSecs === null || totalSecs === undefined || isNaN(totalSecs)) return '--:--:--';
  const s = Math.max(0, Math.floor(totalSecs));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export class DashboardAppointments extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.dom = {
      remaining: this.shadowRoot.getElementById('apt_remaining_count'),
      hero_title: this.shadowRoot.getElementById('apt_hero_title'),
      hero_time: this.shadowRoot.getElementById('apt_hero_time'),
      hero_location: this.shadowRoot.getElementById('apt_hero_location'),
      hero_location_wrapper: this.shadowRoot.getElementById('apt_hero_location_wrapper'),
      hero_category: this.shadowRoot.getElementById('apt_hero_category'),
      hero_status_dot: this.shadowRoot.getElementById('apt_hero_status_dot'),
      hero_status_label: this.shadowRoot.getElementById('apt_hero_status_label'),
      countdown_label: this.shadowRoot.getElementById('apt_countdown_label'),
      countdown: this.shadowRoot.getElementById('apt_hero_countdown'),
      timeline_list: this.shadowRoot.getElementById('apt-timeline-list'),
      // Dialog DOM
      btn_open: this.shadowRoot.getElementById('btn-open-modal'),
      btn_close: this.shadowRoot.getElementById('btn-close-modal'),
      dialog: this.shadowRoot.getElementById('apt-dialog'),
      form: this.shadowRoot.getElementById('apt-form'),
      input_title: this.shadowRoot.getElementById('input-title'),
      input_time: this.shadowRoot.getElementById('input-time'),
      input_category: this.shadowRoot.getElementById('input-category'),
      input_location: this.shadowRoot.getElementById('input-location'),
      form_feedback: this.shadowRoot.getElementById('form-feedback'),
      manage_items: this.shadowRoot.getElementById('apt-manage-items'),
    };

    this.timerState = {
      nextSecsBase: null,
      isOngoing: false,
      lastUpdateMs: null,
    };

    this.currentItems = [];

    this.onStateChange = this.onStateChange.bind(this);
    this.tick = this.tick.bind(this);
    this.openModal = this.openModal.bind(this);
    this.closeModal = this.closeModal.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.isRunning = false;
  }

  connectedCallback() {
    this.unsubscribe = EventBus.on('state-changed', this.onStateChange);
    this.unsubscribeData = EventBus.on('telemetry:data', this.onStateChange);
    this.isRunning = true;
    requestAnimationFrame(this.tick);

    // Modal Events
    if (this.dom.btn_open) {
      this.dom.btn_open.addEventListener('click', this.openModal);
    }
    if (this.dom.btn_close) {
      this.dom.btn_close.addEventListener('click', this.closeModal);
    }
    if (this.dom.dialog) {
      this.dom.dialog.addEventListener('click', (e) => {
        const rect = this.dom.dialog.getBoundingClientRect();
        const isInDialog = (rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
                            rect.left <= e.clientX && e.clientX <= rect.left + rect.width);
        if (!isInDialog) {
          this.closeModal();
        }
      });
    }
    if (this.dom.form) {
      this.dom.form.addEventListener('submit', this.handleSubmit);
    }
  }

  disconnectedCallback() {
    this.isRunning = false;
    if (this.unsubscribe) this.unsubscribe();
    if (this.unsubscribeData) this.unsubscribeData();
  }

  openModal() {
    if (!this.dom.dialog) return;
    this.dom.dialog.showModal();
    this.refreshManageList();
    if (this.dom.input_title) this.dom.input_title.focus();
  }

  closeModal() {
    if (!this.dom.dialog) return;
    this.dom.dialog.close();
    if (this.dom.form_feedback) this.dom.form_feedback.textContent = '';
  }

  async handleSubmit(e) {
    e.preventDefault();
    const title = this.dom.input_title.value.trim();
    const time = this.dom.input_time.value.trim();
    const catSelect = this.dom.input_category;
    const category = catSelect.value;
    const category_label = catSelect.options[catSelect.selectedIndex].getAttribute('data-label') || 'عمل';
    const location = this.dom.input_location.value.trim();

    if (!title || !time) return;

    try {
      this.setFeedback('جاري الحفظ...', '');
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          time,
          category,
          category_label,
          location
        })
      });

      if (!res.ok) {
        throw new Error(`خطأ في الإضافة (${res.status})`);
      }

      this.setFeedback('✓ تمت إضافة الموعد بنجاح!', 'success');
      this.dom.input_title.value = '';
      this.dom.input_location.value = '';

      // Reload appointments
      await this.refreshManageList();

      setTimeout(() => {
        if (this.dom.form_feedback) this.dom.form_feedback.textContent = '';
      }, 3000);
    } catch (err) {
      console.error('Failed to add appointment:', err);
      this.setFeedback('فشل في إضافة الموعد', 'error');
    }
  }

  async deleteAppointment(id) {
    try {
      const res = await fetch(`/api/appointments/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error(`فشل الحذف (${res.status})`);
      }
      await this.refreshManageList();
    } catch (err) {
      console.error('Failed to delete appointment:', err);
    }
  }

  async refreshManageList() {
    try {
      const res = await fetch('/api/appointments');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.today_appointments)) {
          this.currentItems = data.today_appointments;
          this.renderTimeline(this.currentItems);
          this.renderManageItems(this.currentItems);
        }
      }
    } catch (err) {
      this.renderManageItems(this.currentItems);
    }
  }

  renderManageItems(items) {
    if (!this.dom.manage_items) return;
    if (!items || items.length === 0) {
      this.dom.manage_items.innerHTML = '<div class="apt-empty-state">لا توجد مواعيد مسجلة</div>';
      return;
    }

    this.dom.manage_items.innerHTML = '';
    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'apt-manage-item';

      const info = document.createElement('div');
      info.className = 'manage-item-info';

      const timeSpan = document.createElement('span');
      timeSpan.className = 'manage-item-time';
      timeSpan.textContent = item.time_12h || item.time;

      const titleSpan = document.createElement('span');
      titleSpan.className = 'manage-item-title';
      titleSpan.textContent = item.title;

      const catSpan = document.createElement('span');
      catSpan.className = `apt-category-pill category-${item.category || 'work'}`;
      catSpan.textContent = item.category_label || item.category;

      info.appendChild(timeSpan);
      info.appendChild(titleSpan);
      info.appendChild(catSpan);

      const delBtn = document.createElement('button');
      delBtn.className = 'btn-delete-apt';
      delBtn.innerHTML = '🗑️ حذف';
      delBtn.addEventListener('click', () => {
        this.deleteAppointment(item.id);
      });

      row.appendChild(info);
      row.appendChild(delBtn);
      this.dom.manage_items.appendChild(row);
    });
  }

  setFeedback(text, type) {
    if (!this.dom.form_feedback) return;
    this.dom.form_feedback.textContent = text;
    this.dom.form_feedback.className = `form-feedback ${type}`;
  }

  onStateChange(data) {
    if (data.appointments_remaining !== undefined && this.dom.remaining) {
      this.dom.remaining.textContent = (data.appointments_remaining !== null) ? data.appointments_remaining : '--';
    }

    if (data.next_appointment_title) {
      if (this.dom.hero_title) this.dom.hero_title.textContent = data.next_appointment_title;
      if (this.dom.hero_time && data.next_appointment_time) this.dom.hero_time.textContent = data.next_appointment_time;
      if (this.dom.hero_category && data.next_appointment_category_label) {
        this.dom.hero_category.textContent = data.next_appointment_category_label;
        this.dom.hero_category.className = `apt-category-pill category-${data.next_appointment_category || 'work'}`;
      }
      if (data.next_appointment_ongoing) {
        if (this.dom.hero_status_label) this.dom.hero_status_label.textContent = 'جاري الآن';
        if (this.dom.hero_status_dot) this.dom.hero_status_dot.className = 'apt-status-indicator pulse-green';
        if (this.dom.countdown_label) this.dom.countdown_label.textContent = 'منذ البدء';
        this.timerState.isOngoing = true;
      } else {
        if (this.dom.hero_status_label) this.dom.hero_status_label.textContent = 'الموعد القادم';
        if (this.dom.hero_status_dot) this.dom.hero_status_dot.className = 'apt-status-indicator pulse-cyan';
        if (this.dom.countdown_label) this.dom.countdown_label.textContent = 'متبقي';
        this.timerState.isOngoing = false;
      }

      if (this.dom.hero_location && this.dom.hero_location_wrapper) {
        if (data.next_appointment_location) {
          this.dom.hero_location.textContent = data.next_appointment_location;
          this.dom.hero_location_wrapper.style.display = 'inline-flex';
        } else {
          this.dom.hero_location_wrapper.style.display = 'none';
        }
      }

      if (data.next_appointment_seconds !== undefined && data.next_appointment_seconds !== null) {
        this.timerState.nextSecsBase = data.next_appointment_seconds;
        this.timerState.lastUpdateMs = Date.now();
      }
    } else if (data.appointments_count !== undefined) {
      if (this.dom.hero_title) this.dom.hero_title.textContent = 'لا توجد مواعيد متبقية لليوم';
      if (this.dom.hero_time) this.dom.hero_time.textContent = '--:--';
      if (this.dom.countdown) this.dom.countdown.textContent = '00:00:00';
      if (this.dom.hero_status_label) this.dom.hero_status_label.textContent = 'مكتمل';
      if (this.dom.hero_status_dot) this.dom.hero_status_dot.className = 'apt-status-indicator';
    }

    if (Array.isArray(data.today_appointments)) {
      this.currentItems = data.today_appointments;
      if (this.dom.timeline_list) {
        this.renderTimeline(this.currentItems);
      }
    }
  }

  renderTimeline(items) {
    if (!this.dom.timeline_list) return;
    if (!items || items.length === 0) {
      this.dom.timeline_list.innerHTML = '<div class="apt-empty-state">✨ لا توجد مواعيد مسجلة لليوم</div>';
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
    this.dom.timeline_list.innerHTML = html;
  }

  tick() {
    if (!this.isRunning) return;

    if (this.timerState.lastUpdateMs && this.dom.countdown && this.timerState.nextSecsBase !== null) {
      const elapsed = (Date.now() - this.timerState.lastUpdateMs) / 1000.0;
      if (this.timerState.isOngoing) {
        const cur = this.timerState.nextSecsBase + elapsed;
        this.dom.countdown.textContent = formatSecondsToHMS(cur);
      } else {
        const cur = Math.max(0, this.timerState.nextSecsBase - elapsed);
        this.dom.countdown.textContent = formatSecondsToHMS(cur);
      }
    }

    requestAnimationFrame(this.tick);
  }
}

customElements.define('dashboard-appointments', DashboardAppointments);
