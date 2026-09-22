/**
 * AIDA64 Web SensorPanel - 10-Style Dynamic Temperature Gauge Vector Engine
 * Pure mathematical SVG generation and 60 FPS requestAnimationFrame update routines
 */

export const GAUGE_STYLES = [
  { id: 'tachometer',   nameAr: 'النمط الرياضي',       nameEn: 'Racing Tachometer', icon: '🏎️', desc: 'تدريج شعاعي مع نقطة ليزرية متوهجة ومنطقة Redline' },
  { id: 'turbine',      nameAr: 'التوربين النفاث',      nameEn: 'Turbine Engine',    icon: '✈️', desc: '24 ريشة تبريد تضيء بالتتابع مع تصاعد الحرارة' },
  { id: 'hexa-matrix',  nameAr: 'الشبكة السداسية',     nameEn: 'Hexa-Matrix',       icon: '🔷', desc: 'حلقات نانوية سداسية تحاكي معالجات الحوسبة الكمومية' },
  { id: 'liquid-mercury', nameAr: 'المدار الزئبقي',    nameEn: 'Liquid Mercury',    icon: '🧪', desc: 'قوس سائل لزج مع فقاعات حرارية وتوهج كهرماني' },
  { id: 'tactical-radar', nameAr: 'الرادار التكتيكي',  nameEn: 'Tactical Radar',    icon: '🛰️', desc: 'سونار عسكري مع خط مسح دوراني وشبكة إحداثيات' },
  { id: 'holo-minimal', nameAr: 'الهولوغرام العائم',    nameEn: 'Holo Minimal',      icon: '🌌', desc: 'حلقة ليزرية بنحافة 1px مع توهج قلبي ناعم وبسيط' },
  { id: 'arc-reactor',  nameAr: 'مفاعل القوس',         nameEn: 'Arc Reactor',       icon: '⚡', desc: 'ثلاثة مسارات طاقة ميكانيكية تحاكي مفاعل الطاقة' },
  { id: 'retro-nixie',  nameAr: 'أنابيب النيكسي',      nameEn: 'Retro Nixie',       icon: '💡', desc: 'خيوط تفريغ غازية كهرمانية كلاسيكية دافئة' },
  { id: 'dual-split',   nameAr: 'ثنائية الجليد والنار', nameEn: 'Dual Split Arc',    icon: '❄️', desc: 'دائرة منقسمة بين سحب بارد مثلج وعادم حراري ملتهب' },
  { id: 'prism-glass',  nameAr: 'المنشور الزجاجي',     nameEn: 'Prism Glass',       icon: '💎', desc: 'حلقة زجاجية ثلاثية الأبعاد مع انكسار طيفي للألوان' }
];

export class GaugeEngine {
  static getAvailableStyles() {
    return GAUGE_STYLES;
  }

  /**
   * Generates the SVG template and inner HTML structure for a chosen style.
   */
  static renderGaugeSvg(styleId, containerEl, options = {}) {
    if (!containerEl) return;
    const title = options.title || 'الحرارة الحالية';
    const unit = options.unit || '°C';
    const gaugeId = options.gaugeId || 'cpu';

    // Clear container
    containerEl.innerHTML = '';
    const shortStyle = styleId.replace(/-/g, '');
    const prefixStyle = styleId.split('-')[0];
    const suffixStyle = styleId.split('-')[1];
    containerEl.className = `gauge-dynamic-root gauge-${styleId} gauge-${shortStyle} gauge-${prefixStyle}` + (suffixStyle ? ` gauge-${suffixStyle}` : '');
    containerEl.setAttribute('data-gauge-style', styleId);
    containerEl.setAttribute('data-gauge-id', gaugeId);

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'gauge-svg-layer');
    svg.setAttribute('viewBox', '0 0 180 180');

