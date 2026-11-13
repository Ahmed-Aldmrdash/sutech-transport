# اتفاق الفرونت والباك – SUtech Transport

Nov 8, 2026 · @Ahmed Aldmrdash

الفرونت (PWA) بيتبني من الأول على داتا وهمية، والباك (Python + FastAPI) هينفذ نفس الطلبات دي بنفس الشكل بالظبط. **المستند ده هو المرجع**: لو الفرونت والمستند اختلفوا، المستند هو اللي يمشي لحد ما نتفق على تعديل ونسجله هنا.

**الجديد في نسخة 1 نوفمبر:** الدخول بقى خطوتين (`/auth/otp` وبعدين `/auth/login`) لكل الأدوار، وتفاصيل الـ SOS كاملة، وتصدير التقارير Excel و PDF. التلات حاجات دول طالبهم قسم النقل رسمي.

**تحديث 1 نوفمبر (بعد المرحلة 1 من الفرونت):** حقول زيادة في ردود الدخول (`code_length` و `resend_after_seconds` و `expires_at`)، وخطأ جديد `OTP_EXPIRED`، وكل كود جديد بيلغي اللي قبله، وأكواد الأخطاء العامة بقت بحروف كبيرة. التفاصيل في جزء "الدخول بخطوتين".

**تحديث 2 نوفمبر (بعد المرحلة 3 من الفرونت):** طلبات الطالب (تغيير الخط على استمارة الجامعة، والاسترداد حسب سياسة الاسترداد، والشكاوى) مع تتبع الحالة، والإشعارات بعدّاد الجديد، وصفحة الإعلانات، والإعدادات. 10 طلبات جديدة، وصفوف `/requests` و `/complaints` القديمة اتغيرت. التفاصيل في جزء "الطالب: الطلبات والإشعارات والإعدادات".

**تحديث 2 نوفمبر (بعد المرحلة 2 من الفرونت، صفحات الطالب):** الحجز والدفع والكارنيه الرقمي، مبنيين على داتا الجامعة الحقيقية (23 خط، 15,000 جنيه للترم، حساب البنك الأهلي). **فوري وإنستاباي اتشالوا**: الدفع إيداع أو تحويل بنكي مع رفع الإيصال، أو فيزا في مكتب الحسابات بس. طلبات جديدة: إلغاء الحجز، وبيانات الدفع، ومدفوعاتي، والرحلة الجاية. التفاصيل في جزء "الطالب: الحجز والدفع والكارنيه".

## طريقة الشغل

1. الفرونت بيتبني الأول، وكل كلامه مع الداتا في ملفات `api.ts` بداتا وهمية.
2. شكل كل طلب ورد مكتوب بـ Zod، ومنه بيطلع ملف `openapi.json` لوحده. ده المرجع النهائي، وهيكون في الريبو.
3. الباك بينفذ نفس الطلبات بنفس الشكل في FastAPI. أي تغيير في شكل طلب لازم يتفق عليه الأول ويتسجل في الملف.
4. وقت التسليم الفرونت بيغير عنوان السيرفر بس، والشاشات مش بتتغير.

| الفريق | مسؤول عن |
| --- | --- |
| الفرونت (أحمد) | كل الشاشات، والعربي والإنجليزي، والـ PWA، وملف العقد |
| الباك | السيرفر والداتابيز (PostgreSQL)، والدخول، والصلاحيات، وقواعد العمل، واستقبال موقع جهاز الـ GPS، والإشعارات، والتقارير |
| الـ AI | endpoint الشات `/api/v1/chat` |
| السيكيوريتي | مراجعة الصلاحيات، وأمان الـ QR، واختبار الاختراق |

ملحوظة: موقع الباص جاي من جهاز GPS متركب في الباص للباك على طول، مش من موبايل السواق.

## قواعد العقد

| القاعدة | الاتفاق |
| --- | --- |
| العناوين | REST + JSON، وكلها بتبدأ بـ `/api/v1/` |
| أسماء الحقول | `snake_case` (مثال: `student_id`) |
| الـ IDs | نص (string)، والرقم الجامعي 9 أرقام (مثال: `240100101`) |
| التواريخ | ISO 8601 بتوقيت UTC (مثال: `2026-10-29T06:30:00Z`)، والفرونت يحول لتوقيت مصر |
| الفلوس | رقم صحيح بالقرش (مثال: `150000` = 1,500 جنيه) |
| الحالات | قيم ثابتة بالإنجليزي (مثال الاشتراك: `reserved` / `payment_review` / `active` / `expired` / `cancelled`) |
| مواعيد الجدول | مواعيد اليوم في الجدول (الركوب، والوصول للجامعة، والعودة) بتبقى `"HH:MM"` بتوقيت مصر مش UTC (مثال: `"07:40"`). والتواريخ من غير ساعة `"YYYY-MM-DD"` (مثال: `"2026-11-01"`) |
| الأخطاء | HTTP status صح + `{ "code": "SEAT_UNAVAILABLE", "message": "..." }`، والفرونت يترجم الـ code. الأكواد بحروف كبيرة دايمًا، والعامة منها: `UNAUTHORIZED` (401)، `FORBIDDEN` (403)، `NOT_FOUND` (404)، `CONFLICT` (409)، `VALIDATION_ERROR` (422)، `RATE_LIMITED` (429)، `INTERNAL_ERROR` (500) |
| الدخول | **كوكي جلسة HttpOnly و Secure و SameSite=Lax** بيحطها `/auth/login` وبتتبعت مع كل طلب (الفرونت بيستخدم `credentials: "include"`)؛ الصفحة عمرها ما بتشوف التوكن. اتغيّر 8 نوفمبر (مراجعة الأمان) |
| الليستات الطويلة | `?page=1&page_size=20`، والرد `{ items, total }`. الاستثناءات (ليستات قصيرة من غير صفحات): `GET /lines` و `/payments/me` و `/requests/me` بيرجعوا array، و `GET /admin/sos` و `/violations/mine` بيرجعوا `{ items }` |
| اللغة | الفرونت بيبعت `Accept-Language: ar` أو `en` |
| منع التكرار | أي طلب بيعمل حاجة (حجز، إلغاء، إيصال، SOS) معاه header اسمه `Idempotency-Key` (UUID)، فلو اتبعت مرتين يتنفذ مرة، والطلب التاني ياخد نفس الرد |

## الأدوار والصلاحيات

الفرونت بيخفي الصفحات، بس **السيرفر هو اللي لازم يرفض** أي طلب بره صلاحية صاحبه (`403`)، حتى لو حد بعته بإيده.

| الدور (`role`) | مسموحله |
| --- | --- |
| `super_admin` | بيشوف كل حاجة، وهو بس اللي يعمل حسابات ويوزع الصلاحيات. **للعرض بس** في مكتب الطوارئ/العيادة وبوابة شركة الأتوبيسات: المكاتب أصحاب الشغل هما اللي بياخدوا الأكشن. |
| `transport_admin` | التشغيل (التتبع، الطوارئ، الحضور، الخطوط، الباصات، الإعلانات)، والمخالفات، والشكاوى، والفعاليات، وتقارير التشغيل |
| `finance` | المدفوعات، والاسترداد، والتقارير المالية |
| `clinic` | العيادة، والطوارئ الطبية بس |
| `student_affairs` | المخالفات |
| `secretary_general` | صفحته، والتقارير (قراءة بس) |
| `bus_company` | بوابة أبو الهول بس |
| `driver` / `supervisor` | الرحلة المتسجلة باسمه بس |
| `student` | داتاه بس |
| `parent` | أولاده المربوطين بيه بس |

كل عملية من الإدارة بتتسجل في سجل العمليات (مين، عمل إيه، إمتى).

## الـ Endpoints المبدئية

دي نسخة أولى عشان تبدأوا تصمموا الداتابيز. شكل الردود بالتفصيل هيبقى في `openapi.json` مع كل مرحلة فرونت. العناوين من غير `/api/v1`.

| الطلب | مين | بيعمل إيه |
| --- | --- | --- |
| `POST /auth/otp` | الكل | خطوة 1: الرقم الجامعي أو الوظيفي أو موبايل ولي الأمر، والسيرفر يبعت كود على الموبايل المتسجل |
| `POST /auth/login` | الكل | خطوة 2: نفس الـ identifier + الكود، ويحط كوكي الجلسة (والجلسة فيها الدور) |
| `POST /auth/logout` | الكل | إنهاء الجلسة ومسح الكوكي |
| `GET /me` | الكل | بياناته ودوره |
| `GET /lines` · `GET /lines/{id}` | الكل | الخطوط والمحطات ومواعيد الصبح والسعر ونوع الباص والأماكن الفاضية |
| `GET /subscriptions/me` | طالب | حالة اشتراكه |
| `POST /subscriptions` | طالب | حجز مكان (مهلة 24 ساعة للدفع) |
| `POST /subscriptions/{id}/cancel` | طالب | إلغاء حجز لسه ما اتدفعش، والمكان يرجع |
| `GET /payments/instructions` | طالب | المبلغ المطلوب، وحساب البنك، وأماكن ومواعيد المكاتب |
| `GET /payments/me` | طالب | إيصالاته ومدفوعاته وحالة كل واحدة |
| `POST /payments/receipt` | طالب | رفع إيصال إيداع أو تحويل بنكي |
| `GET /card/me` | طالب مشترك | بيانات الكارنيه وكود QR موقّع بيتغير |
| `GET /absences/me` · `POST /absences` · `POST /absences/{id}/cancel` | مشترك مفعّل | "مش هروح": الأيام المتبلّغ عنها من النهارده والأيام اللي لسه ينفع يتبلّغ عنها؛ بلاغ عن يوم (سبب + ملاحظة اختيارية)؛ الرجوع فيه قبل الميعاد |
| `GET /attendance/me?outcome=&page=&page_size=` | طالب | "رحلاتي": كل رحلة بأوقات الركوب والوصول والخروج والنتيجة (`rode` / `absent` / `not_going` / `checked_out`) مع عدّاد لكل نوع |
| `GET /requests/me` · `GET /requests/{id}` | طالب | طلبات تغيير الخط والاسترداد والشكاوى بتاعته ومراحلها |
| `POST /requests/line-change` · `/refund` · `/complaint` | طالب | يبعت طلب (التفاصيل تحت) |
| `POST /requests/{id}/withdraw` | طالب | يسحب طلب المكتب لسه مافتحهوش |
| `GET /requests/refund-policy` | طالب | جدول الاسترداد، وخصم النهارده، والمبلغ المدفوع |
| `GET /trips/next` | طالب مشترك | رحلته الجاية: اليوم، والمحطة، والباص، والحالة/الوقت المتوقع |
| `GET /announcements?kind=&page=&page_size=` | الكل | الإعلانات الرسمية والتأخيرات (لكل الطلاب أو لخطه) |
| `GET /notifications` · `POST /notifications/{id}/read` · `POST /notifications/read-all` | الكل | الإشعارات وعدد الجديد |
| `POST /chat` | طالب | المساعد الذكي (فريق الـ AI) |
| `GET /parent/children` | ولي الأمر | أولاده |
| `GET /parent/children/{id}/timeline?date=` | ولي الأمر | يوم ابنه |
| ~~`POST /requests/{id}/parent-decision`~~ | ولي الأمر | اتشال: استخدموا `POST /parent/approvals/{request_id}/approve` أو `/refuse` (شوف "موافقة ولي الأمر") |
| `GET /driver/trip/today` | سواق / مشرف | رحلته وليستة الركاب |
| `POST /trips/{id}/start` · `POST /trips/{id}/end` | سواق | بداية ونهاية (ذهاب أو عودة) |
| `POST /trips/{id}/scan` | سواق / مشرف | مسح كارنيه: `board` أو `checkout` + السبب |
| `POST /trips/{id}/delay` | سواق | بلاغ تأخير |
| `POST /sos` | سواق / مشرف | استغاثة: `medical` / `breakdown` / `accident` (التفاصيل تحت) |
| `GET /sos/{id}` | اللي بعتها | يتابع حالة استغاثته |
| `POST /violations` | سواق / مشرف | مخالفة بصورة |
| `GET /admin/live` | إدارة النقل | كل الباصات ومواقعها |
| `GET /admin/trips/{id}/riders` | إدارة النقل | مين ركب ومين لسه |
| `GET /admin/sos?status=` · `GET /admin/sos/{id}` | النقل / العيادة | ليستة الاستغاثات وتفاصيل واحدة بسجلها |
| `POST /admin/sos/{id}/actions` | النقل / العيادة | إجراء: استلام، إسعاف، باص بديل، ملحوظة، قفل |
| `POST /admin/trips/{id}/replacement` | إدارة النقل | باص بديل أو تبديل باص/سواق |
| `GET /admin/attendance?date=&line=` | إدارة النقل | الحضور والغياب والخروج |
| `GET /admin/lines/{id}/students` | إدارة النقل | طلاب كل خط |
| CRUD `/admin/lines` · `/admin/buses` · `/admin/drivers` · `/admin/timetable` | إدارة النقل | الخطوط والباصات والسواقين ومواعيد العودة |
| `POST /admin/announcements` | إدارة النقل | إعلان رسمي لكل الطلاب أو لخط |
| `GET /admin/payments` · `PATCH /admin/payments/{id}` | المالية | مراجعة الإيصالات |
| `GET /admin/requests` · `PATCH /admin/requests/{id}` | المالية / النقل | الطلبات والاسترداد |
| `GET /admin/violations` · `GET /admin/complaints` | حسب الدور | المتابعة |
| `GET /admin/reports` | حسب الدور | أنواع التقارير المسموحة للدور ده |
| `GET /admin/reports/{type}?format=&line=&from=&to=` | حسب الدور | التقرير شاشة (`json`) أو تصدير (`xlsx` / `pdf`) |
| `GET /admin/audit` | سوبر أدمن | سجل العمليات |
| CRUD `/admin/users` | سوبر أدمن | الحسابات والصلاحيات |
| `/admin/clinic` · `/admin/sg/*` · `/admin/events/*` · `/bus-company/*` | حسب الدور | العيادة والأمين العام والفعاليات وأبو الهول (تفاصيلها في قسم المرحلة 7 تحت) |
| `POST /gps/ingest` | جهاز الـ GPS | استقبال الموقع (بمفتاح للجهاز، مش توكن مستخدم) |

