// Small shared behaviors; components retain exclusive ownership of their DOM.
export function animationAlpha(component, timestamp) {
  const previousTimestamp = component.previousTimestamp ?? timestamp - 1000 / 60;
  const dt = Math.max(0, Math.min(timestamp - previousTimestamp, 100));
  component.previousTimestamp = timestamp;
  return 1 - Math.exp(-dt / 100);
}

export function updateText(element, text) {
  if (element && element.textContent !== String(text)) element.textContent = String(text);
}

export function syncFlipFaces(host) {
  const flipped = host.classList.contains('flipped');
  const front = host.shadowRoot.querySelector('.card-front');
  const back = host.shadowRoot.querySelector('.card-back');
  if (!front || !back) return;
  const hidden = flipped ? front : back;
  const visible = flipped ? back : front;
  const moveFocus = hidden.contains(host.shadowRoot.activeElement);
  visible.inert = false;
  visible.setAttribute('aria-hidden', 'false');
  if (moveFocus) visible.querySelector('button')?.focus({ preventScroll: true });
  hidden.inert = true;
  hidden.setAttribute('aria-hidden', 'true');
}

export function connectFlipFaces(host) {
  host.flipObserver?.disconnect();
  syncFlipFaces(host);
  host.flipObserver = new MutationObserver(() => syncFlipFaces(host));
  host.flipObserver.observe(host, { attributes: true, attributeFilter: ['class'] });
}

export function updateTelemetryStatus(host, data, keys) {
  host.telemetrySnapshot = { ...host.telemetrySnapshot, ...data };
  const state = host.telemetrySnapshot;
  applyProvenance(host.shadowRoot, state);
  const related=keys.map(key=>state.telemetry_sources?.[state.telemetry_fields?.[key]?.source]).filter(Boolean);
  const sourceStatus=related.some(source=>source.status==='stale')?'stale':related.length&&related.every(source=>source.status==='unavailable')?'unavailable':related.some(source=>source.status==='cached')?'cached':null;
  const status = sourceStatus || (state.telemetry_status === 'stale' ? 'stale' :
    keys.some(key => state[key] != null) ? 'live' : 'unavailable');
  host.dataset.telemetryStatus = status;
  host.dataset.telemetryLabel = status === 'stale' ? 'بيانات قديمة' :
    status === 'unavailable' ? 'غير متاح' : status === 'cached' ? 'نسخة محفوظة' : '';
}

export function applyProvenance(root, state) {
  if (!root?.querySelectorAll) return;
  const fields=state.telemetry_fields || {}, sources=state.telemetry_sources || {};
  const labels={live:'مباشر',cached:'نسخة محفوظة',stale:'بيانات قديمة',unavailable:'غير متاح'};
  const observedTimes={};
  for(const [key,source] of Object.entries(sources)) observedTimes[key]=source?.observed_at ? new Date(source.observed_at*1000).toLocaleTimeString('ar-SA',{timeZone:'Asia/Riyadh',hour12:true}):'—';
  for(const el of root.querySelectorAll('[data-key], [id]')) {
    const key=el.dataset?.key || el.id, field=fields[key];
    if(!field)continue;
    const source=sources[field.source];
    const kind=field.kind==='derived'?'محسوب':field.kind==='configured'?'إعداد':'مقاس';
    const observed=observedTimes[field.source] || '—';
    const identity=key==='nvme_temp'&&state.nvme_sensor_name?` · ${state.nvme_sensor_name}`:key==='storage_total_free_gb'?` · ${state.storage_total_scope || 'النطاق غير متاح'}`:key.startsWith('network_')?` · ${state.network_interface || 'واجهة غير متاحة'}`:'';
    const title=`${kind} · ${source?.source || field.source} · ${field.unit || ''} · ${state[key]==null?'غير متاح':labels[source?.status] || 'غير متاح'} · آخر قراءة ${observed}${identity}`;
    if(el.title!==title)el.title=title;
    const status=state[key]==null?'unavailable':source?.status || 'unavailable';
    if(el.dataset.sourceStatus!==status)el.dataset.sourceStatus=status;
  }
  const inventory=state.hardware_inventory;
  const cpu=root.querySelector?.('[data-inventory="cpu"]');
  if(cpu)updateText(cpu,inventory?.cpu?.Name || 'هوية المعالج غير متاحة');
  const gpu=root.querySelector?.('[data-inventory="gpu"]');
  if(gpu)updateText(gpu,inventory?.gpu?.map(item=>item.Name).join(' / ') || 'هوية كرت الشاشة غير متاحة');
}
