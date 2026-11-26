"""MySQL-backed endpoints for the fleet operations contribution.

Run with: uvicorn dp_api:app --reload
Required environment: MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE
"""

import os
from contextlib import contextmanager
from typing import Iterator, Optional

import mysql.connector
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="SUtech Transportation Fleet API", version="1.0.0")
API_PREFIX = "/api/v1"


@contextmanager
def database_cursor(dictionary: bool = False) -> Iterator[tuple]:
    """Open and reliably close a connection; roll back failed requests."""
    connection = mysql.connector.connect(
        host=os.getenv("MYSQL_HOST", "localhost"),
        user=os.getenv("MYSQL_USER", "root"),
        password=os.getenv("MYSQL_PASSWORD", ""),
        database=os.getenv("MYSQL_DATABASE", "sutech_transport"),
    )
    cursor = None
    try:
        cursor = connection.cursor(dictionary=dictionary)
        yield connection, cursor
    except Exception:
        connection.rollback()
        raise
    finally:
        try:
            if cursor is not None:
                cursor.close()
        finally:
            connection.close()


class ScanRequest(BaseModel):
    student_id: str = Field(min_length=1, max_length=50)
    action: str = Field(pattern="^(board|checkout)$")
    reason: Optional[str] = Field(default=None, max_length=500)


class ReplaceRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=100)
    new_bus_id: Optional[str] = Field(default=None, max_length=50)
    new_driver_name: Optional[str] = Field(default=None, max_length=100)
    new_driver_phone: Optional[str] = Field(default=None, max_length=30)
    note: Optional[str] = Field(default=None, max_length=2000)


class DelayRequest(BaseModel):
    minutes: int = Field(gt=0, le=60)
    reason: str = Field(min_length=1, max_length=100)
    note: Optional[str] = Field(default=None, max_length=2000)