## الدخول بخطوتين (OTP)

كل الأدوار بتدخل بنفس الطريقة، ومفيش باسورد. ولي الأمر بقى بيدخل من نفس الطلبات برقم موبايله، فـ `/auth/parent/otp` و `/auth/parent/verify` اتشالوا.

| الخطوة | الطلب | الرد |
| --- | --- | --- |
| 1. اطلب كود | `POST /auth/otp` `{ "identifier": "240100101" }` | `{ "masked_destination": "010•••••001", "name_hint": "زياد", "expires_in_seconds": 300, "attempts_left": 3, "code_length": 4, "resend_after_seconds": 60 }` |
| 2. ادخل | `POST /auth/login` `{ "identifier": "240100101", "code": "4821" }` | بيحط كوكي الجلسة؛ والرد `{ "expires_at": "2026-11-02T06:00:00Z", "user": { id, role, name, identifier, faculty, level, guardian_name, masked_phone } }` |
| خروج | `POST /auth/logout` (بيمسح الكوكي) | `{ "ok": true }` |
| مين أنا | `GET /me` (بالكوكي) | نفس الـ `user` اللي في رد الدخول، أو 401 لو التوكن انتهى أو اتلغى |

- الـ `identifier`: رقم جامعي 9 أرقام للطالب، أو رقم وظيفي/إيميل للموظف، أو موبايل ولي الأمر. الكود بيروح للموبايل المتسجل بس، والرد بيرجعه متخبي.
- الكود 4 ل 6 أرقام، صالح 5 دقايق، وليه 3 محاولات، وبيتشال أول ما يتستخدم. إعادة الإرسال مرة كل 60 ثانية بالكتير.
- `code_length`: عدد أرقام الكود، عشان الشاشة تدخل لوحدها أول ما الكود يكمل. `resend_after_seconds`: بعد كام ثانية يتفتح زرار "ابعت الكود تاني".
- كل كود جديد بيلغي الكود اللي قبله، والكود الأخير بس هو اللي يشتغل.
- `expires_at`: وقت انتهاء التوكن (UTC). الفرونت بيخرّج المستخدم في اللحظة دي بالظبط، وكمان أول ما أي طلب يرجع 401.
- `masked_destination` ممكن يكون موبايل أو إيميل متخبي (زي `ah•••@sut.edu.eg`)، والفرونت بيعرضه زي ما هو. يعني لو قررتوا تبعتوا الكود على الإيميل، الفرونت مش محتاج يتغير.
- الأخطاء: `UNKNOWN_IDENTIFIER` (404)، `ACCOUNT_DISABLED` (403)، `INVALID_OTP` (400)، `OTP_EXPIRED` (400)، `OTP_LOCKED` (429)، `OTP_RATE_LIMITED` (429).
- في بيئة التجربة بس ممكن الرد يرجع `demo_code`، وممنوع يظهر في الـ production.

## الطالب: الحجز والدفع والكارنيه

اتعملت في المرحلة 2 من الفرونت على الداتا اللي الجامعة بعتتها يوم 2 نوفمبر. الأشكال كاملة في `openapi.json` في الريبو، والجزء ده ملخص.

**الخطوط.** 23 خط (خط 1 وخط 14 كل واحد فيهم باصين، فبقوا 25 مسار). كل الخطوط بـ 15,000 جنيه للترم (`price_piasters: 1500000`). كل الباصات بتوصل الجامعة الساعة 08:30 زي ملف الخطوط بتاع الجامعة (`campus_arrival: { "from": "08:30", "to": "08:30" }`؛ لو `from` زي `to` يبقى ميعاد واحد مش فترة). وكل الباصات بتطلع من الجامعة الساعة 16:30 إلا لو المكتب حدد ميعاد تاني للخط (`return_departure_time`).

| الحقل | معناه |
| --- | --- |
| `code` | رقم الخط زي ما الجامعة كاتباه ("5"، "14-2") |
| `bus_type` | `minibus` / `coaster` / `midibus` / `large_bus` |
| `seats_total` · `seats_available` | السعة والأماكن الفاضية. حاليًا كل باص محسوب مليان (عدد المشتركين = السعة) |
| `first_pickup_time` · `stops[].pickup_time` | `"HH:MM"` بتوقيت مصر، أو `null` |
| `return_departure_time` | الباص بيطلع من الجامعة إمتى، "HH:MM". دلوقتي 16:30 لكل الخطوط؛ المكتب بيغيره من صفحة مواعيد العودة |
| `stops[].location` | `{ lat, lng }`، أو `null` لحد ما المكتب يبعت أماكن المحطات الحقيقية |
| `stops[].note` | علامة مميزة من المكتب ("أمام لولو ماركت")، أو `null` |

الجامعة نفسها مش بترجع كمحطة. والأسماء بترجع بلغة الـ `Accept-Language`.

**حالات الاشتراك:**

| `status` | معناها | الطالب بيشوف إيه |
| --- | --- | --- |
| `reserved` | المكان محجوز ولسه ما اتدفعش، و`hold_expires_at` بيقول لحد إمتى | صفحة الدفع + عداد |
| `payment_review` | الإيصال اتبعت والمالية بتراجعه، والمكان فاضل محجوز | "تحت المراجعة" |
| `active` | المالية وافقت، و`activated_at` اتملى | الكارنيه الرقمي |
| `expired` | المهلة خلصت من غير إيصال، والمكان رجع | "احجز تاني" |
| `cancelled` | الطالب لغى قبل ما يدفع | "احجز تاني" |

`GET /subscriptions/me` بيرجع `{ "subscription": null }` للطالب اللي عمره ما حجز (مش 404). والرد فيه `latest_payment` عشان الرئيسية تعرض سبب الرفض. ولو المالية رفضت الإيصال، الاشتراك يرجع `reserved` بمهلة 24 ساعة جديدة.

**الحجز:** `POST /subscriptions` `{ "line_id": "ln_05", "stop_id": "ln_05_s3" }` ← الاشتراك بـ `status: "reserved"`. الأخطاء: `SEAT_UNAVAILABLE` (409)، `ALREADY_SUBSCRIBED` (409)، `STOP_NOT_ON_LINE` (422)، `LINE_NOT_FOUND` (404). الإلغاء: `POST /subscriptions/{id}/cancel`، وهو `reserved` بس، غير كده `NOT_CANCELLABLE` (409).

**الدفع.** طريقتين بس، من رد الجامعة:
1. إيداع أو تحويل لحساب الجامعة في البنك الأهلي المصري، والطالب يرفع الإيصال في التطبيق.
2. فيزا في مكتب الحسابات (غرفة A045)، والمالية تسجلها من الداشبورد (`method: "card_at_office"`)، والطالب مش بيرفع حاجة.

`GET /payments/instructions` بيرجع المبلغ، وبيانات البنك (`bank_name` و `account_name` و `account_number` و `iban` و `swift_code` و `currency`)، و`cashier_room` (A045)، و`transport_room` (A039)، و`office_hours`، وحدود الملف. بيانات البنك جاية من السيرفر، فالمالية تقدر تغيرها من غير نسخة فرونت جديدة.

`POST /payments/receipt` (مع `Idempotency-Key`):

```json
{
  "subscription_id": "sub_...", "method": "bank_deposit",
  "reference_number": "NBE-12345678", "amount_piasters": 1500000,
  "paid_on": "2026-11-01", "payer_name": "Mohamed Aldmrdash",
  "receipt": { "file_name": "slip.jpg", "content_type": "image/jpeg", "data_base64": "..." }
}
```

- الـ `method`: `bank_deposit` أو `bank_transfer`. الملف JPG أو PNG أو PDF، 5 ميجا بالكتير، ومتبعت base64 جوه الـ JSON (لو تفضلوا `multipart/form-data` قولولنا دلوقتي).
- الـ `payer_name` اسم صاحب الحساب أو اللي أودع (غالبًا ولي الأمر).
- حالات الدفع: `pending_review` ← `approved` أو `rejected` (+ `rejection_reason`).
- الأخطاء: `HOLD_EXPIRED` (409)، `NOT_AWAITING_PAYMENT` (409)، `RECEIPT_ALREADY_USED` (409)، `RECEIPT_TOO_LARGE` (413)، `AMOUNT_MISMATCH` (422).

**الكارنيه الرقمي:** `GET /card/me` بيرجع الطالب والخط والمحطة والترم و`valid_until`، ومعاهم `qr: { token, expires_at }`. التوكن صالح 30 ثانية وموقّع من السيرفر، والفرونت بيجيب واحد جديد قبل ما يخلص بـ 3 ثواني. لو مش مشترك ← `NOT_SUBSCRIBED` (403).

**الرحلة الجاية:** `GET /trips/next` بيرجع `{ "trip": null }` لو مفيش (مش مشترك أو مفيش تشغيل). غير كده: `service_date`، و`direction` (`outbound` / `return`)، والخط، والمحطة وميعادها، و`campus_arrival`، و`bus { bus_type, plate }` أو `null`، و`status` (`scheduled` / `approaching` / `passed_stop` / `arrived`) ومعاها `eta_minutes` و`near_stop` و`location_updated_at` من GPS الباص. الفرونت بيحدّثها كل دقيقة لحد ما الـ WebSocket يجهز. أيام التشغيل من الأحد للخميس.

