# 🗺️ AIDA64 Web SensorPanel — Architectural Roadmap & Enhancement Proposals
# خارطة الطريق المعمارية وقائمة مقترحات التطوير المستقبلية

> **Document Status**: Living Architectural Specification & Gap Analysis  
> **Target Platform**: `aida64-web-sensorpanel`  
> **Current Baseline**: `v1.0.0` (Production Stable)  
> **Last Updated**: 2026-09-22

---

## 📌 Executive Summary / الملخص التنفيذي

This document establishes the strategic architectural roadmap for evolving **AIDA64 Web SensorPanel** from an ultra-responsive, 0ms latency hardware HUD into an enterprise-grade, extensible hardware monitoring platform.

يهدف هذا المستند إلى توثيق خارطة الطريق المعمارية للمشروع، ومطابقة التوصيات الهندسية المتقدمة مع ما تم إنجازه فعلياً في الإصدار المستقر (`v1.0.0`)، وتوزيع التحسينات المقترحة على إصدارات مرحلية مجدولة (`v1.1.0` و `v1.2.0` و `v2.0.0`).

---

## 📊 Gap Analysis Matrix / مصفوفة مطابقة المنجز والمتبقي

| Architectural Pillar / المحور المعماري | Status / الحالة | Implemented in v1.0.0 / ما تم إنجازه فعلياً | Proposed Roadmap / المتبقي والمقترح للمستقبل |
| :--- | :---: | :--- | :--- |
| **1. Data Ingestion & Bridge** | 🟢 **Done** | ربط مباشر بنواة ويندوز عبر الذاكرة المشتركة (`ctypes Shared Memory`) بزمن استجابة **0ms** بدون استهلاك CPU. | بناء واجهة تجريد للمحولات (`Abstract Adapter`) لدعم مصادر إضافية (HWiNFO/LibreHardware). |
| **2. Sensor Normalization** | 🟡 **Partial** | مصفوفة كشف ذكي وتوافق تلقائي مع عتاد مختلف المصنعين (`Candidate Resolution`: Intel, AMD, NVIDIA, AIO Pumps). | توحيد المسميات تحت سجل معجمي قياسي موحد (`cpu.temperature.package`, `gpu.vram.used`). |
| **3. Connection Reliability** | 🟡 **Partial** | دفق موحد عبر `WebSocket`، إعادة اتصال تلقائية ذكية (`Exponential Backoff & Jitter`)، وشارة حالة نيونية حية. | كشف ركود البيانات (`Stale Data Detection`)، تجميد وتظليل الودجات، وعرض وقت آخر تحديث ناجح. |
| **4. Widget Architecture** | 🟢 **Done** | مكونات ويب معيارية (`Web Components`) مع بطاقات دوران تفاعلية ثلاثية الأبعاد (3D Flip Cards) للقراءات العميقة. | تحويل البطاقات إلى عقد موحد (`Widget Contract`) مع عزل أخطاء مستقل (`Error Boundaries`). |
| **5. Responsive & Displays** | 🟡 **Partial** | شبكة `CSS Grid 24-Column` متجاوبة مصممة للقراءة من مسافة 100cm وزر وضع ملء الشاشة (Kiosk). | إعدادات مسبقة لأبعاد شاشات الكيس الصغيرة (`1920x480`, `1280x400`, `480x320`) والوضع الرأسي. |
| **6. Theming & Design System** | 🟡 **Partial** | نظام متغيرات تصميم متكامل عبر CSS (`Design Tokens`) بألوان النيون والزجاج (`Glassmorphism 2.0`). | محول سمات متعدد (Carbon Dark, High Contrast, OLED True Black مع تحريك البكسل لمنع التطبيع). |
| **7. Alerts & Thresholds** | 🟡 **Partial** | تنبيهات صوتية سونار متطورة عبر `Web Audio API`، وتدرج لوني ديناميكي بالحلقات (مثالي / جيدة / حرجة). | محرك تنبيهات مركزي يدعم التهدئة (`Cooldown`) ونطاق التذبذب (`Hysteresis`) لمنع التنبيهات الكاذبة. |
| **8. History & Trends** | ⚪ **Pending** | تقتصر الواجهة حالياً على القراءات اللحظية المباشرة وحساب المتوسطات الحسابية. | ذاكرة حلقية في المتصفح (`In-Memory Ring Buffer`) لآخر (60 ثانية، 5 دقائق، 15 دقيقة) ورسوم Sparklines. |
| **9. Profiles & Configuration** | ⚪ **Pending** | الإعدادات الحالية تتم عبر ملف البيئة `.env` وملفات JSON الموضعية. | نظام بروفايلات متكامل بصيغة JSON قابلة للتصدير والاستيراد مع فحص أمني صارم للمخطط (Schema Validation). |
| **10. Security & Local-First** | 🟢 **Done** | محلي 100% بدون أي سحابة، تقييد بـ `localhost` افتراضياً، وتطهير كامل للسجلات (Zero-Leak Policy). | إضافة سياسة أمان المحتوى (`Content Security Policy`) عبر الترويسات، ولوحة تشخيص للمطورين. |
| **11. Live Auto-Updater** | 🟢 **Done** | منظومة تحديث متكاملة في السيرفر والواجهة مع سكريبت باورشيل محصن للترقية مع النسخ الاحتياطي والاسترجاع. | مكتمل تماماً في v1.0.0. |
| **12. Turnkey Distribution** | 🟢 **Done** | سكريبت تثبيت سحري بأمر واحد (`install.ps1`)، مستودع عام على GitHub بترخيص MIT ودلائل المساهمة. | إضافة حزم Docker اختيارية لبيئات التشغيل المتقدمة أو السيرفرات المنزلية. |
| **13. Automated Testing** | 🟢 **Done** | **57 فحصاً آلياً بنجاح 100%**، ومسار عمل كامل على GitHub Actions يختبر ويندوز ولينكس عبر بايثون 3.11/3.12/3.13. | إضافة اختبارات الواجهة الرسومية البصرية التلقائية (`Visual Regression Tests` عبر Playwright). |

