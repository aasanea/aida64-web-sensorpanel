// Behavioral regressions for Aurora parity and native detail workspaces.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const read=name=>fs.readFileSync(path.join(__dirname,'../frontend/js/components',name),'utf8');
let now=10000;
const context={HTMLElement:class{},customElements:{define(){}},URL,URLSearchParams,performance:{now:()=>now},location:{search:''},document:{title:''}};
vm.createContext(context);
vm.runInContext(read('station-content.js').replace(/export /g,'')+'\nglobalThis.groups=DETAIL_GROUPS;globalThis.profiles=CONFIGURED_PROFILES;globalThis.score=matchScore;',context);
vm.runInContext(read('dashboard-station.js').replace(/^import .*;\r?\n/gm,'').replace('export class TelemetryStation','class TelemetryStation')+'\nglobalThis.proto=TelemetryStation.prototype;',context);
const {groups,profiles,score,proto}=context;
const averageOwner={state:{cpu_cores:[{type:'P',temp:0},{type:'P',temp:40},{type:'E',temp:null}]},dom:{querySelector:()=>null},text:proto.text};
assert.equal(proto.resolved.call(averageOwner).p_core_average,20);
assert.equal(proto.resolved.call(averageOwner).e_core_average,null);
averageOwner.state={cpu_cores:null};
assert.equal(proto.resolved.call(averageOwner).p_core_average,null,'Missing cores clear derived group averages');
const keys=group=>Array.from(groups[group][1],row=>row[1]);
assert.ok(keys('cpu').includes('total_power'));
assert.ok(keys('gpu').includes('vram_used_percent'));
assert.ok(keys('network').includes('network_local_ip'));
for(const drive of ['c','d'])for(const field of ['used_percent','used_gb','free_gb','total_gb'])assert.ok(keys('storage').includes(`drive_${drive}_${field}`));
assert.equal(Object.keys(groups).length,9);
assert.equal(Object.keys(profiles).length,0,'Unmeasured hardware/audio profiles must not be fabricated');
assert.equal(score({home_score:-1,away_score:-1}),'VS');
assert.equal(score({home_score:null,away_score:null}),'VS');
assert.equal(score({home_score:0,away_score:0}),'0 – 0');
assert.equal(score({home_score:2,away_score:1}),'2 – 1');
const clock={dataset:{countdown:'next_appointment_seconds'},textContent:''};
const owner={state:{next_appointment_seconds:0,next_appointment_ongoing:true,next_appointment_title:'A',today_appointments:[{title:'A',status:'ongoing',seconds_until:-1320}]},references:{appointment_elapsed:9000,next_appointment_seconds:9000},dom:{querySelectorAll:()=>[clock]},text:proto.text};
proto.renderCountdowns.call(owner);
assert.equal(clock.textContent,'00:22:01','Ongoing elapsed time comes from the signed server item, not the clamped zero countdown');
owner.state={next_appointment_seconds:60,next_appointment_ongoing:false};
proto.renderCountdowns.call(owner);assert.equal(clock.textContent,'00:00:59');
owner.state={next_appointment_seconds:null};
proto.renderCountdowns.call(owner);assert.equal(clock.textContent,'—:—:—');
let listWrites=0;
const list={dataset:{},set innerHTML(html){listWrites++;}};
const schedule={state:{today_appointments:[{title:'A',time:'18:30',status:'ongoing',status_label:'جارٍ',seconds_until:-1320}]},dom:{querySelector:()=>list}};
proto.renderAppointments.call(schedule);assert.equal(listWrites,1);
schedule.state.today_appointments[0].seconds_until=-1321;
proto.renderAppointments.call(schedule);assert.equal(listWrites,1,'Clock ticks must not rebuild the schedule list or reset its scroll');
schedule.state.today_appointments[0].status='completed';
proto.renderAppointments.call(schedule);assert.equal(listWrites,2,'A visible status change must update the list');
// An open inspector clears a lost stream and reflects every delta without a snapshot.
const stream={textContent:''},sonar={textContent:''},source={textContent:''},mute={dataset:{muted:'game'},textContent:''};
const inspector={detailKind:'audio',state:{telemetry_status:'live',audio_game_muted:false,sonar_connected:true,fps:100},text:proto.text,dom:{querySelector:sel=>({'[data-detail-stream]':stream,'[data-sonar]':sonar,'[data-detail-frame-source]':source}[sel]||null),querySelectorAll:()=>[mute]}};
proto.renderDetailLive.call(inspector);assert.equal(mute.textContent,'غير مكتوم');assert.equal(sonar.textContent,'متصل');assert.equal(source.textContent,'مشتق من FPS');
inspector.state={telemetry_status:'stale',audio_game_muted:null,sonar_connected:null,fps:0};
proto.renderDetailLive.call(inspector);assert.equal(mute.textContent,'غير متاح');assert.equal(sonar.textContent,'غير متاح');assert.equal(source.textContent,'غير متاح');assert.ok(stream.textContent.includes('غير متاح'));
// Check text/status tokens on both normal and raised surfaces using WCAG's
// relative-luminance formula. This covers tokens, not a full WCAG certification.
const css=fs.readFileSync(path.join(__dirname,'../frontend/css/design-tokens.css'),'utf8');
const colors=block=>Object.fromEntries([...block.matchAll(/--station-([a-z]+):\s*(#[0-9a-f]{6})/gi)].map(m=>[m[1],m[2]]));
const base=colors(css.match(/:root\s*{([\s\S]*?)}/)[1]);
const luminance=hex=>hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((sum,x,i)=>sum+x*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
const ratios={};
for(const design of ['orbit','vector','folio']) {
  const block=css.match(new RegExp(`^html\\[data-theme="${design}"\\]\\s*{([\\s\\S]*?)}`,'m'))[1],tokens={...base,...colors(block)};
  ratios[design]={};
  for(const ink of ['ink','muted','accent','secondary','warning','critical']) {
    const minimum=Math.min(...['bg','surface','raised'].map(surface=>contrast(tokens[ink],tokens[surface])));
    assert.ok(minimum>=4.5,`${design} ${ink} text contrast ${minimum.toFixed(2)} must reach 4.5:1`);
    ratios[design][ink]=Number(minimum.toFixed(2));
  }
  assert.ok(contrast(tokens.bg,tokens.accent)>=4.5,`${design} selected tabs/buttons contrast`);
}
console.log('Complete 9-space sensor map, configured profiles, scores, ongoing elapsed and live/stale inspector checks passed.');
console.log('Minimum text/status contrast across all three surfaces:',JSON.stringify(ratios));