## الطالب: الطلبات والإشعارات والإعدادات

اتبنى في المرحلة 3 من الفرونت. الأشكال كاملة في `openapi.json` (26 مسار)، والجزء ده ملخص.

**تلات أنواع طلبات**، كلهم تحت `/requests`، وكل طلب ليه سجل بمراحله:

| `kind` | مبني على | محتاج |
| --- | --- | --- |
| `line_change` | استمارة الجامعة "طلب تغيير خط السير" | اشتراك مفعّل |
| `refund` | سياسة الاسترداد 2026-2027 | اشتراك مفعّل ودفع متوافق عليه |
| `complaint` | — | شكوى `payment`: أي حجز. باقي الأنواع: اشتراك مفعّل |

| الطلب | بيعمل إيه |
| --- | --- |
| `GET /requests/me?kind=` | طلبات الطالب، الأحدث الأول |
| `GET /requests/refund-policy` | جدول الاسترداد للترم، وخصم النهارده (بتاريخ القاهرة)، والمبلغ المدفوع، و `payout_days` (45)، و `processing_days` (3) |
| `GET /requests/{request_id}` | طلب واحد (طلب طالب تاني ← 404) |
| `POST /requests/line-change` | الخط والمحطة الجديدة، `permanent` / `temporary` (`starts_on` و `ends_on`)، والسبب، وموبايل الطالب، واسم وموبايل ولي الأمر + `guardian_consent: true` |
| `POST /requests/refund` | `reason`: `standard` / `medical` / `bereavement` / `transfer`، والشرح، وبيانات ولي الأمر، و `documents[]` (نفس شكل ملف الإيصال، 3 بالكتير) |
| `POST /requests/complaint` | `category`: `driver_behaviour` / `delay` / `bus_condition` / `crowding` / `safety` / `payment` / `other`، و `line_id` أو null، و `happened_on`، والوصف، و `attachments[]` (3 بالكتير) |
| `POST /requests/{request_id}/withdraw` | وهو لسه `submitted` بس |

في FastAPI سجّلوا `/requests/me` و `/requests/refund-policy` قبل `/requests/{request_id}`. كل POST بياخد `Idempotency-Key`.

**الحالات:** `submitted` ← `in_review` ← `approved` / `rejected` (تغيير الخط والاسترداد) أو `resolved` (الشكوى)، و `withdrawn` لو الطالب سحبه. كل طلب ليه `reference` ("REQ-2026-0042" يقوله في المكتب) و `timeline[]`: `{ status, at, by: student | transport_office | finance, note }`. رد المكتب على الطالب هو الـ `note`، بلغة الطلب.

**قواعد الاسترداد (من السياسة):** خصم 25% من 20 سبتمبر لـ 8 أكتوبر، و50% من 11 أكتوبر لـ 29 أكتوبر، و100% من 1 نوفمبر. استرداد عادي والخصم 100% ← `REFUND_WINDOW_CLOSED` (422). الحالات الصحية والوفاة (والإعاقة) الجامعة بتقرر فيها بالمستندات، والتحويل محتاج خطاب التحويل، ومن غير مستند ← `DOCUMENTS_REQUIRED` (422)، وفيهم `estimated_refund_piasters` بيبقى `null`. الفلوس بترجع بشيك باسم ولي الأمر خلال 45 يوم، والطالب بيجيب أصل الإيصال لـ A039. الاسترداد لما يتوافق عليه بيلغي الاشتراك.

**أخطاء تانية:** `NO_ACTIVE_SUBSCRIPTION` (409)، و `NO_SUBSCRIPTION` (409، شكوى دفع من غير حجز)، و `REQUEST_ALREADY_OPEN` (409، طلب مفتوح واحد من كل نوع)، و `SAME_LINE` (422)، و `INVALID_DATES` (422: بداية فاتت، أو نهاية قبل البداية، أو برا الترم، أو تاريخ شكوى في المستقبل)، و `NOT_WITHDRAWABLE` (409)، وكمان `LINE_NOT_FOUND` و `STOP_NOT_ON_LINE` و `RECEIPT_TOO_LARGE`. تغيير الخط الدائم لما يتوافق عليه بينقل الاشتراك للخط والمحطة الجديدة من `starts_on`.

**الإشعارات:** `GET /notifications?page=&page_size=&unread_only=` ← `{ items, total, unread_count }`، و `POST /notifications/{id}/read` و `POST /notifications/read-all` ← `{ unread_count }`. كل إشعار فيه: `kind` (`bus_near` و `bus_delayed` و `payment_approved` و `payment_rejected` و `request_update` و `announcement`)، و `title` و `body` (حسب Accept-Language)، و `created_at`، و `read_at` أو null، و `link: { target, id }`. الـ `target` اسم صفحة مش URL: `home` / `tracking` / `payment` / `card` / `request` / `complaint` / `announcements`، ومعاه رقم الطلب لـ `request` و `complaint`. السيرفر هو اللي بيعملهم: الباص على بعد 5 دقايق من محطة الطالب (من الـ GPS)، وإعلان تأخير على خطه، وكل قرار على إيصال، وكل تغيير في حالة طلب، وكل إعلان جديد. لحد ما الـ WebSocket يجهز، التطبيق بيشيك على عدد الجديد كل دقيقة ولما يرجع للشاشة.

**مش هروح ورحلاتي (2 نوفمبر، المرحلة 3):** "مش هروح" بيغطي يوم شغل كامل (الرحلتين)، لحد 7 أيام قدام، من الأحد للخميس. الميعاد الأخير هو وقت تحرك الباص من أول محطة في خط الطالب اليوم ده؛ بعده اليوم مينفعش يتبلّغ عنه ولا يترجع فيه (`ABSENCE_CUTOFF_PASSED`، 409). أخطاء تانية: `NO_ACTIVE_SUBSCRIPTION` (409)، `DATE_NOT_REPORTABLE` (422)، `ALREADY_REPORTED` (409). كل بلاغ: `absence_id`، `service_date`، `reason` (`sick` / `no_lectures` / `personal` / `other`)، `note` أو null، `created_at`، `cutoff_at`. `GET /absences/me` بيرجع `{ upcoming, reportable_days: [{ service_date, cutoff_at }] }`. رحلاتي بترجع `{ items, total, summary: { rode, absent, not_going, checked_out } }`؛ كل عنصر فيه `trip_id`، `service_date`، `direction`، `line`، `stop_name`، `outcome`، `boarded_at`، `arrived_at`، `checked_out_at`، `checkout_reason` (حسب Accept-Language). رحلات الرجوع تظهر لما مواعيدها تتعلن.

**الإعلانات:** `GET /announcements` بقى بياخد كمان `kind` (`official` / `delay` / `service_change`). صفحة الطالب بتعرضهم وتفلترهم، والنشر من صفحة الإدارة (مرحلة جاية).

**الإعدادات** مش محتاجة endpoint جديد: اللغة والمظهر (فاتح / غامق / زي الجهاز) محفوظين على الجهاز، والخروج بـ `POST /auth/logout`.

## الطوارئ (SOS)

السواق أو المشرف بيدوس SOS ويختار النوع، والسيرفر بيضيف مكان الباص من جهاز الـ GPS اللي في الباص (مش من الموبايل)، ويبعت تنبيه لايف لفريق النقل فورًا.

**الطلب:** `POST /sos` مع `Idempotency-Key`

```json
{ "trip_id": "trp_812", "type": "breakdown", "note": "عطل في الموتور" }
```

| النوع (`type`) | يوصل لمين | المعتاد |
| --- | --- | --- |
| `medical` | النقل + العيادة | دكتور العيادة يوجه، ولو لزم إسعاف |
| `breakdown` | النقل | تأخير بسيط أو باص بديل |
| `accident` | النقل + العيادة | إسعاف لو فيه مصابين، وباص بديل يكمل الرحلة |

**اللي السيرفر يحفظه ويرجعه:**

```json
{
  "id": "sos_301", "type": "breakdown", "status": "open",
  "trip_id": "trp_812", "line_id": "ln_04", "bus_id": "bus_17",
  "raised_by": { "id": "usr_55", "role": "driver", "name": "..." },
  "location": { "lat": 30.1234, "lng": 31.5678, "fix_at": "2026-11-01T06:42:10Z", "source": "bus_gps" },
  "riders_on_board": 38, "created_at": "2026-11-01T06:42:12Z",
  "actions": [ { "action": "acknowledge", "by": "usr_09", "at": "2026-11-01T06:42:40Z", "note": null } ]
}
```

**الحالات:** `open` ← `acknowledged` ← `closed`. كل إجراء بيتبعت لـ `POST /admin/sos/{id}/actions` ويتسجل بمين والوقت:

| `action` | بيعمل إيه |
| --- | --- |
| `acknowledge` | حد استلم البلاغ، والسواق يشوف "الإدارة استلمت" |
| `ambulance_called` | اتطلب إسعاف |
| `replacement_sent` | باص بديل (`bus_id`)، وبيربط مع `POST /admin/trips/{id}/replacement` |
| `note` | ملحوظة حرة |
| `close` | قفل، ولازم معاه ملخص اللي اتعمل |

**الإبلاغ التلقائي:** أول ما الـ SOS يتعمل، الطلاب اللي على الرحلة دي وأولياء أمورهم يوصلهم إشعار (جوه التطبيق + Web Push) بصياغة هادية من غير تفاصيل طبية. ولما يتبعت باص بديل أو البلاغ يتقفل، يوصلهم تحديث.

## تصدير التقارير (Excel و PDF)

`GET /admin/reports/{type}?format=xlsx&line=ln_04&from=2026-11-01&to=2026-11-30`. الـ `format` يا `json` (للعرض في الشاشة، بنفس `{ items, total }`) يا `xlsx` يا `pdf` (ملف تحميل). الـ `line` اختياري، واللي من غيره معناه كل الخطوط.

| التقرير (`type`) | أهم الأعمدة | مين يشوفه |
| --- | --- | --- |
| `roster` كشف الطلاب | الرقم الجامعي، الاسم، القسم، الفرقة، الخط، المحطة، حالة الاشتراك | النقل، المالية، الأمين العام |
| `payments` المدفوعات | رقم الإيصال، الطالب، المبلغ، الطريقة، الحالة، التاريخ، مين راجع | المالية، الأمين العام |
| `attendance` الحضور | اليوم، ذهاب/عودة، الطالب، وقت الركوب والوصول، الخروج وسببه، غائب أو "مش هروح" | النقل، الأمين العام |
| `seat_occupancy` الإشغال | الخط، الباص، السعة، المشتركين، متوسط الركاب، نسبة الإشغال % | النقل، المالية، الأمين العام |

- السوبر أدمن يشوف الكل، وأي دور مش في الجدول ياخد `403`. الصلاحية بتتشيك على السيرفر مش بس بإخفاء الزرار.
- الملف باسم زي `sutech_attendance_ln_04_2026-11-01_2026-11-30.xlsx`، والـ PDF عربي RTL باللوجو الرسمي، وفيه الفلتر ووقت الإصدار.
- الفلوس في الملف بالجنيه (مش بالقرش)، والوقت بتوقيت مصر.
- كل تصدير بيتسجل في سجل العمليات.

## أحداث اللايف (WebSocket)

اتصال واحد `wss://.../api/v1/ws` (كوكي الجلسة هي اللي بتثبت مين، من غير توكن في الرابط)، والسيرفر يبعت لكل واحد اللي يخصه بس. كل رسالة شكلها `{ "type": "...", "data": {...} }`.

