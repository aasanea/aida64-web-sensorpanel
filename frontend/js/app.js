/** Native component bootstrap. Each component owns its shadow DOM and rendering. */
import { EventBus } from './store/event_bus.js?v=20261007.3';
import { StateManager } from './store/state_manager.js?v=20261103.audio11';
import './components/dashboard-header.js?v=20261007.3';
import './components/dashboard-station.js?v=20261103.audio11';
import './components/dashboard-cpu.js?v=20261007.3';
import './components/dashboard-gpu.js?v=20261007.3';
import './components/dashboard-ram.js?v=20261007.3';
import './components/dashboard-vram.js?v=20261007.3';
import './components/dashboard-storage.js?v=20261007.3';
import './components/dashboard-thermals.js?v=20261007.3';
import './components/dashboard-network.js?v=20261007.3';
import './components/dashboard-display.js?v=20261103.audio11';
import './components/dashboard-weather.js?v=20261007.3';
import './components/dashboard-appointments.js?v=20261106.dates';
import './components/dashboard-matches.js?v=20261007.3';
import { GaugePicker } from './components/gauge-style-picker.js?v=20261007.3';


window.EventBus = EventBus;
window.StateManager = StateManager;
window.GaugePicker = GaugePicker;

function bootstrap() {
  GaugePicker.init();
  const stateManager = new StateManager();
  window.stateManager = stateManager;
  const legacyLayout = document.querySelector('.dashboard-container');
  const header = legacyLayout.querySelector('dashboard-header');
  const station = document.createElement('telemetry-station');
  station.setAttribute('embedded', '');
  station.id = 'dashboard-station';

  // Only the visible composition is connected. Components retain exclusive
  // ownership of their shadow DOM; every layout shares this single transport.
  const applyLayout = theme => {
    if (['orbit', 'vector', 'folio'].includes(theme)) {
      station.setAttribute('design', theme);
      if (!station.isConnected) {
        header.setAttribute('mode', 'theme-picker');
        header.setAttribute('slot', 'theme-picker');
        legacyLayout.replaceWith(station);
        station.append(header);
      }
    } else if (station.isConnected) {
      header.removeAttribute('mode');
      header.removeAttribute('slot');
      legacyLayout.prepend(header);
      station.replaceWith(legacyLayout);
    }
  };
  EventBus.on('theme:changed', applyLayout);
  applyLayout(document.documentElement.getAttribute('data-theme') || 'default');
  stateManager.start();
  if(new URLSearchParams(location.search).has('measure'))import('/dev/frame-monitor.js?v=20261007.3');
  window.addEventListener('pagehide', () => stateManager.stop());
  window.addEventListener('pageshow', event => {
    if (event.persisted) stateManager.start();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}
