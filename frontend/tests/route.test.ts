import { buildSeed } from "@/lib/mock/seed";
import { LINE_PATHS } from "@/lib/mock/line-paths";
import { linePath, positionAt } from "@/lib/mock/route";

const lines = buildSeed().lines;

describe("road paths", () => {
  it("every seeded line has a road path built for its current stops", () => {
    for (const line of lines) {
      const path = LINE_PATHS[line.id];
      expect(path?.stop_ids).toEqual(line.stops.filter((stop) => stop.active).map((stop) => stop.id));
      expect(path!.points.length).toBeGreaterThan(line.stops.length);
    }
  });

  it("the bus follows the road path, both directions", () => {
    const line = lines[0]!;
    const out = linePath(line, "outbound");
    const back = linePath(line, "return");
    expect(positionAt(line, 0, "outbound")).toMatchObject({ lat: out[0]![0], lng: out[0]![1] });
    expect(positionAt(line, 1, "outbound")).toMatchObject({ lat: out.at(-1)![0], lng: out.at(-1)![1] });
    expect(positionAt(line, 0, "return")).toMatchObject({ lat: back[0]![0], lng: back[0]![1] });
  });

  it("falls back to straight lines when the stops no longer match the path", () => {
    const line = structuredClone(lines[0]!);
    line.stops[1]!.active = false;
    const stops = line.stops.filter((stop) => stop.active);
    expect(linePath(line, "outbound")).toEqual(stops.map((stop) => [stop.lat, stop.lng]));
    expect(positionAt(line, 0, "outbound")).toMatchObject({ lat: stops[0]!.lat, lng: stops[0]!.lng });
  });
});
