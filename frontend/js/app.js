/** Native component bootstrap. Each component owns its shadow DOM and rendering. */
import { EventBus } from './store/event_bus.js?v=20261006.2';
import { StateManager } from './store/state_manager.js?v=20261006.2';
import './components/dashboard-header.js?v=20261006.2';
import './components/dashboard-cpu.js?v=20261006.2';
import './components/dashboard-gpu.js?v=20261006.2';
import './components/dashboard-ram.js?v=20261006.2';
import './components/dashboard-vram.js?v=20261006.2';
import './components/dashboard-storage.js?v=20261006.2';
import './components/dashboard-thermals.js?v=20261006.2';
import './components/dashboard-network.js?v=20261006.2';
import './components/dashboard-display.js?v=20261006.2';
import './components/dashboard-weather.js?v=20261006.2';
import './components/dashboard-appointments.js?v=20261006.2';
import './components/dashboard-matches.js?v=20261006.2';
import { GaugePicker } from './components/gauge-style-picker.js?v=20261006.2';


window.EventBus = EventBus;
window.StateManager = StateManager;
window.GaugePicker = GaugePicker;

function bootstrap() {
  GaugePicker.init();
  const stateManager = new StateManager();
  window.stateManager = stateManager;
  stateManager.start();
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
