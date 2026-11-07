import { EventBus } from '../store/event_bus.js?v=20261007.3';

export function meterPosition(peak) {
  if (!Number.isFinite(peak) || peak<=0) return 0;
  return Math.max(0,Math.min(1,(20*Math.log10(peak)+60)/60));
}

export class AudioSignalMeter extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode:'open'});
    this.shadowRoot.innerHTML=`<style>
      :host{display:block;min-width:0;font-family:var(--font-arabic,var(--arabic,sans-serif));color:var(--text-primary,var(--ink));line-height:1.1}
      *{box-sizing:border-box}.row{display:flex;align-items:center;gap:6px;min-height:15px}.label{font-size:10px;white-space:nowrap}.gain{font:700 13px var(--font-numbers,var(--numbers,monospace));min-width:40px;direction:ltr}.rail{height:7px;flex:1;min-width:20px;position:relative;direction:ltr;border-radius:3px;background:var(--border-glass,var(--line,#334));overflow:hidden}
      .fill{height:100%;width:100%;transform:scaleX(0);transform-origin:left;background:var(--status-normal,#00e6aa);mask-image:repeating-linear-gradient(90deg,#000 0 5px,transparent 5px 7px)}
      .hold{position:absolute;top:0;left:0;width:2px;height:100%;background:var(--text-primary,var(--ink,#fff));opacity:0}.state{font-size:9px;color:var(--text-secondary,var(--muted));min-width:24px;white-space:nowrap}.source{display:flex;gap:5px;align-items:center;font-size:10px;color:var(--text-secondary,var(--muted));margin-top:7px;line-height:1.4}.device{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;direction:ltr}
      select{font:inherit;background:var(--bg-card,var(--surface));color:inherit;border:1px solid var(--border-glass,var(--line));border-radius:4px;max-width:180px;padding:3px}select:focus-visible{outline:2px solid var(--neon-cyan,var(--accent));outline-offset:2px}
      :host(:not([detailed])) .source{display:none}:host([signal-only]) .label,:host([signal-only]) .gain,:host([signal-only]) .state{display:none}:host([detailed]) .row{min-height:24px}:host([detailed]) .label{font-size:12px}:host([detailed]) .rail{height:12px}
      :host([compact]){width:44px;height:6px}:host([compact]) .row{min-height:6px;gap:0}:host([compact]) .rail{height:6px;min-width:0}:host([compact]) .fill{mask-image:repeating-linear-gradient(90deg,#000 0 3px,transparent 3px 4px)}
    </style><div class="row"><span class="label"></span><strong class="gain" title="نسبة ضبط Sonar وليست شدة الإشارة">—</strong><div class="rail" role="meter" aria-label="ذروة الإشارة الحية، مقياس لوغاريتمي" aria-valuemin="-60" aria-valuemax="0"><div class="fill"></div><i class="hold"></i></div><span class="state"></span></div><div class="source"><select aria-label="مصدر مؤشر الميكروفون"><option value="input">الأصلي · قبل Sonar</option><option value="mic">Sonar · بعد المعالجة</option></select><span class="device"></span></div>`;
    this.nodes=Object.fromEntries(['label','gain','rail','fill','hold','state','device'].map(key=>[key,this.shadowRoot.querySelector('.'+key)]));
    this.level=0;this.held=0;this.holdUntil=0;
  }
  connectedCallback() {
    this.events?.abort();this.events=new AbortController();
    this.application=this.getAttribute('application');
    const route=this.application?'application':this.getAttribute('route') || 'input';
    const saved=localStorage.getItem('audio-meter-mic-source');this.route=route==='input' ? (['input','mic'].includes(saved)?saved:'input') : route;
    this.nodes.label.textContent=route==='input'?'🎙 Mic':route==='streaming'?'↗ بث':'🔊 صوت';
    const select=this.shadowRoot.querySelector('select');select.hidden=route!=='input';select.value=this.route;
    select.addEventListener('change',()=>{this.route=select.value;localStorage.setItem('audio-meter-mic-source',this.route);EventBus.emit('audio-meter:source',this.route);this.reset();},{signal:this.events.signal});
    EventBus.on('audio-meter:source',value=>{if(route==='input'){this.route=value;select.value=value;this.reset();}},{signal:this.events.signal});
    EventBus.on('audio-levels',sample=>{this.sample=sample;},{signal:this.events.signal});
    EventBus.on('state-changed',delta=>{this.state={...this.state,...delta};this.updateGain();},{signal:this.events.signal});
    this.state=window.stateManager?.currentState || {};this.sample=this.state.audio_levels;this.updateGain();
    this.face=this.closest('.card-face');
    if(this.face){this.faceObserver=new MutationObserver(()=>this.schedule());this.faceObserver.observe(this.face,{attributes:true,attributeFilter:['inert']});}
    this.visibility=new IntersectionObserver(entries=>{this.visible=entries[0].isIntersecting;this.schedule();});this.visibility.observe(this);
    document.addEventListener('visibilitychange',()=>this.schedule(),{signal:this.events.signal});
    this.visible=true;this.schedule();
  }
  disconnectedCallback() {
    this.events?.abort();this.visibility?.disconnect();this.faceObserver?.disconnect();cancelAnimationFrame(this.raf);this.raf=0;this.previous=null;this.reset();
  }
  reset(){this.level=0;this.held=0;this.holdUntil=0;this.previous=null;}
  updateGain() {
    if(this.application)return;
    const channel=this.getAttribute('route')==='input'?'mic':'master';
    const path=this.state.sonar_mode==='stream'?(this.getAttribute('route')==='streaming'?'streaming':'monitoring'):'classic';
    const value=this.state.sonar_channels?.[channel]?.[path];
    this.muted=value?.muted;
    const text=value?.volume==null?'—':`${Math.round(value.volume)}%${value.muted?' 🔇':''}`;
    if(this.nodes.gain.textContent!==text)this.nodes.gain.textContent=text;
    this.nodes.gain.title=`ضبط Sonar · ${path==='streaming'?'البث':path==='monitoring'?'الاستماع':'الصوت المحلي'} · الكتم ${value?.muted==null?'غير متاح':value.muted?'مفعّل':'غير مفعّل'}؛ المؤشر يقيس الجهاز الموضح ولا يثبت كتمه`;
  }
  schedule() {
    cancelAnimationFrame(this.raf);this.raf=0;this.previous=null;
    if(this.isConnected && this.visible && !document.hidden && !this.face?.hasAttribute('inert'))this.raf=requestAnimationFrame(t=>this.draw(t));
  }
  draw(timestamp) {
    const application=this.application ? this.sample?.applications?.filter(app=>app.active && app.icon_url===this.application).reduce((best,app)=>!best||app.peak>best.peak?app:best,null) : null;
    const route=this.application ? application && {...application,status:'live'} : this.sample?.routes?.[this.route];
    const valid=route?.status==='live' && Number.isFinite(route.peak) && timestamp-(this.sample.receivedAt ?? -Infinity)<(this.sample.maxAgeMs || 300) && this.state.telemetry_status!=='stale';
    const dt=Math.max(0,Math.min(timestamp-(this.previous??timestamp-16.7),100));this.previous=timestamp;
    const target=valid?meterPosition(route.peak):0;
    this.level=valid?this.level+(target-this.level)*(1-Math.exp(-dt/(target>this.level?20:180))):0;
    if(!valid){this.held=0;this.holdUntil=0;}else if(target>=this.held){this.held=target;this.holdUntil=timestamp+900;}else if(timestamp>this.holdUntil)this.held=Math.max(this.level,this.held-dt/2000);
    this.nodes.fill.style.transform=`scaleX(${this.level.toFixed(3)})`;this.nodes.fill.style.background=target>=59/60?'var(--status-critical,#ff6275)':target>=54/60?'var(--status-warning,#ffc85a)':'var(--status-normal,#00e6aa)';
    // Position against the rail's width, without reading layout every frame.
    this.nodes.hold.style.left=`${(this.held*100).toFixed(2)}%`;this.nodes.hold.style.opacity=valid&&this.held>0?'1':'0';
    const status=valid?(route.peak===0?'صمت':'حي'):'غير متاح';if(this.nodes.state.textContent!==status)this.nodes.state.textContent=status;
    const name=route?.name || 'مصدر غير متاح';if(this.nodes.device.textContent!==name)this.nodes.device.textContent=name;
    const title=`${this.application?'إشارة البرنامج':this.route==='input'?'إشارة الميكروفون قبل Sonar':this.route==='mic'?'ميكروفون Sonar بعد المعالجة':this.route==='streaming'?'جهاز إخراج البث':'جهاز إخراج الاستماع'} · ${name} · ${valid?'ذروة مقاسة من Windows':'القياس غير متاح'}`;
    if(this.title!==title)this.title=title;
    // Accessibility text updates at 5 Hz; decorative animation stays at display cadence.
    if(timestamp-(this.lastAccessible??0)>200){this.lastAccessible=timestamp;if(valid)this.nodes.rail.setAttribute('aria-valuenow',String(route.peak>0?Math.max(-60,20*Math.log10(route.peak)).toFixed(1):-60));else this.nodes.rail.removeAttribute('aria-valuenow');this.nodes.rail.setAttribute('aria-valuetext',status);}
    this.raf=requestAnimationFrame(t=>this.draw(t));
  }
}
customElements.define('audio-signal-meter',AudioSignalMeter);
