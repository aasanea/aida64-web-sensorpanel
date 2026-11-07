// Actual-source checks for layout mounting and single transport ownership.
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const read = file => fs.readFileSync(path.join(__dirname,'../frontend',file),'utf8');
const headerSource = read('js/components/dashboard-header.js');
const arrayText = headerSource.match(/const THEMES = (\[[\s\S]*?\]);/)[1];
const themes = vm.runInNewContext(arrayText);
const menuIds = [...headerSource.matchAll(/class="theme-menu-item" data-theme-id="([^"]+)"/g)].map(match=>match[1]);
assert.deepEqual(menuIds, Array.from(themes, theme=>theme.id));
assert.equal(themes.length,10);

class Element {
  constructor(tag) { this.tag=tag; this.attrs={}; this.isConnected=false; }
  setAttribute(key,value) { this.attrs[key]=value; }
  getAttribute(key) { return this.attrs[key]??null; }
  removeAttribute(key) { delete this.attrs[key]; }
  replaceWith(next) { this.isConnected=false; next.isConnected=true; }
  append(child) { this.child=child; }
  prepend(child) { this.child=child; }
  querySelector() { return this.child; }
}
const legacy=new Element('legacy'), header=new Element('dashboard-header');
legacy.isConnected=true; legacy.child=header;
let station, transportCount=0, starts=0, stops=0;
const listeners={};
const EventBus={on(event,fn){listeners[event]=fn;},emit(event,value){listeners[event]?.(value);}};
const document={readyState:'complete',documentElement:new Element('html'),querySelector:()=>legacy,createElement:tag=>(station=new Element(tag))};
const window={addEventListener(){}};
const StateManager=class { constructor(){transportCount++;this.currentState={cpu_temp:44};}start(){starts++;}stop(){stops++;} };
const context={EventBus,document,window,StateManager,GaugePicker:{init(){}},console,URLSearchParams,location:{search:''}};
vm.createContext(context);
vm.runInContext(read('js/app.js').replace(/^import .*;\r?\n/gm,''),context);
assert.equal(transportCount,1);
assert.equal(starts,1);
for(const theme of ['orbit','vector','folio']) {
  EventBus.emit('theme:changed',theme);
  assert.equal(station.getAttribute('design'),theme);
  assert.equal(station.isConnected,true);
  assert.equal(legacy.isConnected,false);
  assert.equal(station.child,header);
  assert.equal(header.getAttribute('mode'),'theme-picker');
}
EventBus.emit('theme:changed','default');
assert.equal(legacy.isConnected,true);
assert.equal(station.isConnected,false);
assert.equal(header.getAttribute('mode'),null);
EventBus.emit('theme:changed','orbit');
assert.equal(transportCount,1,'Switching layouts must not create another telemetry transport');
assert.equal(stops,0,'Layout switches must not stop the shared telemetry stream');

// Exercise the real embedded component lifecycle without starting a preview WS.
let scheduled=0, cancelled=[], intervals=[], unsubscribed=0;
Object.assign(context,{HTMLElement:class {},customElements:{define(){}},AbortController,
  setInterval:()=>++scheduled,clearInterval:id=>intervals.push(id),cancelAnimationFrame:id=>cancelled.push(id),
  URLSearchParams,URL,location:{search:''},performance:{now:()=>1000}});
EventBus.on=(event,fn,{signal}={})=>{assert.ok(signal);signal.addEventListener('abort',()=>unsubscribed++);return()=>{};};
vm.runInContext(read('js/components/dashboard-station.js').replace(/^import .*;\r?\n/gm,'').replace('export class TelemetryStation','class TelemetryStation')+'\nglobalThis.stationProto=TelemetryStation.prototype;',context);
let snapshot;
const embedded={hasAttribute:()=>true,renderTemplate(){},markReady(){},mountGauges(){},dom:{addEventListener(){},querySelector:()=>({addEventListener(){}})},onState:state=>snapshot=state,fetchMatches(){},renderClock(){},renderCountdowns(){},queueRender(){},samplePerformance(){},rafId:17,benchmarkRaf:19};
context.stationProto.connectedCallback.call(embedded);
assert.equal(embedded.manager,null);
assert.equal(snapshot.cpu_temp,44);
assert.equal(transportCount,1);
context.stationProto.disconnectedCallback.call(embedded);
assert.equal(unsubscribed,3);
assert.deepEqual(cancelled,[17,19]);
assert.equal(embedded.rafId,0,'A remounted component must not retain a cancelled rAF handle');
assert.equal(intervals.length,2);
assert.equal(stops,0);
console.log('10 theme/menu entries, structural switching, shared transport and embedded cleanup passed.');