| `type` | بيروح لمين | فيه إيه |
| --- | --- | --- |
| `bus.location` | طلاب وأولياء أمور الخط، والإدارة | الباص، وlat/lng، والوقت، والوصول المتوقع |
| `trip.status` | نفس اللي فوق | بدأت، اتأخرت، وصلت، اتبدل الباص |
| `attendance.event` | ولي الأمر والإدارة | ركب، وصل، نزل (السبب)، غاب |
| `sos.new` / `sos.update` | إدارة النقل، والعيادة لو طبية | النوع، والباص، وموقع الـ GPS، والحالة، وآخر إجراء (الطلاب وأولياء الأمور المتأثرين يوصلهم notification.new بس) |
| `notification.new` | صاحب الإشعار | إشعار جديد |

موقع الباص يتبعت كل 2 ل 5 ثواني تقريبًا (حسب جهاز الـ GPS). الإشعارات المهمة (غياب، خروج، SOS) محتاجة كمان Web Push عشان توصل والتطبيق مقفول.

## قواعد العمل اللي السيرفر لازم يضمنها

الفرونت بيمنعها في الشاشة، بس السيرفر هو الحكم الأخير:

1. اشتراك واحد شغال بس لكل طالب، وطلب واحد مفتوح بس من كل نوع في المرة.
2. الحجز بيمسك مكان 24 ساعة، ولو ما وصلش إيصال المكان يرجع. وطول ما الإيصال تحت المراجعة المكان فاضل محجوز. السعر بيتثبت وقت الحجز.
3. الرقم المرجعي للإيصال ما يتستخدمش مرتين، والمبلغ ما يقلش عن السعر، والملف 5 ميجا بالكتير. الدفع بنك أو فيزا في المكتب بس (مفيش فوري ولا إنستاباي).
4. التتبع والكارنيه والطلبات و"مش هروح" للمشترك النشط بس. شكوى الدفع بعد الحجز، وباقي الشكاوى بعد التفعيل.
5. كود الـ QR موقّع وبينتهي بعد 30 ثانية، والمسح بيرفض أي كارنيه ملغي أو مش على الخط ده.
6. الغياب التلقائي: لما رحلة الذهاب تخلص، أي مشترك ما اتمسحش يتحسب غايب (إلا لو بلّغ "مش هروح")، وولي أمره يتبلغ.
7. الخروج في نص الرحلة: مسح بـ `checkout` + سبب، وولي الأمر يتبلغ فورًا (من غير موافقة).
8. "مش هروح النهارده" يوصل للإدارة والسواق وولي الأمر.
9. الـ SOS بيوصل فورًا بمكان الباص من جهاز الـ GPS، وما يتقفلش غير لما حد من الإدارة يستلمه ويسجل اللي اتعمل. سجل الإجراءات ما يتمسحش وما يتعدلش، والطلاب وأولياء الأمور اللي على الرحلة يتبلغوا تلقائي. الضغطة المتكررة بنفس الـ `Idempotency-Key` ما تعملش بلاغ تاني.
10. تبديل الباص أو السواق ما يبوّظش الرحلة: الركاب والحضور بينتقلوا معاه، والتبديل يتسجل.
11. موافقة ولي الأمر أول خطوة في الاسترداد وتغيير الخط، وبعدها الإدارة.
12. الدخول: كود الـ OTP ما يتستخدمش مرتين، وبعد 3 محاولات غلط الحساب يتقفل مؤقتًا.
13. التقارير: كل دور يصدّر اللي مسموحله بس، ونفس الفلتر يطلع نفس الأرقام في `json` و `xlsx` و `pdf`.

## ولي الأمر وتتبع الباص (تحديث المرحلة 4، 3 نوفمبر 2026)

| Method | Path | الدور | بيعمل إيه |
|---|---|---|---|
| GET | `/parent/children` | parent | الطلاب المربوطين بولي الأمر (برقم موبايله في ملف الطالب)، وحجز كل واحد الترم ده. |
| GET | `/parent/children/{student_id}/day` | parent | النهارده لابن واحد: `status` (`no_subscription`، `no_service`، `not_going`، `waiting`، `bus_on_way`، `boarded`، `arrived`، `checked_out`، `absent`)، و`events` اللي حصلت (`not_going`، `bus_left`، `boarded`، `arrived`، `checked_out`، `absent`، كل واحد بـ`at` و`detail`)، والباص والسواق، وآخر 5 أيام. خطأ `NOT_YOUR_CHILD` (403). |
| GET | `/parent/children/{student_id}/tracking` | parent | باص الابن لايف (نفس الشكل اللي تحت). خطأ `NOT_YOUR_CHILD` (403). |
| GET | `/tracking/me` | student | باص الطالب لايف: `trip` فيه `status` و`eta_minutes` و`near_stop` و`position` (`lat`، `lng`، `heading`، `speed_kmh`، `recorded_at` من جهاز الـ GPS اللي في الباص) و`trail` (النقط لحد دلوقتي) و`stop_location` و`campus_location` والباص والسواق. أو `trip: null` مع `reason` (`no_subscription` / `no_trip_now`) و`next_departure_at`. |

تغييرات على endpoints موجودة:
- `GET /lines/{line_id}` بقى فيه `bus: { bus_type, plate, driver: { name, phone } }`. رقم السواق `phone` بيتبعت **بس** لمشتركين الخط ده وأولياء أمورهم، وأي حد تاني بياخد `null`.
- `GET /trips/next`: الـ `bus` بقى فيه `driver` (برقمه، لأن الطالب راكب الخط ده).
- `GET /notifications` لولي الأمر: أنواع جديدة `child_boarded`، `child_arrived`، `child_absent`، `child_not_going`، `child_checked_out`، والـ link target `child_day` (الـ id هو student_id). ولي الأمر بيشوف إعلانات خطوط أولاده بس.

أحداث اللايف: `bus.location` (لكل trip_id) و`child.day` (لكل student_id). لحد ما الـ WebSocket يجهز، التطبيق بيقرا التتبع كل 5 ثواني واليوم كل 30 ثانية.

الداتا: لوحات الباصات والسواقين وأرقامهم من كشف سواقين أبو الهول. فيه خطين في الكشف (المعادي مول HUB 50، إنبي – غمرة) مش موجودين في ملف الخطوط لسه. لسه محتاجين من مكتب النقل لوكيشن الجامعة وأماكن المحطات.

## موافقة ولي الأمر على تغيير الخط (تحديث 3 نوفمبر 2026)

قرار أحمد: **تغيير الخط محتاج موافقة ولي الأمر من التطبيق، وتصريح المجسم لأ** (الاسترداد والشكوى زي ما هم).

- حالة طلب جديدة `awaiting_guardian` قبل `submitted`. طلب تغيير الخط بيبدأ فيها، ومش بيوصل لمكتب النقل غير بعد موافقة ولي الأمر. المكتب مش بيشوف الطلب المرفوض خالص.
- طرف جديد `guardian` في تاريخ الطلب (`by`).
- body تغيير الخط مبقاش فيه `guardian_consent` (اسم ولي الأمر وموبايله لسه موجودين زي الاستمارة الورق). اللي بيرد هو الحساب اللي رقمه متسجل في ملف الطالب.
- الطالب يقدر يسحب الطلب وهو `awaiting_guardian` أو `submitted`.
- endpoints جديدة (دور `parent`):
  - `GET /parent/approvals` → `{approvals: [{student_id, student_name, request}]}`: طلبات تغيير الخط بتاعة الأولاد، المستنية واللي اترد عليها.
  - `POST /parent/approvals/{request_id}/approve` والـ body `{note: string|null}` → `awaiting_guardian → submitted`.
  - `POST /parent/approvals/{request_id}/refuse` والـ body `{note: string|null}` → `awaiting_guardian → rejected`، والملاحظة بتظهر للطالب.
  - الأخطاء: `NOT_YOUR_CHILD` (403) و`NOT_AWAITING_GUARDIAN` (409).
- إشعارات جديدة لولي الأمر: `approval_needed` (target `approvals`)، و`child_not_going` بقى بيتبعت كمان للأيام الجاية، وقت ما الطالب يبلّغ، مش يوم الرحلة بس.
- `GET /parent/children/{student_id}/day` اتضاف له `days_off: [{service_date, reason, note, reported_at}]` (النهارده والأيام الجاية).

## السواق والمشرف (تحديث المرحلة 5، 7 نوفمبر 2026)

السواق والمشرف بيستخدموا نفس الصفحات ونفس الـ endpoints، والدورين مسموح لهم في كل اللي تحت. كل واحد يشوف الخط المتعين له النهارده بس.

| Method | Path | بيعمل إيه |
|---|---|---|
| GET | `/driver/trip/today` | يوم فرد الطاقم: `service_date`، `is_service_day`، `crew_role`، `line`، `bus {bus_id, bus_type, plate, seats}`، `stops [{order, name, pickup_time}]`، `campus_arrival`، و `trips` (الذهاب والعودة؛ فاضية في يوم مفيهوش تشغيل). خطأ `NO_ASSIGNMENT` (404) لو مفيش خط متعين. |
| POST | `/trips/{trip_id}/start` | `not_started → in_progress`. أخطاء `TRIP_ALREADY_STARTED` و `TRIP_ALREADY_ENDED` و `OTHER_TRIP_IN_PROGRESS` (409)، و `NOT_YOUR_TRIP` (403). |
| POST | `/trips/{trip_id}/end` | `in_progress → ended`. أي حد لسه `waiting` يبقى `absent`؛ وده اللي بيملا "رحلاتي" ويوم الطالب عند ولي الأمر. |
| POST | `/trips/{trip_id}/scan` | تسجيل ركوب أو نزول طالب (تحت). |
| POST | `/trips/{trip_id}/delay` | `{minutes, reason, note}`: `minutes` واحدة من 5/10/15/20/30/45/60، و `reason` `traffic` / `breakdown` / `weather` / `road_closed` / `other`. السيرفر ينشره كإعلان `delay` على الخط، فطلاب الخط وأولياء أمورهم يوصلهم إشعار. |
| GET | `/sos/{sos_id}` | متابعة الـ SOS اللي اتبعت (الحالة والإجراءات). |
| GET | `/violations/mine` | **جديد.** المخالفات اللي فرد الطاقم ده سجلها، الأحدث الأول. |

كل الـ POST بتاخد `Idempotency-Key`.

**الرحلة** (`trips[]`): `trip_id`، `direction`، `status` (`not_started` / `in_progress` / `ended`)، `departure_time`، `started_at`، `ended_at`، `riders[]`، `counts {total, waiting, boarded, checked_out, not_going, absent}`، `delays[] {delay_id, minutes, reason, note, reported_at}`، و `sos` (آخر واحد على الرحلة أو null).

**الراكب**: `student_id`، `name` (بلغة الطلب)، `identifier` (الرقم الجامعي)، `stop_order`، `stop_name`، `pickup_time`، `state` (`waiting` / `boarded` / `checked_out` / `not_going` / `absent`)، `boarded_at`، `checked_out_at`، `checkout_reason`، `checkout_note`، `scan_method` (`qr` / `manual`)، `not_going_reason`. القايمة هي كل المشتركين الفعالين على الخط بترتيب المحطات، و `not_going` جاية من "مش هروح النهارده" عند الطالب.

**جسم الـ scan:**

```json
{ "action": "board", "method": "qr", "qr_token": "SUT1....", "identifier": null, "reason": null, "note": null }
```

