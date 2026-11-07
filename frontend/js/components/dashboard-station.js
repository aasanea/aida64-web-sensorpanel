import { renderSonarPanel } from './sonar-panel.js?v=20261103.audio11';
import { applyProvenance } from './component-utils.js?v=20261007.3';
import { StateManager } from '../store/state_manager.js?v=20261007.3';
import { EventBus } from '../store/event_bus.js?v=20261007.3';
import { DETAIL_GROUPS, CONFIGURED_PROFILES, ACTION_LABELS, matchScore, appointmentSeconds } from './station-content.js?v=20261007.3';
import { GaugeEngine } from './gauge-styles-engine.js?v=20261007.3';
import { GaugePicker } from './gauge-style-picker.js?v=20261007.3';
import './dashboard-appointments.js?v=20261106.dates';

const CLOCK_FORMAT = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
const DESIGNS = { orbit: ['ORBIT / COMMAND','قمرة القيادة'], vector: ['VECTOR / OBSERVATORY','مرصد الأداء'], folio: ['FOLIO / STUDIO','دفتر العتاد'] };
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const value = (key, unit = '', places = 0, extra = '') => `<span class="reading ${extra}" data-key="${key}" data-places="${places}">—</span>${unit ? `<small>${unit}</small>` : ''}`;
const metric = (label, key, unit, places = 0) => `<div class="metric"><span>${label}</span><strong dir="ltr">${value(key, unit, places)}</strong></div>`;
const chart = (key, extra = '') => `<svg class="chart ${extra}" viewBox="0 0 600 180" preserveAspectRatio="none" aria-label="تاريخ قياسات ${key}" role="img"><path class="chart-area" data-area="${key}"/><path class="chart-line" data-chart="${key}"/></svg>`;
const heading = (name, tag, button = '') => `<div class="section-head"><div><span class="overline">${tag}</span><h2>${name}</h2></div><small class="source-status" data-source-badge="${button==='audio'?'sonar':button==='network'?'network':button==='appointments'?'appointments':button==='matches'?'sports':tag.startsWith('RIYADH')?'prayer':'aida'}"></small>${button ? `<button data-details="${button}">${ACTION_LABELS[button]} ↗</button>` : ''}</div>`;
const cpuFields = () => metric('التردد','cpu_clock','MHz') + metric('الطاقة','cpu_power','W') + metric('حرارة الحزمة','cpu_hotspot_temp','°C') + metric('مضخة التبريد','pump_rpm','RPM');
const gpuFields = () => metric('التردد','gpu_clock','MHz') + metric('الطاقة','gpu_power','W') + metric('البقعة الساخنة','gpu_hotspot_temp','°C') + metric('ذاكرة الفيديو','vram_used_gb','GiB',1);
const radial = (key, label) => `<div class="dial" data-dial="${key}"><svg viewBox="0 0 260 260" aria-hidden="true"><circle class="dial-track" cx="130" cy="130" r="108"/><circle class="dial-progress" cx="130" cy="130" r="108" pathLength="100"/><circle class="dial-inner" cx="130" cy="130" r="94"/></svg><div class="dial-reading"><span>${label}</span><strong dir="ltr">${value(key,'°C')}</strong><span class="thermal-status" data-thermal="${key}">غير متاح</span></div></div>`;
const meter = key => `<div class="meter"><i data-meter="${key}"></i></div>`;
const ram = () => `<section class="resource memory">${heading('الذاكرة العشوائية','03 / SYSTEM RAM','memory')}<div class="resource-main"><strong dir="ltr">${value('ram_used_percent','%')}</strong><div dir="ltr">${value('ram_used_gb','',1)} / ${value('ram_total_gb','GiB',1)}</div></div>${meter('ram_used_percent')}<div class="mini-row">${metric('ساعة الذاكرة','ram_speed_mhz','MHz')}${metric('حرارة الذاكرة','ram_temp','°C')}</div></section>`;
const storage = () => `<section class="resource storage">${heading('وحدات التخزين','04 / STORAGE POOL','storage')}<div class="disk"><div><span>القرص C: · النظام</span><strong dir="ltr">${value('drive_c_used_percent','%')}</strong></div>${meter('drive_c_used_percent')}<p dir="ltr">${value('drive_c_used_gb','',1)} / ${value('drive_c_total_gb','GiB',1)} <span>· حر ${value('drive_c_free_gb','GiB')}</span></p></div><div class="disk"><div><span>القرص D: · البيانات</span><strong dir="ltr">${value('drive_d_used_percent','%')}</strong></div>${meter('drive_d_used_percent')}<p dir="ltr">${value('drive_d_used_gb','',1)} / ${value('drive_d_total_gb','GiB',1)} <span>· حر ${value('drive_d_free_gb','GiB')}</span></p></div></section>`;
const network = () => `<section class="resource network">${heading('حركة الشبكة','05 / NETWORK','network')}<div class="net-pair"><div><span>↓ التنزيل</span><strong dir="ltr">${value('network_download_mbps','Mbps',2)}</strong>${chart('network_download_mbps','network-chart')}</div><div><span>↑ الرفع</span><strong dir="ltr">${value('network_upload_mbps','Mbps',2)}</strong>${chart('network_upload_mbps','network-chart upload-chart')}</div></div><div class="mini-row">${metric('استجابة TCP','network_ping_ms','ms')}${metric('الاتصالات','network_active_conns','')}</div></section>`;
const audio = () => `<section class="resource audio">${heading('مكسر قنوات Sonar','06 / AUDIO','audio')}<div data-sonar-panel></div></section>`;
const prayer = () => `<section class="daily prayer">${heading('مواقيت الصلاة والطقس','RIYADH / DAILY RHYTHM')}<div class="weather-row"><span><b data-weather-icon>☀</b> طقس الرياض · <span data-weather-desc>—</span></span><strong dir="ltr">${value('riyadh_temp','°C',1)}</strong></div><div class="prayer-hero"><div><span>متبقي على</span><h3 data-next-prayer>—</h3></div><strong data-countdown="next_prayer_seconds" dir="ltr">—:—:—</strong></div><div class="prayer-list">${[['الفجر','fajr'],['الظهر','dhuhr'],['العصر','asr'],['المغرب','maghrib'],['العشاء','isha']].map(([label,key])=>`<div data-prayer-item="${label}"><span>${label}</span><strong data-key="prayer_${key}" dir="ltr">—</strong></div>`).join('')}</div><p class="previous-prayer">مضى على <span data-prev-prayer>—</span> <b data-countdown="prev_prayer_seconds" dir="ltr">—:—:—</b></p></section>`;
const appointments = () => `<section class="daily appointments">${heading('المواعيد اليومية','YOUR NEXT MOMENT','appointments')}<div class="appointment-hero"><div class="next-appointment-label"><span data-appointment-status>الموعد القادم</span><span data-key="next_appointment_time">—</span></div><h3 data-appointment-title>المواعيد غير متاحة</h3><div class="appointment-bottom"><span data-appointment-location>—</span><strong data-countdown="next_appointment_seconds" dir="ltr">—:—:—</strong></div><div class="appointment-meta"><span data-key="next_appointment_category_label">—</span><span>المتبقي <b data-key="appointments_remaining">—</b> / اليوم <b data-key="appointments_count">—</b></span><button data-manage>إدارة المواعيد +</button></div></div><div class="appointment-list" data-appointments></div></section>`;
const matches = () => `<section class="daily matches">${heading('المباريات والمواجهات القادمة','MATCHDAY / SAUDI & WORLD','matches')}<div class="match-filters" role="group" aria-label="تصفية المباريات"><button data-filter="upcoming" aria-pressed="false">القادمة</button><button data-filter="saudi" aria-pressed="true">السعودية</button><button data-filter="all" aria-pressed="false">الكل</button><button data-filter="live" aria-pressed="false">مباشر</button><span data-match-status>جاري التحميل</span></div><div class="match-list" data-matches></div></section>`;
const gaming = () => `<section class="gaming">${heading('محرك العرض والألعاب','LIVE DISPLAY / FRAME TELEMETRY','display')}<span class="fps-caption">معدل الإطارات الحقيقي</span><strong class="fps-value" dir="ltr">${value('fps','FPS')}</strong><div class="display-specs">${metric('تردد شاشة AIDA64','display_hz','Hz')}<div class="metric"><span>زمن الإطار <em data-frame-source>غير متاح</em></span><strong dir="ltr">${value('frame_time_resolved','ms',1)}</strong></div></div><div class="resolution"><span>دقة شاشة AIDA64</span><strong data-key="display_res" dir="ltr">—</strong></div></section>`;

