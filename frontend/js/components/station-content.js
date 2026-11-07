// Shared information architecture for the three native compositions.
// Sensor keys are live readings; configured profiles are explicitly separate.
export const DETAIL_GROUPS = {
  cpu: ['المعالج والأنوية واللوحة', [
    ['الحرارة','cpu_temp','°C'],['الاستهلاك','cpu_load','%'],['التردد','cpu_clock','MHz'],['الطاقة','cpu_power','W'],
    ['الجهد','cpu_voltage','V',3],['حرارة الحزمة Package','cpu_hotspot_temp','°C'],['مروحة المعالج','cpu_fan_rpm','RPM'],['مضخة التبريد','pump_rpm','RPM'],
    ['اللوحة','motherboard_temp','°C'],['VRM','vrm_temp','°C'],['PCH','pch_temp','°C'],['NVMe','nvme_temp','°C'],['CPU + GPU · محسوب','cpu_gpu_power','W'],['طاقة الجهاز المقاسة','total_power','W']]],
  gpu: ['كرت الشاشة وذاكرة الفيديو', [
    ['الحرارة','gpu_temp','°C'],['الاستهلاك','gpu_load','%'],['التردد','gpu_clock','MHz'],['الطاقة','gpu_power','W'],
    ['البقعة الساخنة','gpu_hotspot_temp','°C'],['الجهد','gpu_voltage_mv','mV'],['المروحة','gpu_fan_rpm','RPM'],
    ['استهلاك VRAM','vram_used_percent','%'],['الذاكرة المستخدمة','vram_used_gb','GiB',1],['السعة الكلية','vram_total_gb','GiB',1],['تردد الذاكرة','vram_speed_mhz','MHz'],['حرارة الذاكرة','vram_temp','°C']]],
  memory: ['الذاكرة العشوائية', [['الاستهلاك','ram_used_percent','%'],['المستخدمة','ram_used_gb','GiB',1],['السعة الكلية','ram_total_gb','GiB',1],['التردد','ram_speed_mhz','MHz'],['الحرارة','ram_temp','°C']]],
  storage: ['وحدات التخزين', [
    ['إجمالي المساحة الحرة','storage_total_free_gb','GiB',1],['حرارة NVMe','nvme_temp','°C'],
    ...['c','d'].flatMap(d => [[`القرص ${d.toUpperCase()} · الاستهلاك`,`drive_${d}_used_percent`,'%'],[`القرص ${d.toUpperCase()} · المستخدم`,`drive_${d}_used_gb`,'GiB',1],[`القرص ${d.toUpperCase()} · الحر`,`drive_${d}_free_gb`,'GiB',1],[`القرص ${d.toUpperCase()} · السعة`,`drive_${d}_total_gb`,'GiB',1]])]],
  network: ['الاتصال واستهلاك البرامج', [
    ['التنزيل','network_download_mbps','Mbps',2],['الرفع','network_upload_mbps','Mbps',2],['استجابة TCP','network_ping_ms','ms'],
    ['الاتصالات النشطة','network_active_conns',''],['عنوان الشبكة المحلية','network_local_ip',''],['سرعة الرابط','network_link_speed_mbps','Mbps'],['تنزيل منذ بدء الخدمة','network_total_dl_gb','GiB',2],['رفع منذ بدء الخدمة','network_total_ul_gb','GiB',2]]],
  display: ['الشاشة والإطارات', [['FPS الفعلي','fps','FPS'],['تردد الشاشة','display_hz','Hz'],['الدقة','display_res',''],['زمن الإطار','frame_time_resolved','ms',2]]],
  audio: ['استوديو الصوت وSonar', [['المستوى المحلي · Master','master_resolved','%'],['المستوى المحلي · Mic','audio_mic_volume','%'],...['game','chat','media','aux'].map(key=>[`المستوى المحلي · ${key.toUpperCase()}`,`audio_${key}_volume`,'%'])]],
  appointments: ['المواعيد وإدارة اليوم', [['المتبقي لليوم','appointments_remaining',''],['إجمالي مواعيد اليوم','appointments_count',''],['وقت الموعد','next_appointment_time',''],['الفئة','next_appointment_category_label',''],['الموقع','next_appointment_location','']]],
  matches: ['المباريات وترتيب البطولات', []]
};

export const CONFIGURED_PROFILES = {};

export const ACTION_LABELS = {cpu:'الأنوية واللوحة',gpu:'الكرت وVRAM',memory:'قياسات الذاكرة',storage:'السعات والحرارة',network:'البرامج والاتصال',audio:'استوديو الصوت',display:'ملف الشاشة',appointments:'اليوم والإدارة',matches:'الترتيب والبطولات'};

export function matchScore(match) {
  const valid = Number.isFinite(match.home_score) && Number.isFinite(match.away_score) && match.home_score >= 0 && match.away_score >= 0;
  return valid ? `${match.home_score} – ${match.away_score}` : 'VS';
}

export function appointmentSeconds(raw, elapsed, ongoing) {
  return Math.max(0, Math.floor(raw) + (ongoing ? elapsed : -elapsed));
}
