import './audio-signal-meter.js?v=20261103.audio11';

// Called by the component that owns the target. No document/shadow-root searches.
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const level = channel => channel?.volume == null ? '—' : `${Math.round(channel.volume)}%${channel.muted === true ? ' 🔇' : ''}`;

export function renderSonarPanel(target, state, { detailed = false, liveInGrid = true } = {}) {
  if (!target) return;
  const broadcast = detailed && state.audio_broadcast?.available === true && state.audio_broadcast?.routes_ready === true;
  const signature = JSON.stringify([state.sonar_connected, state.sonar_mode, state.sonar_channels, state.sonar_profiles, detailed, liveInGrid, broadcast]);
  if (target.dataset.signature === signature) return;
  target.dataset.signature = signature;

  const connected = state.sonar_connected === true;
  const streaming = state.sonar_mode === 'stream';
  const channels = connected ? state.sonar_channels : null;
  const labels = {
    master: { name: 'Master', icon: '🔊' },
    game:   { name: 'Game',   icon: '🎮' },
    chat:   { name: 'Chat',   icon: '💬' },
    media:  { name: 'Media',  icon: '🎬' },
    aux:    { name: 'Aux',    icon: '🔌' },
    mic:    { name: 'Mic',    icon: '🎙️' },
  };

  target.innerHTML = `<style>
    .sonar-live {
      font-family: 'Cairo', var(--font-arabic, sans-serif);
      color: var(--text-primary, var(--ink, #fff));
    }
    .sonar-mode {
      font-size: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      margin-bottom: 7px;
    }
    .sonar-mode b {
      font-family: 'Cairo', var(--font-arabic, sans-serif);
      font-weight: 800;
      color: var(--text-pure-white, #FFFFFF);
      letter-spacing: 0.3px;
    }
    .sonar-mode small {
      font-family: 'Cairo', var(--font-arabic, sans-serif);
      font-weight: 700;
      color: var(--text-secondary, var(--muted, #94A3B8));
    }
    .sonar-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 6px;
    }
    .sonar-channel {
      min-width: 0;
      border: 1px solid var(--border-glass, rgba(255, 255, 255, 0.08));
      border-radius: 8px;
      padding: 6px 8px;
      background: var(--bg-card, rgba(255, 255, 255, 0.025));
      transition: border-color 0.2s ease, background 0.2s ease;
    }
    .sonar-channel:hover {
      background: rgba(255, 255, 255, 0.04);
      border-color: rgba(255, 255, 255, 0.14);
    }
    .sonar-channel-header {
      display: flex;
      align-items: center;
      gap: 5px;
      margin-bottom: 5px;
    }
    .sonar-channel-icon {
      font-size: 12px;
      line-height: 1;
    }
    .sonar-channel-name {
      font: 800 12px var(--font-numbers, var(--numbers, monospace));
      letter-spacing: 0.5px;
      color: #F8FAFC;
    }
    .sonar-level {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 5px;
      font-size: 11px;
      white-space: nowrap;
      min-height: 18px;
    }
    .sonar-tag {
      font-family: 'Cairo', var(--font-arabic, sans-serif);
      font-size: 11.5px;
      font-weight: 800;
      min-width: 40px;
      flex-shrink: 0;
    }
    .sonar-tag.tag-monitoring {
      color: var(--neon-cyan, #38BDF8);
    }
    .sonar-tag.tag-streaming {
      color: #A78BFA;
    }
    .sonar-tag.tag-classic {
      color: #94A3B8;
    }
    .sonar-meter-slot {
      flex: 1;
      min-width: 18px;
      display: flex;
      align-items: center;
    }
    .sonar-level-rail {
      width: 100%;
      height: 4px;
      background: rgba(255, 255, 255, 0.07);
      border-radius: 2px;
      overflow: hidden;
      position: relative;
    }
    .sonar-level-fill {
      height: 100%;
      border-radius: 2px;
      transition: width 0.25s ease;
    }
    .sonar-level-fill.fill-monitoring {
      background: linear-gradient(90deg, #0284C7, #38BDF8);
    }
    .sonar-level-fill.fill-streaming {
      background: linear-gradient(90deg, #7C3AED, #C084FC);
    }
    .sonar-level-fill.fill-classic {
      background: linear-gradient(90deg, #059669, #34D399);
    }
    .sonar-level audio-signal-meter {
      flex: 1;
      min-width: 18px;
    }
    .sonar-level strong {
      font: 800 13px var(--font-numbers, var(--numbers, monospace));
      direction: ltr;
      min-width: 38px;
      text-align: left;
      font-variant-numeric: tabular-nums;
      flex-shrink: 0;
      color: var(--text-pure-white, #FFFFFF);
    }
    .sonar-level+ .sonar-level {
      margin-top: 4px;
    }
    .sonar-note {
      font-size: 10px;
      line-height: 1.5;
      color: var(--text-secondary, var(--muted, #94A3B8));
      margin-top: 7px;
    }
  </style>
  <div class="sonar-live" title="${broadcast ? 'بث البرامج يجمع Game وMedia وAux؛ صوت Discord مستثنى والمايك مستقل' : 'مستويات ضبط مستقلة لكل مسار؛ Aux إعداد محفوظ؛ التوجيه والبروفايلات غير مقاسة'}">
    <div class="sonar-mode">
      <b>${connected ? streaming ? 'Streamer · الاستماع والبث' : 'Classic · الصوت المحلي' : 'Sonar غير متاح'}</b>
      <small>ضبط % · إشارة حية</small>
    </div>
    <div class="sonar-grid">
      ${Object.entries(labels).map(([key, item]) => `
        <div class="sonar-channel">
          <div class="sonar-channel-header">
            <span class="sonar-channel-icon">${item.icon}</span>
            <b class="sonar-channel-name">${item.name}</b>
          </div>
          ${(streaming ? ['monitoring', 'streaming'] : ['classic']).map(path => {
            const chanData = channels?.[key]?.[path];
            const excluded = broadcast && streaming && key === 'chat' && path === 'streaming';
            const hasVol = chanData?.volume != null;
            const volPct = hasVol ? Math.min(100, Math.max(0, chanData.volume)) : 0;
            const isLiveMeter = liveInGrid && (key === 'master' || key === 'mic') && path !== 'streaming';
            return `
              <div class="sonar-level">
                <span class="sonar-tag tag-${path}">${path === 'monitoring' ? 'استماع' : path === 'streaming' ? 'بث' : 'المستوى'}</span>
                <div class="sonar-meter-slot">
                  ${isLiveMeter
                    ? `<audio-signal-meter signal-only route="${key === 'mic' ? 'input' : 'monitoring'}"></audio-signal-meter>`
                    : `<div class="sonar-level-rail"><div class="sonar-level-fill fill-${path}" style="width: ${excluded ? 0 : volPct}%;"></div></div>`
                  }
                </div>
                <strong title="${excluded ? `التوجيه إلى البث معطّل؛ مستوى Sonar المحفوظ: ${level(chanData)}` : chanData?.muted == null ? 'حالة الكتم غير متاحة' : chanData.muted ? 'مكتوم' : 'غير مكتوم'}">${excluded ? 'مستثنى' : escape(level(chanData))}</strong>
              </div>
            `;
          }).join('')}
        </div>
      `).join('')}
    </div>
    <p class="sonar-note">
      ${connected ? broadcast ? 'بث البرامج: Game + Media + Aux · Chat مستثنى · Mic مستقل' : 'الكتم مستقل لكل مسار · Aux إعداد محفوظ؛ التوجيه غير مقاس' : 'لا توجد قراءة حية؛ لا يُستخدم مستوى Windows بديلًا'}
      ${connected && !state.sonar_profiles ? ' · البروفايلات غير متاحة' : ''}
    </p>
    ${detailed ? `
      ${!liveInGrid ? '<p class="sonar-note"><b>الإشارة المقاسة · Windows</b> — الأشرطة أعلاه لضبط المستوى فقط</p>' : ''}
      <section style="border-top:1px solid var(--border-glass,var(--line));padding-top:10px;display:grid;gap:12px">
        <audio-signal-meter detailed route="input"></audio-signal-meter>
        <audio-signal-meter detailed route="monitoring"></audio-signal-meter>
        ${streaming ? '<audio-signal-meter detailed route="streaming"></audio-signal-meter>' : ''}
        <small style="font-size:10px;line-height:1.4">النسبة: ضبط Sonar · الشريط: ذروة الجهاز المقاس · القراءة من Windows قبل تحكم مستوى الجهاز؛ لا يثبت المؤشر وحده حالة الكتم</small>
      </section>
    ` : ''}
  </div>`;
}