---

## 🚀 Phased Version Roadmap / خارطة طريق الإصدارات القادمة

```
┌─────────────────────────────────┐
│     v1.0.0 (Launched 🟢)         │
│  0ms Core, Auto-Updater, Tests  │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│     v1.1.0 (Observability)      │
│  Ring Buffer, Stale Data, Alarms│
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│      v1.2.0 (Customization)     │
│  Profiles, Screen Presets, OLED │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│      v2.0.0 (Platform SDK)      │
│  Multi-Provider, Plugin Engine  │
└─────────────────────────────────┘
```

---

### 📦 Milestone 1: Observability & Resilience (الإصدار v1.1.0)
**الهدف:** تعزيز موثوقية رصد البيانات وتحليل الاتجاهات التاريخية.

1. **الذاكرة الحلقية ورسوم الاتجاه (In-Memory Ring Buffer & Sparklines):**
   - تخزين سجل القراءات لمدد زمنية محددة (60 ثانية، 5 دقائق، 15 دقيقة) بحد أقصى للذاكرة يمنع استنزاف الموارد.
   - إضافة رسوم بيانية مصغرة (SVG Sparklines) تحت قراءات المعالج، كرت الشاشة، وحركة الشبكة.
2. **كشف خمول البيانات (Stale Data Detection):**
   - تمييز حالة توقف تحديثات AIDA64 دون انقطاع اتصال الـ WebSocket.
   - تظليل بطاقات الحساسات المتأثرة وعرض مؤشر زمني: `آخر تحديث منذ X ثانية`.
3. **محرك التنبيهات المركزي (Centralized Threshold Engine):**
   - دعم فترات التهدئة (`Cooldown: 30s`) لتجنب إطلاق أصوات التنبيه المتكررة عند تذبذب درجات الحرارة.
   - دعم التذبذب المنطقي (`Hysteresis`): تفعيل التنبيه عند 85°C وعدم إيقافه إلا بعد النزول تحت 78°C.
