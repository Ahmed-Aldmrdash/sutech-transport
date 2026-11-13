# Frontend–Backend Agreement – SUtech Transport

Nov 8, 2026 · Ahmed Aldmrdash

The frontend (PWA) is being built from scratch on mock data. The backend (Python + FastAPI) will implement the same requests in exactly the same shape. **This document is the source of truth**: if the frontend and this document disagree, the document wins until we agree on a change and record it here.

**New in the Nov 1 version:** login is now two steps (`/auth/otp`, then `/auth/login`) for every role, the full SOS flow, and report export to Excel and PDF. The Transportation Department asked for all three officially.

**Nov 1 update (after frontend phase 1):** extra fields in the login responses (`code_length`, `resend_after_seconds`, `expires_at`), a new `OTP_EXPIRED` error, each new code cancels the previous one, and general error codes are now upper case. Details are in "Two-step login".

**Nov 2 update (after frontend phase 3):** student requests (line change on the university form, refund under the refund policy, complaints) with status tracking, notifications with an unread count, an announcements page, and settings. 10 new requests; the old `/requests` and `/complaints` rows are replaced. Details are in "Student: requests, notifications and settings".

**Nov 2 update (after frontend phase 2, the student pages):** booking, payment and the digital card, built on the real university data (23 lines, EGP 15,000 per term, the NBE account). **Fawry and InstaPay are removed**: payment is only a bank deposit/transfer with a receipt upload, or a Visa card at the Accounting office. New requests: cancel a booking, payment instructions, my payments, and the next trip. Details are in "Student: booking, payment and the card".

## How we work

1. The frontend is built first, and all of its data access lives in `api.ts` files that return mock data.
2. The shape of every request and response is written in Zod, and an `openapi.json` file is generated from it automatically. That file is the final reference and will live in the repo.
3. The backend implements the same requests with the same shapes in FastAPI. Any change to a request's shape must be agreed first and recorded in that file.
4. At hand-off, the frontend only changes the server address; the screens do not change.

| Team | Responsible for |
| --- | --- |
| Frontend (Ahmed) | All screens, Arabic and English, the PWA, and the contract file |
| Backend | Server and database (PostgreSQL), login, permissions, business rules, receiving the GPS device location, notifications, and reports |
| AI | The chat endpoint `/api/v1/chat` |
| Security | Permission review, QR security, and penetration testing |

Note: the bus location comes from a GPS device installed in the bus and goes straight to the backend. It does not come from the driver's phone.

## Contract rules