- `method: "qr"` يبعت التوكن اللي اتقرا من الكارنيه (عمره 30 ثانية، شوف جزء الكارنيه)؛ `method: "manual"` يبعت الرقم الجامعي اللي السواق كتبه بداله.
- `action: "checkout"` لازم معاه `reason`: `unwell` / `guardian_pickup` / `personal` / `other` (و `note` لحد 200 حرف).
- الرد `{rider, counts}`.
- الأخطاء: `CARD_INVALID`، `CARD_EXPIRED`، `STUDENT_NOT_FOUND`، `NOT_ON_THIS_TRIP` (ملوش حجز فعال على الخط ده)، `ALREADY_BOARDED`، `NOT_ON_BOARD`، `REASON_REQUIRED`، `TRIP_NOT_STARTED`، `TRIP_ALREADY_ENDED`.

**تعديلات الـ SOS:** `POST /sos` أخطاؤه `NOT_YOUR_TRIP` (403) و `TRIP_ALREADY_ENDED` (409)؛ ونفس الـ `Idempotency-Key` يرجع نفس البلاغ (بلاغ واحد لكل ضغطة). وكل عنصر في `actions` بقى فيه `by_name` عشان السواق يشوف مين في المكتب استلمه.

**المخالفات:** `POST /violations` جسمه `{trip_id|null, student_identifier|null, rule, description (10–500), photo {file_name, content_type (JPEG/PNG/WebP), data_base64}}`، والصورة لحد 5 ميجا. `rule` ماشية على لائحة سلوك الباص: `unapproved_model` (2)، `photographing` (3)، `bullying` (4)، `cleanliness` (5)، `smoking` (6)، `noise` (7)، `unsafe_boarding` (9)، `refused_id` (10)، `bad_language` (11)، `not_subscribed` (12)، `distracting_driver` (14)، `damage` (15)، `seating` (16)، `other`. الحالات `submitted` ← `under_review` ← `closed`. أخطاء `STUDENT_NOT_FOUND` و `FILE_TYPE` و `FILE_TOO_LARGE`.

في الديمو بس: في يوم مفيهوش تشغيل بيظهر زرار "جرّب يوم تجريبي"؛ ده مش مطلوب من السيرفر.

## ناحية المكتب في الطوارئ والباص البديل (تحديث المرحلة 5، 7 نوفمبر 2026)

| Method | Path | الدور | بيعمل إيه |
|---|---|---|---|
| GET | `/admin/sos?status=` | transport_admin، clinic، super_admin | كل البلاغات، الأحدث الأول. العيادة بتشوف `medical` و `accident` بس. |
| GET | `/admin/sos/{sos_id}` | نفسهم | بلاغ واحد (404 للعيادة لو عطل باص). |
| POST | `/admin/sos/{sos_id}/actions` | transport_admin، clinic (**مش** super_admin: 403) | `{action, note}`: `acknowledge` (وهو `open` بس)، وبعدين `ambulance_called`، و `note` (لازم `note`)، و `close` (لازم الملخص في `note`). |
| GET | `/admin/trips/{trip_id}/replacement-options` | transport_admin | باص الرحلة وسواقها دلوقتي، وعدد الركاب، والباصات الاحتياطي الفاضية (كل باص بسواقه) والسواقين الاحتياطي. |
| POST | `/admin/trips/{trip_id}/replacement` | transport_admin | `{bus_id, driver_id, reason, note, sos_id}`: باص تاني (بييجي بسواقه إلا لو اتبعت `driver_id`) أو سواق تاني بس. |

كل الـ POST بتاخد `Idempotency-Key`.

**البلاغ عند المكتب** (عناصر `/admin/sos`) = شكل الـ SOS زائد: `line {line_id, code, name}`، `direction`، و `bus {bus_id, bus_type, plate, seats}` و `driver {driver_id, name, phone}` **زي ما هم دلوقتي** (بعد أي تبديل)، و `raised_by_phone`، و `replacements[]` (تحت)، و `campus_location {lat, lng}` للخريطة. كل عنصر في `actions[]` فيه `by_name`؛ وفي `replacement_sent` الـ `note` بيبقى "اللوحة · السواق" (وملاحظة المكتب لو فيه).

**أخطاء الإجراءات:** `ALREADY_ACKNOWLEDGED`، `SOS_NOT_ACKNOWLEDGED` (استلمه الأول)، `SOS_CLOSED` (409)، `NOTE_REQUIRED` (422). أول `acknowledge` هو اللي السواق بيشوفه "المكتب استلمه، فلان الساعة كذا". مفيش استلام أوتوماتيك.

**الباص البديل:** `reason` واحدة من `breakdown` / `accident` / `driver_unavailable` / `other`. الرد `{replacement_id, bus, driver, reason, note, sos_id, by_name, at}`. الأخطاء: `TRIP_ALREADY_ENDED`، `BUS_NOT_AVAILABLE`، `DRIVER_NOT_AVAILABLE`، `SOS_CLOSED` (409)، `NOTHING_TO_CHANGE` (422). وبعده:
- الركاب والسكانات والحضور بيفضلوا على نفس الـ `trip_id` (قاعدة 10)، والتبديل بيتسجل.
- لو اتبعت `sos_id`، البلاغ بيتسجل فيه سطر `replacement_sent`.
- `GET /driver/trip/today`: الـ `bus` بيبقى الباص الجديد، وكل رحلة فيها حقل جديد `replacement: {bus_type, plate, driver_name, driver_phone, at} | null`.
- `/tracking/me` و `/trips/next` و `/parent/children/{id}/day`: الـ `bus` والـ `driver` بيبقوا الجداد لباقي اليوم.
- الباص أو السواق اللي اتبعت لرحلة لسه مخلصتش مبيتعرضش تاني.

**إشعارات لطلاب الخط وأولياء أمورهم** (إعلان نوعه `service_change` + إشعار)، بكلام هادي ومن غير تفاصيل طبية: لما الـ SOS يتبعت ("باص خط 7 واقف على الطريق، والمكتب متابع")، ولما باص بديل يتبعت ("الباص دلوقتي {plate} والسواق {name} ({phone})")، ولما البلاغ يتقفل ("الموقف اتحل").

**اللايف:** لحد ما الـ WebSocket يجهز، صفحات المكتب بتقرا `/admin/sos` كل 5 ثواني؛ وفيه شريط أحمر بصوت تنبيه بيظهر في كل صفحات إدارة النقل والعيادة طول ما فيه بلاغ محدش استلمه.

محتاجين: الباصات والسواقين الاحتياطي اللي أبو الهول بيسيبهم في الجراج (الأبلكيشن بيعرض احتياطي وهمي دلوقتي).

## تحديث مراجعة الفرونت إند (8 نوفمبر 2026)

اتعملت مراجعة كاملة للفرونت (الأمان، سهولة الاستخدام، السرعة، والعقد)، وطلع منها التغييرات دي. ملف `openapi.json` في الريبو (`frontend/openapi.json`، بيطلع من الكود) هو **المرجع الأساسي للحقول**، والملف ده ملخص. ياريت تقارنوا الـ OpenAPI اللي FastAPI بيطلعه بيه، والأحسن يبقى check في الـ CI.

**الجلسة (الأمان):**
- `/auth/login` مبقاش بيرجع `token` في الرد. بيحط كوكي **HttpOnly و Secure و SameSite=Lax**، وكل طلب بيبعتها (`credentials: "include"`)، والـ API لازم يسمح لدومين التطبيق مع الـ credentials (CORS) ويتأكد من CSRF في الطلبات اللي بتغيّر حاجة (الـ header `Idempotency-Key` أصلًا بيجبر preflight).
- `/auth/logout` بيمسح الكوكي. أي طلب بكوكي منتهية أو ملغية بيرجع 401 والتطبيق بيخرّج المستخدم.
- `demo_code` **ممنوع** يتبعت برّه بيئة التجربة (والتطبيق كمان بيتجاهله في النسخة الحقيقية).
- كل endpoint بيتأكد من الدور في السيرفر ويرجّع `FORBIDDEN` (403)؛ إن التطبيق يخبّي صفحة مش حماية.

**تغييرات العقد:**
- الخطوط بقى فيها الاسمين: `name_ar` و `name_en` في كل خط في `GET /lines` و `GET /lines/{id}` (ومعاهم `name` بلغة الطلب)، عشان البحث يشتغل بأي لغة.
- جديد في التطبيق، ياريت تضيفوه: `GET /admin/trips/{trip_id}/replacement-options`، `GET /health`، `GET /violations/mine`، `POST /requests/model-permit`.
- طريقة واحدة لرد ولي الأمر: `POST /parent/approvals/{request_id}/approve|refuse`. و `POST /requests/{id}/parent-decision` اتشال.
- قاعدة التأخير: `POST /crew/trips/{trip_id}/delay` بس والرحلة شغالة، أو في حدود 60 دقيقة قبل أو بعد معاد التحرك؛ غير كده `DELAY_OUT_OF_WINDOW` (409).
- شكل الليستات: الاستثناءات من `{ items, total }` مكتوبة في "قواعد العقد".
- الرفع: الإيصالات والمرفقات base64 جوه الـ JSON دلوقتي (ملف 5 ميجا ≈ 6.7 ميجا). لو تفضلوا `multipart/form-data` أو presigned upload قولولنا والتطبيق هيتغيّر.
- الخريطة: الديمو بيستخدم سيرفرات OpenStreetMap، ومينفعش تطبيق حقيقي يستخدمها. النسخة الحقيقية محتاجة مزوّد tiles تختاره الجامعة (`NEXT_PUBLIC_MAP_TILE_URL`)، والتطبيق مش هيتبني للـ production من غيره.

**اللي الباك إند بس يقدر يعمله:**
1. يمشي على الأدوار والحالات والقيم اللي في الملف ده و `openapi.json` (الموديلز بتاريخ 4 نوفمبر لسه فيها 5 أدوار، و Fawry/InstaPay، وحالات طلبات ودفع مختلفة).
2. جلسة الكوكي، و CORS مع الـ credentials، وحماية CSRF.
3. فحص الـ 403 حسب الدور في كل endpoint، وسجل العمليات.
4. إن `demo_code` عمره ما يتبعت في الـ production.
5. `name_ar` / `name_en` في الخطوط، والـ 4 endpoints اللي فوق.
6. قاعدة وقت التأخير، وباقي "قواعد العمل اللي السيرفر لازم يضمنها".
7. القرارات اللي تحت: الرفع (base64 ولا multipart) ومزوّد الخريطة (مع الجامعة).

## تحديث تجربة المستخدمين (8 نوفمبر 2026)

اتعملت تجربة للديمو دور بدور (طلاب، ولي أمر، سواق، مشرف، وكل المكاتب)، وطلع منها 33 ملاحظة. الفرونت صلّحهم كلهم في الـ mock. دي الحاجات اللي **السيرفر** لازم يعملها بنفس الطريقة (أسماء الحقول في `openapi.json`):

**الدخول والجلسات:**
- **مدة الجلسة حسب الدور.** الطلاب وأولياء الأمور والسواقين والمشرفين يفضلوا داخلين **30 يوم** (والأحسن تتجدد طول ما التطبيق بيتفتح). حسابات المكاتب: **12 ساعة**. لو 12 ساعة للكل، السواق اللي يدخل 6 بالليل هيحتاج كود SMS جديد 6 الصبح قبل الباص على طول. `expires_at` في رد الدخول بيقول للتطبيق إمتى.
- **رقم الموبايل بأي شكل.** `+201000002000` و `00201000002000` و `0100 000 2000` و `01000002000` نفس الرقم: شيلوا `+20` / `0020` والمسافات والشرط والأقواس قبل البحث.
- **الكود يفضل شغال لو الطالب قفل التطبيق.** الكود يفضل صالح على السيرفر لحد ما ينتهي أو كود جديد يحل محله. الكود المستخدم أو اللي اتبدّل أو مش موجود يرجّع `OTP_EXPIRED` ("اطلب كود جديد")، مش `INVALID_OTP` ("الكود غلط").
- `GET /me` ورد الدخول بقى فيهم `phone` بتاع المستخدم نفسه (عمره ما يبقى رقم حد تاني)، عشان يتملى في الفورمز بتاعته.