function orbit() {
  return `<main class="orbit-layout"><div class="orbit-primary"><section class="processor cpu">${heading('المعالج المركزي','01 / CPU MASTER','cpu')}<div class="processor-body">${radial('cpu_temp','حرارة المعالج')}<div class="processor-side"><div class="load-title"><span>نسبة الاستهلاك</span><strong dir="ltr">${value('cpu_load','%')}</strong></div>${meter('cpu_load')}<div class="processor-stats">${cpuFields()}</div></div></div><div class="core-strip" data-cores></div></section>${gaming()}<section class="processor gpu">${heading('معالج الرسوميات','02 / GPU & VRAM MASTER','gpu')}<div class="processor-body">${radial('gpu_temp','حرارة الكرت')}<div class="processor-side"><div class="load-title"><span>نسبة الاستهلاك</span><strong dir="ltr">${value('gpu_load','%')}</strong></div>${meter('gpu_load')}<div class="processor-stats">${gpuFields()}</div></div></div><div class="vram-strip">VRAM <b dir="ltr">${value('vram_used_gb','',1)} / ${value('vram_total_gb','GiB',1)}</b><span>الحرارة <b dir="ltr">${value('vram_temp','°C')}</b></span><span>المروحة <b dir="ltr">${value('gpu_fan_rpm','RPM')}</b></span></div></section></div><div class="orbit-resources">${ram()}${storage()}${network()}${audio()}</div><div class="orbit-day">${prayer()}${appointments()}${matches()}</div></main>`;
}
const instrument = (label,key,unit,tag) => `<div class="instrument"><span class="overline">${tag}</span><h2>${label}</h2><strong dir="ltr">${value(key,unit)}</strong></div>`;
function vector() {
  return `<main class="vector-layout"><aside class="instrument-rail"><span class="rail-symbol">⌁</span><span>CPU</span><i></i><span>GPU</span><i></i><span>RAM</span><i></i><span>NET</span><a href="/dev/theme-lab/index.html" aria-label="مقارنة التصاميم">↗</a><small dir="ltr">AIDA / LIVE</small></aside><div class="vector-hardware"><div class="instrument-strip">${instrument('المعالج المركزي','cpu_temp','°C','PROCESSOR')}${instrument('معالج الرسوميات','gpu_temp','°C','GRAPHICS')}${instrument('الذاكرة العشوائية','ram_used_percent','%','MEMORY')}${instrument('معدل الإطارات الحقيقي','fps','FPS','DISPLAY')}</div><section class="observatory">${heading('رصد الأداء المباشر','MEASURED HISTORY / LAST 60 SECONDS')}<div class="plot-legend"><span><i></i> المعالج · الاستهلاك <b class="reading" data-key="cpu_load">—</b>%</span><span><i></i> كرت الشاشة · الاستهلاك <b class="reading" data-key="gpu_load">—</b>%</span><b dir="ltr">0–100%</b></div><div class="plot"><div class="axis"><span>100</span><span>75</span><span>50</span><span>25</span><span>0</span></div>${chart('cpu_load','cpu-chart')}${chart('gpu_load','gpu-chart')}<div class="plot-empty" data-history-label>تجميع القراءات المقاسة…</div></div><div class="time-axis"><span>−60 ثانية</span><span>−30 ثانية</span><span>الآن</span></div></section><div class="parameter-pair"><section>${heading('قياسات المعالج','CPU / PARAMETERS','cpu')}<div class="parameter-grid">${cpuFields()}${metric('الجهد','cpu_voltage','V',3)}${metric('حرارة اللوحة','motherboard_temp','°C')}</div></section><section>${heading('قياسات كرت الشاشة','GPU / PARAMETERS','gpu')}<div class="parameter-grid">${gpuFields()}${metric('ذاكرة الفيديو','vram_used_percent','%')}${metric('مروحة الكرت','gpu_fan_rpm','RPM')}</div></section></div><div class="vector-resources">${ram()}${storage()}${network()}</div><div class="vector-media">${gaming()}${audio()}</div></div><div class="vector-day">${prayer()}${appointments()}${matches()}</div></main>`;
}
function folio() {
  const row = (label,tag,temp,load,clock,power,details) => `<tr><th scope="row"><span>${tag}</span><h2>${label}</h2><button data-details="${details}">القياسات كاملة ↗</button></th><td><strong dir="ltr">${value(temp,'°C')}</strong></td><td><strong dir="ltr">${value(load,'%')}</strong>${chart(load,'table-chart')}</td><td><strong dir="ltr">${value(clock,'MHz')}</strong></td><td><strong dir="ltr">${value(power,power.includes('gb')?'GiB':'W',power.includes('gb')?1:0)}</strong>${power.includes('gb')?`<span class="ledger-total" dir="ltr">/ ${value(power==='ram_used_gb'?'ram_total_gb':'vram_total_gb','GiB',1)}</span>`:''}</td></tr>`;
  return `<main class="folio-layout"><div class="folio-hardware"><div class="folio-title"><span class="overline">THE MACHINE / LIVE INVENTORY</span><h1>الجهاز، في نظرة واحدة.</h1><p>قياسات فعلية من الحساسات · تتحدث كل نصف ثانية</p></div><table class="hardware-ledger"><thead><tr><th>المكوّن</th><th>الحرارة</th><th>الاستهلاك</th><th>التردد</th><th>الطاقة / السعة</th></tr></thead><tbody>${row('المعالج المركزي','01 / CPU','cpu_temp','cpu_load','cpu_clock','cpu_power','cpu')}${row('معالج الرسوميات','02 / GPU','gpu_temp','gpu_load','gpu_clock','gpu_power','gpu')}${row('الذاكرة العشوائية','03 / SYSTEM RAM','ram_temp','ram_used_percent','ram_speed_mhz','ram_used_gb','memory')}${row('ذاكرة الفيديو','04 / VRAM','vram_temp','vram_used_percent','vram_speed_mhz','vram_used_gb','gpu')}</tbody></table><div class="folio-resources">${storage()}${network()}</div><div class="folio-media">${gaming()}${audio()}</div></div><aside class="folio-day"><div class="daily-title"><span class="overline">THE DAY / DAILY COMPANION</span><h2>ما يهمّك اليوم.</h2></div>${prayer()}${appointments()}${matches()}</aside></main>`;
}

