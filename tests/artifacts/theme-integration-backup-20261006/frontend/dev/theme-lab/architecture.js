import { StateManager } from '../../js/store/state_manager.js?v=20261006.10';
import { EventBus } from '../../js/store/event_bus.js?v=20261006.10';

const DESIGNS = { orbit: ['ORBIT / COMMAND','قمرة القيادة'], vector: ['VECTOR / OBSERVATORY','مرصد الأداء'], folio: ['FOLIO / STUDIO','دفتر العتاد'] };
const requested = new URLSearchParams(location.search).get('design');
const design = DESIGNS[requested] ? requested : 'orbit';
document.title = `${DESIGNS[design][1]} • AIDA64 Live Architecture`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const value = (key, unit = '', places = 0, extra = '') => `<span class="reading ${extra}" data-key="${key}" data-places="${places}">—</span>${unit ? `<small>${unit}</small>` : ''}`;
const metric = (label, key, unit, places = 0) => `<div class="metric"><span>${label}</span><strong dir="ltr">${value(key, unit, places)}</strong></div>`;
const chart = (key, extra = '') => `<svg class="chart ${extra}" viewBox="0 0 600 180" preserveAspectRatio="none" aria-label="تاريخ قياسات ${key}" role="img"><path class="chart-area" data-area="${key}"/><path class="chart-line" data-chart="${key}"/></svg>`;
const heading = (name, tag, button = '') => `<div class="section-head"><div><span class="overline">${tag}</span><h2>${name}</h2></div>${button ? `<button data-details="${button}">التفاصيل ↗</button>` : ''}</div>`;
const cpuFields = () => metric('التردد','cpu_clock','MHz') + metric('الطاقة','cpu_power','W') + metric('البقعة الساخنة','cpu_hotspot_temp','°C') + metric('مضخة التبريد','pump_rpm','RPM');
const gpuFields = () => metric('التردد','gpu_clock','MHz') + metric('الطاقة','gpu_power','W') + metric('البقعة الساخنة','gpu_hotspot_temp','°C') + metric('ذاكرة الفيديو','vram_used_gb','GB',1);
const radial = (key, label) => `<div class="dial" data-dial="${key}"><svg viewBox="0 0 260 260" aria-hidden="true"><circle class="dial-track" cx="130" cy="130" r="108"/><circle class="dial-progress" cx="130" cy="130" r="108" pathLength="100"/><circle class="dial-inner" cx="130" cy="130" r="94"/></svg><div class="dial-reading"><span>${label}</span><strong dir="ltr">${value(key,'°C')}</strong><span class="thermal-status" data-thermal="${key}">غير متاح</span></div></div>`;
const meter = key => `<div class="meter"><i data-meter="${key}"></i></div>`;
const ram = () => `<section class="resource memory">${heading('الذاكرة العشوائية','03 / SYSTEM RAM','memory')}<div class="resource-main"><strong dir="ltr">${value('ram_used_percent','%')}</strong><div dir="ltr">${value('ram_used_gb','',1)} / ${value('ram_total_gb','GB',1)}</div></div>${meter('ram_used_percent')}<div class="mini-row">${metric('التردد','ram_speed_mhz','MHz')}${metric('حرارة الذاكرة','ram_temp','°C')}</div></section>`;
const storage = () => `<section class="resource storage">${heading('وحدات التخزين','04 / STORAGE POOL','storage')}<div class="disk"><div><span>القرص C: · النظام</span><strong dir="ltr">${value('drive_c_used_percent','%')}</strong></div>${meter('drive_c_used_percent')}<p dir="ltr">${value('drive_c_used_gb','',1)} / ${value('drive_c_total_gb','GB',1)} <span>· حر ${value('drive_c_free_gb','GB')}</span></p></div><div class="disk"><div><span>القرص D: · البيانات</span><strong dir="ltr">${value('drive_d_used_percent','%')}</strong></div>${meter('drive_d_used_percent')}<p dir="ltr">${value('drive_d_used_gb','',1)} / ${value('drive_d_total_gb','GB',1)} <span>· حر ${value('drive_d_free_gb','GB')}</span></p></div></section>`;
const network = () => `<section class="resource network">${heading('حركة الشبكة','05 / NETWORK','network')}<div class="net-pair"><div><span>↓ التنزيل</span><strong dir="ltr">${value('network_download_mbps','Mbps',2)}</strong></div><div><span>↑ الرفع</span><strong dir="ltr">${value('network_upload_mbps','Mbps',2)}</strong></div></div>${chart('network_download_mbps','network-chart')}<div class="mini-row">${metric('زمن الاستجابة','network_ping_ms','ms')}${metric('الاتصالات','network_active_conns','')}</div></section>`;
const audio = () => `<section class="resource audio">${heading('مكسر قنوات Sonar','06 / AUDIO CONTROL','audio')}<div class="master"><span>الصوت العام · Master</span><strong dir="ltr">${value('master_resolved','%')}</strong></div><div class="mixers">${[['Game','game'],['Chat','chat'],['Media','media'],['Aux','aux']].map(([label,key])=>`<div><span>${label}</span><strong dir="ltr">${value(`audio_${key}_volume`,'%')}</strong>${meter(`audio_${key}_volume`)}</div>`).join('')}</div><span class="mic-state" data-mic>الميكروفون —</span></section>`;
const prayer = () => `<section class="daily prayer">${heading('مواقيت الصلاة والطقس','RIYADH / DAILY RHYTHM')}<div class="weather-row"><span><b data-weather-icon>☀</b> طقس الرياض · <span data-weather-desc>—</span></span><strong dir="ltr">${value('riyadh_temp','°C',1)}</strong></div><div class="prayer-hero"><div><span>متبقي على</span><h3 data-next-prayer>—</h3></div><strong data-countdown="next_prayer_seconds" dir="ltr">—:—:—</strong></div><div class="prayer-list">${[['الفجر','fajr'],['الظهر','dhuhr'],['العصر','asr'],['المغرب','maghrib'],['العشاء','isha']].map(([label,key])=>`<div><span>${label}</span><strong data-key="prayer_${key}" dir="ltr">—</strong></div>`).join('')}</div><p class="previous-prayer">مضى على <span data-prev-prayer>—</span> <b data-countdown="prev_prayer_seconds" dir="ltr">—:—:—</b></p></section>`;
const appointments = () => `<section class="daily appointments">${heading('المواعيد اليومية','YOUR NEXT MOMENT','appointments')}<div class="appointment-hero"><div class="next-appointment-label">الموعد القادم <span data-key="next_appointment_time">—</span></div><h3 data-appointment-title>المواعيد غير متاحة</h3><div class="appointment-bottom"><span data-appointment-location>—</span><strong data-countdown="next_appointment_seconds" dir="ltr">—:—:—</strong></div></div><div class="appointment-list" data-appointments></div></section>`;
const matches = () => `<section class="daily matches">${heading('مباريات اليوم والمواجهات القادمة','MATCHDAY / SAUDI & WORLD','matches')}<div class="match-filters" role="group" aria-label="تصفية المباريات"><button data-filter="saudi" aria-pressed="true">السعودية</button><button data-filter="all" aria-pressed="false">الكل</button><button data-filter="live" aria-pressed="false">مباشر</button><span data-match-status>جاري التحميل</span></div><div class="match-list" data-matches></div></section>`;
const gaming = () => `<section class="gaming">${heading('محرك العرض والألعاب','LIVE DISPLAY / FRAME TELEMETRY','display')}<span class="fps-caption">معدل الإطارات الحقيقي</span><strong class="fps-value" dir="ltr">${value('fps','FPS')}</strong><div class="display-specs">${metric('التردد','display_hz','Hz')}<div class="metric"><span>زمن الإطار <em data-frame-source>غير متاح</em></span><strong dir="ltr">${value('frame_time_resolved','ms',1)}</strong></div></div><div class="resolution"><span>دقة الشاشة</span><strong data-key="display_res" dir="ltr">—</strong></div></section>`;