**الطلبات:**
- **تغيير الخط اللي اتوافق عليه يتطبق في تواريخه.** التغيير المؤقت (`duration: temporary`) بينقل الطالب للخط والمحطة الجديدة **من `starts_on` لحد `ends_on` بس**، في كل حتة: الرحلة الجاية، الكارنيه، كشف ركاب الخط (طاقم الخط الجديد لازم يقبل الكارنيه، وطاقم الخط القديم ما يحسبوش)، التتبع، أخبار الخط، وصفحات ولي الأمر. قبل وبعد التواريخ دي الطالب يرجع لخطه الأصلي. التغيير الدايم بينقل الاشتراك من `starts_on`.
- **أرقام الطلبات عدّاد واحد للكل** (`REQ-2026-0042`، `0043`، …) والسيرفر هو اللي بيديها. عمر طالبين ما ياخدوا نفس الرقم.
- **ولي الأمر يقدر يغيّر رأيه** لمدة 10 دقايق بعد ما يرد، طالما المكتب لسه ما فتحش الطلب (الرفض ممكن يبقى موافقة لو الطالب ما بعتش طلب أحدث). حقل جديد في كل عنصر من `GET /parent/approvals`: `can_change_until` (وقت ISO أو null). الرد بالعكس جوه المدة دي مسموح؛ غير كده `NOT_AWAITING_GUARDIAN` (409).
- ملاحظات المكتب (زي "اتوافق من يوم …") تبقى بتاريخ مكتوب كويس، مش `2026-11-08` خام.

**الرحلات والسجل:**
- **مفيش سجل قبل ما الاشتراك يبدأ.** الطالب اللي اتوافق عليه الساعة 3:40 العصر مالوش "ركب" ولا ركوب ولا وصول في رحلة الصبح بتاعة اليوم ده، وصفحة ولي الأمر مش بتبيّن رحلة في اليوم ده.
- **الباص أو السواق البديل يخص رحلة يومه بس.** كارت الرحلة الجاية بكره يرجع يبيّن باص الخط وسواقه العاديين.
- **سجل الـ SOS يحتفظ بالباص والطاقم.** خزّنوا الباص والسواق وقت الاستغاثة على الاستغاثة نفسها؛ أي باص بديل يتبعت بعد كده على نفس الرحلة ما يغيّرش الاستغاثات القديمة أو المقفولة. و `replacements` بتاعة الاستغاثة فيها بس التغييرات اللي حصلت وهي مفتوحة.
- **السواق اللي اتبدّل بيتشال من الرحلة.** لما المكتب يبعت سواق تاني (`POST /admin/trips/{trip_id}/replacement` بسواق جديد، أو باص بسواقه)، حساب السواق القديم ميقدرش يبدأ أو يمسح أو يخلّص الرحلة أو يبلّغ عن تأخير: الطلبات دي ترجّع **`DRIVER_RELIEVED` (403)**. حقل جديد `relieved` في `GET /crew/today` (`driver_name` و `driver_phone` و `at`، أو null) بيقول للسواق القديم مين استلم. المشرف بيكمّل الرحلة عادي، والـ SOS من السواق القديم لسه بيتقبل.

**المكاتب:**
- صفحات المكاتب للمدفوعات والاسترداد والطلبات والشكاوى والمخالفات في المرحلة 6. لحد ما تتعمل، الديمو بيرد عليها بتايمر وبيقول كده. في السيرفر الحقيقي **مفيش حاجة تتقرر بتايمر**: كل إيصال وطلب وشكوى بيستنى إنسان يرد.

**اللي الباك إند بس يقدر يعمله:**
1. مدة الجلسة حسب الدور (30 يوم للطلاب وأولياء الأمور والطاقم، 12 ساعة للمكاتب)، والأحسن تتجدد.
2. توحيد شكل رقم الموبايل (`+20` و `0020` والمسافات والشرط) في الدخول.
3. تطبيق تغيير الخط اللي اتوافق عليه حسب التاريخ في كل حتة بتقرا خط الطالب (الكشوف، المسح، الرحلة الجاية، الكارنيه، التتبع، الأخبار).
4. عدّاد واحد لأرقام الطلبات.
5. مدة الـ 10 دقايق لولي الأمر و `can_change_until`.
6. حفظ الباص والطاقم في كل SOS؛ الباص البديل لكل يوم لوحده؛ `DRIVER_RELIEVED` و `relieved`.
7. مفيش سجل رحلات قبل وقت التفعيل.

## صفحات المكاتب (تحديث المرحلة 6، 12 نوفمبر 2026)

صفحات المكاتب اتعملت: المالية (المدفوعات، الفيزا في A045، الاسترداد)، طلبات وشكاوى إدارة النقل، مخالفات شؤون الطلاب، إعلانات المكتب، والتقارير مع تصدير Excel وPDF. **مفيش أي قرار بيتاخد بتايمر خلاص، حتى في الديمو**: كل إيصال وطلب وشكوى ومخالفة بيقرر فيها شخص من المكتب الصح. أسماء الحقول في `openapi.json` (بقى فيه 63 path).

| Method | Path | الدور | بيعمل إيه |
|---|---|---|---|
| GET | `/admin/payments?status=&q=&page=` | finance, super_admin | الإيصالات والدفع في المكتب. المستني الأول (الأقدم فوق)، وبعدين اللي اتقرر (الأحدث الأول). `q`: الرقم الجامعي أو جزء من الاسم أو الرقم المرجعي. الرد `{items, total, counts{pending_review, approved, rejected}}`. |
| GET | `/admin/payments/{payment_id}` | نفسه | دفعة واحدة مع الطالب (`name`, `identifier`, `phone`)، الكرسي (`line`, `stop_name`)، `price_piasters`، `subscription_status`، `reviewed_by_name`، `file_url` (لينك مؤقت للملف)، و`other_payments` (إيصالات الطالب التانية في الترم). |
| PATCH | `/admin/payments/{payment_id}` | نفسه | `{decision: approve أو reject, reason}`. الموافقة: الاشتراك يبقى `active`. الرفض: `reason` إجباري (الطالب بيقراه) والكرسي بياخد **حجز جديد 24 ساعة** عشان الطالب يرفع تاني. |
| GET | `/admin/bookings/awaiting-payment?identifier=` | نفسه | الحجز المستني دفع، بالرقم الجامعي عند خزنة A045: الطالب، `subscription_id`، الخط، المحطة، السعر، `hold_expires_at`. |
| POST | `/admin/payments/office` | نفسه | دفع بالفيزا في A045: `{subscription_id, reference_number (إيصال الماكينة), amount_piasters, paid_on, payer_name}`. بيتسجل `card_at_office` و`approved`، والكرسي بيتفعّل على طول. |
| GET | `/admin/requests?kind[]=&stage=&q=&page=` | transport_admin, finance, super_admin | طابور المكتب. `stage`: `new`، `in_review`، `closed`. كل عنصر: `request_id`، `reference`، `kind`، `status`، `stage`، `title` (سطر واحد بلغة الطلب)، `student{name, identifier}`، `received_at`، `updated_at`، `handled_by_name`؛ ومعاهم `counts`. |
| GET | `/admin/requests/{request_id}` | نفسه | `{request (نفس شكل الطالب مع الـ timeline), stage, student{…, faculty, level, line, subscription_status}, allowed_actions, suggested_replies{open, approve, reject, resolve}, target_seats_available, handled_by_name}`. |
| PATCH | `/admin/requests/{request_id}` | نفسه | `{action: open أو approve أو reject أو resolve, note, refund_piasters}`. |
| GET | `/admin/violations?status=&rule=&q=&page=` | student_affairs, transport_admin, super_admin | بلاغات الطاقم: جديدة، بتتراجع، اتقفلت؛ ومعاهم `counts`. كل عنصر بيزود `reported_by{name, role}`، `line`، `photo_url`، `opened_by_name`، `decision{outcome, note, by_name, at}`، `allowed_actions`. |
| GET | `/admin/violations/{violation_id}` | نفسه | بلاغ واحد. |
| PATCH | `/admin/violations/{violation_id}` | student_affairs, super_admin | `{action: open أو close, outcome, note}`. `outcome`: `warning`، `investigation`، `dismissed`. |
| POST | `/admin/announcements` | transport_admin, super_admin | `{kind: official أو service_change, line_id أو null, title_ar, title_en, body_ar, body_en}`. كل واحد بيشوف لغته؛ إعلان الخط بيوصل لطلبة الخط ده وأولياء أمورهم بس. إعلانات `delay` لسه جاية من بلاغ التأخير بتاع الطاقم بس. |
| GET | `/admin/reports` | transport_admin, finance, secretary_general, super_admin | التقارير اللي الدور ده يقدر يفتحها: `{items: [{type, title, description, uses_period}]}`. |

**مين بيرد على أنهي طلب (السيرفر هو اللي بيفلتر، الأبلكيشن بيطلب بس):**
- **المالية:** الاسترداد والشكاوى من نوع `payment`.
- **إدارة النقل:** تغيير الخط وتصاريح المجسمات وباقي الشكاوى. تغيير الخط بيوصل للمكتب **بعد موافقة ولي الأمر بس** (أو لو ولي الأمر معندوش حساب: المكتب بيكلمه).
- `open` بيخليه `in_review` (الطالب بيشوف "بيتراجع" ومعاها الملاحظة لو فيه). `approve` / `reject` لتغيير الخط والاسترداد والمجسم؛ `resolve` للشكاوى. `reject` و`resolve` محتاجين `note` (5 حروف أو أكتر). الطالب بيقرا كل ملاحظة. `suggested_replies` نصوص جاهزة المكتب يقدر يعدلها (الأبلكيشن بيكتبها في الخانة).
- **الموافقة على تغيير الخط:** لازم كرسي فاضي على الخط الجديد (`target_seats_available`)؛ لو مفيش: `SEAT_UNAVAILABLE` (409).
- **الموافقة على الاسترداد:** العادي بيترجع بمبلغ السياسة (`estimated_refund_piasters`)؛ الاستثنائي (مرضي، وفاة، تحويل) محتاج `refund_piasters` من 0 لحد المدفوع، وإلا `REFUND_AMOUNT_INVALID` (422). المبلغ بيرجع على الطلب في `approved_refund_piasters` (حقل جديد في تفاصيل الاسترداد)، والطالب بيشوفه.
- **تصريح المجسم** إدارة النقل هي اللي بتقرر فيه (من غير ولي الأمر).
- الأخطاء: `REQUEST_CLOSED` (409)، `NOTE_REQUIRED`، `ACTION_NOT_ALLOWED`، `REFUND_AMOUNT_INVALID` (422)، `SEAT_UNAVAILABLE` (409)، `FORBIDDEN` (403) لطلب مكتب تاني.

**أخطاء المالية:** `PAYMENT_ALREADY_REVIEWED` (409)، `REASON_REQUIRED` (422)، `STUDENT_NOT_FOUND` (404)، `NOT_AWAITING_PAYMENT`، `HOLD_EXPIRED`، `RECEIPT_ALREADY_USED` (409: نفس رقم الإيصال متسجل ومش مرفوض)، `AMOUNT_MISMATCH` (422: أقل من سعر الترم).

**المخالفات:** شؤون الطلاب بتفتح (`under_review`: الطاقم بيشوفها) وبتقفل بـ `outcome` و`note` (5 حروف أو أكتر) للملف؛ `DECISION_REQUIRED` (422)، `VIOLATION_CLOSED` (409). إدارة النقل بتقرا نفس القايمة و`allowed_actions: []`.