    // Build specific SVG inner nodes according to style
    switch (styleId) {
      case 'tachometer':
        this._buildTachometerSvg(svg);
        break;
      case 'turbine':
        this._buildTurbineSvg(svg);
        break;
      case 'hexa-matrix':
        this._buildHexaSvg(svg);
        break;
      case 'liquid-mercury':
        this._buildMercurySvg(svg);
        break;
      case 'tactical-radar':
        this._buildRadarSvg(svg);
        break;
      case 'holo-minimal':
        this._buildMinimalSvg(svg);
        break;
      case 'arc-reactor':
        this._buildReactorSvg(svg);
        break;
      case 'retro-nixie':
        this._buildNixieSvg(svg);
        break;
      case 'dual-split':
        this._buildDualSplitSvg(svg);
        break;
      case 'prism-glass':
        this._buildPrismSvg(svg);
        break;
      default:
        this._buildTachometerSvg(svg);
        break;
    }

    containerEl.appendChild(svg);

    // Center Stack (Readouts & Pill)
    const centerStack = document.createElement('div');
    centerStack.className = 'gauge-center-stack';
    centerStack.innerHTML = `
      <span class="gauge-title-label">${title}</span>
      <div class="gauge-val-group">
        <span class="gauge-huge-number" id="${gaugeId}_temp">--</span>
        <span class="gauge-huge-unit">${unit}</span>
      </div>
      <div class="gauge-status-pill" id="${gaugeId}-temp-desc-pill">
        <span class="pill-dot"></span>
        <span class="pill-text" id="${gaugeId}-temp-desc">طبيعي</span>
      </div>
    `;
    containerEl.appendChild(centerStack);
  }

  /**
   * Updates gauge parameters in 60 FPS animation loop without recreating DOM.
   */
  static updateGaugeSvg(styleId, containerEl, value, min = 20, max = 100, statusText = 'طبيعي') {
    if (!containerEl || isNaN(value)) return;
    const clampedVal = Math.max(min, Math.min(max, value));
    const ratio = (clampedVal - min) / (max - min);

    // 1. Update text elements
    const numEl = containerEl.querySelector('.gauge-huge-number');
    if (numEl) numEl.textContent = Math.round(value);

    const descEl = containerEl.querySelector('.pill-text');
    if (descEl && statusText) descEl.textContent = statusText;

    const pillEl = containerEl.querySelector('.gauge-status-pill');
    if (pillEl) {
      if (value >= 80) {
        pillEl.style.color = 'var(--neon-red, #EF4444)';
        pillEl.style.borderColor = 'rgba(239, 68, 68, 0.4)';
      } else if (value >= 70) {
        pillEl.style.color = 'var(--neon-yellow, #FACC15)';
        pillEl.style.borderColor = 'rgba(250, 204, 21, 0.4)';
      } else {
        pillEl.style.color = 'var(--theme-accent, var(--neon-cyan, #22D3EE))';
        pillEl.style.borderColor = 'rgba(34, 211, 238, 0.3)';
      }
    }

    // 2. Update style-specific SVG parameters
    const defaultCircumference = 2 * Math.PI * 72; // ~452.39

    switch (styleId) {
      case 'tachometer': {
        const prog = containerEl.querySelector('.tacho-progress');
        const bead = containerEl.querySelector('.laser-bead');
        if (prog) {
          const totalArc = defaultCircumference * 0.75; // 270 deg
          const offset = totalArc - (ratio * totalArc);
          prog.style.strokeDashoffset = `${offset}px`;
          
          if (bead) {
            // Angle from 135 deg to 405 deg
            const angleDeg = 135 + (ratio * 270);
            const angleRad = (angleDeg * Math.PI) / 180;
            const bx = 90 + 72 * Math.cos(angleRad);
            const by = 90 + 72 * Math.sin(angleRad);
            bead.setAttribute('cx', bx.toFixed(1));
            bead.setAttribute('cy', by.toFixed(1));
          }
        }
        break;
      }

      case 'turbine': {
        const blades = containerEl.querySelectorAll('.turbine-blade');
        const activeCount = Math.round(ratio * blades.length);
        blades.forEach((b, i) => {
          if (i < activeCount) {
            b.classList.add('blade-active');
            if (value >= 80) {
              b.classList.add('blade-critical');
              b.classList.remove('blade-warning');
            } else if (value >= 70) {
              b.classList.add('blade-warning');
              b.classList.remove('blade-critical');
            } else {
              b.classList.remove('blade-warning', 'blade-critical');
            }
          } else {
            b.classList.remove('blade-active', 'blade-warning', 'blade-critical');
          }
        });
        break;
      }

      case 'hexa-matrix': {
        const arc = containerEl.querySelector('.hexa-arc');
        if (arc) {
          const totalLen = arc.getTotalLength ? arc.getTotalLength() : (2 * Math.PI * 65);
          arc.style.strokeDashoffset = `${totalLen * (1 - ratio)}px`;
        }
        const cells = containerEl.querySelectorAll('.hexa-cell');
        const activeCells = Math.round(ratio * cells.length);
        cells.forEach((c, idx) => {
          c.classList.toggle('cell-active', idx < activeCells);
        });
        break;
      }

      case 'liquid-mercury': {
        const fluid = containerEl.querySelector('.mercury-fluid');
        const bubble = containerEl.querySelector('.mercury-bubble');
        if (fluid) {
          const totalLen = fluid.getTotalLength ? fluid.getTotalLength() : (2 * Math.PI * 70);
          fluid.style.strokeDashoffset = `${totalLen * (1 - ratio)}px`;
          if (bubble) {
            const angleDeg = -90 + (ratio * 360);
            const angleRad = (angleDeg * Math.PI) / 180;
            const bx = 90 + 70 * Math.cos(angleRad);
            const by = 90 + 70 * Math.sin(angleRad);
            bubble.setAttribute('cx', bx.toFixed(1));
            bubble.setAttribute('cy', by.toFixed(1));
          }
        }
        break;
      }

      case 'tactical-radar': {
        const arc = containerEl.querySelector('.radar-arc');
        if (arc) {
          const totalLen = arc.getTotalLength ? arc.getTotalLength() : defaultCircumference;
          arc.style.strokeDashoffset = `${totalLen * (1 - ratio)}px`;
        }
        break;
      }

      case 'holo-minimal': {
        const hair = containerEl.querySelector('.holo-hairline-progress');
        const glow = containerEl.querySelector('.holo-core-glow');
        if (hair) {
          const totalLen = hair.getTotalLength ? hair.getTotalLength() : (2 * Math.PI * 75);
          hair.style.strokeDashoffset = `${totalLen * (1 - ratio)}px`;
        }
        if (glow) {
          glow.style.opacity = `${0.15 + (ratio * 0.45)}`;
        }
        break;
      }

      case 'arc-reactor': {
        const arc = containerEl.querySelector('.reactor-active-arc');
        if (arc) {
          const totalLen = arc.getTotalLength ? arc.getTotalLength() : (2 * Math.PI * 74);
          arc.style.strokeDashoffset = `${totalLen * (1 - ratio)}px`;
        }
        const nodes = containerEl.querySelectorAll('.reactor-node');
        nodes.forEach((n, idx) => {
          const thresh = 0.25 + (idx * 0.3);
          if (ratio >= thresh) {
            n.style.opacity = '1';
            n.style.transform = 'scale(1.2)';
          } else {
            n.style.opacity = '0.4';
            n.style.transform = 'scale(0.8)';
          }
        });
        break;
      }

      case 'retro-nixie': {
        const fil = containerEl.querySelector('.nixie-filament');
        if (fil) {
          const totalLen = fil.getTotalLength ? fil.getTotalLength() : (2 * Math.PI * 73);
          fil.style.strokeDashoffset = `${totalLen * (1 - ratio)}px`;
        }
        break;
      }

      case 'dual-split': {
        const coolArc = containerEl.querySelector('.split-cool-arc');
        const hotArc = containerEl.querySelector('.split-hot-arc');
        if (coolArc) {
          const coolLen = coolArc.getTotalLength ? coolArc.getTotalLength() : (Math.PI * 73);
          const coolRatio = Math.min(1, ratio * 2);
          coolArc.style.strokeDashoffset = `${coolLen * (1 - coolRatio)}px`;
        }
        if (hotArc) {
          const hotLen = hotArc.getTotalLength ? hotArc.getTotalLength() : (Math.PI * 73);
          const hotRatio = Math.max(0, Math.min(1, (ratio - 0.5) * 2));
          hotArc.style.strokeDashoffset = `${hotLen * (1 - hotRatio)}px`;
        }
        break;
      }

      case 'prism-glass': {
        const prism = containerEl.querySelector('.prism-spectrum-arc');
        if (prism) {
          const totalLen = prism.getTotalLength ? prism.getTotalLength() : (2 * Math.PI * 71);
          prism.style.strokeDashoffset = `${totalLen * (1 - ratio)}px`;
        }
        break;
      }
    }
  }

  // --- SVG Builders ---

  static _buildTachometerSvg(svg) {
    const r = 72;
    const cx = 90;
    const cy = 90;
    const circ = 2 * Math.PI * r;
    const totalArc = circ * 0.75; // 270 degrees

    // Ticks group
    const ticksGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    ticksGroup.setAttribute('class', 'tacho-ticks');
    const tickCount = 28;
    for (let i = 0; i <= tickCount; i++) {
      const angleDeg = 135 + (i / tickCount) * 270;
      const angleRad = (angleDeg * Math.PI) / 180;
      const x1 = cx + (r - 2) * Math.cos(angleRad);
      const y1 = cy + (r - 2) * Math.sin(angleRad);
      const isMajor = i % 4 === 0;
      const tickLen = isMajor ? 8 : 4;
      const x2 = cx + (r - 2 - tickLen) * Math.cos(angleRad);
      const y2 = cy + (r - 2 - tickLen) * Math.sin(angleRad);

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x1.toFixed(1));
      line.setAttribute('y1', y1.toFixed(1));
      line.setAttribute('x2', x2.toFixed(1));
      line.setAttribute('y2', y2.toFixed(1));
      if (i > tickCount * 0.75) line.classList.add('tick-redline');
      ticksGroup.appendChild(line);
    }
    svg.appendChild(ticksGroup);

    // Track
    const track = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    track.setAttribute('class', 'tacho-track');
    track.setAttribute('cx', cx);
    track.setAttribute('cy', cy);
    track.setAttribute('r', r);
    track.style.strokeDasharray = `${totalArc} ${circ - totalArc}`;
    track.style.transformOrigin = '90px 90px';
    track.style.transform = 'rotate(135deg)';
    svg.appendChild(track);

    // Progress
    const progress = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    progress.setAttribute('class', 'tacho-progress');
    progress.setAttribute('cx', cx);
    progress.setAttribute('cy', cy);
    progress.setAttribute('r', r);
    progress.style.strokeDasharray = `${totalArc} ${circ - totalArc}`;
    progress.style.strokeDashoffset = `${totalArc}px`;
    progress.style.transformOrigin = '90px 90px';
    progress.style.transform = 'rotate(135deg)';
    svg.appendChild(progress);

    // Laser bead
    const bead = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    bead.setAttribute('class', 'laser-bead');
    bead.setAttribute('r', '4');
    bead.setAttribute('cx', (cx + r * Math.cos(135 * Math.PI / 180)).toFixed(1));
    bead.setAttribute('cy', (cy + r * Math.sin(135 * Math.PI / 180)).toFixed(1));
    svg.appendChild(bead);
  }

  static _buildTurbineSvg(svg) {
    const cx = 90;
    const cy = 90;
    const rOuter = 82;
    const rInner = 68;
    const bladeCount = 24;

    const rim = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    rim.setAttribute('class', 'turbine-rim');
    rim.setAttribute('cx', cx);
    rim.setAttribute('cy', cy);
    rim.setAttribute('r', rOuter);
    svg.appendChild(rim);

    for (let i = 0; i < bladeCount; i++) {
      const angle = (i * 360) / bladeCount;
      const rad = (angle * Math.PI) / 180;
      const x1 = cx + rInner * Math.cos(rad);
      const y1 = cy + rInner * Math.sin(rad);
      const rad2 = ((angle + 9) * Math.PI) / 180;
      const x2 = cx + rOuter * Math.cos(rad2);
      const y2 = cy + rOuter * Math.sin(rad2);

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('class', 'turbine-blade');
      path.setAttribute('d', `M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)}`);
      path.style.strokeWidth = '3.5px';
      path.style.strokeLinecap = 'round';
      path.style.stroke = 'currentColor';
      svg.appendChild(path);
    }
  }

  static _buildHexaSvg(svg) {
    const cx = 90;
    const cy = 90;
    const cellCount = 18;
    const r = 75;

    for (let i = 0; i < cellCount; i++) {
      const angle = (i * 360) / cellCount;
      const rad = (angle * Math.PI) / 180;
      const x = cx + r * Math.cos(rad);
      const y = cy + r * Math.sin(rad);

      const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      poly.setAttribute('class', 'hexa-cell');
      const s = 6;
      let pts = [];
      for (let j = 0; j < 6; j++) {
        const a = (j * 60 * Math.PI) / 180;
        pts.push(`${(x + s * Math.cos(a)).toFixed(1)},${(y + s * Math.sin(a)).toFixed(1)}`);
      }
      poly.setAttribute('points', pts.join(' '));
      svg.appendChild(poly);
    }

    const arc = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    arc.setAttribute('class', 'hexa-arc');
    arc.setAttribute('cx', cx);
    arc.setAttribute('cy', cy);
    arc.setAttribute('r', '65');
    const c = 2 * Math.PI * 65;
    arc.style.strokeDasharray = `${c}`;
    arc.style.strokeDashoffset = `${c}px`;
    arc.style.transformOrigin = '90px 90px';
    arc.style.transform = 'rotate(-90deg)';
    svg.appendChild(arc);
  }

  static _buildMercurySvg(svg) {
    const cx = 90;
    const cy = 90;
    const r = 70;
    const circ = 2 * Math.PI * r;

    // Golden amber / neon yellow liquid gradient
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    grad.setAttribute('id', 'mercury-grad');
    grad.setAttribute('x1', '0%');
    grad.setAttribute('y1', '100%');
    grad.setAttribute('x2', '100%');
    grad.setAttribute('y2', '0%');
    grad.innerHTML = `
      <stop offset="0%" stop-color="var(--neon-yellow, #FACC15)"/>
      <stop offset="100%" stop-color="var(--neon-orange, #FB923C)"/>
    `;
    defs.appendChild(grad);
    svg.appendChild(defs);

    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    bg.setAttribute('class', 'mercury-bg');
    bg.setAttribute('cx', cx);
    bg.setAttribute('cy', cy);
    bg.setAttribute('r', r);
    svg.appendChild(bg);

    const fluid = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    fluid.setAttribute('class', 'mercury-fluid');
    fluid.setAttribute('cx', cx);
    fluid.setAttribute('cy', cy);
    fluid.setAttribute('r', r);
    fluid.setAttribute('stroke', 'url(#mercury-grad)');
    fluid.style.strokeDasharray = `${circ}`;
    fluid.style.strokeDashoffset = `${circ}px`;
    fluid.style.transformOrigin = '90px 90px';
    fluid.style.transform = 'rotate(-90deg)';
    svg.appendChild(fluid);

    const bubble = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    bubble.setAttribute('class', 'mercury-bubble');
    bubble.setAttribute('cx', '90');
    bubble.setAttribute('cy', '20');
    bubble.setAttribute('r', '3');
    svg.appendChild(bubble);
  }

  static _buildRadarSvg(svg) {
    const cx = 90;
    const cy = 90;

    // Cyan radar sweep cone gradient
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    grad.setAttribute('id', 'radar-sweep-grad');
    grad.setAttribute('x1', '0%');
    grad.setAttribute('y1', '0%');
    grad.setAttribute('x2', '100%');
    grad.setAttribute('y2', '100%');
    grad.innerHTML = `
      <stop offset="0%" stop-color="var(--theme-accent, var(--neon-cyan, #22D3EE))" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="var(--theme-accent, var(--neon-cyan, #22D3EE))" stop-opacity="0"/>
    `;
    defs.appendChild(grad);
    svg.appendChild(defs);

    [30, 50, 72].forEach(r => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('class', 'radar-grid');
      circle.setAttribute('cx', cx);
      circle.setAttribute('cy', cy);
      circle.setAttribute('r', r);
      svg.appendChild(circle);
    });

    const cross = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    cross.setAttribute('class', 'radar-crosshair');
    cross.setAttribute('d', `M 90 15 L 90 165 M 15 90 L 165 90`);
    svg.appendChild(cross);

    const cone = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    cone.setAttribute('class', 'radar-sweep-cone');
    cone.setAttribute('d', `M 90 90 L 90 18 A 72 72 0 0 1 141 39 Z`);
    cone.setAttribute('fill', 'url(#radar-sweep-grad)');
    svg.appendChild(cone);

    const arc = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    arc.setAttribute('class', 'radar-arc');
    arc.setAttribute('cx', cx);
    arc.setAttribute('cy', cy);
    arc.setAttribute('r', '72');
    const circ = 2 * Math.PI * 72;
    arc.style.strokeDasharray = `${circ}`;
    arc.style.strokeDashoffset = `${circ}px`;
    arc.style.transformOrigin = '90px 90px';
    arc.style.transform = 'rotate(-90deg)';
    svg.appendChild(arc);
  }

  static _buildMinimalSvg(svg) {
    const cx = 90;
    const cy = 90;
    const r = 75;
    const circ = 2 * Math.PI * r;

    // Definitions for radial gradient glow
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const grad = document.createElementNS('http://www.w3.org/2000/svg', 'radialGradient');
    grad.setAttribute('id', 'holo-core-grad');
    grad.innerHTML = `
      <stop offset="0%" stop-color="var(--neon-cyan, #22D3EE)" stop-opacity="0.8"/>
      <stop offset="60%" stop-color="var(--neon-cyan, #22D3EE)" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="var(--neon-cyan, #22D3EE)" stop-opacity="0"/>
    `;
    defs.appendChild(grad);
    svg.appendChild(defs);

    const core = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    core.setAttribute('class', 'holo-core-glow');
    core.setAttribute('cx', cx);
    core.setAttribute('cy', cy);
    core.setAttribute('r', '60');
    svg.appendChild(core);

    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    bg.setAttribute('class', 'holo-hairline-bg');
    bg.setAttribute('cx', cx);
    bg.setAttribute('cy', cy);
    bg.setAttribute('r', r);
    svg.appendChild(bg);

    const prog = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    prog.setAttribute('class', 'holo-hairline-progress');
    prog.setAttribute('cx', cx);
    prog.setAttribute('cy', cy);
    prog.setAttribute('r', r);
    prog.style.strokeDasharray = `${circ}`;
    prog.style.strokeDashoffset = `${circ}px`;
    prog.style.transformOrigin = '90px 90px';
    prog.style.transform = 'rotate(-90deg)';
    svg.appendChild(prog);
  }

  static _buildReactorSvg(svg) {
    const cx = 90;
    const cy = 90;
    const r = 74;
    const circ = 2 * Math.PI * r;

    const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    ring.setAttribute('class', 'reactor-outer-ring');
    ring.setAttribute('cx', cx);
    ring.setAttribute('cy', cy);
    ring.setAttribute('r', r);
    svg.appendChild(ring);

    const activeArc = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    activeArc.setAttribute('class', 'reactor-active-arc');
    activeArc.setAttribute('cx', cx);
    activeArc.setAttribute('cy', cy);
    activeArc.setAttribute('r', r);
    activeArc.style.strokeDasharray = `${circ}`;
    activeArc.style.strokeDashoffset = `${circ}px`;
    activeArc.style.transformOrigin = '90px 90px';
    activeArc.style.transform = 'rotate(-90deg)';
    svg.appendChild(activeArc);

    [0, 120, 240].forEach(deg => {
      const rad = (deg * Math.PI) / 180;
      const node = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      node.setAttribute('class', 'reactor-node');
      node.setAttribute('cx', (cx + (r + 1) * Math.cos(rad)).toFixed(1));
      node.setAttribute('cy', (cy + (r + 1) * Math.sin(rad)).toFixed(1));
      node.setAttribute('r', '3');
      svg.appendChild(node);
    });
  }

  static _buildNixieSvg(svg) {
    const cx = 90;
    const cy = 90;
    const r = 73;
    const circ = 2 * Math.PI * r;

    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    bg.setAttribute('class', 'nixie-bg');
    bg.setAttribute('cx', cx);
    bg.setAttribute('cy', cy);
    bg.setAttribute('r', r);
    svg.appendChild(bg);

    const filament = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    filament.setAttribute('class', 'nixie-filament');
    filament.setAttribute('cx', cx);
    filament.setAttribute('cy', cy);
    filament.setAttribute('r', r);
    filament.style.strokeDasharray = `${circ}`;
    filament.style.strokeDashoffset = `${circ}px`;
    filament.style.transformOrigin = '90px 90px';
    filament.style.transform = 'rotate(-90deg)';
    svg.appendChild(filament);
  }

  static _buildDualSplitSvg(svg) {
    const cx = 90;
    const cy = 90;
    const r = 73;
    const halfCirc = Math.PI * r; // ~229.3

    const bgLeft = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    bgLeft.setAttribute('class', 'split-bg-left');
    bgLeft.setAttribute('d', `M ${cx} ${cy - r} A ${r} ${r} 0 0 0 ${cx} ${cy + r}`);
    svg.appendChild(bgLeft);

    const bgRight = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    bgRight.setAttribute('class', 'split-bg-right');
    bgRight.setAttribute('d', `M ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx} ${cy + r}`);
    svg.appendChild(bgRight);

    const coolArc = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    coolArc.setAttribute('class', 'split-cool-arc');
    coolArc.setAttribute('d', `M ${cx} ${cy - r} A ${r} ${r} 0 0 0 ${cx} ${cy + r}`);
    coolArc.style.strokeDasharray = `${halfCirc}`;
    coolArc.style.strokeDashoffset = `${halfCirc}px`;
    svg.appendChild(coolArc);

    const hotArc = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    hotArc.setAttribute('class', 'split-hot-arc');
    hotArc.setAttribute('d', `M ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx} ${cy + r}`);
    hotArc.style.strokeDasharray = `${halfCirc}`;
    hotArc.style.strokeDashoffset = `${halfCirc}px`;
    svg.appendChild(hotArc);
  }

  static _buildPrismSvg(svg) {
    const cx = 90;
    const cy = 90;
    const r = 71;
    const circ = 2 * Math.PI * r;

    // Prismatic multi-spectrum gradient
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    grad.setAttribute('id', 'prism-gradient');
    grad.setAttribute('x1', '0%');
    grad.setAttribute('y1', '0%');
    grad.setAttribute('x2', '100%');
    grad.setAttribute('y2', '100%');
    grad.innerHTML = `
      <stop offset="0%" stop-color="#22D3EE"/>
      <stop offset="33%" stop-color="#818CF8"/>
      <stop offset="66%" stop-color="#F43F5E"/>
      <stop offset="100%" stop-color="#FACC15"/>
    `;
    defs.appendChild(grad);
    svg.appendChild(defs);

    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    bg.setAttribute('class', 'prism-bevel-bg');
    bg.setAttribute('cx', cx);
    bg.setAttribute('cy', cy);
    bg.setAttribute('r', r);
    svg.appendChild(bg);

    const arc = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    arc.setAttribute('class', 'prism-spectrum-arc');
    arc.setAttribute('cx', cx);
    arc.setAttribute('cy', cy);
    arc.setAttribute('r', r);
    arc.style.strokeDasharray = `${circ}`;
    arc.style.strokeDashoffset = `${circ}px`;
    arc.style.transformOrigin = '90px 90px';
    arc.style.transform = 'rotate(-90deg)';
    svg.appendChild(arc);
  }
}

if (typeof window !== 'undefined') {
  window.GaugeEngine = GaugeEngine;
}
