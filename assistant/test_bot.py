"""Run the evaluation questions against the assistant and score them.

  python test_bot.py              run all 100 questions (about 7 minutes)
  python test_bot.py 45 22 81     run only these question numbers

Output: results.csv (open it in Excel) and a summary in the terminal.

Each question has an expected check:
  answer  - the reply must contain the expected words (all_of = all of them, any_of = at least one)
  unknown - the question is not covered by the documents: the reply must say the info is not available
  refuse  - the question is outside transport: the reply must decline and NOT send the student to the office
  manual  - needs a human to read the reply (for example, questions that need the routes file)
Every reply is also checked for invented emails or phone numbers.
"""
import csv
import re
import sys
import time

ALLOWED_EMAILS = {"transportation@sut.edu.eg", "finance@sut.edu.eg", "info@sut.edu.eg"}
ALLOWED_PHONES = {"01040772030", "15755"}

UNKNOWN_PHRASES = [
    "غير متوفر", "لا تتوفر", "عدم توفر", "لا توجد معلومات", "لا توجد اي", "غير متاحه", "لا يوجد ما يشير",
    "not available", "not detailed", "do not have", "no information", "isn't available", "not specified",
]
REFUSE_PHRASES = [
    "خارج نطاق", "خارج مجال", "مخصص", "يقتصر", "تقتصر", "outside my scope", "outside the scope", "dedicated",
]
OFFICE_MARKERS = ["a039", "039a"]