**الملفات المرفوعة (اتضافت 13 نوفمبر 2026):** كل صفحة مكتب بتعرض الملفات اللي اترفعت، فكل رد لازم يرجع لينك مؤقت (موقّع، حوالي 15 دقيقة، ويتفتح من غير هيدر زيادة عشان يشتغل في `<img>` وفي تاب جديدة):
- `GET /admin/payments` و`/admin/payments/{id}`: `file_url` و`file_content_type` (`image/jpeg` أو `image/png` أو `application/pdf`)، والاتنين null في الدفع بالفيزا.
- كل مرفق في الطلبات (مستندات الاسترداد، صور الشكاوى)، للطالب وللمكتب: `{attachment_id, file_name, content_type, size_bytes, url}`.
- `GET /admin/violations` و`/admin/violations/{id}`: `photo_url`.
- اللينك ميطلعش غير للي مسموحله يشوف السجل ده (الطالب، ولي أمره لو مسموح، المكتب المسؤول، والسوبر أدمن).

**التقارير (تعديلات على "تصدير التقارير"):**
- `GET /admin/reports/{type}?format=json` بيرد `{type, title, columns[{key, label, kind}], rows[], total, page, page_size, filters{line, from, to}, summary[{label, value}], generated_at}`، مش `{items, total}`. `kind`: `text`، `number`، `money` (قروش على الشاشة، جنيه في الملفات)، `date`، `time`، `percent` (من 0 لـ 100). العناوين والملخص وخانات النص بلغة الطلب، عشان الشاشة وملف Excel والـ PDF يبقوا متطابقين دايمًا. `page_size` لحد 200.
- من غير `from`/`to` السيرفر بياخد **الشهر ده لحد النهارده** (الحضور: **الأسبوع ده لحد النهارده**). `roster` ملهوش فترة (حسب النهارده).
- `attendance` **صف لكل خط في كل يوم تشغيل** (المشتركين، ركبوا، قالوا مش رايحين، غابوا، نسبة الحضور)، بحد أقصى **31 يوم** للتقرير (`REPORT_RANGE_TOO_LONG`، 422). كشف حضور لكل طالب ممكن ييجي بعدين لو المكتب طلبه.
- `roster`: الخط، اسم الخط، الرقم الجامعي، الاسم، المحطة، ميعاد الركوب. `payments`: تاريخ الدفع، الرقم المرجعي، الرقم الجامعي، الاسم، الخط، طريقة الدفع، المبلغ، الحالة. `seat_occupancy`: الخط، الكراسي، المشتركين، الكراسي الفاضية، متوسط الركاب في اليوم، نسبة الإشغال.
- الـ PDF: **2,000 صف** بالكتير (`REPORT_TOO_LARGE_FOR_PDF`، 422؛ Excel ملهوش حد). `to` قبل `from`: `INVALID_RANGE` (422). خط مش موجود: `LINE_NOT_FOUND` (404).
- اسم الملف: `sutech_<type>_<كود الخط أو all>_<from>_<to>.<ext>` (الكشف: تاريخ اليوم)، في `Content-Disposition`. الأبلكيشن بينزّله بكوكي الجلسة.
- الديمو بيعمل نفس الملفات في المتصفح (Excel بـ `write-excel-file`، والـ PDF العربي بيترسم صفحة صفحة عشان الحروف العربي تتوصل صح). الملفات الحقيقية هتيجي من السيرفر.

**اللي فريق الباك إند بس يقدر يعمله:**
1. الـ 13 endpoint اللي فوق، مع فلترة المكتب على السيرفر (المالية عمرها ما تشوف تغيير خط، والنقل عمره ما يشوف استرداد).
2. مفيش قرارات أوتوماتيك في أي حتة: الإيصالات والطلبات والشكاوى والمخالفات بتستنى شخص.
3. حجز جديد 24 ساعة بعد رفض إيصال؛ و`RECEIPT_ALREADY_USED` على كل الطلبة.
4. التأكد من الكرسي الفاضي عند الموافقة على تغيير الخط؛ و`approved_refund_piasters` في الاسترداد.
5. أشكال التقارير اللي فوق (json وxlsx وpdf من نفس الصفوف)، وحد الـ 31 يوم للحضور وحد الـ 2,000 صف للـ PDF، وتسجيل كل تصدير في سجل النشاط.

## الأمين العام وباصات الفعاليات وأبو الهول (تحديث المرحلة 7، 13 نوفمبر 2026)

تلات صفحات جديدة: **مكتب النقل بيطلب باصات فعاليات من أبو الهول** (تربية عسكرية، يوم مفتوح، رحلات…)، و**أبو الهول بيرد** بالباصات والسواقين اللي هيبعتهم، و**الأمين العام** بيشوف اليوم كله بنظرة (قراءة بس). الأمين العام بيدخل على `/admin/secretary-general` وأبو الهول على `/admin/bus-company`. أسماء الحقول في `openapi.json` (بقى 73 مسار).

| الطريقة | المسار | الدور | بيعمل إيه |
|---|---|---|---|
| GET | `/admin/events?status=&page=` | transport_admin, super_admin | طلبات الفعاليات، الأقرب يوم الأول. كل عنصر: `event_id`، `reference`، `kind`، `title`، `event_date`، `departs_at`، `returns_at`، `pickup`، `destination`، `students_count`، `bus_type`، `buses_requested`، `seats_requested`، `note`، `status`، `is_past`، `requested_by_name`، `created_at`، `company_reply{buses[], note, by_name, at}`، `cancellation{reason, by_name, at}`، `allowed_actions`. ومعاهم `total` و`counts`. |
| GET | `/admin/events/{event_id}` | نفسه | طلب واحد. |
| POST | `/admin/events` | نفسه | `{kind, title, event_date, departs_at, returns_at (أو null لو رايح بس), pickup, destination, students_count, bus_type, buses_requested, note}`. بيبدأ `waiting_company`. Idempotent (`Idempotency-Key`). |
| POST | `/admin/events/{event_id}/cancel` | نفسه | `{reason}` (5 حروف أو أكتر، الشركة بتقراه). مسموح وهو مستني أو متأكد وقبل اليوم. |
| GET | `/bus-company/requests?status=&page=` | bus_company, super_admin | نفس القايمة للشركة. **من غير أسماء ولا أرقام طلاب**، العدد بس. للـ super_admin الـ `allowed_actions` دايمًا `[]` (للعرض بس). |
| GET | `/bus-company/requests/{event_id}` | نفسه | `{event, available_buses[]}`: باصات الشركة اللي مش رايحة فعالية تانية اليوم ده، كل واحد `{bus_id, plate, bus_type, seats, driver_name, driver_phone, line (أو null للاحتياطي)}`، الاحتياطي الأول. |
| POST | `/bus-company/requests/{event_id}/reply` | bus_company (**مش** super_admin: 403) | `{decision: confirm أو decline, bus_ids[], note}`. التأكيد: من 1 لحد `buses_requested` باص مختلف من `available_buses` (أقل من المطلوب = رد جزئي والمكتب بيشوفه). الرفض: `note` هي السبب (5 حروف أو أكتر). |
| GET | `/bus-company/fleet` | نفسه | كل باصات الشركة ومعاها `line`، `today` (`on_line`، `replacement`، `spare`)، `covering_line` (باص بديل النهارده)، `event_today{event_id, title}`؛ ومعاهم `counts{total, on_line, spare, seats}`. |
| GET | `/admin/sg/overview?date=` | secretary_general, super_admin | يوم واحد (النهارده لو مفيش تاريخ، ولحد 31 يوم لورا): `is_today`، `is_service_day`، `previous_service_day` (في يوم مفيهوش باصات)، `generated_at`، `totals{lines, lines_running, lines_delayed, subscribers, rode, not_going, absent}`، `lines[]` (كل خط: الخط، `bus{plate, bus_type, driver_name}` بعد أي بديل، `replaced`، `status` `no_service`/`not_started`/`in_progress`/`ended`، `subscribers`، `rode`، `not_going`، `absent`، `delay_minutes`)، `emergencies[]` (بلاغات الطوارئ اليوم ده)، `events[]` (باصات الفعاليات اليوم ده)، `violations_new`. |
| GET | `/admin/sg/watchlist?date=` | نفسه | الطلاب اللي الأمين العام متابعهم (20 بالكتير): كل واحد `{student{student_id, identifier, name, line, stop_name, pickup_time}, status, boarded_at, checked_out_at, checkout_reason, added_at}`. `status`: `no_service`، `no_subscription`، `waiting`، `on_bus`، `arrived`، `checked_out`، `not_going`، `absent` (رحلة الصبح). |
| POST | `/admin/sg/watchlist` | نفسه | `{identifier}` (الرقم الجامعي). بيرجع القايمة الجديدة. |
| DELETE | `/admin/sg/watchlist/{student_id}` | نفسه | إلغاء المتابعة. بيرجع القايمة الجديدة. |

**قواعد لازم السيرفر يطبقها:**
- يوم الفعالية من بكرة لحد **120 يوم** قدام (`EVENT_DATE_INVALID`، 422)؛ و`returns_at` بعد `departs_at` (`EVENT_TIMES_INVALID`، 422).
- الكراسي المطلوبة (`buses_requested` × كراسي `bus_type`: ميني باص 14، كوستر 28، ميدي باص 33، باص كبير 50) لازم تكفي `students_count` (`NOT_ENOUGH_SEATS`، 422). لحد 2,000 طالب و30 باص.
- نفس الاسم في نفس اليوم وهو مستني أو متأكد: `EVENT_DUPLICATE` (409).
- إلغاء أو رد على طلب مقفول أو يومه عدى: `EVENT_CLOSED` (409). رد وهو مش مستني: `EVENT_NOT_WAITING` (409). باص مش تبع الشركة أو رايح فعالية تانية نفس اليوم: `BUS_NOT_AVAILABLE` (409). عدد غلط أو باص متكرر: `BUSES_INVALID` (422). رفض أو إلغاء من غير سبب: `REASON_REQUIRED` (422).
- باص الخط ينفع يروح فعالية (وبيفضل شغال على خطه الصبح وبعد الضهر)؛ والشركة هي اللي تقرر.
- صفحات المكتب لمكتب النقل بس؛ صفحات الشركة لأبو الهول بس؛ والأمين العام قراءة بس. والسوبر أدمن بيشوف التلاتة.
- أخطاء الأمين العام: `DATE_INVALID` (422: يوم جاي أو أقدم من 31 يوم)، `STUDENT_NOT_FOUND` (404)، `ALREADY_WATCHED` (409)، `WATCHLIST_FULL` (409، 20 طالب).
- `delay_minutes` هو آخر بلاغ تأخير من طاقم الباص اليوم ده. الأسماء والأماكن والملاحظات بترجع بلغة الطلب لو المكتب كتبها باللغتين (الديمو بيخزن اللي اتكتب في اللغتين).

**اللي فريق الباك إند بس يقدر يعمله:**
1. الـ 12 endpoint اللي فوق، وفلترة الأدوار على السيرفر، وبيانات الطلاب ما تتبعتش للشركة أبدًا.
2. تبليغ أبو الهول بطلب جديد أو ملغي (SMS أو إيميل)، وتبليغ المكتب برد الشركة.
3. أرقام صفحة الأمين العام من الرحلات والمسح الحقيقي، مع كاش يناسب التحديث كل 30 ثانية.

**أسئلة مفتوحة للمرحلة 7:**
- [ ] أبو الهول: عندهم كام باص احتياطي، وكام كرسي فعلًا في كل نوع باص؟
- [ ] نبلغ أبو الهول بـ SMS أو إيميل كمان، ولا في التطبيق بس؟
- [ ] الأمين العام عايز إشعار (طوارئ، خط متأخر جدًا) ولا الصفحة كفاية؟

## صفحات إدارة النقل والسوبر أدمن (تحديث المرحلة 8، 13 نوفمبر 2026)

