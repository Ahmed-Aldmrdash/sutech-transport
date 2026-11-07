import { MOCK_LINES, type MockDriverSource, type MockLineSource } from "./mock-lines";
import { BusType } from "./schema";

/**
 * Mock only: the buses and drivers the Transportation office can send when a bus breaks down
 * or a driver can't drive. Each line's own bus and driver come from the Abu El Hol drivers
 * list; the spares here are made up until Abu El Hol says which buses stand by at the garage.
 */
export interface MockFleetDriver extends MockDriverSource {
  driverId: string;
}

export interface MockFleetBus {
  busId: string;
  busType: BusType;
  plate: string;
  /** The driver who comes with this bus. */
  driverId: string;
}

const SPARE_DRIVERS: readonly MockFleetDriver[] = [
  {
    driverId: "drv_spare_1",
    nameAr: "سيد عبد الحميد",
    nameEn: "Sayed Abdelhamid",
    phone: "01001234561",
  },
  { driverId: "drv_spare_2", nameAr: "رضا منصور", nameEn: "Reda Mansour", phone: "01001234562" },
  { driverId: "drv_spare_3", nameAr: "أشرف جمال", nameEn: "Ashraf Gamal", phone: "01001234563" },
  { driverId: "drv_spare_4", nameAr: "هاني فوزي", nameEn: "Hany Fawzy", phone: "01001234564" },
  { driverId: "drv_spare_5", nameAr: "وليد سعيد", nameEn: "Walid Said", phone: "01001234565" },
];

/** Spare buses at the Abu El Hol garage, each with its own driver. */
export const MOCK_SPARE_BUSES: readonly MockFleetBus[] = [
  { busId: "bus_spare_1", busType: BusType.Coaster, plate: "ن ص ط 7120", driverId: "drv_spare_1" },
  { busId: "bus_spare_2", busType: BusType.LargeBus, plate: "ل م ج 6604", driverId: "drv_spare_2" },
  { busId: "bus_spare_3", busType: BusType.Minibus, plate: "ب ع ر 3385", driverId: "drv_spare_3" },
];

/** Spare drivers with no bus of their own, for when only the driver has to change. */
export const MOCK_SPARE_DRIVER_IDS: readonly string[] = ["drv_spare_4", "drv_spare_5"];

export const lineBusId = (lineId: string) => `bus_${lineId}`;
export const lineDriverId = (lineId: string) => `drv_${lineId}`;

export function mockFleetBus(busId: string): MockFleetBus | undefined {
  const spare = MOCK_SPARE_BUSES.find((bus) => bus.busId === busId);
  if (spare) return spare;
  const line = MOCK_LINES.find((item) => lineBusId(item.lineId) === busId);
  return line
    ? { busId, busType: line.busType, plate: line.plate, driverId: lineDriverId(line.lineId) }
    : undefined;
}

export function mockFleetDriver(driverId: string): MockFleetDriver | undefined {
  const spare = SPARE_DRIVERS.find((driver) => driver.driverId === driverId);
  if (spare) return spare;
  const line = MOCK_LINES.find((item) => lineDriverId(item.lineId) === driverId);
  return line ? { driverId, ...line.driver } : undefined;
}

/** The line as it runs with another bus or driver: what students and guardians are shown. */
export function withFleet(
  line: MockLineSource,
  bus: MockFleetBus,
  driver: MockFleetDriver,
): MockLineSource {
  const { nameAr, nameEn, phone } = driver;
  return { ...line, busType: bus.busType, plate: bus.plate, driver: { nameAr, nameEn, phone } };
}
