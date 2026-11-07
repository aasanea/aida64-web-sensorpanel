// No build/test dependencies. Regression checks against the actual preview module.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
let now = 1000;
const context = { URLSearchParams, URL, location:{search:''}, document:{title:''}, HTMLElement:class {}, customElements:{define(){}}, performance:{now:()=>now} };
vm.createContext(context);
const source = fs.readFileSync(require('node:path').join(__dirname,'../frontend/js/components/dashboard-station.js'),'utf8')
  .replace(/^import .*;\r?\n/gm,'').replace('export class TelemetryStation','class TelemetryStation');
vm.runInContext(source+'\nglobalThis.stationClass=TelemetryStation;',context);
const proto=context.stationClass.prototype;
const label={textContent:''};
const owner={state:{},dom:{querySelector:()=>label},text:proto.text};
owner.state={fps:0,audio_master_volume:0,display_volume:100};
assert.equal(proto.resolved.call(owner).master_resolved,0,'Master zero must not fall back to system volume');
assert.equal(proto.resolved.call(owner).frame_time_resolved,null,'FPS zero must clear derived frame time');
assert.equal(label.textContent,'غير متاح');
owner.state={fps:250,audio_master_volume:null,display_volume:40};
assert.equal(proto.resolved.call(owner).frame_time_resolved,4);
assert.equal(proto.resolved.call(owner).master_resolved,null);
assert.equal(label.textContent,'مشتق من FPS');
owner.state={fps:250,frame_time_ms:5};
assert.equal(proto.resolved.call(owner).frame_time_resolved,5);
assert.equal(label.textContent,'مقاس');
owner.state={fps:null};
assert.equal(proto.resolved.call(owner).frame_time_resolved,null,'Lost stream must not retain a previous derived value');
assert.equal(proto.format(0),'0');
assert.equal(proto.format(null),'—');
assert.equal(proto.format(Infinity),'—');
assert.equal(proto.logo('javascript:alert(1)'),'');
const historyOwner={state:{},references:{},history:[],queueRender(){},renderAppointments(){}};
for(let index=0;index<150;index++) {
  proto.onState.call(historyOwner,{telemetry_status:'live',cpu_load:index%100,gpu_load:0}); now+=500;
}
assert.ok(historyOwner.history.length<=125);
assert.ok(historyOwner.history.every(sample=>now-sample.time<=60500));
const count=historyOwner.history.length;
proto.onState.call(historyOwner,{telemetry_status:'stale',cpu_load:null,gpu_load:null});
assert.equal(historyOwner.history.length,count,'Stale stream must not manufacture history points');
assert.equal(historyOwner.state.cpu_load,null);
assert.equal(historyOwner.history.at(-1).gpu_load,0,'Zero samples remain measured history');
console.log('Theme architecture truthfulness/history checks passed.');