export class TelemetryStation extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode:'open'});
    this.state = {}; this.history = []; this.references = {}; this.filter = 'saudi'; this.matches = null;
    this.design = 'orbit';
    this.onState = this.onState.bind(this);
    this.renderTemplate();
  }
  static get observedAttributes() { return ['design']; }
  attributeChangedCallback(name, previous, next) {
    if (name !== 'design' || previous === next) return;
    const design = DESIGNS[next] ? next : 'orbit';
    if (design === this.design) return;
    this.design = design;
    this.renderTemplate();
    if (this.isConnected && this.events) {
      this.markReady(); this.renderAppointments(); this.renderMatches();
      this.renderClock(); this.mountGauges(); this.queueRender();
      this.samplePerformance();
    }
  }
  renderTemplate() {
    const design = this.design;
    this.shadowRoot.innerHTML = `<link rel="stylesheet" href="/css/dashboard-station.css?v=20261007.3"><div class="station ${design}"><header class="masthead"><div class="identity"><span class="brand-mark">${design==='orbit'?'◉':design==='vector'?'⌁':'A'}</span><div><span class="overline" dir="ltr">${DESIGNS[design][0]}</span><h1>${DESIGNS[design][1]}</h1></div></div><div class="clock-block"><strong class="clock-readout" dir="ltr"><span data-clock>—:—:—</span><small data-clock-period lang="ar" dir="rtl">—</small></strong><div class="calendar"><span data-date>—</span><span class="date-pair" dir="ltr"><span data-key="date_gregorian">—</span> / <span data-key="date_hijri">—</span></span></div></div><div class="header-actions"><span class="connection" data-connection>انتظار الحساسات</span>${this.hasAttribute('embedded') ? '<slot name="theme-picker"></slot>' : `<nav aria-label="التصاميم">${Object.entries(DESIGNS).map(([key,item])=>`<a href="/dev/theme-lab/architecture.html?design=${key}" ${design===key?'aria-current="page"':''}>${item[1]}</a>`).join('')}</nav>`}<button data-fullscreen aria-label="ملء الشاشة">⛶</button></div></header>${({orbit,vector,folio}[design])()}<footer><span>AIDA64 / SHARED MEMORY · LIVE SENSOR STREAM</span><span data-history-count>السجل يبدأ عند فتح المعاينة</span><a href="/dev/theme-lab/index.html">مقارنة التصاميم ↗</a></footer><dialog aria-label="تفاصيل القياسات"><div class="detail-header"><h2 data-detail-title>التفاصيل</h2><button data-close aria-label="إغلاق التفاصيل">✕</button></div><div data-detail-content></div></dialog></div>`;
    this.dom = this.shadowRoot;
    const platform = document.createElement('section');
    platform.className = 'platform-strip';
    platform.setAttribute('aria-label','صحة اللوحة والتبريد');
    platform.innerHTML = `<button data-details="cpu">اللوحة والتبريد ↗</button>${[['VRM','vrm_temp','°C'],['اللوحة','motherboard_temp','°C'],['PCH','pch_temp','°C'],['NVMe','nvme_temp','°C'],['مروحة CPU','cpu_fan_rpm','RPM'],['CPU + GPU · محسوب','cpu_gpu_power','W']].map(fields=>metric(...fields)).join('')}`;
    this.dom.querySelector('footer').before(platform);
    for (const kind of ['cpu','gpu']) {
      const host = this.dom.querySelector(`.processor.${kind},.parameter-pair>section:${kind==='cpu'?'first':'last'}-child`);
      if(host) { const button=document.createElement('button');button.dataset.gauge=kind;button.className='gauge-link';button.textContent='تخصيص العداد';host.querySelector('.section-head').append(button); }
    }
    this.dom.querySelector('.storage').insertAdjacentHTML('beforeend',`<p class="storage-free">إجمالي الحر <strong dir="ltr">${value('storage_total_free_gb','GiB',1)}</strong></p>`);
    this.readings = [...this.dom.querySelectorAll('[data-key]')];
    this.chartPaths = [...this.dom.querySelectorAll('[data-chart]')];
  }
  markReady() {
    const design = this.design;
    this.dataset.design = design;
    delete this.dataset.ready;
    const styleLink = this.dom.querySelector('link');
    const styled = styleLink.sheet ? Promise.resolve() : new Promise(resolve => styleLink.addEventListener('load', resolve, {once:true, signal:this.events.signal}));
    styled.then(() => document.fonts.ready).then(() => { if(this.isConnected && this.design === design) this.dataset.ready = 'true'; });
  }
  connectedCallback() {
    this.events = new AbortController();
    this.renderTemplate();
    this.markReady();
    GaugePicker.init();
    EventBus.on('gauge:style-changed',()=>{this.mountGauges();this.queueRender();},{signal:this.events.signal});
    this.mountGauges();
    // Embedded compositions subscribe to the existing transport; previews own theirs.
    this.manager = this.hasAttribute('embedded') ? null : new StateManager();
    this.unsubscribe = EventBus.on('state-changed',this.onState,{signal:this.events.signal});
    EventBus.on('connection:status', status => { this.connectionMode=status.mode; this.queueRender(); },{signal:this.events.signal});
    this.dom.addEventListener('click', event => {
      const target=event.target.closest('button'); if(!target) return;
      if(target.hasAttribute('data-fullscreen')) {
        const action=document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
        action.catch(()=>{this.dom.querySelector('[data-connection]').textContent='ملء الشاشة غير متاح في المتصفح الحالي';});
      }
      if(target.dataset.details) this.openDetails(target.dataset.details);
      if(target.dataset.inspector) this.openDetails(target.dataset.inspector);
      if(target.dataset.gauge) GaugePicker.open(target.dataset.gauge);
      if(target.hasAttribute('data-manage')) this.openAppointmentManager();
      if(target.dataset.league) { this.league=target.dataset.league;this.renderStandings(); }
      if(target.hasAttribute('data-close')) this.dom.querySelector('dialog').close();
      if(target.dataset.filter) { this.filter=target.dataset.filter; this.renderMatches(); }
    },{signal:this.events.signal});
    this.dom.addEventListener('contextmenu',event=>{
      const dial=event.target.closest('[data-dial]');if(!dial)return;
      event.preventDefault();GaugePicker.open(dial.dataset.dial.startsWith('cpu')?'cpu':'gpu');
    },{signal:this.events.signal});
    this.dom.addEventListener('keydown',event=>{
      const tab=event.target.closest('[role="tab"]');if(!tab||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      const tabs=[...tab.parentElement.querySelectorAll('[role="tab"]')],index=tabs.indexOf(tab);
      const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowLeft'?1:-1)+tabs.length)%tabs.length;
      event.preventDefault();tabs[next].click();tabs[next].focus();
    },{signal:this.events.signal});
    this.dom.querySelector('dialog').addEventListener('close',()=>{
      this.detailKind=null;this.dom.querySelector('[data-detail-content]').replaceChildren();this.indexReadings();
    },{signal:this.events.signal});
    if (this.manager) this.manager.start();
    else this.onState(window.stateManager?.currentState || {});
    this.clockTimer=setInterval(()=>{this.renderClock();this.renderCountdowns();},1000);
    this.matchTimer=setInterval(()=>{this.fetchMatches();if(this.detailKind==='matches')this.fetchStandings();},60000);
    this.fetchMatches(); this.renderClock(); this.mountGauges(); this.queueRender();
    if (this.manager) {
      window.addEventListener('pagehide',()=>this.manager.stop(),{signal:this.events.signal});
      window.addEventListener('pageshow',event=>{if(event.persisted)this.manager.start();},{signal:this.events.signal});
    }
    this.samplePerformance();
  }
  disconnectedCallback() {
    this.events.abort(); this.manager?.stop(); this.fetchController?.abort();this.standingsController?.abort();
    this.appointmentManager?.remove();this.appointmentManager=null;
    clearInterval(this.clockTimer);clearInterval(this.matchTimer);cancelAnimationFrame(this.rafId);cancelAnimationFrame(this.benchmarkRaf);
    this.rafId = 0; this.benchmarkRaf = 0;
    this.performanceObserver?.disconnect();
  }
  onState(delta) {
    this.state={...this.state,...delta};
    const now=performance.now();
    for(const key of ['next_prayer_seconds','prev_prayer_seconds','next_appointment_seconds']) if(key in delta) this.references[key]=now;
    if('today_appointments' in delta) this.references.appointment_elapsed=now;
    if(this.state.telemetry_status==='live' && (!this.lastSample || now-this.lastSample>=450)) {
      this.lastSample=now;
      this.history.push({time:now,cpu_load:this.state.cpu_load,gpu_load:this.state.gpu_load,ram_used_percent:this.state.ram_used_percent,vram_used_percent:this.state.vram_used_percent,network_download_mbps:this.state.network_download_mbps,network_upload_mbps:this.state.network_upload_mbps});
      this.history=this.history.filter(sample=>now-sample.time<=60000).slice(-125);
    }
    if('today_appointments' in delta) this.renderAppointments();
    this.queueRender();
  }
  queueRender() { if(this.rafId)return;this.rafId=requestAnimationFrame(()=>{this.rafId=0;this.render();}); }
  text(el,text) { if(el && el.textContent!==String(text))el.textContent=String(text); }
  resolved() {
    const state={...this.state};
    state.master_resolved=state.audio_master_volume ?? null;
    const measured=state.frame_time_ms ?? state.frametime_ms;
    state.frame_time_resolved=measured ?? (Number.isFinite(state.fps)&&state.fps>0?1000/state.fps:null);
    for(const type of ['P','E']) {
      const temps=(state.cpu_cores||[]).filter(core=>core.type===type&&Number.isFinite(core.temp)).map(core=>core.temp);
      state[`${type.toLowerCase()}_core_average`]=temps.length?temps.reduce((a,b)=>a+b,0)/temps.length:null;
    }
    this.text(this.dom.querySelector('[data-frame-source]'),measured!=null?'مقاس':state.frame_time_resolved!=null?'مشتق من FPS':'غير متاح');
    return state;
  }
  format(raw,places=0) { return raw==null?'—':typeof raw==='number'?(Number.isFinite(raw)?raw.toFixed(places):'—'):String(raw); }
  render() {
    const state=this.resolved();
    renderSonarPanel(this.dom.querySelector('[data-sonar-panel]'), state);
    renderSonarPanel(this.dom.querySelector('[data-detail-sonar-panel]'), state,{detailed:true});
    applyProvenance(this.dom, state);
    this.dom.querySelectorAll('[data-source-badge]').forEach(el=>{
      const source=el.dataset.sourceBadge==='sports'?this.matches?.source_meta:state.telemetry_sources?.[el.dataset.sourceBadge];
      this.text(el,source?.status==='live'?'محدّث':source?.status==='cached'?'محفوظ':source?.status==='stale'?'قديم':'غير متاح');
      el.dataset.status=source?.status || 'unavailable';
    });
    for(const el of this.readings) this.text(el,this.format(state[el.dataset.key],Number(el.dataset.places||0)));
    const live=state.telemetry_status==='live';
    this.dom.querySelector('.station').dataset.stream=live?'live':'stale';
    this.text(this.dom.querySelector('[data-connection]'),live?'● مباشر · WebSocket':state.telemetry_status==='stale'?'بيانات قديمة / غير متاحة':'انتظار الحساسات');
    for(const dial of this.dom.querySelectorAll('[data-dial]')) {
      const raw=state[dial.dataset.dial]; const progress=Math.min(100,Math.max(0,raw??0));
      dial.querySelector('.dial-progress').style.strokeDashoffset=String(100-progress);
      dial.dataset.severity=raw==null?'missing':raw>=85?'critical':raw>=75?'warning':'normal';
      this.text(dial.querySelector('[data-thermal]'),raw==null?'غير متاح':raw>=85?'حرارة مرتفعة':raw>=75?'دافئ':'حرارة طبيعية');
    }
    for(const track of this.dom.querySelectorAll('[data-meter]')) track.style.transform=`scaleX(${Math.min(100,Math.max(0,state[track.dataset.meter]??0))/100})`;
    this.text(this.dom.querySelector('[data-weather-icon]'),state.riyadh_weather_icon??'—');
    this.text(this.dom.querySelector('[data-weather-desc]'),state.riyadh_weather_desc??'غير متاح');
    this.text(this.dom.querySelector('[data-next-prayer]'),state.next_prayer_name??'غير متاح');
    this.text(this.dom.querySelector('[data-prev-prayer]'),state.prev_prayer_name??'غير متاح');
    this.dom.querySelectorAll('[data-prayer-item]').forEach(el=>{el.dataset.current=String(el.dataset.prayerItem===state.next_prayer_name);});
    this.text(this.dom.querySelector('[data-appointment-title]'),state.next_appointment_title??(state.appointments_remaining===0?'انتهت مواعيد اليوم':'المواعيد غير متاحة'));
    this.text(this.dom.querySelector('[data-appointment-status]'),state.appointments_remaining===0?'لا توجد مواعيد متبقية':state.next_appointment_ongoing?'جارٍ الآن · مضى':'الموعد القادم · متبقي');
    this.text(this.dom.querySelector('[data-appointment-location]'),state.next_appointment_location??'');
    this.text(this.dom.querySelector('[data-mic]'),state.audio_mic_muted==null?'الميكروفون غير متاح':state.audio_mic_muted?'الميكروفون مكتوم':'الميكروفون غير مكتوم');
    this.renderCores();this.renderCharts();this.renderCountdowns();
    this.renderDetailLive();this.updateGauges();
  }
  renderClock() {
    const now=new Date();
    const parts=CLOCK_FORMAT.formatToParts(now);
    const time=['hour','minute','second'].map(type=>parts.find(part=>part.type===type).value).join(':');
    const period=parts.find(part=>part.type==='dayPeriod').value==='AM'?'ص':'م';
    this.text(this.dom.querySelector('[data-clock]'),time);
    this.text(this.dom.querySelector('[data-clock-period]'),period);
    this.text(this.dom.querySelector('[data-date]'),now.toLocaleDateString('ar-SA',{timeZone:'Asia/Riyadh',weekday:'long',day:'numeric',month:'long'}));
  }
  renderCountdowns() {
    for(const el of this.dom.querySelectorAll('[data-countdown]')) {
      const key=el.dataset.countdown;
      const ongoing=key==='next_appointment_seconds'&&this.state.next_appointment_ongoing;
      const item=ongoing?this.state.today_appointments?.find(item=>item.status==='ongoing'&&item.title===this.state.next_appointment_title):null;
      // The backend countdown clamps an ongoing appointment to zero. Its
      // signed per-item seconds_until retains the actual elapsed duration.
      const raw=item&&Number.isFinite(item.seconds_until)?Math.max(0,-item.seconds_until):this.state[key];
      if(raw==null){this.text(el,'—:—:—');continue;}
      const reference=item?this.references.appointment_elapsed:this.references[key];
      const elapsed=Math.max(0,Math.floor((performance.now()-(reference??performance.now()))/1000));
      const total=appointmentSeconds(raw,elapsed,key==='prev_prayer_seconds'||ongoing);
      const formatted=[Math.floor(total/3600),Math.floor(total/60)%60,total%60].map(n=>String(n).padStart(2,'0')).join(':');
      this.text(el,formatted);
    }
  }
  renderCores() {
    const strip=this.dom.querySelector('[data-cores]');if(!strip)return;
    const cores=this.state.cpu_cores||[];
    if(strip.children.length!==cores.length)strip.innerHTML=cores.map(core=>`<i title="${esc(core.type)}${esc(core.id)}"></i>`).join('');
    [...strip.children].forEach((el,index)=>{const core=cores[index];el.style.setProperty('--load',String(Math.min(1,Math.max(.06,(core.load??0)/100))));el.title=`${core.type || 'Core '}${core.id}: ${this.format(core.load)}% / ${this.format(core.temp)}°C`;});
  }
  renderCharts() {
    const now=performance.now(), history=this.history.filter(s=>now-s.time<=60000);
    for(const path of this.chartPaths) {
      const key=path.dataset.chart, max=key.startsWith('network_')?Math.max(1,...history.map(s=>s[key]??0)):100;
      let d='',open=false,lastX=0,firstX=0;
      for(const sample of history) {
        if(sample[key]==null){open=false;continue;}
        const x=600-(now-sample.time)/60000*600, y=174-Math.min(max,Math.max(0,sample[key]))/max*168;
        if(!d)firstX=x; d+=`${open?'L':'M'}${x.toFixed(1)},${y.toFixed(1)} `;open=true;lastX=x;
      }
      if(path.getAttribute('d')!==d)path.setAttribute('d',d);
      const area=path.parentElement.querySelector('[data-area]');
      if(area)area.setAttribute('d',d&&d.split('M').length===2?`${d}L${lastX.toFixed(1)},180 L${firstX.toFixed(1)},180 Z`:'');
    }
    this.text(this.dom.querySelector('[data-history-label]'),history.length<3?'تجميع القراءات المقاسة…':'');
    this.text(this.dom.querySelector('[data-history-count]'),`${history.length} عينة مقاسة · آخر 60 ثانية`);
  }
  renderAppointments() {
    const target=this.dom.querySelector('[data-appointments]');
    const items=this.state.today_appointments;
    // seconds_until changes every tick but is not displayed in this list.
    // Keep its DOM and scroll position stable until visible fields change.
    const signature=JSON.stringify(Array.isArray(items)?items.map(item=>[item.time_12h,item.time,item.title,item.category_label,item.status_label,item.status]):null);
    if(target.dataset.signature===signature)return;
    target.dataset.signature=signature;
    target.innerHTML=Array.isArray(items)?items.map(item=>`<div class="appointment-item ${item.status==='completed'?'completed':''}"><time>${esc(item.time_12h??item.time)}</time><div><strong>${esc(item.title)}</strong><span>${esc(item.category_label)} · ${esc(item.status_label)}</span></div></div>`).join(''):'<p class="empty">المواعيد غير متاحة</p>';
    if(Array.isArray(items)&&!items.length)target.innerHTML='<p class="empty">لا توجد مواعيد مسجلة اليوم</p>';
  }
  async fetchMatches() {
    this.fetchController?.abort();this.fetchController=new AbortController();
    try {
      const response=await fetch('/api/matches/today',{signal:this.fetchController.signal,cache:'no-store'});
      if(!response.ok)throw new Error('Matches unavailable');
      this.matches=await response.json();this.renderMatches();this.queueRender();
    } catch(error) { if(error.name!=='AbortError'){this.matches=null;this.renderMatches();} }
  }
  renderMatches() {
    const target=this.dom.querySelector('[data-matches]');
    this.dom.querySelectorAll('[data-filter]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.filter===this.filter)));
    if(!this.matches){target.innerHTML='<p class="empty">المباريات غير متاحة</p>';this.text(this.dom.querySelector('[data-match-status]'),'غير متاح');return;}
    const all=[...(this.matches.matches||[]),...(this.matches.upcoming_matches||[])];
    const unique=[...new Map(all.map(match=>[match.id,match])).values()];
    const today=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Riyadh'});
    let rows=unique.filter(match=>match.is_live||String(match.date_key||'')>=today);
    if(this.filter==='saudi')rows=rows.filter(match=>match.is_saudi);
    if(this.filter==='live')rows=rows.filter(match=>match.is_live);
    if(this.filter==='upcoming')rows=rows.filter(match=>!match.is_live&&!match.is_ended);
    rows.sort((a,b)=>Number(b.is_live)-Number(a.is_live)||String(a.start_time).localeCompare(String(b.start_time)));
    this.text(this.dom.querySelector('[data-match-status]'),`${rows.length} مواجهات · ${this.matches.source_meta?.status==='live'?'محدّث':this.matches.source_meta?.status==='unavailable'?'غير متاح':this.matches.source_meta?.status==='stale'?'بيانات قديمة':'نسخة محفوظة'}`);
    target.innerHTML=rows.length?rows.map(match=>`<article class="match"><div class="match-top"><span>${esc(match.competition_name)}</span><span>${esc(match.start_date_display)} · ${esc(match.start_time_display)}</span></div><div class="teams"><strong>${this.logo(match.home_logo)}${esc(match.home_name)}</strong><span class="match-score" dir="ltr">${match.is_live||match.is_ended?esc(matchScore(match)):'VS'}</span><strong>${esc(match.away_name)}${this.logo(match.away_logo)}</strong></div><div class="match-bottom"><span>${esc(match.status_text)}</span><span>${esc(match.channel)}</span></div></article>`).join(''):'<p class="empty">لا توجد مواجهات بهذه التصفية</p>';
  }
  logo(raw) {
    try { const url=new URL(raw);return url.protocol==='https:'?`<img src="${esc(url.href)}" alt="" width="24" height="24" loading="lazy">`:''; }catch{return '';}
  }
  indexReadings() {
    this.readings=[...this.dom.querySelectorAll('[data-key]')];
    this.chartPaths=[...this.dom.querySelectorAll('[data-chart]')];
  }
  openDetails(kind) {
    if(!DETAIL_GROUPS[kind])return;
    this.detailKind=kind;
    const [title,fields]=DETAIL_GROUPS[kind],content=this.dom.querySelector('[data-detail-content]');
    this.text(this.dom.querySelector('[data-detail-title]'),title);
    const tabs=Object.entries(DETAIL_GROUPS).map(([id,[name]])=>`<button id="detail-tab-${id}" role="tab" aria-selected="${id===kind}" aria-controls="detail-panel" tabindex="${id===kind?0:-1}" data-inspector="${id}">${ACTION_LABELS[id]}</button>`).join('');
    content.innerHTML=`<div class="inspector-tabs" role="tablist" aria-label="مساحات التفاصيل">${tabs}</div><section id="detail-panel" data-kind="${kind}" role="tabpanel" aria-labelledby="detail-tab-${kind}" tabindex="0"><p class="detail-source"><span data-detail-stream>قراءات حية من الحساسات</span> · القيم المفقودة تظهر بشرطة</p><div class="detail-grid">${fields.map(([label,key,unit,places])=>metric(label,key,unit,places||0)).join('')}</div><div data-detail-extra></div></section>`;
    const extra=content.querySelector('[data-detail-extra]');
    if(kind==='cpu')extra.innerHTML=`<div class="core-summary">${metric('متوسط P · مشتق','p_core_average','°C',1)}${metric('متوسط E · مشتق','e_core_average','°C',1)}<div class="average-load"><span>استهلاك P / E · مشتق</span><strong dir="ltr"><b data-core-average-load="P">—</b>% / <b data-core-average-load="E">—</b>%</strong></div><button data-gauge="cpu">تخصيص العداد الحراري</button></div><div class="inspector-cpu"><div data-custom-gauge="cpu"></div><div><h3>الأنوية · الاستهلاك والحرارة</h3><div class="cores-grid" data-detail-cores></div></div></div>`;
    if(kind==='gpu')extra.innerHTML='<div class="gauge-workspace"><div data-custom-gauge="gpu"></div><div><h3>العداد الحراري</h3><p>أنماط العداد العشرة محفوظة بين الثيمات.</p><button data-gauge="gpu">تخصيص العداد الحراري</button></div></div>';
    if(kind==='network')extra.innerHTML=`<div class="detail-network-plots"><div><h3>التنزيل · آخر 60 ثانية</h3>${chart('network_download_mbps')}</div><div><h3>الرفع · آخر 60 ثانية</h3>${chart('network_upload_mbps','upload-chart')}</div></div><h3>أعلى 5 برامج · الاتصالات النشطة</h3><div data-detail-processes></div>`;
    if(kind==='display')extra.innerHTML='<p class="provenance">زمن الإطار: <b data-detail-frame-source>غير متاح</b> · 1% Low: غير متاح؛ لا يوجد حساس له في البث.</p>';
    if(kind==='audio')extra.innerHTML=`<div class="audio-status-grid">${['master','mic','game','chat','media','aux'].map(key=>`<div><span>${key.toUpperCase()} · كتم محلي</span><b data-muted="${key}">غير متاح</b></div>`).join('')}</div><p class="provenance">اتصال Sonar: <b data-sonar>غير متاح</b></p>`;
    if(kind==='appointments')extra.innerHTML='<div class="detail-appointment-head"><h3>جدول اليوم</h3><button data-manage>فتح إدارة المواعيد +</button></div><div data-detail-appointments></div>';
    if(kind==='matches') {
      this.league=this.league||'roshn';
      extra.innerHTML=`<div class="league-tabs" role="tablist" aria-label="البطولات">${[['roshn','دوري روشن'],['afc','نخبة آسيا'],['king','كأس الملك']].map(([id,name])=>`<button id="league-${id}" role="tab" aria-controls="league-panel" data-league="${id}">${name}</button>`).join('')}</div><div id="league-panel" role="tabpanel" tabindex="0" data-standings></div>`;
      this.renderStandings();this.fetchStandings();
    }
    if(kind==='audio')extra.insertAdjacentHTML('beforeend','<div data-detail-sonar-panel></div>');
    if(['cpu','gpu','memory','storage','display'].includes(kind))extra.insertAdjacentHTML('beforeend','<section class="configured-profiles"><h3>هوية المصدر</h3><div data-detail-inventory></div></section>');
    this.indexReadings();this.mountGauges();this.render();
    const dialog=this.dom.querySelector('dialog');if(!dialog.open)dialog.showModal();
    content.querySelector('[aria-selected="true"]').focus();
  }
  renderDetailLive() {
    if(!this.detailKind)return;
    const state=this.state;
    const inventoryNode=this.dom.querySelector('[data-detail-inventory]');
    if(inventoryNode){
      const inventory=state.hardware_inventory,kind=this.detailKind;
      let description='هوية العتاد غير متاحة';
      if(kind==='cpu'&&inventory?.cpu)description=`${inventory.cpu.Name} · ${inventory.cpu.NumberOfCores} أنوية / ${inventory.cpu.NumberOfLogicalProcessors} معالج منطقي`;
      if(kind==='gpu'&&inventory?.gpu?.length)description=inventory.gpu.map(gpu=>gpu.Name).join(' · ');
      if(kind==='memory'&&inventory?.memory?.length)description=inventory.memory.map(module=>`${String(module.Manufacturer||'').trim()} ${String(module.PartNumber||'').trim()} · ${(module.Capacity/1024**3).toFixed(0)} GiB · ${module.ConfiguredClockSpeed??'—'} MT/s`).join(' | ');
      if(kind==='storage'&&inventory?.disks?.length)description=inventory.disks.map(disk=>`${disk.FriendlyName} · ${Object.entries(inventory.volumes||{}).filter(([,id])=>id===disk.Number).map(([letter])=>letter+':').join(' / ')}`).join(' | ');
      if(kind==='display')description=`الدقة والتردد من شاشة AIDA64 · FPS من RTSS · HDR وVRR غير متاحين${inventory?.displays?.length?' · الشاشات المتصلة: '+inventory.displays.map(display=>`${display.Primary?'الرئيسية':'الثانوية'} ${display.Width} × ${display.Height}`).join(' / '):''}`;
      this.text(inventoryNode,description);
    }
    this.text(this.dom.querySelector('[data-detail-stream]'),this.detailKind==='matches'?(this.standings?`بيانات البطولات · ${this.standings[this.league]?.source_meta?.status==='live'?'محدّثة':this.standings[this.league]?.source_meta?.status==='stale'?'بيانات قديمة':'نسخة محفوظة'}`:'بيانات البطولات غير متاحة'):state.telemetry_status==='live'?'قراءات حية من الحساسات':'البث قديم / غير متاح');
    const cores=this.dom.querySelector('[data-detail-cores]');
    if(cores) {
      const list=state.cpu_cores||[],signature=list.map(core=>`${core.type}:${core.id}`).join('|');
      if(cores.dataset.signature!==signature){cores.dataset.signature=signature;cores.innerHTML=list.map(core=>`<div><b>${esc(core.type)}${esc(core.id)}</b><strong data-core-load dir="ltr">—</strong><span data-core-temp dir="ltr">—</span></div>`).join('')||'<p class="empty">الأنوية غير متاحة</p>';}
      [...cores.children].forEach((el,index)=>{const core=list[index];if(!core)return;this.text(el.querySelector('[data-core-load]'),`${this.format(core.load)}%`);this.text(el.querySelector('[data-core-temp]'),`${this.format(core.temp)}°C`);el.dataset.severity=core.temp==null?'missing':core.temp>=85?'critical':core.temp>=75?'warning':'normal';});
      for(const type of ['P','E']) {
        const temps=list.filter(core=>core.type===type&&Number.isFinite(core.temp)).map(core=>core.temp);
        this.text(this.dom.querySelector(`[data-key="${type.toLowerCase()}_core_average"]`),temps.length?(temps.reduce((a,b)=>a+b,0)/temps.length).toFixed(1):'—');
        const loads=list.filter(core=>core.type===type&&Number.isFinite(core.load)).map(core=>core.load);
        this.text(this.dom.querySelector(`[data-core-average-load="${type}"]`),loads.length?(loads.reduce((a,b)=>a+b,0)/loads.length).toFixed(0):'—');
      }
    }
    const processes=this.dom.querySelector('[data-detail-processes]');
    if(processes) {
      const list=state.network_top_processes?.slice(0,5),signature=JSON.stringify(list??null);
      if(processes.dataset.signature!==signature){processes.dataset.signature=signature;processes.innerHTML=list?.length?`<table class="detail-table"><thead><tr><th>البرنامج</th><th>الاتصالات</th></tr></thead><tbody>${list.map(app=>`<tr><th scope="row">${esc(app.name)}</th><td>${esc(this.format(app.connections))}</td></tr>`).join('')}</tbody></table>`:'<p class="empty">اتصالات البرامج غير متاحة</p>';}
    }
    const appointments=this.dom.querySelector('[data-detail-appointments]');
    if(appointments) {
      const items=state.today_appointments,signature=JSON.stringify(Array.isArray(items)?items.map(item=>[item.title,item.time_12h,item.time,item.category_label,item.status_label,item.location]):null);
      if(appointments.dataset.signature!==signature){appointments.dataset.signature=signature;appointments.innerHTML=Array.isArray(items)&&items.length?items.map(item=>`<div class="process-row"><strong>${esc(item.title)}</strong><span>${esc(item.time_12h??item.time)} · ${esc(item.category_label)} · ${esc(item.status_label)}${item.location?` · ${esc(item.location)}`:''}</span></div>`).join(''):'<p class="empty">لا توجد مواعيد متاحة</p>';}
    }
    this.dom.querySelectorAll('[data-muted]').forEach(el=>{const raw=state[`audio_${el.dataset.muted}_muted`];this.text(el,raw==null?'غير متاح':raw?'مكتوم':'غير مكتوم');});
    this.text(this.dom.querySelector('[data-sonar]'),state.sonar_connected==null?'غير متاح':state.sonar_connected?'متصل':'غير متصل');
    const measured=state.frame_time_ms??state.frametime_ms;
    this.text(this.dom.querySelector('[data-detail-frame-source]'),measured!=null?'مقاس':Number.isFinite(state.fps)&&state.fps>0?'مشتق من FPS':'غير متاح');
  }
  openAppointmentManager() {
    if(this.appointmentManager?.isConnected)return;
    const manager=document.createElement('dashboard-appointments');
    manager.setAttribute('mode','manager');this.appointmentManager=manager;
    manager.addEventListener('appointments:closed',()=>{manager.remove();this.appointmentManager=null;},{once:true,signal:this.events.signal});
    this.dom.querySelector('.station').append(manager);manager.openModal();
  }
  mountGauges() {
    for(const dial of this.dom.querySelectorAll('[data-dial]')) {
      const id=dial.dataset.dial.startsWith('cpu')?'cpu':'gpu';let configured=false;
      try{configured=Boolean(localStorage.getItem('aida_gauge_style_global')||localStorage.getItem(`aida_gauge_style_${id}`));}catch{}
      dial.classList.toggle('customized',configured);
      if(configured&&!dial.querySelector('[data-custom-gauge]')){const mount=document.createElement('div');mount.dataset.customGauge=id;dial.append(mount);}
    }
    this.dom.querySelectorAll('[data-custom-gauge]').forEach(el=>{
      const id=el.dataset.customGauge,style=GaugePicker.getSavedStyle(id);
      if(el.dataset.gaugeStyle!==style)GaugeEngine.renderGaugeSvg(style,el,{title:id.toUpperCase(),gaugeId:id,unit:'°C'});
    });
  }
  updateGauges() {
    this.dom.querySelectorAll('[data-custom-gauge]').forEach(el=>{
      const raw=this.state[`${el.dataset.customGauge}_temp`];
      GaugeEngine.updateGaugeSvg(el.dataset.gaugeStyle,el,raw,20,100,raw==null?'غير متاح':raw>=85?'حرارة مرتفعة':raw>=75?'دافئ':'طبيعي');
    });
  }
  async fetchStandings() {
    this.standingsController?.abort();const controller=new AbortController();this.standingsController=controller;
    try {
      const response=await fetch('/api/matches/saudi-standings',{signal:controller.signal,cache:'no-store'});
      if(!response.ok)throw new Error('Standings unavailable');
      this.standings=await response.json();this.renderStandings();this.renderDetailLive();
    }catch(error){if(error.name!=='AbortError'){this.standings=null;this.renderStandings();}}
  }
  renderStandings() {
    const target=this.dom.querySelector('[data-standings]');if(!target)return;
    this.dom.querySelectorAll('[data-league]').forEach(tab=>{const selected=tab.dataset.league===this.league;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;});
    target.setAttribute('aria-labelledby',`league-${this.league}`);
    if(!this.standings){target.innerHTML='<p class="empty">ترتيب البطولات غير متاح / جاري التحميل</p>';return;}
    const source=this.standings[this.league]?.source_meta || this.standings.source_meta;
    target.title=`365Scores · ${source?.status==='live'?'محدّث':source?.status==='stale'?'بيانات قديمة':source?.status==='cached'?'نسخة محفوظة':'غير متاح'} · ${source?.observed_at?new Date(source.observed_at*1000).toLocaleString('ar-SA',{timeZone:'Asia/Riyadh'}):'تاريخ التحديث غير متاح'}`;
    if(this.league==='king') {
      const rows=this.standings.king?.matches||[];
      target.innerHTML=rows.length?`<div class="cup-grid">${rows.map(match=>`<article class="cup-match"><span>${esc(match.stage_name||'كأس الملك')}</span><div class="teams"><strong>${this.logo(match.home_logo)}${esc(match.home_name)}${match.home_qualified?' ✓':''}</strong><b dir="ltr">${esc(matchScore(match))}</b><strong>${esc(match.away_name)}${match.away_qualified?' ✓':''}${this.logo(match.away_logo)}</strong></div></article>`).join('')}</div>`:'<p class="empty">لا توجد مواجهات متاحة</p>';
      return;
    }
    const rows=this.league==='roshn'?(this.standings.roshn?.standings||this.standings.standings||[]):(this.standings.afc?.standings||[]),cutoff=this.league==='roshn'?3:8;
    target.innerHTML=rows.length?`<p class="table-legend">تمييز المراكز المؤهلة ${cutoff}${this.league==='roshn'?' · الهبوط من المركز 16':''}</p><table class="detail-table standings-table"><thead><tr><th>المركز</th><th>الفريق</th><th>لعب</th><th>فارق الأهداف</th><th>النقاط</th></tr></thead><tbody>${rows.map(row=>`<tr class="${row.position<=cutoff?'qualifying':this.league==='roshn'&&row.position>=16?'relegation':''}"><td>${esc(row.position)}</td><th scope="row">${this.logo(row.team_logo)}${esc(row.team_name)}</th><td>${esc(row.played)}</td><td>${esc(row.goal_diff>0?`+${row.goal_diff}`:row.goal_diff)}</td><td><b>${esc(row.points)}</b></td></tr>`).join('')}</tbody></table>`:'<p class="empty">لا توجد بيانات ترتيب متاحة</p>';
  }
  samplePerformance() {
    if(!new URLSearchParams(location.search).has('measure'))return;
    cancelAnimationFrame(this.benchmarkRaf);this.performanceObserver?.disconnect();
    const started=performance.now(),samples=[],longTasks=[];let previous;
    if(PerformanceObserver.supportedEntryTypes.includes('longtask')) {
      this.performanceObserver=new PerformanceObserver(list=>longTasks.push(...list.getEntries().filter(entry=>entry.startTime-started>=2000).map(entry=>entry.duration)));
      this.performanceObserver.observe({type:'longtask'});
    }
    const tick=timestamp=>{
      if(previous&&timestamp-started>=2000)samples.push(timestamp-previous);previous=timestamp;
      if(timestamp-started<14000)this.benchmarkRaf=requestAnimationFrame(tick);
      else {this.performanceObserver?.disconnect();const sorted=[...samples].sort((a,b)=>a-b);const output=document.createElement('output');output.hidden=true;output.id='architecture-benchmark';output.textContent=JSON.stringify({design:this.design,frames:samples.length,p95Ms:sorted[Math.floor(sorted.length*.95)],maxMs:Math.max(...samples),longTasks});this.dom.append(output);}
    };this.benchmarkRaf=requestAnimationFrame(tick);
  }
}
customElements.define('telemetry-station',TelemetryStation);
