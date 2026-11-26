from dataclasses import dataclass, field, replace
from datetime import date, datetime, time, timezone
from typing import Dict, List, Optional


@dataclass
class Stop:
    id: str
    stop_order: int
    name_en: str
    pickup_time: Optional[time] = None


@dataclass
class Line:
    id: str
    code: str
    name_en: str
    campus_arrival: time = time(8, 30)
    return_departure_time: time = time(16, 30)
    stops: List[Stop] = field(default_factory=list)

    def update_return_time(self, new_time: time) -> time:
        if not (time(12, 0) <= new_time <= time(19, 0)):
            raise ValueError("RETURN_TIME_OUT_OF_RANGE")
        self.return_departure_time = new_time
        return self.return_departure_time


@dataclass
class Bus:
    id: str
    plate: str
    bus_type: str
    seats_total: int
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None


@dataclass
class AttendanceRecord:
    student_id: str
    student_name: str
    stop_name: str
    state: str = "waiting"  # waiting / boarded / checked_out / not_going / absent
    boarded_at: Optional[datetime] = None
    checked_out_at: Optional[datetime] = None
    checkout_reason: Optional[str] = None


@dataclass
class ReplacementLog:
    id: str
    old_bus_id: str
    new_bus_id: Optional[str]
    old_driver_name: Optional[str]
    new_driver_name: Optional[str]
    reason: str
    note: Optional[str] = None


@dataclass
class DelayLog:
    id: str
    minutes: int
    reason: str
    note: Optional[str] = None


@dataclass
class Trip:
    id: str
    service_date: date
    direction: str  # outbound / return
    line: Line
    bus: Bus
    status: str = "not_started"  # not_started / in_progress / ended
    total_delay_minutes: int = 0
    riders: List[AttendanceRecord] = field(default_factory=list)
    replacements: List[ReplacementLog] = field(default_factory=list)
    delays: List[DelayLog] = field(default_factory=list)

    def start_trip(self) -> None:
        if self.status != "not_started":
            raise ValueError("TRIP_ALREADY_STARTED")
        self.status = "in_progress"

    def scan_rider(self, student_id: str, action: str, reason: Optional[str] = None) -> AttendanceRecord:
        if self.status != "in_progress":
            raise ValueError("TRIP_NOT_ACTIVE")
        rider = next((r for r in self.riders if r.student_id == student_id), None)
        if not rider:
            raise ValueError("NOT_ON_THIS_TRIP")

        now = datetime.now(timezone.utc)
        if action == "board":
            if rider.state != "waiting":
                raise ValueError("INVALID_STATE_FOR_BOARD")
            boarded_count = sum(1 for record in self.riders if record.state == "boarded")
            if boarded_count >= self.bus.seats_total:
                raise ValueError("BUS_CAPACITY_REACHED")
            rider.state = "boarded"
            rider.boarded_at = now
        elif action == "checkout":
            if rider.state != "boarded":
                raise ValueError("NOT_ON_BOARD")
            if not reason:
                raise ValueError("REASON_REQUIRED")
            rider.state = "checked_out"
            rider.checked_out_at = now
            rider.checkout_reason = reason
        else:
            raise ValueError("INVALID_ACTION")
        return rider

    def add_delay(self, minutes: int, reason: str, note: Optional[str] = None, max_allowed: int = 60) -> DelayLog:
        if self.status == "ended":
            raise ValueError("TRIP_ALREADY_ENDED")
        if minutes <= 0 or self.total_delay_minutes + minutes > max_allowed:
            raise ValueError("INVALID_OR_EXCESSIVE_DELAY")
        self.total_delay_minutes += minutes
        entry = DelayLog(id=f"dly_{len(self.delays) + 1}", minutes=minutes, reason=reason, note=note)
        self.delays.append(entry)
        return entry

    def replace_bus_or_driver(
        self,
        reason: str,
        new_bus: Optional[Bus] = None,
        new_driver_name: Optional[str] = None,
        new_driver_phone: Optional[str] = None,
        note: Optional[str] = None,
    ) -> ReplacementLog:
        if self.status == "ended":
            raise ValueError("TRIP_ALREADY_ENDED")
        if not new_bus and not new_driver_name and not new_driver_phone:
            raise ValueError("NEW_BUS_OR_DRIVER_REQUIRED")

        old_bus_id = self.bus.id
        old_driver = self.bus.driver_name

        # A trip has its own assignment snapshot. Don't mutate the shared bus
        # object and accidentally change a different trip using the same bus.
        self.bus = replace(new_bus or self.bus)
        if new_driver_name:
            self.bus.driver_name = new_driver_name
        if new_driver_phone:
            self.bus.driver_phone = new_driver_phone

        entry = ReplacementLog(
            id=f"rep_{len(self.replacements) + 1}",
            old_bus_id=old_bus_id,
            new_bus_id=new_bus.id if new_bus else None,
            old_driver_name=old_driver,
            new_driver_name=self.bus.driver_name,
            reason=reason,
            note=note,
        )
        self.replacements.append(entry)
        return entry

    def end_trip(self) -> Dict[str, int]:
        if self.status != "in_progress":
            raise ValueError("TRIP_NOT_IN_PROGRESS")
        if self.direction == "outbound":
            for rider in self.riders:
                if rider.state == "waiting":
                    rider.state = "absent"
        self.status = "ended"
        return self.summary()

    def summary(self) -> Dict[str, int]:
        boarded = sum(1 for r in self.riders if r.state == "boarded")
        waiting = sum(1 for r in self.riders if r.state == "waiting")
        checked_out = sum(1 for r in self.riders if r.state == "checked_out")
        not_going = sum(1 for r in self.riders if r.state == "not_going")
        absent = sum(1 for r in self.riders if r.state == "absent")
        return {
            "seats_total": self.bus.seats_total,
            "boarded": boarded,
            "available_seats": max(0, self.bus.seats_total - boarded),
            "waiting": waiting,
            "checked_out": checked_out,
            "not_going": not_going,
            "absent": absent,
            "total_delay_minutes": self.total_delay_minutes,
        }


def demo() -> Dict[str, object]:
    """Run a small example without side effects when this module is imported."""
    line = Line(
        id="line_1",
        code="1",
        name_en="Line 1",
        stops=[Stop(id="stop_1", stop_order=1, name_en="Stop 1", pickup_time=time(7, 15))],
    )
    bus = Bus(id="bus_01", plate="ABC-123", bus_type="coaster", seats_total=24,
              driver_name="Ali", driver_phone="01000000001")
    spare_bus = Bus(id="bus_02", plate="XYZ-789", bus_type="hiace", seats_total=14,
                    driver_name="Karim", driver_phone="01000000002")
    trip = Trip(
        id="trip_01",
        service_date=date(2026, 11, 20),
        direction="outbound",
        line=line,
        bus=bus,
        riders=[
            AttendanceRecord("std_101", "Student 101", "Stop 1"),
            AttendanceRecord("std_102", "Student 102", "Stop 1"),
            AttendanceRecord("std_103", "Student 103", "Stop 1", state="not_going"),
        ],
    )
    trip.start_trip()
    trip.scan_rider("std_101", "board")
    trip.add_delay(15, "traffic", "Rush hour")
    trip.replace_bus_or_driver("breakdown", new_bus=spare_bus, note="Bus changed")
    return trip.end_trip()


if __name__ == "__main__":
    print(demo())
