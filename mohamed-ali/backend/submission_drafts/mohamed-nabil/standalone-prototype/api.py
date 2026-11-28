"""In-memory demonstration API; use dp_api.py for the MySQL-backed API."""

from datetime import date, time
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import fleet_operations_logic as fol

app = FastAPI(title="SUtech Transportation Fleet Demo API", version="1.0.0")
API_PREFIX = "/api/v1"

s1 = fol.Stop(id="stop_1", stop_order=1, name_en="Stop 1", pickup_time=time(7, 15))
s2 = fol.Stop(id="stop_2", stop_order=2, name_en="Stop 2", pickup_time=time(7, 35))

l1 = fol.Line(
    id="line_1",
    code="1",
    name_en="10th of Ramadan Line",
    campus_arrival=time(8, 30),
    return_departure_time=time(16, 30),
    stops=[s1, s2],
)

b1 = fol.Bus(id="bus_01", plate="ABC-123", bus_type="coaster", seats_total=24, driver_name="Ali", driver_phone="01000000001")
b2 = fol.Bus(id="bus_02", plate="XYZ-789", bus_type="hiace", seats_total=14, driver_name="Karim", driver_phone="01000000002")

t1 = fol.Trip(
    id="trip_01",
    service_date=date(2026, 11, 20),
    direction="outbound",
    line=l1,
    bus=b1,
    riders=[
        fol.AttendanceRecord("std_101", "Student 101", "Stop 1"),
        fol.AttendanceRecord("std_102", "Student 102", "Stop 2"),
    ],
)

TRIPS = {"trip_01": t1}
LINES = {"line_1": l1}
BUSES = {"bus_01": b1, "bus_02": b2}


class ScanIn(BaseModel):
    student_id: str
    action: str
    reason: str | None = None


class ReplaceIn(BaseModel):
    reason: str
    new_bus_id: str | None = None
    new_driver_name: str | None = None
    new_driver_phone: str | None = None
    note: str | None = None


class DelayIn(BaseModel):
    minutes: int
    reason: str
    note: str | None = None


class ReturnIn(BaseModel):
    return_departure_time: time


def get_t(tid: str) -> fol.Trip:
    if tid not in TRIPS:
        raise HTTPException(404, "Trip not found")
    return TRIPS[tid]


@app.post(f"{API_PREFIX}/trips/{{trip_id}}/start")
def start_trip(trip_id: str):
    t = get_t(trip_id)
    try:
        t.start_trip()
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"trip_id": trip_id, "status": t.status}


@app.post(f"{API_PREFIX}/trips/{{trip_id}}/end")
def end_trip(trip_id: str):
    t = get_t(trip_id)
    try:
        summary = t.end_trip()
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"trip_id": trip_id, "status": t.status, "summary": summary}


@app.post(f"{API_PREFIX}/trips/{{trip_id}}/scan")
def scan(trip_id: str, p: ScanIn):
    t = get_t(trip_id)
    try:
        rec = t.scan_rider(student_id=p.student_id, action=p.action, reason=p.reason)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"trip_id": trip_id, "student_id": rec.student_id, "state": rec.state}


@app.post(f"{API_PREFIX}/trips/{{trip_id}}/replace")
def replace(trip_id: str, p: ReplaceIn):
    t = get_t(trip_id)
    nb = BUSES.get(p.new_bus_id) if p.new_bus_id else None
    if p.new_bus_id and nb is None:
        raise HTTPException(404, "Replacement bus not found")
    try:
        t.replace_bus_or_driver(
            reason=p.reason,
            new_bus=nb,
            new_driver_name=p.new_driver_name,
            new_driver_phone=p.new_driver_phone,
            note=p.note,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"trip_id": trip_id, "bus": t.bus.id, "driver": t.bus.driver_name}


@app.post(f"{API_PREFIX}/trips/{{trip_id}}/delay")
def delay(trip_id: str, p: DelayIn):
    t = get_t(trip_id)
    try:
        t.add_delay(minutes=p.minutes, reason=p.reason, note=p.note)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"trip_id": trip_id, "total_delay_minutes": t.total_delay_minutes}


@app.patch(f"{API_PREFIX}/lines/{{line_id}}/return-time")
def ret_time(line_id: str, p: ReturnIn):
    if line_id not in LINES:
        raise HTTPException(404, "Line not found")
    try:
        updated = LINES[line_id].update_return_time(p.return_departure_time)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"line_id": line_id, "return_departure_time": str(updated)}
