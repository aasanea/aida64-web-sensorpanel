// Preview the same native templates used by the production theme dropdown.
import { TelemetryStation } from '../../js/components/dashboard-station.js?v=20261007.3';
export { TelemetryStation };
const names = {orbit:'قمرة القيادة',vector:'مرصد الأداء',folio:'دفتر العتاد'};
const requested = new URLSearchParams(location.search).get('design');
const design = names[requested] ? requested : 'orbit';
document.documentElement.setAttribute('data-theme', design);
document.querySelector('telemetry-station').setAttribute('design', design);
document.title = names[design] + ' • AIDA64 Live Architecture';
