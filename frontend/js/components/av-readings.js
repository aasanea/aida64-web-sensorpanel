// Interpretation belongs to the A/V card; shared telemetry is left untouched.
export function displayReadings(state = {}) {
  const stale = state.telemetry_status === 'stale' || ['stale', 'unavailable'].includes(state.telemetry_sources?.aida?.status);
  const number = value => typeof value === 'number' && Number.isFinite(value);
  const source = ['AIDA64', 'RTSS'].includes(state.fps_source) ? state.fps_source : null;
  const fps = !stale && source && number(state.fps) && state.fps >= 0 ? state.fps : null;
  const measured = [state.frametime_ms, state.frametime, state.gpu_frametime].find(value => number(value) && value > 0);
  const frameTime = stale ? null : measured ?? (fps > 0 ? 1000 / fps : null);
  return { fps, source, hz: !stale && number(state.display_hz) && state.display_hz > 0 ? state.display_hz : null,
    frameTime, frameTimeSource: frameTime == null ? 'unavailable' : measured != null ? 'measured' : 'derived' };
}