function orbit() {
  return `<main class="orbit-layout"><div class="orbit-primary"><section class="processor cpu">${heading('المعالج المركزي','01 / CPU MASTER','cpu')}<div class="processor-body">${radial('cpu_temp','حرارة المعالج')}<div class="processor-side"><div class="load-title"><span>نسبة الاستهلاك</span><strong dir="ltr">${value('cpu_load','%')}</strong></div>${meter('cpu_load')}<div class="processor-stats">${cpuFields()}</div></div></div><div class="core-strip" data-cores></div></section>${gaming()}<section class="processor gpu">${heading('معالج الرسوميات','02 / GPU & VRAM MASTER','gpu')}<div class="processor-body">${radial('gpu_temp','حرارة الكرت')}<div class="processor-side"><div class="load-title"><span>نسبة الاستهلاك</span><strong dir="ltr">${value('gpu_load','%')}</strong></div>${meter('gpu_load')}<div class="processor-stats">${gpuFields()}</div></div></div><div class="vram-strip">VRAM <b dir="ltr">${value('vram_used_gb','',1)} / ${value('vram_total_gb','GB',1)}</b><span>الحرارة <b dir="ltr">${value('vram_temp','°C')}</b></span><span>المروحة <b dir="ltr">${value('gpu_fan_rpm','RPM')}</b></span></div></section></div><div class="orbit-resources">${ram()}${storage()}${network()}${audio()}</div><div class="orbit-day">${prayer()}${appointments()}${matches()}</div></main>`;
}
const instrument = (label,key,unit,tag) => `<div class="instrument"><span class="overline">${tag}</span><h2>${label}</h2><strong dir="ltr">${value(key,unit)}</strong></div>`;
function vector() {
  return `<main class="vector-layout"><aside class="instrument-rail"><span class="rail-symbol">⌁</span><span>CPU</span><i></i><span>GPU</span><i></i><span>RAM</span><i></i><span>NET</span><a href="index.html" aria-label="مقارنة التصاميم">↗</a><small dir="ltr">AIDA / LIVE</small></aside><div class="vector-hardware"><div class="instrument-strip">${instrument('المعالج المركزي','cpu_temp','°C','PROCESSOR')}${instrument('معالج الرسوميات','gpu_temp','°C','GRAPHICS')}${instrument('الذاكرة العشوائية','ram_used_percent','%','MEMORY')}${instrument('معدل الإطارات الحقيقي','fps','FPS','DISPLAY')}</div><section class="observatory">${heading('رصد الأداء المباشر','MEASURED HISTORY / LAST 60 SECONDS')}<div class="plot-legend"><span><i></i> المعالج · الاستهلاك <b class="reading" data-key="cpu_load">—</b>%</span><span><i></i> كرت الشاشة · الاستهلاك <b class="reading" data-key="gpu_load">—</b>%</span><b dir="ltr">0–100%</b></div><div class="plot"><div class="axis"><span>100</span><span>75</span><span>50</span><span>25</span><span>0</span></div>${chart('cpu_load','cpu-chart')}${chart('gpu_load','gpu-chart')}<div class="plot-empty" data-history-label>تجميع القراءات المقاسة…</div></div><div class="time-axis"><span>−60 ثانية</span><span>−30 ثانية</span><span>الآن</span></div></section><div class="parameter-pair"><section>${heading('قياسات المعالج','CPU / PARAMETERS','cpu')}<div class="parameter-grid">${cpuFields()}${metric('الجهد','cpu_voltage','V',3)}${metric('حرارة اللوحة','motherboard_temp','°C')}</div></section><section>${heading('قياسات كرت الشاشة','GPU / PARAMETERS','gpu')}<div class="parameter-grid">${gpuFields()}${metric('ذاكرة الفيديو','vram_used_percent','%')}${metric('مروحة الكرت','gpu_fan_rpm','RPM')}</div></section></div><div class="vector-resources">${ram()}${storage()}${network()}</div><div class="vector-media">${gaming()}${audio()}</div></div><div class="vector-day">${prayer()}${appointments()}${matches()}</div></main>`;
}
function folio() {
  const row = (label,tag,temp,load,clock,power,details) => `<tr><th scope="row"><span>${tag}</span><h2>${label}</h2><button data-details="${details}">القياسات كاملة ↗</button></th><td><strong dir="ltr">${value(temp,'°C')}</strong></td><td><strong dir="ltr">${value(load,'%')}</strong>${chart(load,'table-chart')}</td><td><strong dir="ltr">${value(clock,'MHz')}</strong></td><td><strong dir="ltr">${value(power,power.includes('gb')?'GB':'W',power.includes('gb')?1:0)}</strong>${power.includes('gb')?`<span class="ledger-total" dir="ltr">/ ${value(power==='ram_used_gb'?'ram_total_gb':'vram_total_gb','GB',1)}</span>`:''}</td></tr>`;
  return `<main class="folio-layout"><div class="folio-hardware"><div class="folio-title"><span class="overline">THE MACHINE / LIVE INVENTORY</span><h1>الجهاز، في نظرة واحدة.</h1><p>قياسات فعلية من الحساسات · تتحدث كل نصف ثانية</p></div><table class="hardware-ledger"><thead><tr><th>المكوّن</th><th>الحرارة</th><th>الاستهلاك</th><th>التردد</th><th>الطاقة / السعة</th></tr></thead><tbody>${row('المعالج المركزي','01 / CPU','cpu_temp','cpu_load','cpu_clock','cpu_power','cpu')}${row('معالج الرسوميات','02 / GPU','gpu_temp','gpu_load','gpu_clock','gpu_power','gpu')}${row('الذاكرة العشوائية','03 / SYSTEM RAM','ram_temp','ram_used_percent','ram_speed_mhz','ram_used_gb','memory')}${row('ذاكرة الفيديو','04 / VRAM','vram_temp','vram_used_percent','vram_speed_mhz','vram_used_gb','gpu')}</tbody></table><div class="folio-resources">${storage()}${network()}</div><div class="folio-media">${gaming()}${audio()}</div></div><aside class="folio-day"><div class="daily-title"><span class="overline">THE DAY / DAILY COMPANION</span><h2>ما يهمّك اليوم.</h2></div>${prayer()}${appointments()}${matches()}</aside></main>`;
}

