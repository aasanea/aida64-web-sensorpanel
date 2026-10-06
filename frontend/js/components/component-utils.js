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
  const status = state.telemetry_status === 'stale' ? 'stale' :
    keys.some(key => state[key] != null) ? 'live' : 'unavailable';
  host.dataset.telemetryStatus = status;
  host.dataset.telemetryLabel = status === 'stale' ? 'بيانات قديمة' :
    status === 'unavailable' ? 'غير متاح' : '';
}