إدارة النقل بقت بتدخل على **نظرة عامة** خاصة بيها (`/admin`) فيها اللي مستنيها، ومعاها **خريطة حية** لكل الأتوبيسات، و**الخطوط** بطلابها، و**مين ركب** كل رحلة، و**الطلاب**، و**الأتوبيسات والسواقين**. السوبر أدمن بقى عنده **المستخدمين والصلاحيات** و**سجل العمليات**. أسماء الحقول في `openapi.json` (بقى 84 مسار).

| Method | المسار | الدور | بيعمل إيه |
|---|---|---|---|
| GET | `/admin/overview?date=` | transport_admin، super_admin | نفس عرض اليوم بتاع `/admin/sg/overview` وزيادة `queues{emergencies_open, requests_new, complaints_new, events_waiting}` (اللي مستني دلوقتي، مهما كان اليوم المعروض). |
| GET | `/admin/live` | نفس الأدوار | أتوبيس كل خط الصبح: `line`، `trip_id`، `bus{plate, bus_type, driver_name, driver_phone}` (بعد أي بديل)، `replaced`، `status` (`not_started`، `on_the_road`، `arrived`، `no_service`)، `position{lat, lng, heading, speed_kmh, recorded_at}` وهو ماشي، `near_stop`، `progress` (من 0 لـ 1)، `leaves_at`، `subscribers`، `rode`، `delay_minutes`، `sos_open`؛ ومعاهم `generated_at` و`campus_location`. بعد كده `bus.location` على الـ WebSocket. |
| GET | `/admin/lines` | نفس الأدوار | كل خط بأتوبيسه وسواقه، `stops`، `first_pickup`، `subscribers`، `reserved` (حجوزات حاجزة مقعد)، `seats_free`؛ ومعاهم `totals`. |
| GET | `/admin/lines/{line_id}` | نفس الأدوار | الخط ومعاه `stops_list[]` (الترتيب، الاسم، الميعاد، عدد المشتركين)، و`students[]` حسب المحطة، و`today_trip_id` لتغيير الأتوبيس أو السواق. |
| GET | `/admin/attendance?line_id=&date=` | نفس الأدوار | رحلة الصبح لخط في يوم (لحد 31 يوم لورا): `is_service_day`، `trip_status`، `counts`، `riders[]` (نفس شكل كشف الركاب بتاع الطاقم). |
| GET | `/admin/students?q=&line_id=&page=` | نفس الأدوار | الطلاب اللي ليهم مقعد أو حجز الترم ده، 25 في الصفحة: `identifier`، `name`، `line`، `stop_name`، `subscription_status`. |
| GET | `/admin/students/{student_id}` | نفس الأدوار | وزيادة `faculty`، `level`، `phone`، `pickup_time`، `guardian{name, phone, has_account}`، `trips{rode, not_going, absent}` الترم ده، و`requests[]` (مع `handled_here`). |
| GET | `/admin/buses` | نفس الأدوار | أتوبيسات الشركة (زي `/bus-company/fleet`) وزيادة `trips[{line_id, trip_id}]` لتغيير أتوبيس أو سواق خط النهارده. |
| GET | `/admin/users?q=&role=` | super_admin | حسابات المكاتب بس (transport_admin، finance، clinic، student_affairs، secretary_general، bus_company، super_admin): `user_id`، `identifier`، `name`، `role`، `masked_phone`، `active`، `is_you`، `added_at`؛ ومعاهم `counts` لكل دور. |
| POST | `/admin/users` | super_admin | `{name, name_ar, phone, role}`. السيرفر بيدي رقم الدخول اللي عليه الدور في المكتب (`TRN-`، `FIN-`، `CLN-`، `STA-`، `SGO-`، `BUS-`، `ADM-` + رقم). Idempotent. |
| PATCH | `/admin/users/{user_id}` | super_admin | `{active}` و/أو `{role}`. الإيقاف بينهي جلسات الحساب فورًا (أول طلب بعدها بيرجع 401، و`request-otp` بيرد `ACCOUNT_DISABLED`). |
| GET | `/admin/audit?area=&q=&page=` | super_admin | سجل العمليات، الأحدث الأول، 25 في الصفحة: `audit_id`، `at`، `actor{name, identifier, role}`، `action`، `area`، `target`، `detail`. |

تغيير أتوبيس أو سواق رحلة من الخريطة الحية أو صفحة الخط أو صفحة الأتوبيسات بيستخدم نفس `POST /admin/trips/{trip_id}/replacement` مع `sos_id: null`.

**قواعد لازم السيرفر يطبقها:**
- السوبر أدمن مايقدرش يوقف حسابه أو يغير مكتبه (`CANNOT_CHANGE_SELF`، 409)، ولازم يفضل سوبر أدمن واحد شغال على الأقل (`LAST_SUPER_ADMIN`، 409). رقم موبايل مستخدم في حساب تاني: `PHONE_TAKEN` (409). حساب مش موجود: `USER_NOT_FOUND` (404).
- الطلاب وأولياء الأمور والسواقين والمشرفين مش بيتعملوا من هنا: بييجوا من قاعدة بيانات القبول وكشف أبو الهول.
- كل قرار من أي مكتب بيكتب سطر في السجل، ومحدش (ولا السوبر أدمن) يقدر يعدل أو يمسح سطر. قيم `action`: `payment_approved`، `payment_rejected`، `office_payment`، `request_opened`، `request_approved`، `request_rejected`، `request_resolved`، `violation_opened`، `violation_closed`، `announcement_posted`، `sos_action`، `replacement_sent`، `event_requested`، `event_cancelled`، `event_confirmed`، `event_declined`، `user_added`، `user_stopped`، `user_activated`، `user_role_changed`. و`area`: `payments`، `requests`، `violations`، `announcements`، `emergencies`، `events`، `users`.
- أخطاء صفحات التشغيل: `DATE_INVALID` (422)، `LINE_NOT_FOUND` (404)، `STUDENT_NOT_FOUND` (404).

**اللي فريق الباك إند بس يقدر يعمله:**
1. الـ 12 endpoint اللي فوق، مع فحص الدور على السيرفر.
2. إنهاء جلسات الحساب الموقوف فورًا (blacklist للتوكن أو توكن قصير العمر).
3. كتابة سطر السجل في نفس الـ transaction بتاعة القرار، عشان مايبقاش واحد من غير التاني.

**أسئلة مفتوحة للمرحلة 8:**
- [ ] هنحتفظ بسجل العمليات قد إيه (سنة؟ على طول)؟
- [x] مواعيد العودة: 16:30 لكل الخطوط (أحمد، 13 نوفمبر 2026)، في صفحة مواعيد العودة تحت.

## مواعيد العودة والوصول للجامعة (13 نوفمبر 2026)

- **الوصول:** كل الخطوط بتوصل الجامعة الساعة **08:30** (ملف الخطوط بتاع الجامعة، آخر محطة "جامعة السويدي"). `campus_arrival` بقى `{ "from": "08:30", "to": "08:30" }` في كل حتة (الخطوط، الرحلة الجاية، يوم الطاقم، التتبع، يوم ولي الأمر). الفرونت بيعرض ميعاد واحد لما `from` يساوي `to`.
- **العودة:** كل الباصات بتطلع من الجامعة الساعة **16:30** (أحمد). `return_departure_time` مبقاش null: موجود في `GET /lines` و`GET /lines/{id}` و`GET /trips/next`، ورحلة العودة بتاعة الطاقم `departure_time` بتاعها هو الميعاد ده.
- تصليح واحد في ملف الخطوط: "مسجد بلال" في خط 19 مكتوب 8:30 بين محطتين 7:32 و7:35، فخدناه 07:33. ياريت تتأكدوا من المكتب.

| Method | Path | مين | إيه |
|---|---|---|---|
| GET | `/admin/timetable` | transport_admin، super_admin | `{default_return_time, items[]}`؛ كل عنصر: `line`، `stop_count`، `first_pickup_time`، `campus_arrival`، `return_departure_time`، `changed_by_name`، `changed_at` (null طول ما الخط على الميعاد الأساسي). |
| PUT | `/admin/timetable/return-time` | transport_admin، super_admin | `{line_ids[], return_departure_time}`. `line_ids` فاضية = كل الخطوط (وبتلغي أي ميعاد خاص اتحط قبل كده). الطلاب والطاقم بيشوفوا الميعاد الجديد على طول. بيتسجل في سجل العمليات (`return_time_changed`، منطقة جديدة `timetable`). الخطأ: `LINE_NOT_FOUND` (404). Idempotent. |

بند "رحلات المغادرة" (`/admin/departures`) في قايمة المكتب بقى **مواعيد العودة** (`/admin/return-times`).

## محتاجين ردكم على

- [ ] موافقين على قواعد العقد؟ أي تعديل دلوقتي أسهل بكتير من بعدين.
- [ ] جهاز الـ GPS هيبعت بأنهي بروتوكول (HTTP، أو MQTT، أو TCP)؟ وكل كام ثانية؟
- [ ] هتستخدموا إيه للتوكن (JWT؟) ومدته قد إيه؟
- [ ] هتبعتوا الـ OTP بـ SMS من أنهي مزود؟ ومين هيدفع تكلفته؟
- [ ] فريق السيكيوريتي: نرجع `UNKNOWN_IDENTIFIER` ولا رد واحد لكل الحالات عشان محدش يعرف مين متسجل؟
- [ ] لو الـ SOS ما اتستلمش في دقيقتين، يتصعد لمين (سوبر أدمن؟ SMS لمدير النقل؟)
- [ ] مكتبة الـ PDF العربي (WeasyPrint أو غيرها)، والتقارير الكبيرة تتعمل فورًا ولا في الخلفية؟
- [ ] المشرف حساب منفصل عن السواق؟ (الأبلكيشن عاملهم حسابين بنفس الصفحات؛ قولولنا لو ناويين حساب واحد مشترك.)
- [ ] مهلة الـ 24 ساعة كفاية؟ المكاتب شغالة من الأحد للخميس بس، فاللي يحجز الخميس بالليل مهلته هتخلص قبل البنك أو المكتب ما يفتح. نحسبها بأيام الشغل ولا نخليها 48 ساعة؟
- [ ] رفع الإيصال: base64 جوه الـ JSON (زي دلوقتي) ولا `multipart/form-data`؟ والملفات هتتخزن فين؟
- [ ] لسه محتاجين من مكتب النقل: أماكن المحطات، وعدد الكراسي الحقيقي لكل باص (الأعداد دلوقتي تقديرية).
- [ ] الربط بداتابيز القبول (بيانات الطلاب وموبايلات أولياء الأمور) هيتم إزاي؟ مستنيين رد أ. عمرو.
- [ ] ملاحظاتكم على ليستة الـ Endpoints: ناقص حاجة؟ أو فيه حاجة الأحسن تتعمل بشكل تاني؟
- [x] ~~قاعدة 11 (موافقة ولي الأمر الأول): حسابات أولياء الأمور جاية في مرحلة بعدين. لحد ساعتها الفورم بيسجل اسم ولي الأمر وموبايله وموافقته (زي التوقيع في الاستمارة الورق)، والمكتب بيكلمه يتأكد. لما ولي الأمر يبقى عنده التطبيق، الطلب يستنى في حالة جديدة `awaiting_guardian`؟~~ اترد عليها: شوف "موافقة ولي الأمر على تغيير الخط".
- [ ] سياسة الاسترداد سايبة 9 و10 أكتوبر و30 و31 أكتوبر من غير خصم محدد. دلوقتي الأيام دي بتاخد الصف اللي بعدها الأشد (50% و100%). محتاجين تأكيد من المالية.

اكتبوا ردودكم كومنتات على المستند مباشرة.