export class TelemetryStation extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode:'open'});
    this.state = {}; this.history = []; this.references = {}; this.filter = 'saudi'; this.matches = null;
    this.shadowRoot.innerHTML = `<link rel="stylesheet" href="architecture.css?v=2"><div class="station ${design}"><header class="masthead"><div class="identity"><span class="brand-mark">${design==='orbit'?'◉':design==='vector'?'⌁':'A'}</span><div><span class="overline" dir="ltr">${DESIGNS[design][0]}</span><h1>${DESIGNS[design][1]}</h1></div></div><div class="clock-block"><strong data-clock dir="ltr">—:—:—</strong><div class="calendar"><span data-date>—</span><span class="date-pair" dir="ltr"><span data-key="date_gregorian">—</span> / <span data-key="date_hijri">—</span></span></div></div><div class="header-actions"><span class="connection" data-connection>انتظار الحساسات</span><nav aria-label="التصاميم">${Object.entries(DESIGNS).map(([key,item])=>`<a href="architecture.html?design=${key}" ${design===key?'aria-current="page"':''}>${item[1]}</a>`).join('')}</nav><button data-fullscreen aria-label="ملء الشاشة">⛶</button></div></header>${({orbit,vector,folio}[design])()}<footer><span>AIDA64 / SHARED MEMORY · LIVE SENSOR STREAM</span><span data-history-count>السجل يبدأ عند فتح المعاينة</span><a href="index.html">مقارنة التصاميم ↗</a></footer><dialog aria-label="تفاصيل القياسات"><div class="detail-header"><h2 data-detail-title>التفاصيل</h2><button data-close aria-label="إغلاق التفاصيل">✕</button></div><div data-detail-content></div></dialog></div>`;
    this.dom = this.shadowRoot;
    this.readings = [...this.dom.querySelectorAll('[data-key]')];
    this.chartPaths = [...this.dom.querySelectorAll('[data-chart]')];
    this.onState = this.onState.bind(this);
  }
  connectedCallback() {
    this.events = new AbortController();
    this.dataset.design=design;
    const styleLink=this.dom.querySelector('link');
    const styled=styleLink.sheet?Promise.resolve():new Promise(resolve=>styleLink.addEventListener('load',resolve,{once:true,signal:this.events.signal}));
    styled.then(()=>document.fonts.ready).then(()=>{if(this.isConnected)this.dataset.ready='true';});
    this.manager = new StateManager();
    this.unsubscribe = EventBus.on('state-changed',this.onState,{signal:this.events.signal});
    EventBus.on('connection:status', status => { this.connectionMode=status.mode; this.queueRender(); },{signal:this.events.signal});
    this.dom.addEventListener('click', event => {
      const target=event.target.closest('button'); if(!target) return;
      if(target.hasAttribute('data-fullscreen')) {
        const action=document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
        action.catch(()=>{this.dom.querySelector('[data-connection]').textContent='ملء الشاشة غير متاح في المتصفح الحالي';});
      }
      if(target.dataset.details) this.openDetails(target.dataset.details);
      if(target.hasAttribute('data-close')) this.dom.querySelector('dialog').close();
      if(target.dataset.filter) { this.filter=target.dataset.filter; this.renderMatches(); }
    },{signal:this.events.signal});
    this.manager.start();
    this.clockTimer=setInterval(()=>{this.renderClock();this.renderCountdowns();},1000);
    this.matchTimer=setInterval(()=>this.fetchMatches(),60000);
    this.fetchMatches(); this.renderClock(); this.queueRender();
    window.addEventListener('pagehide',()=>this.manager.stop(),{signal:this.events.signal});
    window.addEventListener('pageshow',event=>{if(event.persisted)this.manager.start();},{signal:this.events.signal});
    this.samplePerformance();
  }
  disconnectedCallback() {
    this.events.abort(); this.manager.stop(); this.fetchController?.abort();
    clearInterval(this.clockTimer);clearInterval(this.matchTimer);cancelAnimationFrame(this.rafId);cancelAnimationFrame(this.benchmarkRaf);
    this.performanceObserver?.disconnect();
  }
  onState(delta) {
    this.state={...this.state,...delta};
    const now=performance.now();
    for(const key of ['next_prayer_seconds','prev_prayer_seconds','next_appointment_seconds']) if(key in delta) this.references[key]=now;
    if(this.state.telemetry_status==='live' && (!this.lastSample || now-this.lastSample>=450)) {
      this.lastSample=now;
      this.history.push({time:now,cpu_load:this.state.cpu_load,gpu_load:this.state.gpu_load,ram_used_percent:this.state.ram_used_percent,vram_used_percent:this.state.vram_used_percent,network_download_mbps:this.state.network_download_mbps});
      this.history=this.history.filter(sample=>now-sample.time<=60000).slice(-125);
    }
    if('today_appointments' in delta) this.renderAppointments();
    this.queueRender();
  }
  queueRender() { if(this.rafId)return;this.rafId=requestAnimationFrame(()=>{this.rafId=0;this.render();}); }
  text(el,text) { if(el && el.textContent!==String(text))el.textContent=String(text); }
  resolved() {
    const state={...this.state};
    state.master_resolved=state.audio_master_volume ?? state.display_volume;
    const measured=state.frame_time_ms ?? state.frametime_ms;
    state.frame_time_resolved=measured ?? (Number.isFinite(state.fps)&&state.fps>0?1000/state.fps:null);
    this.text(this.dom.querySelector('[data-frame-source]'),measured!=null?'مقاس':state.frame_time_resolved!=null?'مشتق من FPS':'غير متاح');
    return state;
  }
  format(raw,places=0) { return raw==null?'—':typeof raw==='number'?(Number.isFinite(raw)?raw.toFixed(places):'—'):String(raw); }
  render() {
    const state=this.resolved();
    for(const el of this.readings) this.text(el,this.format(state[el.dataset.key],Number(el.dataset.places||0)));
    const live=state.telemetry_status==='live';
    this.dom.querySelector('.station').dataset.stream=live?'live':'stale';
    this.text(this.dom.querySelector('[data-connection]'),live?'● مباشر · WebSocket':state.telemetry_status==='stale'?'بيانات قديمة / غير متاحة':'انتظار الحساسات');
    for(const dial of this.dom.querySelectorAll('[data-dial]')) {
      const raw=state[dial.dataset.dial]; const progress=Math.min(100,Math.max(0,raw??0));
      dial.querySelector('.dial-progress').style.strokeDashoffset=String(100-progress);
      dial.dataset.severity=raw==null?'missing':raw>=90?'critical':raw>=75?'warning':'normal';
      this.text(dial.querySelector('[data-thermal]'),raw==null?'غير متاح':raw>=90?'حرارة مرتفعة':raw>=75?'دافئ':'حرارة طبيعية');
    }
    for(const track of this.dom.querySelectorAll('[data-meter]')) track.style.transform=`scaleX(${Math.min(100,Math.max(0,state[track.dataset.meter]??0))/100})`;
    this.text(this.dom.querySelector('[data-weather-icon]'),state.riyadh_weather_icon??'—');
    this.text(this.dom.querySelector('[data-weather-desc]'),state.riyadh_weather_desc??'غير متاح');
    this.text(this.dom.querySelector('[data-next-prayer]'),state.next_prayer_name??'غير متاح');
    this.text(this.dom.querySelector('[data-prev-prayer]'),state.prev_prayer_name??'غير متاح');
    this.text(this.dom.querySelector('[data-appointment-title]'),state.next_appointment_title??'المواعيد غير متاحة');
    this.text(this.dom.querySelector('[data-appointment-location]'),state.next_appointment_location??'');
    this.text(this.dom.querySelector('[data-mic]'),state.audio_mic_muted==null?'الميكروفون غير متاح':state.audio_mic_muted?'الميكروفون مكتوم':'الميكروفون مباشر');
    this.renderCores();this.renderCharts();this.renderCountdowns();
  }
  renderClock() {
    const now=new Date();
    this.text(this.dom.querySelector('[data-clock]'),now.toLocaleTimeString('en-GB',{timeZone:'Asia/Riyadh',hour12:false}));
    this.text(this.dom.querySelector('[data-date]'),now.toLocaleDateString('ar-SA',{weekday:'long',day:'numeric',month:'long'}));
  }
  renderCountdowns() {
    for(const el of this.dom.querySelectorAll('[data-countdown]')) {
      const key=el.dataset.countdown,raw=this.state[key];
      if(raw==null){this.text(el,'—:—:—');continue;}
      const elapsed=Math.max(0,Math.floor((performance.now()-(this.references[key]??performance.now()))/1000));
      const total=Math.max(0,Math.floor(raw)+(key==='prev_prayer_seconds'?elapsed:-elapsed));
      const formatted=[Math.floor(total/3600),Math.floor(total/60)%60,total%60].map(n=>String(n).padStart(2,'0')).join(':');
      this.text(el,formatted);
    }
  }
  renderCores() {
    const strip=this.dom.querySelector('[data-cores]');if(!strip)return;
    const cores=this.state.cpu_cores||[];
    if(strip.children.length!==cores.length)strip.innerHTML=cores.map(core=>`<i title="${esc(core.type)}${esc(core.id)}"></i>`).join('');
    [...strip.children].forEach((el,index)=>{const core=cores[index];el.style.setProperty('--load',String(Math.min(1,Math.max(.06,(core.load??0)/100))));el.title=`${core.type}${core.id}: ${this.format(core.load)}% / ${this.format(core.temp)}°C`;});
  }
  renderCharts() {
    const now=performance.now(), history=this.history.filter(s=>now-s.time<=60000);
    for(const path of this.chartPaths) {
      const key=path.dataset.chart, max=key==='network_download_mbps'?Math.max(1,...history.map(s=>s[key]??0)):100;
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
    target.innerHTML=Array.isArray(items)?items.map(item=>`<div class="appointment-item ${item.status==='completed'?'completed':''}"><time>${esc(item.time_12h??item.time)}</time><div><strong>${esc(item.title)}</strong><span>${esc(item.category_label)} · ${esc(item.status_label)}</span></div></div>`).join(''):'<p class="empty">المواعيد غير متاحة</p>';
  }
  async fetchMatches() {
    this.fetchController?.abort();this.fetchController=new AbortController();
    try {
      const response=await fetch('/api/matches/today',{signal:this.fetchController.signal,cache:'no-store'});
      if(!response.ok)throw new Error('Matches unavailable');
      this.matches=await response.json();this.renderMatches();
    } catch(error) { if(error.name!=='AbortError'){this.matches=null;this.renderMatches();} }
  }
  renderMatches() {
    const target=this.dom.querySelector('[data-matches]');
    this.dom.querySelectorAll('[data-filter]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.filter===this.filter)));
    if(!this.matches){target.innerHTML='<p class="empty">المباريات غير متاحة</p>';this.text(this.dom.querySelector('[data-match-status]'),'غير متاح');return;}
    const all=[...(this.matches.matches||[]),...(this.matches.upcoming_matches||[])];
    const unique=[...new Map(all.map(match=>[match.id,match])).values()];
    const today=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Riyadh'});
    let rows=unique.filter(match=>match.is_live||(!match.is_ended&&String(match.date_key||'')>=today));
    if(this.filter==='saudi')rows=rows.filter(match=>match.is_saudi);
    if(this.filter==='live')rows=rows.filter(match=>match.is_live);
    rows.sort((a,b)=>Number(b.is_live)-Number(a.is_live)||String(a.start_time).localeCompare(String(b.start_time)));
    this.text(this.dom.querySelector('[data-match-status]'),`${rows.length} مواجهات`);
    target.innerHTML=rows.length?rows.slice(0,12).map(match=>`<article class="match"><div class="match-top"><span>${esc(match.competition_name)}</span><span>${esc(match.start_date_display)} · ${esc(match.start_time_display)}</span></div><div class="teams"><strong>${this.logo(match.home_logo)}${esc(match.home_name)}</strong><span class="match-score" dir="ltr">${match.is_live||match.is_ended?`${esc(match.home_score)} – ${esc(match.away_score)}`:'VS'}</span><strong>${esc(match.away_name)}${this.logo(match.away_logo)}</strong></div><div class="match-bottom"><span>${esc(match.status_text)}</span><span>${esc(match.channel)}</span></div></article>`).join(''):'<p class="empty">لا توجد مواجهات بهذه التصفية</p>';
  }
  logo(raw) {
    try { const url=new URL(raw);return url.protocol==='https:'?`<img src="${esc(url.href)}" alt="" width="24" height="24" loading="lazy">`:''; }catch{return '';}
  }
  openDetails(kind) {
    const state=this.resolved();
    const groups={cpu:['المعالج المركزي',[['الحرارة','cpu_temp','°C'],['الاستهلاك','cpu_load','%'],['التردد','cpu_clock','MHz'],['الطاقة','cpu_power','W'],['الجهد','cpu_voltage','V'],['البقعة الساخنة','cpu_hotspot_temp','°C'],['مروحة المعالج','cpu_fan_rpm','RPM'],['مضخة التبريد','pump_rpm','RPM'],['اللوحة','motherboard_temp','°C'],['VRM','vrm_temp','°C'],['PCH','pch_temp','°C'],['NVMe','nvme_temp','°C']]],gpu:['معالج الرسوميات وذاكرة الفيديو',[['الحرارة','gpu_temp','°C'],['الاستهلاك','gpu_load','%'],['التردد','gpu_clock','MHz'],['الطاقة','gpu_power','W'],['البقعة الساخنة','gpu_hotspot_temp','°C'],['الجهد','gpu_voltage_mv','mV'],['المروحة','gpu_fan_rpm','RPM'],['الذاكرة المستخدمة','vram_used_gb','GB'],['السعة الكلية','vram_total_gb','GB'],['تردد الذاكرة','vram_speed_mhz','MHz'],['حرارة الذاكرة','vram_temp','°C']]],memory:['الذاكرة العشوائية',[['الاستهلاك','ram_used_percent','%'],['المستخدمة','ram_used_gb','GB'],['السعة الكلية','ram_total_gb','GB'],['التردد','ram_speed_mhz','MHz'],['الحرارة','ram_temp','°C']]],storage:['وحدات التخزين',[['إجمالي المساحة الحرة','storage_total_free_gb','GB'],['حرارة NVMe','nvme_temp','°C']]],network:['حركة الشبكة والبرامج',[['التنزيل','network_download_mbps','Mbps'],['الرفع','network_upload_mbps','Mbps'],['زمن الاستجابة','network_ping_ms','ms'],['سرعة الاتصال','network_link_speed_mbps','Mbps'],['إجمالي التنزيل','network_total_dl_gb','GB'],['إجمالي الرفع','network_total_ul_gb','GB']]],display:['محرك العرض',[['FPS الفعلي','fps','FPS'],['تردد الشاشة','display_hz','Hz'],['دقة الشاشة','display_res',''],['زمن الإطار','frame_time_resolved','ms']]],audio:['الصوت وSonar',[['الصوت العام','master_resolved','%'],['الميكروفون','audio_mic_volume','%'],['Game','audio_game_volume','%'],['Chat','audio_chat_volume','%'],['Media','audio_media_volume','%'],['Aux','audio_aux_volume','%']]],matches:['المباريات',[]]};
    groups.appointments=['المواعيد اليومية', [['المتبقي لليوم','appointments_remaining',''],['وقت الموعد القادم','next_appointment_time',''],['نوع الموعد','next_appointment_category_label',''],['الموقع','next_appointment_location','']]];
    const group=groups[kind]||groups.cpu;this.detailKind=kind;
    this.text(this.dom.querySelector('[data-detail-title]'),group[0]);
    const content=this.dom.querySelector('[data-detail-content]');
    content.innerHTML=`<p class="detail-snapshot">قراءات وقت فتح التفاصيل · الواجهة الرئيسية تستمر في التحديث</p><div class="detail-grid">${group[1].map(([label,key,unit])=>`<div><span>${label}</span><strong dir="ltr">${esc(this.format(state[key],typeof state[key]==='number'&&!Number.isInteger(state[key])?2:0))} <small>${unit}</small></strong></div>`).join('')}</div>`;
    if(kind==='cpu')content.innerHTML+=`<h3>مصفوفة الأنوية واللوحة</h3><div class="cores-grid">${(state.cpu_cores||[]).map(core=>`<div><b>${esc(core.type)}${esc(core.id)}</b><strong dir="ltr">${esc(this.format(core.load))}%</strong><span dir="ltr">${esc(this.format(core.temp))}°C</span></div>`).join('')||'غير متاح'}</div>`;
    if(kind==='network')content.innerHTML+=`<h3>أعلى البرامج استهلاكًا للإنترنت</h3>${(state.network_top_processes||[]).map(app=>`<div class="process-row"><strong>${esc(app.name)}</strong><span dir="ltr">↓ ${esc(app.dl_kbps)} / ↑ ${esc(app.ul_kbps)} KB/s</span></div>`).join('')||'غير متاح'}`;
    if(kind==='appointments')content.innerHTML+=(state.today_appointments||[]).map(item=>`<div class="process-row"><strong>${esc(item.title)}</strong><span>${esc(item.time_12h)} · ${esc(item.category_label)} · ${esc(item.status_label)}</span></div>`).join('');
    if(kind==='matches')content.innerHTML+=this.dom.querySelector('[data-matches]').innerHTML;
    this.dom.querySelector('dialog').showModal();
  }
  samplePerformance() {
    if(!new URLSearchParams(location.search).has('measure'))return;
    const started=performance.now(),samples=[],longTasks=[];let previous;
    if(PerformanceObserver.supportedEntryTypes.includes('longtask')) {
      this.performanceObserver=new PerformanceObserver(list=>longTasks.push(...list.getEntries().filter(entry=>entry.startTime-started>=2000).map(entry=>entry.duration)));
      this.performanceObserver.observe({type:'longtask'});
    }
    const tick=timestamp=>{
      if(previous&&timestamp-started>=2000)samples.push(timestamp-previous);previous=timestamp;
      if(timestamp-started<14000)this.benchmarkRaf=requestAnimationFrame(tick);
      else {this.performanceObserver?.disconnect();const sorted=[...samples].sort((a,b)=>a-b);const output=document.createElement('output');output.hidden=true;output.id='architecture-benchmark';output.textContent=JSON.stringify({design,frames:samples.length,p95Ms:sorted[Math.floor(sorted.length*.95)],maxMs:Math.max(...samples),longTasks});this.dom.append(output);}
    };this.benchmarkRaf=requestAnimationFrame(tick);
  }
}
customElements.define('telemetry-station',TelemetryStation);