QUESTIONS = [
    (1, "مواعيد وصول الباصات للجامعة الساعة كام؟", 'answer', [], ["08:30", "8:30"]),
    (2, "الباص بيتحرك من الجامعة امتى آخر اليوم؟", 'answer', [], ["16:30"]),
    (3, "أقصى مدة انتظار للباص في المحطة قد إيه؟", 'answer', [], ["دقيقتان", "دقيقتين", "two minutes", "2 minutes"]),
    (4, "ينفع ميعاد الرجوع يتغير عن الساعة 4 ونص؟", 'answer', ["12:00", "20:00"], []),
    (5, "لو الباص فاتني الصبح أعمل إيه؟", 'answer', [], ["غائب", "absent", "مكتب النقل", "A039"]),
    (6, "هل في باصات بتتحرك الساعة 12 الظهر؟", 'answer', [], ["16:30", "12:00"]),
    (7, "إيه هو الرينج اللي ممكن يتغير فيه ميعاد العودة؟", 'answer', ["12:00", "20:00"], []),
    (8, "السواق بيستنى في المحطة كام دقيقة بالظبط؟", 'answer', [], ["دقيقتان", "دقيقتين"]),
    (9, "لو اتأخرت 5 دقايق عن ميعاد المحطة الباص هيستناني؟", 'answer', [], ["دقيقتان", "دقيقتين"]),
    (10, "مواعيد الركوب من المحطات ثابتة ولا بتختلف من خط للتاني؟", 'answer', [], ["تختلف", "من خط"]),
    (11, "الباص بيوصل الجامعة 8 ونص ولا 9؟", 'answer', [], ["08:30", "8:30"]),
    (12, "امتى آخر ميعاد ممكن يتحرك فيه باص العودة من الجامعة؟", 'answer', [], ["16:30"]),
    (13, "لو عندي محاضرات بتخلص بدري، هل في باصات بترجع الساعة 2؟", 'manual', [], []),
    (14, "مين المسؤول عن تغيير مواعيد العودة في الجامعة؟", 'answer', [], ["مكتب النقل"]),
    (15, "ببلغ مين لو الباص اتأخر عن ميعاده في المحطة؟", 'answer', [], ["شكوى", "مكتب النقل", "إشعار"]),
    (16, "هل في باصات يوم السبت أو الجمعة؟", 'answer', [], ["الأحد", "الخميس"]),
    (17, "إزاي أعرف ميعاد الوقوف في المحطة بتاعتي بالظبط؟", 'answer', [], ["بيانات الخطوط", "مكتب النقل", "التطبيق"]),
    (18, "ميعاد التجمع الصبح بيكون قبل التحرك بقد إيه؟", 'unknown', [], []),
    (19, "لو ميعاد العودة اتغير، بنعرف إزاي؟", 'answer', [], ["إشعار", "التطبيق"]),
    (20, "هل المواعيد في رمضان أو الامتحانات بتختلف؟", 'unknown', [], []),
    (21, "إيه هي خطوط الباصات المتاحة في الجامعة؟", 'answer', ["الإسماعيلية", "الرحاب", "المعادي", "حلوان", "الهرم"], []),
    (22, "في باص بيعدي على التجمع الخامس؟", 'manual', [], []),
    (23, "خط مدينة نصر بيقف في أنهي محطات؟", 'manual', [], []),
    (24, "أركب منين لو أنا ساكن في المعادي؟", 'answer', [], ["المعادي", "Maadi"]),
    (25, "هل في خط بيغطي منطقة أكتوبر والشيخ زايد؟", 'manual', [], []),
    (26, "إيه أقرب محطة لرمسيس أو وسط البلد؟", 'manual', [], []),
    (27, "باص الشروق والعبور بيتحرك الساعة كام؟", 'manual', [], []),
    (28, "هل في باصات بتروح الهرم وفيصل؟", 'manual', [], []),
    (29, "إزاي أعرف خط السير الكامل للباص بتاعي؟", 'manual', [], []),
    (30, "ينفع أغير المحطة اللي بركب منها في نص الترم؟", 'answer', [], ["طلب", "ولي الأمر", "مكتب النقل"]),
    (31, "ينفع أركب خط غير الخط اللي أنا مسجل فيه لو رايح عند صاحبي؟", 'answer', [], ["طلب", "ولي الأمر", "مقعد"]),
    (32, "فين مكان تجمع الباصات جوه الجامعة وقت المرواح؟", 'unknown', [], []),
    (33, "هل في خط بيعدي على الدائري؟", 'answer', [], ["الدائري"]),
    (34, "لو ساكن في الرحاب أو مدينتي، إيه الخط المناسب ليا؟", 'answer', [], ["الرحاب", "مدينتي"]),
    (35, "محطات خط مصر الجديدة إيه هي؟", 'manual', [], []),
    (36, "هل الباص بيدخل جوه الشوارع الفرعية ولا شوارع رئيسية بس؟", 'unknown', [], []),
    (37, "ممكن أطلب إضافة محطة جديدة على خط السير؟", 'unknown', [], []),
    (38, "أعرف منين رقم الباص ومكان وقوفه في الباركينج؟", 'unknown', [], []),
    (39, "خط حلوان والمقطم موجود ولا لأ؟", 'answer', [], ["حلوان"]),
    (40, "هل في باصات لمحافظات تانية بره القاهرة الكبرى زي الشرقية أو القليوبية؟", 'answer', [], ["الزقازيق", "الإسماعيلية", "السويس"]),
    (41, "إزاي أشترك في باصات الجامعة؟", 'answer', [], ["إيداع", "الفيزا", "فيزا"]),
    (42, "سعر اشتراك الباص في الترم كام؟", 'answer', [], ["15,000", "15000"]),
    (43, "هل ينفع أدفع اشتراك الباص على قسطين؟", 'unknown', [], []),
    (44, "ينفع أركب الباص ليوم واحد بس وأدفع تذكرة يومية؟", 'unknown', [], []),
    (45, "لو دفعت الاشتراك وعايز ألغيه، هل بسترد الفلوس؟", 'answer', ["100%", "اليوم"], []),
    (46, "إيه الأوراق المطلوبة للاشتراك في خدمة النقل؟", 'answer', [], ["إيصال", "الدفع"]),
    (47, "هل الدفع بيكون كاش ولا فيزا ولا إنستا باي؟", 'answer', [], ["إيداع", "فيزا"]),
    (48, "أروح لمكتب مين في الجامعة عشان أسجل في الباص؟", 'answer', [], ["A039", "039A"]),
    (49, "هل لازم يكون معايا كارنيه الجامعة أو كارنيه الباص وأنا راكب؟", 'answer', [], ["بطاقة", "كارنيه"]),
    (50, "لو نسيت كارنيه الباص في البيت، السواق هيرضى يركبني؟", 'unknown', [], []),
    (51, "هل في غرامة لو ركبت باص من غير اشتراك؟", 'answer', [], ["الرسوم", "رسوم"]),
    (52, "ينفع أحجز كرسي معين في الباص طول الترم؟", 'answer', [], ["تنظيم", "الجلوس", "لا تتوفر", "غير متوفر"]),
    (53, "إيه القواعد اللي لازم ألتزم بيها جوه الباص؟", 'answer', [], ["التدخين", "الأقدام"]),
    (54, "مسموح بالأكل والشرب جوه الباص؟", 'answer', [], ["غير مسموح", "ممنوع", "لا"]),
    (55, "لو نسيت حاجة في الباص (موبايل أو شنطة) أوصلها إزاي؟", 'unknown', [], []),
    (56, "إزاي أقدم شكوى لو حصلت مشكلة في الباص؟", 'answer', [], ["التطبيق", "مكتب النقل"]),
    (57, "هل في مشرف في كل باص ولا السواق بس؟", 'answer', [], ["مشرف", "لا تتوفر", "غير متوفر"]),
    (58, "أقدر أتواصل مع سواق الباص مباشرة؟", 'answer', [], ["الطوارئ", "المشرف"]),
    (59, "لو نقلت سكني في نص السنة، إجراءات تغيير الخط إيه؟", 'answer', [], ["ولي الأمر"]),
    (60, "هل الاشتراك شامل الترمين ولا كل ترم لوحده؟", 'answer', ["15,000", "30,000"], []),
    (61, "What time do the buses arrive at the university?", 'answer', [], ["08:30", "8:30"]),
    (62, "When do buses depart from the campus in the afternoon?", 'answer', [], ["16:30"]),
    (63, "How long does the bus wait at each pickup station?", 'answer', [], ["two minutes", "2 minutes"]),
    (64, "Can the return time be changed?", 'answer', [], ["12:00", "20:00"]),
    (65, "What is the time window for afternoon bus departures?", 'answer', [], ["12:00"]),
    (66, "How can I know the exact pickup time for my station?", 'answer', [], ["lines data", "Transportation", "A039"]),
    (67, "What happens if I miss the morning bus?", 'answer', [], ["absent", "A039", "Transportation"]),
    (68, "Are there buses going to New Cairo?", 'answer', [], ["New Cairo"]),
    (69, "How do I subscribe to the university transport service?", 'answer', [], ["deposit", "Visa"]),
    (70, "Can I take a different bus route than my registered one?", 'answer', [], ["parent", "guardian", "seat"]),
    (71, "Where do I report a lost item on the bus?", 'unknown', [], []),
    (72, "Is there a bus route for Maadi or Nasr City?", 'answer', [], ["Maadi", "Nasr City"]),
    (73, "Who decides if the return bus schedule changes?", 'answer', [], ["Transportation"]),
    (74, "What are the rules for riding the university bus?", 'answer', [], ["smoking", "feet"]),
    (75, "Do I need to show my student ID to board the bus?", 'answer', [], ["ID"]),
    (76, "Can I pay for a single ride without a semester subscription?", 'answer', [], ["not available", "not detailed", "prescribed", "subscription"]),
    (77, "What is the maximum waiting time at any bus stop?", 'answer', [], ["two minutes", "2 minutes"]),
    (78, "Who should I contact if the bus is late?", 'answer', [], ["Transportation", "complaint", "delay"]),
    (79, "Are bus schedules the same for all routes?", 'answer', [], ["differ", "No"]),
    (80, "Where do buses park inside the university?", 'unknown', [], []),
    (81, "ممكن تكتبلي كود بايثون يطبع الأرقام من 1 لـ 10؟", 'refuse', [], []),
    (82, "هي نتيجة امتحانات الميدتيرم هتظهر امتى؟", 'refuse', [], []),
    (83, "طريقة عمل المكرونة بالبشاميل إيه؟", 'refuse', [], []),
    (84, "سعر الدولار النهاردة كام في البنك؟", 'refuse', [], []),
    (85, "مين هو عميد كلية تكنولوجيا الهندسة في جامعة السويدي؟", 'refuse', [], []),
    (86, "مصاريف كلية الذكاء الاصطناعي في جامعة السويدي كام؟", 'refuse', [], []),
    (87, "تفتكر الأهلي هيكسب الماتش الجاي؟", 'refuse', [], []),
    (88, "إزاي أعمل فيزا شنجن لألمانيا؟", 'refuse', [], []),
    (89, "الباص فيه واي فاي وشاشات عرض ولا لأ؟", 'unknown', [], []),
    (90, "هل الجامعة بتوفر طيارات هليكوبتر للطلاب المستعجلين؟", 'manual', [], []),
    (91, "ينفع أسوق أنا الباص مكان السواق لو هو تعبان؟", 'answer', [], ["14", "ممنوع", "لا يجوز", "الطوارئ"]),
    (92, "مسموح أجيب القطة أو الكلب بتاعي معايا في الباص؟", 'unknown', [], []),
    (93, "أحسن لابتوب للبرمجة في حدود 30 ألف جنيه إيه؟", 'refuse', [], []),
    (94, "درجة الحرارة بكرة في القاهرة كام؟", 'refuse', [], []),
    (95, "ملخص محاضرة الداتا بيز اللي فاتت إيه؟", 'refuse', [], []),
    (96, "Who won the World Cup in 2022?", 'refuse', [], []),
    (97, "Write an essay about artificial intelligence.", 'refuse', [], []),
    (98, "لو عايز أحول من قسم الذكاء الاصطناعي لقسم تاني أعمل إيه؟", 'refuse', [], []),
    (99, "كافيتريا الجامعة بتقفل الساعة كام؟", 'refuse', [], []),
    (100, "هل السواق بيعرف يتكلم فرنساوي؟", 'unknown', [], []),
]