| Rule | Agreement |
| --- | --- |
| Endpoints | REST + JSON, all starting with `/api/v1/` |
| Field names | `snake_case` (e.g. `student_id`) |
| IDs | Strings; the university ID is 9 digits (e.g. `240100101`) |
| Dates | ISO 8601 in UTC (e.g. `2026-10-29T06:30:00Z`); the frontend converts to Egypt time |
| Money | Integer in piastres (e.g. `150000` = EGP 1,500) |
| Statuses | Fixed English values (e.g. subscription: `reserved` / `payment_review` / `active` / `expired` / `cancelled`) |
| Timetable times | Times of day on the timetable (pickup, campus arrival, return) are `"HH:MM"` in Egypt time, not UTC (e.g. `"07:40"`). Calendar dates are `"YYYY-MM-DD"` (e.g. `"2026-11-01"`) |
| Errors | Correct HTTP status + `{ "code": "SEAT_UNAVAILABLE", "message": "..." }`; the frontend translates the `code`. Codes are always UPPER_SNAKE_CASE; the general ones are `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `VALIDATION_ERROR` (422), `RATE_LIMITED` (429), `INTERNAL_ERROR` (500) |
| Auth | An **HttpOnly, Secure, SameSite=Lax session cookie** set by `/auth/login` and sent with every request (the frontend uses `credentials: "include"`); the page never sees the token. Updated Nov 8 (security audit) |
| Long lists | `?page=1&page_size=20`, response `{ items, total }`. Exceptions (short lists, no paging): `GET /lines`, `/payments/me`, `/requests/me` return an array; `GET /admin/sos` and `/violations/mine` return `{ items }` |
| Language | The frontend sends `Accept-Language: ar` or `en` |
| Duplicate prevention | Every request that changes something (booking, cancel, receipt, SOS) carries an `Idempotency-Key` header (a UUID), so if it is sent twice it runs once and the second call gets the same response |

## Roles and permissions

The frontend hides pages, but **the server must reject** any request outside the caller's permissions (`403`), even if someone sends it by hand.

| Role (`role`) | Allowed to |
| --- | --- |
| `super_admin` | Sees everything; the only role that creates accounts and assigns permissions. **View only** on the SOS/clinic desk and the bus company's portal: the offices that own them act there. |
| `transport_admin` | Operations (tracking, emergencies, attendance, lines, buses, announcements), violations, complaints, events, and operations reports |
| `finance` | Payments, refunds, and financial reports |
| `clinic` | The clinic and medical emergencies only |
| `student_affairs` | Violations |
| `secretary_general` | Their own page and reports (read-only) |
| `bus_company` | The Abu El-Hol portal only |
| `driver` / `supervisor` | Only the trip assigned to them |
| `student` | Only their own data |
| `parent` | Only the children linked to them |

Every admin action is written to the audit log (who did what, and when).

## Initial endpoints

This is a first version so you can start designing the database. The detailed response shapes will be in `openapi.json` with each frontend phase. Paths are shown without `/api/v1`.

| Request | Who | What it does |
| --- | --- | --- |
| `POST /auth/otp` | Everyone | Step 1: university ID, staff ID, or parent phone; the server sends a code to the registered phone |
| `POST /auth/login` | Everyone | Step 2: the same identifier + the code; sets the session cookie (the session carries the role) |
| `POST /auth/logout` | Everyone | End the session and clear the cookie |
| `GET /me` | Everyone | Their profile and role |
| `GET /lines` · `GET /lines/{id}` | Everyone | Lines, stops, morning times, price, bus type and free seats |
| `GET /subscriptions/me` | Student | Their subscription status |
| `POST /subscriptions` | Student | Reserve a seat (24-hour window to pay) |
| `POST /subscriptions/{id}/cancel` | Student | Cancel an unpaid booking and free the seat |
| `GET /payments/instructions` | Student | Amount due, the bank account, and the office rooms and hours |
| `GET /payments/me` | Student | Their receipts and payments with each one's status |
| `POST /payments/receipt` | Student | Upload a bank deposit or transfer receipt |
| `GET /card/me` | Subscribed student | Pass details and a signed, rotating QR code |
| `GET /absences/me` · `POST /absences` · `POST /absences/{id}/cancel` | Active subscriber | "Not going": the reported days from today on plus the days still reportable; report a day (reason + optional note); take it back before the cutoff |
| `GET /attendance/me?outcome=&page=&page_size=` | Student | "My trips": each trip with boarding/arrival/check-out times and outcome (`rode` / `absent` / `not_going` / `checked_out`), plus a summary count |
| `GET /requests/me` · `GET /requests/{id}` | Student | Their line change, refund and complaint requests with status history |
| `POST /requests/line-change` · `/refund` · `/complaint` | Student | Send a request (details below) |
| `POST /requests/{id}/withdraw` | Student | Withdraw a request the office hasn't opened |
| `GET /requests/refund-policy` | Student | Refund table, today's deduction, amount paid |
| `GET /trips/next` | Subscribed student | Their next trip: date, stop, bus, and status/ETA |
| `GET /announcements?kind=&page=&page_size=` | Everyone | Official announcements and delays (all students or their line) |
| `GET /notifications` · `POST /notifications/{id}/read` · `POST /notifications/read-all` | Everyone | Notifications and the unread count |
| `POST /chat` | Student | The AI assistant (AI team) |
| `GET /parent/children` | Parent | Their children |
| `GET /parent/children/{id}/timeline?date=` | Parent | Their child's day |
| ~~`POST /requests/{id}/parent-decision`~~ | Parent | Removed: use `POST /parent/approvals/{request_id}/approve` or `/refuse` (see "Guardian approval") |
| `GET /driver/trip/today` | Driver / Supervisor | Their trip and passenger list |
| `POST /trips/{id}/start` · `POST /trips/{id}/end` | Driver | Start and end (outbound or return) |
| `POST /trips/{id}/scan` | Driver / Supervisor | Scan a pass: `board` or `checkout` + reason |
| `POST /trips/{id}/delay` | Driver | Report a delay |
| `POST /sos` | Driver / Supervisor | Emergency: `medical` / `breakdown` / `accident` (details below) |
| `GET /sos/{id}` | Whoever raised it | Follow the status of their SOS |
| `POST /violations` | Driver / Supervisor | Violation with a photo |
| `GET /admin/live` | Transport admin | All buses and their locations |
| `GET /admin/trips/{id}/riders` | Transport admin | Who has boarded and who hasn't yet |
| `GET /admin/sos?status=` · `GET /admin/sos/{id}` | Transport / Clinic | List of SOS alerts, and one alert with its log |
| `POST /admin/sos/{id}/actions` | Transport / Clinic | Action: acknowledge, ambulance, replacement bus, note, close |
| `POST /admin/trips/{id}/replacement` | Transport admin | Replacement bus, or swap bus/driver |
| `GET /admin/attendance?date=&line=` | Transport admin | Attendance, absences and check-outs |
| `GET /admin/lines/{id}/students` | Transport admin | Students on each line |
| CRUD `/admin/lines` · `/admin/buses` · `/admin/drivers` · `/admin/timetable` | Transport admin | Lines, buses, drivers and return times |
| `POST /admin/announcements` | Transport admin | Official announcement to all students or one line |
| `GET /admin/payments` · `PATCH /admin/payments/{id}` | Finance | Review receipts |
| `GET /admin/requests` · `PATCH /admin/requests/{id}` | Finance / Transport | Requests and refunds |
| `GET /admin/violations` · `GET /admin/complaints` | By role | Follow-up |
| `GET /admin/reports` | By role | The report types this role may see |
| `GET /admin/reports/{type}?format=&line=&from=&to=` | By role | The report on screen (`json`) or exported (`xlsx` / `pdf`) |
| `GET /admin/audit` | Super admin | Audit log |
| CRUD `/admin/users` | Super admin | Accounts and permissions |
| `/admin/clinic` · `/admin/sg/*` · `/admin/events/*` · `/bus-company/*` | By role | Clinic, Secretary General, events, and Abu El-Hol (phase 7 section below) |
| `POST /gps/ingest` | GPS device | Receive location (with a device key, not a user token) |

## Two-step login (OTP)

Every role logs in the same way, with no password. Parents now log in through the same requests with their phone number, so `/auth/parent/otp` and `/auth/parent/verify` are removed.

| Step | Request | Response |
| --- | --- | --- |
| 1. Ask for a code | `POST /auth/otp` `{ "identifier": "240100101" }` | `{ "masked_destination": "010•••••001", "name_hint": "Ziad", "expires_in_seconds": 300, "attempts_left": 3, "code_length": 4, "resend_after_seconds": 60 }` |
| 2. Log in | `POST /auth/login` `{ "identifier": "240100101", "code": "4821" }` | Sets the session cookie; body `{ "expires_at": "2026-11-02T06:00:00Z", "user": { id, role, name, identifier, faculty, level, guardian_name, masked_phone } }` |
| Log out | `POST /auth/logout` (clears the cookie) | `{ "ok": true }` |
| Who am I | `GET /me` (with the cookie) | The same `user` as in the login response, or 401 if the token expired or was revoked |

- `identifier`: a 9-digit university ID for students, a staff ID or email for staff, or the parent's phone. The code goes only to the registered phone, and the response returns it masked.
- The code is 4 to 6 digits, valid for 5 minutes, with 3 attempts, and is deleted once used. Resend at most once every 60 seconds.
- `code_length`: how many digits the code has, so the screen submits as soon as it's complete. `resend_after_seconds`: when the "Resend code" button unlocks.
- Each new code cancels the previous one; only the latest code works.
- `expires_at`: when the token stops working (UTC). The frontend signs the user out at exactly that moment, and also as soon as any request returns 401.
- `masked_destination` can be a masked phone or email (e.g. `ah•••@sut.edu.eg`); the frontend shows it as is. So if you decide to send the code by email, the frontend doesn't need to change.
- Errors: `UNKNOWN_IDENTIFIER` (404), `ACCOUNT_DISABLED` (403), `INVALID_OTP` (400), `OTP_EXPIRED` (400), `OTP_LOCKED` (429), `OTP_RATE_LIMITED` (429).
- Only in the test environment may the response include `demo_code`; it must never appear in production.

## Student: booking, payment and the card

Built in frontend phase 2 on the data the university sent on Nov 2. The full shapes are in `openapi.json` in the repo; this section is the summary.

**Lines.** 23 lines (lines 1 and 14 have two buses each, so there are 25 routes). Every line costs EGP 15,000 a term (`price_piasters: 1500000`). Every bus reaches campus at 08:30, as the university's Routes file says (`campus_arrival: { "from": "08:30", "to": "08:30" }`; `from` equal to `to` means one time, not a window). Every bus leaves campus at 16:30 unless the office sets another time for its line (`return_departure_time`).

| Field | Meaning |
| --- | --- |
| `code` | The university's line number as written ("5", "14-2") |
| `bus_type` | `minibus` / `coaster` / `midibus` / `large_bus` |
| `seats_total` · `seats_available` | Capacity and free seats. Today every bus is treated as full (subscribers = capacity) |
| `first_pickup_time` · `stops[].pickup_time` | `"HH:MM"` Egypt time, or `null` |
| `return_departure_time` | When the bus leaves campus, "HH:MM". Today 16:30 for every line; the office changes it on the Return times page |
| `stops[].location` | `{ lat, lng }`, or `null` until the office sends the real stop locations |
| `stops[].note` | Landmark from the office ("in front of Lulu Market"), or `null` |

The campus itself is not returned as a stop. Names come in the language of `Accept-Language`.

**Subscription statuses:**

| `status` | Meaning | What the student sees |
| --- | --- | --- |
| `reserved` | Seat held, not paid yet; `hold_expires_at` says until when | Payment page + countdown |
| `payment_review` | A receipt was sent and finance is reviewing it; the seat stays held | "Under review" |
| `active` | Finance approved; `activated_at` is set | The digital card |
| `expired` | The hold ended with no receipt; the seat went back | "Book again" |
| `cancelled` | The student cancelled before paying | "Book again" |

`GET /subscriptions/me` returns `{ "subscription": null }` for a student who never booked (not 404). The response includes `latest_payment` so the home page can show a rejection reason. If finance rejects a receipt, the subscription goes back to `reserved` with a new 24-hour hold.

**Booking:** `POST /subscriptions` `{ "line_id": "ln_05", "stop_id": "ln_05_s3" }` → the subscription with `status: "reserved"`. Errors: `SEAT_UNAVAILABLE` (409), `ALREADY_SUBSCRIBED` (409), `STOP_NOT_ON_LINE` (422), `LINE_NOT_FOUND` (404). Cancel: `POST /subscriptions/{id}/cancel`, only while `reserved`; otherwise `NOT_CANCELLABLE` (409).

**Payment.** Only two ways, from the university's reply:
1. A deposit or transfer to the university account at the National Bank of Egypt, then the student uploads the receipt in the app.
2. A Visa card at the Accounting office (room A045). Finance records it from the dashboard (`method: "card_at_office"`), and the student uploads nothing.

`GET /payments/instructions` returns the amount, the bank details (`bank_name`, `account_name`, `account_number`, `iban`, `swift_code`, `currency`), `cashier_room` (A045), `transport_room` (A039), `office_hours`, and the file limits. The bank details come from the server, so finance can change them without a new frontend release.

`POST /payments/receipt` (with `Idempotency-Key`):

```json
{
  "subscription_id": "sub_...", "method": "bank_deposit",
  "reference_number": "NBE-12345678", "amount_piasters": 1500000,
  "paid_on": "2026-11-01", "payer_name": "Mohamed Aldmrdash",
  "receipt": { "file_name": "slip.jpg", "content_type": "image/jpeg", "data_base64": "..." }
}
```

- `method`: `bank_deposit` or `bank_transfer`. The file is JPG, PNG or PDF, at most 5 MB, sent as base64 inside the JSON (if you prefer `multipart/form-data`, tell us now).
- `payer_name` is the account holder or depositor (often a parent).
- Payment statuses: `pending_review` → `approved` or `rejected` (+ `rejection_reason`).
- Errors: `HOLD_EXPIRED` (409), `NOT_AWAITING_PAYMENT` (409), `RECEIPT_ALREADY_USED` (409), `RECEIPT_TOO_LARGE` (413), `AMOUNT_MISMATCH` (422).

**Digital card:** `GET /card/me` returns the student, line, stop, term and `valid_until`, plus `qr: { token, expires_at }`. The token lasts 30 seconds and is signed by the server; the frontend fetches a new one 3 seconds before it ends. Not subscribed → `NOT_SUBSCRIBED` (403).

**Next trip:** `GET /trips/next` returns `{ "trip": null }` when there is none (not subscribed, or no service). Otherwise: `service_date`, `direction` (`outbound` / `return`), line, stop and its time, `campus_arrival`, `bus { bus_type, plate }` or `null`, and `status` (`scheduled` / `approaching` / `passed_stop` / `arrived`) with `eta_minutes`, `near_stop` and `location_updated_at` from the bus GPS. The frontend refreshes it every minute until the WebSocket is ready. Service days are Sunday to Thursday.

## Student: requests, notifications and settings

Built in frontend phase 3. The full shapes are in `openapi.json` (26 paths); this section is the summary.

**Three kinds of request**, all under `/requests`, each with a status history:

| `kind` | Based on | Needs |
| --- | --- | --- |
| `line_change` | The university's "طلب تغيير خط السير" form | Active subscription |
| `refund` | Refund Policy 2026-2027 | Active subscription with an approved payment |
| `complaint` | — | `payment` complaints: any booking. All other categories: active subscription |

| Request | What it does |
| --- | --- |
| `GET /requests/me?kind=` | The student's requests, newest first |
| `GET /requests/refund-policy` | The term's refund table, today's deduction (Cairo date), the amount paid, `payout_days` (45), `processing_days` (3) |
| `GET /requests/{request_id}` | One request (another student's → 404) |
| `POST /requests/line-change` | New line + stop, `permanent` / `temporary` (`starts_on`, `ends_on`), reason, student phone, guardian name + phone + `guardian_consent: true` |
| `POST /requests/refund` | `reason`: `standard` / `medical` / `bereavement` / `transfer`, explanation, guardian fields, `documents[]` (same file shape as receipts, max 3) |
| `POST /requests/complaint` | `category`: `driver_behaviour` / `delay` / `bus_condition` / `crowding` / `safety` / `payment` / `other`, `line_id` or null, `happened_on`, description, `attachments[]` (max 3) |
| `POST /requests/{request_id}/withdraw` | Only while `submitted` |

Register `/requests/me` and `/requests/refund-policy` before `/requests/{request_id}` in FastAPI. Every POST takes `Idempotency-Key`.

**Statuses:** `submitted` → `in_review` → `approved` / `rejected` (line change, refund) or `resolved` (complaint); `withdrawn` by the student. Each request has `reference` ("REQ-2026-0042", to quote at the office) and `timeline[]`: `{ status, at, by: student | transport_office | finance, note }`. The office's reply to the student is the `note`, in the request's language.

**Refund rules (from the policy):** 25% deducted Sep 20 – Oct 8, 50% Oct 11 – Oct 29, 100% from Nov 1. An ordinary refund at 100% → `REFUND_WINDOW_CLOSED` (422). `medical`, `bereavement` (and disability) are decided by the university with documents; `transfer` needs the transfer letter; no document → `DOCUMENTS_REQUIRED` (422). Their `estimated_refund_piasters` is `null`. Money comes back by a cheque in the guardian's name within 45 days; the student brings the original receipt to A039. An approved refund cancels the subscription.

**Other errors:** `NO_ACTIVE_SUBSCRIPTION` (409), `NO_SUBSCRIPTION` (409, payment complaint with no booking), `REQUEST_ALREADY_OPEN` (409, one open request per kind), `SAME_LINE` (422), `INVALID_DATES` (422: start in the past, end before start, or outside the term; complaint date in the future), `NOT_WITHDRAWABLE` (409), plus `LINE_NOT_FOUND`, `STOP_NOT_ON_LINE`, `RECEIPT_TOO_LARGE`. An approved permanent line change moves the subscription to the new line and stop from `starts_on`.

**Notifications:** `GET /notifications?page=&page_size=&unread_only=` → `{ items, total, unread_count }`; `POST /notifications/{id}/read` and `POST /notifications/read-all` → `{ unread_count }`. Each item: `kind` (`bus_near`, `bus_delayed`, `payment_approved`, `payment_rejected`, `request_update`, `announcement`), `title`, `body` (Accept-Language), `created_at`, `read_at` or null, and `link: { target, id }`. `target` is a page name, not a URL: `home` / `tracking` / `payment` / `card` / `request` / `complaint` / `announcements`, with the request id for `request` and `complaint`. The server creates them: bus 5 minutes from the student's stop (GPS), a delay announcement on their line, each receipt decision, each request status change, and each new announcement. Until the WebSocket is ready the app checks the unread count every minute and when it comes back to the foreground.

**Not going and my trips (Nov 2, phase 3):** "Not going" covers one whole service day (both trips), up to 7 days ahead, Sunday to Thursday. The cutoff is when the bus leaves the first stop of the student's line that day; after it a day can't be reported or taken back (`ABSENCE_CUTOFF_PASSED`, 409). Other errors: `NO_ACTIVE_SUBSCRIPTION` (409), `DATE_NOT_REPORTABLE` (422), `ALREADY_REPORTED` (409). Each absence: `absence_id`, `service_date`, `reason` (`sick` / `no_lectures` / `personal` / `other`), `note` or null, `created_at`, `cutoff_at`. `GET /absences/me` → `{ upcoming, reportable_days: [{ service_date, cutoff_at }] }`. My trips → `{ items, total, summary: { rode, absent, not_going, checked_out } }`; each item has `trip_id`, `service_date`, `direction`, `line`, `stop_name`, `outcome`, `boarded_at`, `arrived_at`, `checked_out_at`, `checkout_reason` (Accept-Language). Return trips appear once return times exist.

**Announcements:** `GET /announcements` now also takes `kind` (`official` / `delay` / `service_change`). The student page lists and filters them; publishing is the admin page (later phase).

**Settings** need no new endpoint: language and theme (light / dark / device) are kept on the device, and sign-out uses `POST /auth/logout`.

## Emergencies (SOS)

The driver or supervisor presses SOS and picks the type. The server adds the bus location from the GPS device in the bus (not from the phone) and sends a live alert to the transport team immediately.

**Request:** `POST /sos` with an `Idempotency-Key`

```json
{ "trip_id": "trp_812", "type": "breakdown", "note": "Engine failure" }
```

| Type (`type`) | Goes to | Usual response |
| --- | --- | --- |
| `medical` | Transport + Clinic | The clinic doctor guides; ambulance if needed |
| `breakdown` | Transport | Short delay or a replacement bus |
| `accident` | Transport + Clinic | Ambulance if anyone is hurt, and a replacement bus to finish the trip |

**What the server stores and returns:**

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

**Statuses:** `open` → `acknowledged` → `closed`. Each action is sent to `POST /admin/sos/{id}/actions` and logged with who and when:

| `action` | What it does |
| --- | --- |
| `acknowledge` | Someone took the alert; the driver sees "Admin received it" |
| `ambulance_called` | An ambulance was called |
| `replacement_sent` | Replacement bus (`bus_id`), linked to `POST /admin/trips/{id}/replacement` |
| `note` | Free-text note |
| `close` | Close; requires a summary of what was done |

**Automatic notice:** as soon as the SOS is raised, students on that trip and their parents get a notification (in-app + Web Push) in calm wording with no medical details. When a replacement bus is sent or the alert is closed, they get an update.

## Report export (Excel and PDF)

`GET /admin/reports/{type}?format=xlsx&line=ln_04&from=2026-11-01&to=2026-11-30`. `format` is `json` (shown on screen, same `{ items, total }`), `xlsx`, or `pdf` (file download). `line` is optional; without it the report covers all lines.

| Report (`type`) | Main columns | Who can see it |
| --- | --- | --- |
| `roster` | University ID, name, department, year, line, stop, subscription status | Transport, Finance, Secretary General |
| `payments` | Receipt number, student, amount, method, status, date, reviewed by | Finance, Secretary General |
| `attendance` | Day, outbound/return, student, boarding and arrival time, check-out and reason, absent or "not going" | Transport, Secretary General |
| `seat_occupancy` | Line, bus, capacity, subscribers, average riders, occupancy % | Transport, Finance, Secretary General |

- The super admin sees all of them; any role not in the table gets `403`. Access is checked on the server, not only by hiding the button.
- File names look like `sutech_attendance_ln_04_2026-11-01_2026-11-30.xlsx`. The PDF is Arabic RTL with the official logo, and shows the filter and the time it was generated.
- Money in the files is in pounds (not piastres), and times are in Egypt time.
- Every export is written to the audit log.

## Live events (WebSocket)

One connection, `wss://.../api/v1/ws` (the session cookie authenticates it, no token in the URL), and the server sends each user only what concerns them. Every message has the shape `{ "type": "...", "data": {...} }`.

| `type` | Sent to | Contains |
| --- | --- | --- |
| `bus.location` | Students and parents on the line, and admins | Bus, lat/lng, time, and expected arrival |
| `trip.status` | Same as above | Started, delayed, arrived, bus replaced |
| `attendance.event` | Parent and admins | Boarded, arrived, checked out (reason), absent |
| `sos.new` / `sos.update` | Transport admin, and the clinic if medical | Type, bus, GPS location, status, and latest action (affected students and parents only get notification.new) |
| `notification.new` | The notification's owner | New notification |

The bus location is sent roughly every 2 to 5 seconds (depending on the GPS device). Important notifications (absence, check-out, SOS) also need Web Push so they arrive while the app is closed.

## Business rules the server must enforce

The frontend blocks these on screen, but the server has the final say:

1. Only one active subscription per student, and only one open request of each kind at a time.
2. A booking holds a seat for 24 hours; if no receipt arrives, the seat is released. While a receipt is under review the seat stays held. The price is fixed at booking time.
3. A receipt reference number can't be used twice, the amount must not be less than the price, and the file is at most 5 MB. Payment is bank or office Visa only (no Fawry, no InstaPay).
4. Tracking, the pass, requests and "not going" are for active subscribers only. Payment complaints are allowed after booking; all other complaints after activation.
5. The QR code is signed and expires after 30 seconds, and scanning rejects any pass that is cancelled or not on this line.
6. Automatic absence: when the outbound trip ends, any subscriber who wasn't scanned is marked absent (unless they reported "not going"), and their parent is notified.
7. Mid-trip check-out: scan with `checkout` + a reason, and the parent is notified immediately (no approval needed).
8. "Not going today" reaches the admins, the driver and the parent.
9. An SOS is delivered immediately with the bus location from the GPS device, and can only be closed once an admin has received it and recorded what was done. The action log can't be edited or deleted, and students and parents on the trip are notified automatically. A repeated press with the same `Idempotency-Key` does not create a second SOS.
10. Swapping the bus or driver must not break the trip: passengers and attendance move with it, and the swap is logged.
11. Parent approval is the first step for refunds and line changes; the admins act after that.
12. Login: an OTP code can't be used twice, and after 3 wrong attempts the account is locked temporarily.
13. Reports: each role exports only what it is allowed to, and the same filter gives the same numbers in `json`, `xlsx` and `pdf`.

## Guardians and live tracking (phase 4 update, 2026-11-03)

| Method | Path | Role | What it does |
|---|---|---|---|
| GET | `/parent/children` | parent | The students linked to this guardian (by the guardian's phone on the student's file), each with this term's booking. |
| GET | `/parent/children/{student_id}/day` | parent | Today for one child: `status` (`no_subscription`, `no_service`, `not_going`, `waiting`, `bus_on_way`, `boarded`, `arrived`, `checked_out`, `absent`), `events` so far (`not_going`, `bus_left`, `boarded`, `arrived`, `checked_out`, `absent`, each with `at` and `detail`), the bus and driver, and the last 5 days. Error `NOT_YOUR_CHILD` (403). |
| GET | `/parent/children/{student_id}/tracking` | parent | The child's bus live (same shape as below). Error `NOT_YOUR_CHILD` (403). |
| GET | `/tracking/me` | student | The student's bus live: `trip` with `status`, `eta_minutes`, `near_stop`, `position` (`lat`, `lng`, `heading`, `speed_kmh`, `recorded_at` from the GPS device in the bus), `trail` (points so far), `stop_location`, `campus_location`, and the bus + driver. Or `trip: null` with `reason` (`no_subscription` / `no_trip_now`) and `next_departure_at`. |

Changes to existing endpoints:
- `GET /lines/{line_id}` now has `bus: { bus_type, plate, driver: { name, phone } }`. The driver's `phone` is filled **only** for the line's active subscribers and their guardians; everyone else gets `null`.
- `GET /trips/next`: `bus` now includes `driver` (with phone, since the student rides that line).
- `GET /notifications` for guardians: new kinds `child_boarded`, `child_arrived`, `child_absent`, `child_not_going`, `child_checked_out`, with link target `child_day` (id = student_id). Guardians see announcements for their children's lines only.

Live events: `bus.location` (per trip_id) and `child.day` (per student_id). Until the WebSocket is in place the app re-reads tracking every 5 s and the day every 30 s.

Data: bus plates, drivers and their mobiles come from the Abu El Hol drivers list. Two routes in that list (Maadi Mall 50 HUB, ENPPI – Ghamra) aren't in the Routes file yet. The campus pin and stop locations are still needed from the Transportation office.

## Guardian approval for a line change (update, 2026-11-03)

Decided by Ahmed: **a line change needs the guardian's approval in the app; the model permit does not** (refund and complaint unchanged).

- New request status `awaiting_guardian`, before `submitted`. A line change starts there; it reaches the Transportation office only after the guardian approves. The office never sees a refused one.
- New actor `guardian` in the request timeline (`by`).
- The line change body no longer has `guardian_consent` (the guardian's name and phone stay, as on the paper form). The guardian who answers is the account whose phone is on the student's file.
- The student can withdraw while `awaiting_guardian` or `submitted`.
- New endpoints (role `parent`):
  - `GET /parent/approvals` → `{approvals: [{student_id, student_name, request}]}`: the children's line changes, waiting and answered.
  - `POST /parent/approvals/{request_id}/approve` body `{note: string|null}` → `awaiting_guardian → submitted`.
  - `POST /parent/approvals/{request_id}/refuse` body `{note: string|null}` → `awaiting_guardian → rejected`, note shown to the student.
  - Errors: `NOT_YOUR_CHILD` (403), `NOT_AWAITING_GUARDIAN` (409).
- New notifications to the guardian: `approval_needed` (target `approvals`), and `child_not_going` now also for coming days, sent when the child reports, not only on the day.
- `GET /parent/children/{student_id}/day` gained `days_off: [{service_date, reason, note, reported_at}]` (today and coming days).

## Driver and supervisor (phase 5 update, 2026-11-07)

The driver and the supervisor use the same pages and the same endpoints; both roles are allowed on every one below. Each sees only the line assigned to them today.

| Method | Path | What it does |
|---|---|---|
| GET | `/driver/trip/today` | Today for the crew member: `service_date`, `is_service_day`, `crew_role`, `line`, `bus {bus_id, bus_type, plate, seats}`, `stops [{order, name, pickup_time}]`, `campus_arrival`, and `trips` (outbound and return; empty on a non-service day). Error `NO_ASSIGNMENT` (404) when no line is assigned. |
| POST | `/trips/{trip_id}/start` | `not_started → in_progress`. Errors `TRIP_ALREADY_STARTED`, `TRIP_ALREADY_ENDED`, `OTHER_TRIP_IN_PROGRESS` (409), `NOT_YOUR_TRIP` (403). |
| POST | `/trips/{trip_id}/end` | `in_progress → ended`. Everyone still `waiting` becomes `absent`; this is what fills "My trips" and the guardian's day. |
| POST | `/trips/{trip_id}/scan` | Board or check out one student (below). |
| POST | `/trips/{trip_id}/delay` | `{minutes, reason, note}`: `minutes` one of 5/10/15/20/30/45/60, `reason` `traffic` / `breakdown` / `weather` / `road_closed` / `other`. The server publishes it as a `delay` announcement on the line, so students on the line and their guardians get a notification. |
| GET | `/sos/{sos_id}` | Follow an SOS you raised (status and actions). |
| GET | `/violations/mine` | **New.** The violations this crew member reported, newest first. |

All POSTs take an `Idempotency-Key`.

**Trip** (`trips[]`): `trip_id`, `direction`, `status` (`not_started` / `in_progress` / `ended`), `departure_time`, `started_at`, `ended_at`, `riders[]`, `counts {total, waiting, boarded, checked_out, not_going, absent}`, `delays[] {delay_id, minutes, reason, note, reported_at}`, and `sos` (the latest on this trip, or null).

**Rider**: `student_id`, `name` (in the request's language), `identifier` (university ID), `stop_order`, `stop_name`, `pickup_time`, `state` (`waiting` / `boarded` / `checked_out` / `not_going` / `absent`), `boarded_at`, `checked_out_at`, `checkout_reason`, `checkout_note`, `scan_method` (`qr` / `manual`), `not_going_reason`. The list is every active subscriber on the line in stop order; `not_going` comes from the student's "not going today".

**Scan body:**

```json
{ "action": "board", "method": "qr", "qr_token": "SUT1....", "identifier": null, "reason": null, "note": null }
```

- `method: "qr"` sends the token read from the pass (it lives 30 seconds, see the card section); `method: "manual"` sends the university ID typed by the driver instead.
- `action: "checkout"` needs `reason`: `unwell` / `guardian_pickup` / `personal` / `other` (`note` up to 200 characters).
- Response `{rider, counts}`.
- Errors: `CARD_INVALID`, `CARD_EXPIRED`, `STUDENT_NOT_FOUND`, `NOT_ON_THIS_TRIP` (no active booking on this line), `ALREADY_BOARDED`, `NOT_ON_BOARD`, `REASON_REQUIRED`, `TRIP_NOT_STARTED`, `TRIP_ALREADY_ENDED`.

**SOS changes:** `POST /sos` errors `NOT_YOUR_TRIP` (403) and `TRIP_ALREADY_ENDED` (409); the same `Idempotency-Key` returns the same SOS (one alert per press). Each item in `actions` now also has `by_name`, so the driver sees who in the office took it.

**Violations:** `POST /violations` body `{trip_id|null, student_identifier|null, rule, description (10–500), photo {file_name, content_type (JPEG/PNG/WebP), data_base64}}`, photo up to 5 MB. `rule` follows the bus Code of Conduct: `unapproved_model` (2), `photographing` (3), `bullying` (4), `cleanliness` (5), `smoking` (6), `noise` (7), `unsafe_boarding` (9), `refused_id` (10), `bad_language` (11), `not_subscribed` (12), `distracting_driver` (14), `damage` (15), `seating` (16), `other`. Statuses `submitted` → `under_review` → `closed`. Errors `STUDENT_NOT_FOUND`, `FILE_TYPE`, `FILE_TOO_LARGE`.

Mock only: on a non-service day the demo shows a "Try a test day" button; that is not something the server needs.

## Office side of emergencies and the replacement bus (phase 5 update, 2026-11-07)

| Method | Path | Role | What it does |
|---|---|---|---|
| GET | `/admin/sos?status=` | transport_admin, clinic, super_admin | Every alert, newest first. The clinic gets only `medical` and `accident`. |
| GET | `/admin/sos/{sos_id}` | same | One alert (404 for the clinic on a breakdown). |
| POST | `/admin/sos/{sos_id}/actions` | transport_admin, clinic (**not** super_admin: 403) | `{action, note}`: `acknowledge` (only while `open`), then `ambulance_called`, `note` (needs `note`), `close` (needs the summary in `note`). |
| GET | `/admin/trips/{trip_id}/replacement-options` | transport_admin | The trip's bus and driver now, its rider count, and the free spare buses (each with its driver) and spare drivers. |
| POST | `/admin/trips/{trip_id}/replacement` | transport_admin | `{bus_id, driver_id, reason, note, sos_id}`: another bus (comes with its own driver unless `driver_id` is given) or only another driver. |

All POSTs take an `Idempotency-Key`.

**The office's alert** (`/admin/sos` items) = the SOS shape plus: `line {line_id, code, name}`, `direction`, `bus {bus_id, bus_type, plate, seats}` and `driver {driver_id, name, phone}` **as they are now** (after any replacement), `raised_by_phone`, `replacements[]` (below), and `campus_location {lat, lng}` for the map. Each `actions[]` item has `by_name`; for `replacement_sent` the `note` reads "plate · driver" (plus the office's note).

**Action errors:** `ALREADY_ACKNOWLEDGED`, `SOS_NOT_ACKNOWLEDGED` (take it first), `SOS_CLOSED` (409), `NOTE_REQUIRED` (422). The first `acknowledge` is what the driver sees as "the office has it, by X at time". There is no automatic acknowledge.

**Replacement:** `reason` is `breakdown` / `accident` / `driver_unavailable` / `other`. Response `{replacement_id, bus, driver, reason, note, sos_id, by_name, at}`. Errors: `TRIP_ALREADY_ENDED`, `BUS_NOT_AVAILABLE`, `DRIVER_NOT_AVAILABLE`, `SOS_CLOSED` (409), `NOTHING_TO_CHANGE` (422). After it:
- Riders, scans and attendance stay on the same `trip_id` (business rule 10); the swap is logged.
- If `sos_id` is given, the alert gets a `replacement_sent` line.
- `GET /driver/trip/today`: `bus` is the new bus, and each trip has a new field `replacement: {bus_type, plate, driver_name, driver_phone, at} | null`.
- `/tracking/me`, `/trips/next`, `/parent/children/{id}/day`: `bus` and `driver` are the new ones for the rest of the day.
- A bus or driver sent to a trip that hasn't ended is not offered again.

**Notices to the line's students and guardians** (announcement kind `service_change` + notification), calm wording, no medical details: when an SOS is raised ("Line 7's bus has stopped; the office is following up"), when a replacement is sent ("the bus is now {plate} with driver {name} ({phone})"), and when the alert is closed ("handled").

**Live:** until the WebSocket is in place, the office's pages re-read `/admin/sos` every 5 s; a red banner with a beep shows on every page of the Transportation office and the clinic while an alert is not taken.

Data needed: which spare buses and drivers Abu El Hol keeps at the garage (the app shows made-up spares for now).

## Front end audit update (2026-11-08)

A full audit of the front end (security, accessibility, performance, the contract) led to these changes. `openapi.json` in the repo (`frontend/openapi.json`, generated from the code) is **the source of truth for fields**; this document is the summary. Please compare your FastAPI OpenAPI with it, ideally as a CI check.

**Session (security):**
- `/auth/login` no longer returns `token` in the body. It sets an **HttpOnly, Secure, SameSite=Lax** cookie; every request sends it (`credentials: "include"`), and the API must allow the app's origin with credentials (CORS) and check CSRF on changing requests (the `Idempotency-Key` header already forces a preflight).
- `/auth/logout` clears the cookie. Any request with an expired or revoked cookie returns 401 and the app signs out.
- `demo_code` must **never** be sent outside the test environment (the app also ignores it in a live build).
- Every endpoint checks the role on the server and returns `FORBIDDEN` (403); the app hiding a page is not protection.

**Contract changes:**
- Lines now carry both names: `name_ar` and `name_en` on every line in `GET /lines` and `GET /lines/{id}` (plus `name` in the request language), so search works in either language.
- New in the app, please add: `GET /admin/trips/{trip_id}/replacement-options`, `GET /health`, `GET /violations/mine`, `POST /requests/model-permit`.
- One way for the guardian to answer: `POST /parent/approvals/{request_id}/approve|refuse`. `POST /requests/{id}/parent-decision` is removed.
- Delay rule: `POST /crew/trips/{trip_id}/delay` only while the trip runs, or within 60 minutes before or after its pickup time; otherwise `DELAY_OUT_OF_WINDOW` (409).
- List shapes: the exceptions to `{ items, total }` are listed in "Contract rules".
- Uploads: receipts and attachments are base64 inside the JSON for now (5 MB file ≈ 6.7 MB body). If you prefer `multipart/form-data` or presigned uploads, tell us and the app will switch.
- Map tiles: the demo uses OpenStreetMap's servers, which a production app may not use. The live build needs a tile provider the university picks (`NEXT_PUBLIC_MAP_TILE_URL`); the app refuses to build for production without one.

**What only the backend team can do:**
1. Use the roles, statuses and enums in this document and `openapi.json` (the models dated 4 Nov still have 5 roles, Fawry/InstaPay, and different request and payment statuses).
2. The cookie session, CORS with credentials, and CSRF protection.
3. The 403 check per role on every endpoint, and the audit log.
4. Never sending `demo_code` in production.
5. `name_ar` / `name_en` on lines, and the 4 endpoints above.
6. The delay window rule, and the rest of "Business rules the server must enforce".
7. The decisions below: uploads (base64 or multipart) and the map tile provider (with the university).

## User test update (2026-11-08)

A role-by-role user test of the demo (students, guardian, driver, supervisor, every office) found 33 issues. The front end fixed all of them on the mock side. These are the parts the **server** must do the same way (field names are in `openapi.json`):

**Sign-in and sessions:**
- **Session length per role.** Students, guardians, drivers and supervisors stay signed in for **30 days** (ideally sliding: renewed while the app is used). Office accounts: **12 hours**. A 12-hour session for everyone means a driver who signs in at 6 PM needs a new SMS code at 6 AM, just before the bus. `expires_at` in the login answer tells the app when.
- **Phone numbers in any format.** `+201000002000`, `00201000002000`, `0100 000 2000` and `01000002000` are the same number: normalise `+20` / `0020`, spaces, dashes and brackets before looking it up.
- **The code survives closing the app.** A code stays valid on the server until it expires or a new one replaces it. A used, replaced or forgotten code answers `OTP_EXPIRED` ("ask for a new code"), not `INVALID_OTP` ("wrong code").
- `GET /me` and the login answer now include the user's own `phone` (never another person's), to prefill their forms.

**Requests:**
- **Approved line changes apply on their dates.** A temporary change (`duration: temporary`) moves the student to the new line and stop **only from `starts_on` to `ends_on`**, everywhere: next trip, card, the line's roster (the new line's crew must accept the card; the old line's must not count them), tracking, line news and the guardian's pages. Before and after those dates the student is back on the subscribed line. A permanent change moves the subscription from `starts_on`.
- **Request numbers are one global sequence** (`REQ-2026-0042`, `0043`, …) assigned by the server. Two students never get the same number.
- **The guardian may change their answer** for 10 minutes after answering, while the office hasn't opened the request (a refusal can become an approval if the student hasn't sent a newer request). New field on each item of `GET /parent/approvals`: `can_change_until` (ISO time or null). Answering the opposite way inside that window is allowed; otherwise `NOT_AWAITING_GUARDIAN` (409).
- Notes written by the office (e.g. "approved from …") use formatted dates, not raw `2026-11-08`.

**Trips and history:**
- **No history before the subscription started.** A student approved at 3:40 PM has no "rode" record, boarding or arrival for that morning's trip; the guardian's day page shows no trip that day.
- **A replacement bus or driver belongs to its own day's trip.** Tomorrow's next-trip card shows the line's usual bus and driver again.
- **SOS records keep their bus and crew.** Store the bus and driver at the moment of the alert on the alert itself; a replacement sent later on the same trip must not rewrite older or closed alerts. The alert's `replacements` list only the changes made while it was open.
- **A replaced driver is relieved.** When the office sends another driver (`POST /admin/trips/{trip_id}/replacement` with a new driver, or a bus with its own driver), the old driver account can no longer start, scan, end or report delays on that trip: those answer **`DRIVER_RELIEVED` (403)**. New field `relieved` on `GET /crew/today` (`driver_name`, `driver_phone`, `at`, or null) tells the old driver who took over. The supervisor keeps running the trip; an SOS from the old driver is still accepted.

**Offices:**
- The office pages for payments, refunds, requests, complaints and violations are phase 6. Until they exist, the demo answers these on a timer and says so. On the real server **nothing is decided by a timer**: every receipt, request and complaint waits for a person.

**What only the backend team can do:**
1. Per-role session lengths (30 days for students, guardians and crew; 12 hours for offices), ideally sliding.
2. Phone normalisation (`+20`, `0020`, spaces, dashes) on sign-in.
3. Applying approved line changes by date everywhere a student's line is read (rosters, scanning, next trip, card, tracking, news).
4. One global request-number sequence.
5. The guardian's 10-minute change window and `can_change_until`.
6. Snapshotting bus and crew on each SOS; replacements per day; `DRIVER_RELIEVED` and `relieved`.
7. No ride history before the activation time.

## Office pages update (phase 6, 2026-11-12)

The office pages are built: finance (payments, Visa at A045, refunds), the Transportation office's requests and complaints, Student Affairs' violations, office announcements, and reports with Excel and PDF export. **Nothing is decided by a timer any more, in the demo either**: a person in the right office decides every receipt, request, complaint and violation. Field names are in `openapi.json` (now 63 paths).

| Method | Path | Role | What it does |
|---|---|---|---|
| GET | `/admin/payments?status=&q=&page=` | finance, super_admin | Receipts and office payments. Waiting first (oldest at the top), then decisions (newest first). `q`: university ID, part of the name, or reference number. Answer `{items, total, counts{pending_review, approved, rejected}}`. |
| GET | `/admin/payments/{payment_id}` | same | One payment with the student (`name`, `identifier`, `phone`), the seat (`line`, `stop_name`), `price_piasters`, `subscription_status`, `reviewed_by_name`, `file_url` (a short-lived link to the file), and `other_payments` (the student's other receipts this term). |
| PATCH | `/admin/payments/{payment_id}` | same | `{decision: approve or reject, reason}`. Approve: the subscription becomes `active`. Reject: `reason` is required (the student reads it) and the seat gets a **fresh 24-hour hold** so the student can upload again. |
| GET | `/admin/bookings/awaiting-payment?identifier=` | same | The booking waiting for a payment, found by university ID at the A045 cashier: student, `subscription_id`, line, stop, price, `hold_expires_at`. |
| POST | `/admin/payments/office` | same | A Visa payment at A045: `{subscription_id, reference_number (the machine slip), amount_piasters, paid_on, payer_name}`. Recorded as `card_at_office`, `approved`, and the seat is active at once. |
| GET | `/admin/requests?kind[]=&stage=&q=&page=` | transport_admin, finance, super_admin | The office's queue. `stage`: `new`, `in_review`, `closed`. Each item: `request_id`, `reference`, `kind`, `status`, `stage`, `title` (one line in the request's language), `student{name, identifier}`, `received_at`, `updated_at`, `handled_by_name`; plus `counts`. |
| GET | `/admin/requests/{request_id}` | same | `{request (the student's shape, with timeline), stage, student{…, faculty, level, line, subscription_status}, allowed_actions, suggested_replies{open, approve, reject, resolve}, target_seats_available, handled_by_name}`. |
| PATCH | `/admin/requests/{request_id}` | same | `{action: open, approve, reject or resolve, note, refund_piasters}`. |
| GET | `/admin/violations?status=&rule=&q=&page=` | student_affairs, transport_admin, super_admin | The crews' reports: new, under review, closed; plus `counts`. Each item adds `reported_by{name, role}`, `line`, `photo_url`, `opened_by_name`, `decision{outcome, note, by_name, at}`, `allowed_actions`. |
| GET | `/admin/violations/{violation_id}` | same | One report. |
| PATCH | `/admin/violations/{violation_id}` | student_affairs, super_admin | `{action: open or close, outcome, note}`. `outcome`: `warning`, `investigation`, `dismissed`. |
| POST | `/admin/announcements` | transport_admin, super_admin | `{kind: official or service_change, line_id or null, title_ar, title_en, body_ar, body_en}`. Each reader gets their own language; a line's post reaches only that line's students and their guardians. `delay` posts still come only from the crew's delay report. |
| GET | `/admin/reports` | transport_admin, finance, secretary_general, super_admin | The report types this role may open: `{items: [{type, title, description, uses_period}]}`. |

**Who answers which request (the server filters, the app only asks):**
- **Finance:** refunds and complaints in the `payment` category.
- **Transportation office:** line changes, model permits and every other complaint. A line change reaches the office **only after the guardian approved** (or the guardian has no account: the office calls).
- `open` sets `in_review` (the student sees "being reviewed", with the note if any). `approve` / `reject` for line change, refund and model permit; `resolve` for complaints. `reject` and `resolve` need a `note` (5+ letters). The student reads every note. `suggested_replies` are ready texts the office can edit (the app fills them in).
- **Line change approve:** check a free seat on the new line (`target_seats_available`); none: `SEAT_UNAVAILABLE` (409).
- **Refund approve:** an ordinary refund pays the policy amount (`estimated_refund_piasters`); an exceptional one (medical, bereavement, transfer) needs `refund_piasters` from 0 to what was paid, else `REFUND_AMOUNT_INVALID` (422). The amount goes back on the request as `approved_refund_piasters` (new field on refund details), and the student sees it.
- **Model permit** is decided by the Transportation office (no guardian step).
- Errors: `REQUEST_CLOSED` (409), `NOTE_REQUIRED`, `ACTION_NOT_ALLOWED`, `REFUND_AMOUNT_INVALID` (422), `SEAT_UNAVAILABLE` (409), `FORBIDDEN` (403) for another office's request.

**Finance errors:** `PAYMENT_ALREADY_REVIEWED` (409), `REASON_REQUIRED` (422), `STUDENT_NOT_FOUND` (404), `NOT_AWAITING_PAYMENT`, `HOLD_EXPIRED`, `RECEIPT_ALREADY_USED` (409: the same slip number already recorded and not rejected), `AMOUNT_MISMATCH` (422: less than the term price).

**Violations:** Student Affairs opens (`under_review`: the crew sees it) and closes with an `outcome` and a `note` (5+ letters) for the file; `DECISION_REQUIRED` (422), `VIOLATION_CLOSED` (409). The Transportation office reads the same list and gets `allowed_actions: []`.

**Uploaded files (added 2026-11-13):** every office page shows the files people uploaded, so each response carries a short-lived link (signed, about 15 minutes; it opens with no extra header, so it works in an `<img>` tag and a new tab):
- `GET /admin/payments` and `/admin/payments/{id}`: `file_url` and `file_content_type` (`image/jpeg`, `image/png` or `application/pdf`); both null for a Visa payment.
- Every request attachment (refund documents, complaint photos), for the student and the office: `{attachment_id, file_name, content_type, size_bytes, url}`.
- `GET /admin/violations` and `/admin/violations/{id}`: `photo_url`.
- The link must only be issued to someone allowed to see the record (the student, their guardian where allowed, the office that handles it, super_admin).

**Reports (changes to "Report export"):**
- `GET /admin/reports/{type}?format=json` answers `{type, title, columns[{key, label, kind}], rows[], total, page, page_size, filters{line, from, to}, summary[{label, value}], generated_at}`, not `{items, total}`. `kind`: `text`, `number`, `money` (piasters on screen, pounds in the files), `date`, `time`, `percent` (0 to 100). Labels, summary and text cells are in the request's language, so the screen, the Excel file and the PDF always match. `page_size` up to 200.
- Without `from`/`to` the server uses **this month so far** (attendance: **this week so far**). `roster` has no period (as of today).
- `attendance` is **one row per line per service day** (subscribers, rode, said "not going", absent, attendance %), at most **31 days** per report (`REPORT_RANGE_TOO_LONG`, 422). A per-student attendance list can come later if the office asks.
- `roster`: line, line name, university ID, name, stop, pickup time. `payments`: paid on, reference, university ID, name, line, method, amount, status. `seat_occupancy`: line, seats, subscribers, free seats, average riders a day, occupancy %.
- PDF: at most **2,000 rows** (`REPORT_TOO_LARGE_FOR_PDF`, 422; Excel has no limit). `to` before `from`: `INVALID_RANGE` (422). Unknown line: `LINE_NOT_FOUND` (404).
- File name: `sutech_<type>_<line code or all>_<from>_<to>.<ext>` (roster: the day's date), in `Content-Disposition`. The app downloads it with the session cookie.
- The demo makes the same files in the browser (Excel with `write-excel-file`, the Arabic PDF drawn page by page so Arabic letters join correctly). The real files come from the server.

**What only the backend team can do:**
1. The 13 endpoints above, with the office filter on the server (finance never sees a line change, transport never sees a refund).
2. No automatic decisions anywhere: receipts, requests, complaints and violations wait for a person.
3. A fresh 24-hour hold after a rejected receipt; `RECEIPT_ALREADY_USED` across all students.
4. The seat check on approving a line change; `approved_refund_piasters` on refunds.
5. The report shapes above (json, xlsx, pdf from the same rows), the 31-day attendance limit and the 2,000-row PDF limit, and the audit log entry for each export.

## Secretary General, event buses and Abu El Hol (phase 7, 2026-11-13)

Three new pages: the **Transportation office asks Abu El Hol for event buses** (military education, Open Day, field trips…), **Abu El Hol answers** with the buses and drivers it sends, and the **Secretary General** sees the day at a glance (read-only). The Secretary General lands on `/admin/secretary-general` and Abu El Hol on `/admin/bus-company`. Field names are in `openapi.json` (now 73 paths).

| Method | Path | Role | What it does |
|---|---|---|---|
| GET | `/admin/events?status=&page=` | transport_admin, super_admin | Event requests, nearest day first. Each item: `event_id`, `reference`, `kind`, `title`, `event_date`, `departs_at`, `returns_at`, `pickup`, `destination`, `students_count`, `bus_type`, `buses_requested`, `seats_requested`, `note`, `status`, `is_past`, `requested_by_name`, `created_at`, `company_reply{buses[], note, by_name, at}`, `cancellation{reason, by_name, at}`, `allowed_actions`. Plus `total` and `counts`. |
| GET | `/admin/events/{event_id}` | same | One request. |
| POST | `/admin/events` | same | `{kind, title, event_date, departs_at, returns_at (or null for one way), pickup, destination, students_count, bus_type, buses_requested, note}`. Starts as `waiting_company`. Idempotent (`Idempotency-Key`). |
| POST | `/admin/events/{event_id}/cancel` | same | `{reason}` (5+ letters; the company reads it). Allowed while waiting or confirmed and before the day. |
| GET | `/bus-company/requests?status=&page=` | bus_company, super_admin | The same list, for the company. **No student names or IDs**, only how many. For super_admin, `allowed_actions` is always `[]` (view only). |
| GET | `/bus-company/requests/{event_id}` | same | `{event, available_buses[]}`: the company's buses with no other event that day, each `{bus_id, plate, bus_type, seats, driver_name, driver_phone, line (or null for a spare)}`, spares first. |
| POST | `/bus-company/requests/{event_id}/reply` | bus_company (**not** super_admin: 403) | `{decision: confirm or decline, bus_ids[], note}`. Confirm: 1 to `buses_requested` distinct buses from `available_buses` (fewer than asked = a partial answer the office sees). Decline: `note` is the reason (5+ letters). |
| GET | `/bus-company/fleet` | same | Every company bus with `line`, `today` (`on_line`, `replacement`, `spare`), `covering_line` (a replacement bus today), `event_today{event_id, title}`; plus `counts{total, on_line, spare, seats}`. |
| GET | `/admin/sg/overview?date=` | secretary_general, super_admin | One day (today if left out, up to 31 days back): `is_today`, `is_service_day`, `previous_service_day` (on a day with no buses), `generated_at`, `totals{lines, lines_running, lines_delayed, subscribers, rode, not_going, absent}`, `lines[]` (each: line, `bus{plate, bus_type, driver_name}` after any replacement, `replaced`, `status` `no_service`/`not_started`/`in_progress`/`ended`, `subscribers`, `rode`, `not_going`, `absent`, `delay_minutes`), `emergencies[]` (SOS that day), `events[]` (event buses that day), `violations_new`. |
| GET | `/admin/sg/watchlist?date=` | same | The students the Secretary General follows (max 20): each `{student{student_id, identifier, name, line, stop_name, pickup_time}, status, boarded_at, checked_out_at, checkout_reason, added_at}`. `status`: `no_service`, `no_subscription`, `waiting`, `on_bus`, `arrived`, `checked_out`, `not_going`, `absent` (the morning trip). |
| POST | `/admin/sg/watchlist` | same | `{identifier}` (university ID). Answers the new list. |
| DELETE | `/admin/sg/watchlist/{student_id}` | same | Stop following. Answers the new list. |

**Rules the server must enforce:**
- The event day is from tomorrow up to **120 days** ahead (`EVENT_DATE_INVALID`, 422); `returns_at` after `departs_at` (`EVENT_TIMES_INVALID`, 422).
- Seats asked for (`buses_requested` × seats of `bus_type`: minibus 14, coaster 28, midibus 33, large 50) must cover `students_count` (`NOT_ENOUGH_SEATS`, 422). Up to 2,000 students and 30 buses.
- The same title on the same day while waiting or confirmed: `EVENT_DUPLICATE` (409).
- Cancel or reply on a closed or past request: `EVENT_CLOSED` (409). Reply when not waiting: `EVENT_NOT_WAITING` (409). A bus not the company's, or already sent to another event that day: `BUS_NOT_AVAILABLE` (409). Wrong count or repeats: `BUSES_INVALID` (422). Decline or cancel without a reason: `REASON_REQUIRED` (422).
- A line bus can go to an event (it still runs its line morning and afternoon); the company decides.
- The office pages are Transportation only; the company's pages are Abu El Hol only; the Secretary General reads only. super_admin sees all three.
- Secretary General errors: `DATE_INVALID` (422: future or more than 31 days back), `STUDENT_NOT_FOUND` (404), `ALREADY_WATCHED` (409), `WATCHLIST_FULL` (409, 20 students).
- `delay_minutes` is the crew's latest delay report that day. Titles, places and notes come back in the request's language when the office typed them in both (the demo stores what was typed in both).

**What only the backend team can do:**
1. The 12 endpoints above, with the role filter on the server, and student data never sent to the company.
2. Telling Abu El Hol about a new or cancelled request (SMS or email), and the office about the company's answer.
3. The overview numbers from the real trips and scans, cached for the 30-second refresh.

**Open questions for phase 7:**
- [ ] Abu El Hol: how many spare buses, and the real seats of each bus type?
- [ ] Should Abu El Hol be told by SMS or email too, or only in the app?
- [ ] Does the Secretary General want a notification (an emergency, a line very late), or only the page?

## Transportation office pages and the super admin (phase 8, 2026-11-13)

The Transportation office now lands on its own **overview** (`/admin`) with what waits for it, and has a **live map** of every bus, the **lines** with their students, **who rode** each trip, the **students**, and the **buses and drivers**. The super admin gets **users and permissions** and the **activity log**. Field names are in `openapi.json` (now 84 paths).

| Method | Path | Role | What it does |
|---|---|---|---|
| GET | `/admin/overview?date=` | transport_admin, super_admin | The same day view as `/admin/sg/overview` plus `queues{emergencies_open, requests_new, complaints_new, events_waiting}` (what waits now, whatever the day). |
| GET | `/admin/live` | same | Every line's bus this morning: `line`, `trip_id`, `bus{plate, bus_type, driver_name, driver_phone}` (after any replacement), `replaced`, `status` (`not_started`, `on_the_road`, `arrived`, `no_service`), `position{lat, lng, heading, speed_kmh, recorded_at}` while on the road, `near_stop`, `progress` (0 to 1), `leaves_at`, `subscribers`, `rode`, `delay_minutes`, `sos_open`; plus `generated_at` and `campus_location`. Then `bus.location` on the WebSocket. |
| GET | `/admin/lines` | same | Each line with its own bus and driver, `stops`, `first_pickup`, `subscribers`, `reserved` (bookings holding a seat), `seats_free`; plus `totals`. |
| GET | `/admin/lines/{line_id}` | same | The line plus `stops_list[]` (order, name, pickup_time, subscribers), `students[]` by stop, and `today_trip_id` for changing the bus or driver. |
| GET | `/admin/attendance?line_id=&date=` | same | One line's morning trip on a day (up to 31 days back): `is_service_day`, `trip_status`, `counts`, `riders[]` (same shape as the crew's passenger list). |
| GET | `/admin/students?q=&line_id=&page=` | same | Students with a seat or a booking this term, 25 a page: `identifier`, `name`, `line`, `stop_name`, `subscription_status`. |
| GET | `/admin/students/{student_id}` | same | Plus `faculty`, `level`, `phone`, `pickup_time`, `guardian{name, phone, has_account}`, `trips{rode, not_going, absent}` this term, and `requests[]` (with `handled_here`). |
| GET | `/admin/buses` | same | The company's buses (same as `/bus-company/fleet`) plus `trips[{line_id, trip_id}]` for changing a line's bus or driver today. |
| GET | `/admin/users?q=&role=` | super_admin | Office accounts only (transport_admin, finance, clinic, student_affairs, secretary_general, bus_company, super_admin): `user_id`, `identifier`, `name`, `role`, `masked_phone`, `active`, `is_you`, `added_at`; plus `counts` per role. |
| POST | `/admin/users` | super_admin | `{name, name_ar, phone, role}`. The server gives the next sign-in ID for the office (`TRN-`, `FIN-`, `CLN-`, `STA-`, `SGO-`, `BUS-`, `ADM-` + number). Idempotent. |
| PATCH | `/admin/users/{user_id}` | super_admin | `{active}` and/or `{role}`. Stopping ends the account's sessions at once (its next request gets 401, and `request-otp` answers `ACCOUNT_DISABLED`). |
| GET | `/admin/audit?area=&q=&page=` | super_admin | The activity log, newest first, 25 a page: `audit_id`, `at`, `actor{name, identifier, role}`, `action`, `area`, `target`, `detail`. |

Changing a trip's bus or driver from the live map, a line or the buses page reuses `POST /admin/trips/{trip_id}/replacement` with `sos_id: null`.

**Rules the server must enforce:**
- The super admin can't stop their own account or change its office (`CANNOT_CHANGE_SELF`, 409), and there is always one active super admin (`LAST_SUPER_ADMIN`, 409). A phone already used by another account: `PHONE_TAKEN` (409). Unknown account: `USER_NOT_FOUND` (404).
- Students, guardians, drivers and supervisors are not created here: they come from the admissions database and Abu El Hol's list.
- Every office decision writes one audit line, and nobody (not even the super admin) can edit or delete one. `action` values: `payment_approved`, `payment_rejected`, `office_payment`, `request_opened`, `request_approved`, `request_rejected`, `request_resolved`, `violation_opened`, `violation_closed`, `announcement_posted`, `sos_action`, `replacement_sent`, `event_requested`, `event_cancelled`, `event_confirmed`, `event_declined`, `user_added`, `user_stopped`, `user_activated`, `user_role_changed`. `area`: `payments`, `requests`, `violations`, `announcements`, `emergencies`, `events`, `users`.
- Operations errors: `DATE_INVALID` (422), `LINE_NOT_FOUND` (404), `STUDENT_NOT_FOUND` (404).

**What only the backend team can do:**
1. The 12 endpoints above, with role checks on the server.
2. Ending a stopped account's sessions at once (token blacklist or short tokens).
3. Writing the audit line in the same transaction as the decision, so neither exists without the other.

**Open questions for phase 8:**
- [ ] How long do we keep the activity log (one year? forever)?
- [x] Return times: 16:30 for every line (Ahmed, 2026-11-13), on the Return times page below.

## Return times and campus arrival (2026-11-13)

- **Arrival:** every line reaches campus at **08:30** (the university's Routes file, last stop "جامعة السويدي"). `campus_arrival` is now `{ "from": "08:30", "to": "08:30" }` everywhere (lines, next trip, crew today, tracking, guardian day). The frontend shows one time when `from` equals `to`.
- **Return:** every bus leaves campus at **16:30** (Ahmed). `return_departure_time` is no longer null: it is on `GET /lines`, `GET /lines/{id}`, `GET /trips/next`, and the crew's return trip has `departure_time` = that time.
- One fix to the Routes file: line 19's "مسجد بلال" says 8:30 between stops at 7:32 and 7:35; we use 07:33. Please confirm with the office.

| Method | Path | Who | What |
|---|---|---|---|
| GET | `/admin/timetable` | transport_admin, super_admin | `{default_return_time, items[]}`; each item: `line`, `stop_count`, `first_pickup_time`, `campus_arrival`, `return_departure_time`, `changed_by_name`, `changed_at` (null while the line has the default). |
| PUT | `/admin/timetable/return-time` | transport_admin, super_admin | `{line_ids[], return_departure_time}`. Empty `line_ids` = every line (overrides earlier per-line times). Students and crews see the new time at once. Logged in the audit log (`return_time_changed`, new area `timetable`). Error: `LINE_NOT_FOUND` (404). Idempotent. |

The office menu item "Departure trips" (`/admin/departures`) is now **Return times** (`/admin/return-times`).

## We need your answers on

- [ ] Do you agree with the contract rules? Any change is much easier now than later.
- [ ] Which protocol will the GPS device use (HTTP, MQTT, or TCP)? And how many seconds between updates?
- [ ] What will you use for the token (JWT?), and how long should it last?
- [ ] Which SMS provider will send the OTP, and who pays for it?
- [ ] Security team: return `UNKNOWN_IDENTIFIER`, or one response for every case so nobody can tell who is registered?
- [ ] If an SOS isn't acknowledged within 2 minutes, who is it escalated to (super admin? SMS to the transport manager?)
- [ ] Which library for Arabic PDF (WeasyPrint or another), and are big reports built immediately or in the background?
- [ ] Is the supervisor a separate account from the driver? (The app treats them as two accounts with the same pages; tell us if one shared account is planned.)
- [ ] Is a 24-hour hold enough? The offices work Sunday to Thursday only, so a booking on Thursday evening ends before the bank or office opens. Should the hold count working days, or be 48 hours?
- [ ] Receipt upload: base64 inside the JSON (as now), or `multipart/form-data`? And where are the files stored?
- [ ] Still needed from the Transportation office: stop locations, and the real seat count of each bus (the seat counts are estimates for now).
- [ ] How will we connect to the admissions database (student data and parent phone numbers)? We're waiting for Mr. Amr's reply.
- [ ] Your notes on the endpoint list: is anything missing, or is there something better done differently?
- [x] ~~Rule 11 (guardian approval first): parent accounts come in a later phase. Until then the form records the guardian's name, phone and consent (like the signature on the paper form) and the office calls to confirm. Once parents have the app, should requests wait in a new `awaiting_guardian` status?~~ Answered: see "Guardian approval for a line change".
- [ ] The refund policy leaves out Oct 9–10 and Oct 30–31. For now those days take the next, stricter row (50% and 100%). Please confirm with Finance.

Write your answers as comments directly on the document.

*Translated from the Arabic original (`SUtech-Frontend-Backend-Agreement.ar.md`). Code, endpoints, field names and values are unchanged. Online original: https://claude.ai/artifact/JYiG6QRYdGmct5pYS3Jjzh*