4. **لوحة تشخيص المطورين (Diagnostics Overlay):**
   - شاشة منبثقة مصغرة تعرض معدل الإطارات (FPS)، زمن الوصول (Latency)، وعدد الرسائل المستقبلة بالثانية.

---

### 🎨 Milestone 2: Multi-Screen & Profiles (الإصدار v1.2.0)
**الهدف:** دعم مختلف شاشات المراقبة وتخصيص الواجهات.

1. **إعدادات مسبقة لأبعاد الشاشات (Screen Resolution Presets):**
   - دعم شاشات الكيس الصغيرة والشاشات العريضة:
     - `1920x480` (Ultrawide Sensor Panel).
     - `1280x400` / `1024x600` (Barrowch & Wisecoco Panels).
     - `800x480` / `480x320` (Mini PC Status Displays).
     - `Portrait Mode` (الشاشات الرأسية).
2. **نظام البروفايلات (JSON Profiles Management):**
   - تصدير واستيراد ملفات الإعدادات والودجات بصيغة JSON.
   - إعدادات مسبقة جاهزة: (بروفايل ألعاب `Gaming.json`، بروفايل فحص عتاد `Diagnostics.json`، بروفايل شاشة مصغرة `Compact.json`).
   - فحص أمني صارم لمنع حقن أي نصوص برمجية داخل ملفات التكوين.
3. **سمات متقدمة وحماية شاشات OLED (Theming & OLED Burn-In Shield):**
   - قالب `OLED True Black` بخلفيات سوداء 100% لتوفير الطاقة وتقليل التوهج.
   - ميزة تحريك البكسل الدوري (`Pixel Shift`) الآمن بصرياً كل 5 دقائق لحماية شاشات OLED من التطبيع.
4. **عزل أخطاء الودجات (Widget Error Boundaries):**
   - عزل كل ودجت برمجياً بحيث إذا حدث خطأ غير متوقع في ودجت معين لا تنهار بقية اللوحة.

---

### 🔌 Milestone 3: Extensibility & Multi-Source (الإصدار v2.0.0)
**الهدف:** تحويل المشروع إلى منصة مراقبة شاملة ومفتوحة لمصادر متعددة.

1. **واجهة تجريد محولات البيانات (Abstract Telemetry Adapter):**
   - واجهة برمجية موحدة: `connect()`, `disconnect()`, `subscribe()`, `getSnapshot()`.
   - إمكانية العمل مع مصادر عتاد بديلة (HWiNFO, LibreHardwareMonitor) أو وضع محاكاة للمطورين (`Mock Telemetry`).
2. **سجل الحساسات القياسي (Normalized Canonical Sensor Registry):**
   - توحيد المعرفات بمسميات قياسية عالمية مجردة من أسماء المعالجات والشركات.
3. **حزم النشر والتشغيل المعزول (Docker & Cross-Platform Packaging):**
   - توفير حاوية Docker اختيارية للتشغيل على السيرفرات المنزلية والأنظمة المعزولة.
4. **فحوصات الواجهة البصرية الآلية (Visual Regression CI):**
   - أتمتة التقاط لقطات الشاشة لكل دقة وقالب في مسار GitHub Actions لضمان عدم انكسار التنسيقات.

---

## 🔒 Non-Negotiable Operational Principles / المبادئ الثابتة

1. **0ms Latency Priority:** القراءة المباشرة من الذاكرة المشتركة هي الأساس ولن يتم استبدالها بأي آلية أبطأ.
2. **Local-First & Zero-Leak:** خصوصية المستخدم وأمان السيرفر المحلي خط أحمر (لا خدمات سحابية، لا جمع بيانات).
3. **Idempotent Deployments:** كل أداة أو سكريبت يجب أن يكون آمناً وقابلاً للتشغيل المتكرر دون أخطاء.
4. **Backward Compatibility:** الحفاظ على استقرار الواجهة الحالية وسلامة ملفات المستخدم عند التحديث.