def norm(s):
    s = s.lower()
    s = re.sub(r"[\u064b-\u065f\u0640]", "", s)  # diacritics and tatweel
    for a, b in (("أ", "ا"), ("إ", "ا"), ("آ", "ا"), ("ى", "ي"), ("ة", "ه")):
        s = s.replace(a, b)
    return s


def has_any(text, phrases):
    t = norm(text)
    return any(norm(p) in t for p in phrases)


def invented_contacts(text):
    bad = []
    for e in re.findall(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+", text):
        if e.lower() not in ALLOWED_EMAILS:
            bad.append(e)
    for p in re.findall(r"\b01\d{9}\b", text):
        if p not in ALLOWED_PHONES:
            bad.append(p)
    return bad


def check(tag, all_of, any_of, response):
    """Return (verdict, reason). verdict is PASS, FAIL or REVIEW."""
    bad = invented_contacts(response)
    if bad:
        return "FAIL", "invented contact: " + ", ".join(bad)
    if tag == "manual":
        return "REVIEW", "needs a human reader"
    if tag == "answer":
        missing = [w for w in all_of if not has_any(response, [w])]
        if missing:
            return "FAIL", "missing: " + ", ".join(missing)
        if any_of and not has_any(response, any_of):
            return "FAIL", "none of: " + ", ".join(any_of)
        return "PASS", ""
    if tag == "unknown":
        return ("PASS", "") if has_any(response, UNKNOWN_PHRASES) else ("FAIL", "did not say the info is unavailable")
    if tag == "refuse":
        if not has_any(response, REFUSE_PHRASES):
            return "FAIL", "did not decline"
        if has_any(response, OFFICE_MARKERS):
            return "FAIL", "declined but still sent the student to the office"
        return "PASS", ""
    return "REVIEW", "unknown tag"


def run():
    from app import chat_endpoint, ChatRequest  # imported here so check() can be tested without the app

    wanted = {int(a) for a in sys.argv[1:] if a.isdigit()}
    todo = [q for q in QUESTIONS if not wanted or q[0] in wanted]
    print(f"Running {len(todo)} questions...\n")

    rows = []
    for n, (i, question, tag, all_of, any_of) in enumerate(todo, 1):
        print(f"[{n}/{len(todo)}] Q{i}: {question}")
        try:
            res = chat_endpoint(ChatRequest(question=question))
            status = res.get("status", "unknown")
            response = (res.get("response") or "").strip()
        except Exception as e:
            status, response = "error", f"{type(e).__name__}: {e}"
        if status != "success":
            verdict, reason = "FAIL", "API error"
        else:
            verdict, reason = check(tag, all_of, any_of, response)
        print(f"        -> {verdict} {reason}")
        rows.append([i, tag, question, verdict, reason, status, response])
        if n < len(todo):
            time.sleep(4)  # stay under the free-tier rate limit

    with open("results.csv", "w", encoding="utf-8-sig", newline="") as f:  # utf-8-sig so Excel shows Arabic
        w = csv.writer(f)
        w.writerow(["id", "check", "question", "verdict", "reason", "status", "response"])
        w.writerows(rows)

    total = len(rows)
    passed = sum(r[3] == "PASS" for r in rows)
    failed = sum(r[3] == "FAIL" for r in rows)
    review = sum(r[3] == "REVIEW" for r in rows)
    scored = passed + failed
    print("\n" + "=" * 50)
    print(f"Questions: {total}   PASS: {passed}   FAIL: {failed}   REVIEW (read by a human): {review}")
    if scored:
        print(f"Automatic score: {passed}/{scored} = {100 * passed / scored:.0f}%  (REVIEW questions not counted)")
    if failed:
        print("\nFailed questions:")
        for r in rows:
            if r[3] == "FAIL":
                print(f"  Q{r[0]}: {r[4]}")
    print("\nFull results saved in results.csv")


if __name__ == "__main__":
    run()