class ReturnTimeRequest(BaseModel):
    return_departure_time: str = Field(pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$")


def _fetch_trip(cursor, trip_id: str, *, for_update: bool = False) -> dict:
    query = "SELECT id, status, direction, total_delay_minutes FROM trips WHERE id = %s"
    if for_update:
        query += " FOR UPDATE"
    cursor.execute(query, (trip_id,))
    trip = cursor.fetchone()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return trip


@app.get(f"{API_PREFIX}/trips")
def list_trips():
    with database_cursor(dictionary=True) as (_, cursor):
        cursor.execute("SELECT * FROM trips ORDER BY service_date, id")
        return {"trips": cursor.fetchall()}


@app.get(f"{API_PREFIX}/trips/{{trip_id}}/attendance")
def get_attendance(trip_id: str):
    with database_cursor(dictionary=True) as (_, cursor):
        _fetch_trip(cursor, trip_id)
        cursor.execute(
            "SELECT * FROM attendance_records WHERE trip_id = %s ORDER BY id",
            (trip_id,),
        )
        return {"trip_id": trip_id, "attendance": cursor.fetchall()}


@app.post(f"{API_PREFIX}/trips/{{trip_id}}/start")
def start_trip(trip_id: str):
    with database_cursor() as (connection, cursor):
        cursor.execute(
            "UPDATE trips SET status = 'in_progress' WHERE id = %s AND status = 'not_started'",
            (trip_id,),
        )
        if cursor.rowcount == 0:
            _fetch_trip(cursor, trip_id)
            raise HTTPException(status_code=409, detail="Trip is not waiting to start")
        connection.commit()
        return {"trip_id": trip_id, "status": "in_progress"}


@app.post(f"{API_PREFIX}/trips/{{trip_id}}/end")
def end_trip(trip_id: str):
    with database_cursor(dictionary=True) as (connection, cursor):
        trip = _fetch_trip(cursor, trip_id, for_update=True)
        if trip["status"] != "in_progress":
            raise HTTPException(status_code=409, detail="Only an active trip can be ended")
        if trip["direction"] == "outbound":
            cursor.execute(
                "UPDATE attendance_records SET state = 'absent' "
                "WHERE trip_id = %s AND state = 'waiting'",
                (trip_id,),
            )
        cursor.execute("UPDATE trips SET status = 'ended' WHERE id = %s", (trip_id,))
        cursor.execute(
            "SELECT state, COUNT(*) AS count FROM attendance_records "
            "WHERE trip_id = %s GROUP BY state",
            (trip_id,),
        )
        summary = {row["state"]: row["count"] for row in cursor.fetchall()}
        connection.commit()
        return {"trip_id": trip_id, "status": "ended", "summary": summary}


@app.post(f"{API_PREFIX}/trips/{{trip_id}}/scan")
def scan_rider(trip_id: str, payload: ScanRequest):
    if payload.action == "checkout" and not payload.reason:
        raise HTTPException(status_code=422, detail="Checkout requires a reason")
    with database_cursor(dictionary=True) as (connection, cursor):
        trip = _fetch_trip(cursor, trip_id, for_update=True)
        if trip["status"] != "in_progress":
            raise HTTPException(status_code=409, detail="Trip is not active")
        if payload.action == "board":
            cursor.execute(
                "SELECT b.seats_total, COUNT(a.id) AS boarded_count "
                "FROM trips t JOIN buses b ON b.id = t.bus_id "
                "LEFT JOIN attendance_records a ON a.trip_id = t.id AND a.state = 'boarded' "
                "WHERE t.id = %s GROUP BY b.seats_total",
                (trip_id,),
            )
            capacity = cursor.fetchone()
            if capacity["boarded_count"] >= capacity["seats_total"]:
                raise HTTPException(status_code=409, detail="Bus has no available seats")
            cursor.execute(
                "UPDATE attendance_records SET state = 'boarded', boarded_at = UTC_TIMESTAMP() "
                "WHERE trip_id = %s AND student_id = %s AND state = 'waiting'",
                (trip_id, payload.student_id),
            )
            new_state = "boarded"
        else:
            cursor.execute(
                "UPDATE attendance_records SET state = 'checked_out', "
                "checked_out_at = UTC_TIMESTAMP(), checkout_reason = %s "
                "WHERE trip_id = %s AND student_id = %s AND state = 'boarded'",
                (payload.reason, trip_id, payload.student_id),
            )
            new_state = "checked_out"
        if cursor.rowcount == 0:
            cursor.execute(
                "SELECT state FROM attendance_records WHERE trip_id = %s AND student_id = %s",
                (trip_id, payload.student_id),
            )
            record = cursor.fetchone()
            if not record:
                raise HTTPException(status_code=404, detail="Student record not found for trip")
            raise HTTPException(status_code=409, detail=f"Cannot {payload.action} student from state {record['state']}")
        connection.commit()
        return {"trip_id": trip_id, "student_id": payload.student_id, "state": new_state}


@app.post(f"{API_PREFIX}/trips/{{trip_id}}/delay")
def add_delay(trip_id: str, payload: DelayRequest):
    with database_cursor(dictionary=True) as (connection, cursor):
        trip = _fetch_trip(cursor, trip_id, for_update=True)
        if trip["status"] == "ended":
            raise HTTPException(status_code=409, detail="Trip has ended")
        if trip["total_delay_minutes"] + payload.minutes > 60:
            raise HTTPException(status_code=422, detail="Total delay cannot exceed 60 minutes")
        log_id = f"dly_{trip_id}_{os.urandom(6).hex()}"
        cursor.execute(
            "INSERT INTO delay_logs (id, trip_id, minutes, reason, note) VALUES (%s, %s, %s, %s, %s)",
            (log_id, trip_id, payload.minutes, payload.reason, payload.note),
        )
        new_total = trip["total_delay_minutes"] + payload.minutes
        cursor.execute("UPDATE trips SET total_delay_minutes = %s WHERE id = %s", (new_total, trip_id))
        connection.commit()
        return {"trip_id": trip_id, "total_delay_minutes": new_total}


@app.post(f"{API_PREFIX}/trips/{{trip_id}}/replace")
def replace_bus_or_driver(trip_id: str, payload: ReplaceRequest):
    if not payload.new_bus_id and not payload.new_driver_name and not payload.new_driver_phone:
        raise HTTPException(status_code=422, detail="Provide a replacement bus or driver")
    with database_cursor(dictionary=True) as (connection, cursor):
        trip = _fetch_trip(cursor, trip_id, for_update=True)
        if trip["status"] == "ended":
            raise HTTPException(status_code=409, detail="Trip has ended")
        cursor.execute(
            "SELECT t.bus_id, t.driver_name, t.driver_phone FROM trips t "
            "JOIN buses b ON b.id = t.bus_id WHERE t.id = %s FOR UPDATE",
            (trip_id,),
        )
        current = cursor.fetchone()
        old_bus_id = current["bus_id"]
        old_driver_name = current["driver_name"]
        old_driver_phone = current["driver_phone"]
        target_bus_id = payload.new_bus_id or old_bus_id
        target_driver_name = payload.new_driver_name or old_driver_name
        target_driver_phone = payload.new_driver_phone or old_driver_phone
        if payload.new_bus_id:
            cursor.execute("SELECT id, driver_name, driver_phone FROM buses WHERE id = %s", (payload.new_bus_id,))
            replacement_bus = cursor.fetchone()
            if not replacement_bus:
                raise HTTPException(status_code=404, detail="Replacement bus not found")
            if not payload.new_driver_name:
                target_driver_name = replacement_bus["driver_name"]
            if not payload.new_driver_phone:
                target_driver_phone = replacement_bus["driver_phone"]
        cursor.execute(
            "UPDATE trips SET bus_id = %s, driver_name = %s, driver_phone = %s WHERE id = %s",
            (target_bus_id, target_driver_name, target_driver_phone, trip_id),
        )
        log_id = f"rep_{trip_id}_{os.urandom(6).hex()}"
        cursor.execute(
            "INSERT INTO replacement_logs "
            "(id, trip_id, old_bus_id, new_bus_id, old_driver_name, new_driver_name, reason, note) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
            (log_id, trip_id, old_bus_id, payload.new_bus_id, old_driver_name,
             target_driver_name if (payload.new_driver_name or payload.new_bus_id) else None,
             payload.reason, payload.note),
        )
        connection.commit()
        return {"trip_id": trip_id, "bus_id": target_bus_id, "driver_name": target_driver_name}


@app.patch(f"{API_PREFIX}/lines/{{line_id}}/return-time")
def update_return_time(line_id: str, payload: ReturnTimeRequest):
    value = payload.return_departure_time
    if len(value) == 5:
        value += ":00"
    if not ("12:00:00" <= value <= "19:00:00"):
        raise HTTPException(status_code=422, detail="Return time must be between 12:00 and 19:00")
    with database_cursor() as (connection, cursor):
        cursor.execute("UPDATE lines SET return_departure_time = %s WHERE id = %s", (value, line_id))
        if cursor.rowcount == 0:
            cursor.execute("SELECT id FROM lines WHERE id = %s", (line_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Line not found")
        connection.commit()
        return {"line_id": line_id, "return_departure_time": value}
