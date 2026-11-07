export function broadcastView(controller, applications = [], samples = {}, now = Date.now()/1000, appsFresh = true) {
  const active=applications.filter(app=>app.active);
  const volume=controller?.volume;
  const result=(code,label,detail)=>({code,label,detail,volume,muted:controller?.muted===true});
  if(!controller?.available || !Number.isFinite(controller.observed_at) || now-controller.observed_at>3) return result('unknown','حالة البث غير متاحة','تعذر تأكيد قراءة العجلة ومسار الصوت');
  if(!controller.routes_ready || !controller.stream_input_id || controller.discord_input_id!==controller.stream_input_id || !controller.chat_output_id || controller.discord_output_id!==controller.chat_output_id) return result('blocked','مسار Discord غير جاهز','مدخل Discord أو مخرجه لا يطابق مسار Sonar المعزول');
  if(controller.muted) return result('muted','بث البرامج مكتوم','Discord مستثنى · المايك والاستماع مستقلان');
  if(controller.mixed_mute || volume==null) return result('blocked','مستويات البث غير متزامنة','حرّك عجلة البث لمزامنة قنوات البرامج');
  if(active.some(app=>app.excluded && app.in_program_bus)) return result('blocked','صوت Discord خارج مساره','جارٍ عزله عن بث البرامج؛ لا يُعتمد الإرسال حتى اكتمال العزل');
  if(active.some(app=>!app.excluded && !app.in_program_bus)) return result('blocked','برنامج خارج مسار البث','جارٍ توجيه البرنامج إلى مسار البرامج');
  if(controller.discord_muted || controller.discord_deafened || controller.server_muted===true || controller.server_blocked===true) return result('blocked','الإرسال متوقف في Discord','Discord مكتوم أو معزول صوتيًا');
  if(controller.in_voice===false) return result('idle','Discord غير متصل بصوت','ادخل قناة صوتية لاستخدام البث');
  if(!controller.discord_ready || controller.in_voice!==true) return result('unknown','اتصال Discord غير مؤكد','لم تصل حالة القناة الصوتية');
  if(controller.server_muted!==false) return result('unknown','صلاحية الإرسال غير مؤكدة','لم تصل حالة كتمك في القناة الصوتية');
  if(volume===0 || controller.stream_master_muted || controller.stream_master_volume===0 || controller.discord_input_volume===0) return result('muted','مسار البث بلا مستوى صوت','تحقق من مستوى البث ومدخل Discord');
  if(!appsFresh) return result('unknown','قياس البرامج غير متاح','انتظار قراءة حديثة للبرامج ومصدر الإشارة');
  if(!active.some(app=>!app.excluded && app.in_program_bus)) return result('idle','البث مفتوح · لا صوت برامج الآن','تظهر البرامج عند إصدار إشارة فعلية');
  const processing=controller.discord_processing;
  if(!processing || ['auto_threshold','echo_cancellation','noise_suppression'].some(key=>processing[key]!==false)) return result('unknown','Discord قد يحجب صوت البرامج','اختر Input Profile: Studio في Discord للصوت المختلط');
  const signal=samples.stream_input;
  if(signal?.status!=='live')return result('unknown','جاهز · قياس الإشارة غير متاح','لا يمكن تأكيد وجود إشارة على المدخل الافتراضي');
  if(signal.peak<=0.0001)return result('idle','جاهز · لا إشارة على خرج البث','المسار مضبوط، لكن لم تُقَس إشارة حاليًا');
  return result('sending','إشارة متجهة إلى Discord','قياس على مدخل البث؛ سماع الطرف الآخر يحتاج تجربة فعلية');
}

export function playingPrograms(applications = []) {
  const grouped=new Map();
  for(const app of applications.filter(item=>item.active)) {
    const key=app.icon_url || app.executable || app.name;
    const current=grouped.get(key);
    if(!current || app.peak>current.peak)grouped.set(key,app);
  }
  return [...grouped.values()].sort((a,b)=>String(a.executable || a.name).localeCompare(String(b.executable || b.name)));
}
