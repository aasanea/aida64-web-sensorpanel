// Opt-in diagnostic (?measure=1), never loaded by the kiosk's normal URL.
import { EventBus } from '../js/store/event_bus.js?v=20261007.3';

let raf, observer, output;
function measure() {
  cancelAnimationFrame(raf);
  observer?.disconnect();
  output?.remove();
  const theme = document.documentElement.dataset.theme || 'default';
  const samples = [], longTasks = [];
  const started = performance.now();
  let previous;
  if (PerformanceObserver.supportedEntryTypes.includes('longtask')) {
    observer = new PerformanceObserver(list => longTasks.push(...list.getEntries()
      .filter(entry => entry.startTime > started + 2000).map(entry => entry.duration)));
    observer.observe({type: 'longtask'});
  }
  const tick = timestamp => {
    if (previous != null && timestamp - started >= 2000) samples.push(timestamp - previous);
    previous = timestamp;
    if (timestamp - started < 10000) { raf = requestAnimationFrame(tick); return; }
    observer?.disconnect();
    const ordered = [...samples].sort((a, b) => a - b);
    output = document.createElement('output');
    output.id = 'frame-benchmark';
    output.hidden = true;
    output.textContent = JSON.stringify({theme, frames: samples.length,
      averageMs: samples.reduce((sum, ms) => sum + ms, 0) / samples.length,
      p95Ms: ordered[Math.floor(ordered.length * .95)], maxMs: Math.max(...samples), longTasks});
    document.body.append(output);
  };
  raf = requestAnimationFrame(tick);
}
EventBus.on('theme:changed', measure);
window.addEventListener('pagehide', () => { cancelAnimationFrame(raf); observer?.disconnect(); });
measure();
