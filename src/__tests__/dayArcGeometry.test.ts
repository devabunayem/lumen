import { describe, expect, it } from "vitest";
import { BASE_GEOMETRY, resolveAutoScaleFactor } from "../design/tokens";
import {
  ARC_HORIZON_Y,
  ARC_X_END,
  ARC_X_START,
  buildDeCasteljauProgressPath,
  computeDayArcGeometry,
  evaluateArcAtU,
  evaluateArcAtX,
  inspectArcAtSvgX,
} from "../home/hooks/useDayArcGeometry";

describe("Day Arc geometry & scaling", () => {
  it("evaluates exact parabolic quadratic Bezier y = 96 - 328 * u * (1 - u)", () => {
    const start = evaluateArcAtU(0);
    expect(start.x).toBe(ARC_X_START);
    expect(start.y).toBe(ARC_HORIZON_Y);

    const apex = evaluateArcAtU(0.5);
    expect(apex.x).toBe(364);
    expect(apex.y).toBe(14); // 96 - 328 * 0.25 = 14

    const end = evaluateArcAtU(1);
    expect(end.x).toBe(ARC_X_END);
    expect(end.y).toBe(ARC_HORIZON_Y);

    const midLeft = evaluateArcAtX(192); // u = 0.25
    expect(midLeft.u).toBeCloseTo(0.25, 5);
    expect(midLeft.y).toBeCloseTo(96 - 328 * 0.25 * 0.75, 4);
  });

  it("splits progress arc with exact de Casteljau endpoint matching evaluateArcAtU", () => {
    for (const u of [0.25, 0.5, 0.84, 1.0]) {
      const path = buildDeCasteljauProgressPath(u);
      const tokens = path.split(" ");
      const endX = Number(tokens[tokens.length - 2]);
      const endY = Number(tokens[tokens.length - 1]);
      const pt = evaluateArcAtU(u);
      expect(endX).toBeCloseTo(pt.x, 1);
      expect(endY).toBeCloseTo(pt.y, 1);
    }
  });

  it("maps day arc from Fajr-30 to Isha+55 and switches to Jumu'ah on Friday", () => {
    const geom = computeDayArcGeometry({
      schedule: null,
      calendarEvents: [
        { id: 1, title: "Deep focus", start_at: "14:00", created_at: "" },
        { id: 2, title: "Standup meeting", start_at: "14:20", created_at: "" },
      ],
      tasks: [],
      nowDate: new Date(2026, 10, 27, 16, 41, 0),
      zoomMode: "day",
      language: "en",
      overrideFriday: true,
      overrideRamadan: true,
      overrideNowMin: 16 * 60 + 41,
    });

    expect(geom.isNightMode).toBe(false);
    expect(geom.startMin).toBe(302 - 30);
    expect(geom.endMin).toBe(1115 + 55);
    expect(geom.markers.find((m) => m.id === "dhuhr")?.label).toBe("Jumu'ah");
    expect(geom.ramadanMarkers.map((m) => m.id)).toEqual(["sehri", "iftar"]);
    // Overlapping events stack by 8 px: lane 0 -> y=101, lane 1 -> y=109
    expect(geom.events).toHaveLength(2);
    expect(geom.events[0].y).toBe(101);
    expect(geom.events[1].y).toBe(109);
  });

  it("switches to moon night arc from Isha to next Fajr both before and after midnight", () => {
    const lateNight = computeDayArcGeometry({
      schedule: null,
      calendarEvents: [],
      tasks: [],
      nowDate: new Date(2026, 10, 26, 23, 0, 0),
      zoomMode: "day",
      language: "en",
      overrideNightMode: true,
      overrideNowMin: 23 * 60,
    });
    expect(lateNight.isNightMode).toBe(true);
    expect(lateNight.markers.map((m) => m.id)).toEqual(["isha", "fajr"]);
    expect(lateNight.nowPoint.u).toBeGreaterThan(0.2);
    expect(lateNight.nowPoint.u).toBeLessThan(0.6);

    const preFajr = computeDayArcGeometry({
      schedule: null,
      calendarEvents: [],
      tasks: [],
      nowDate: new Date(2026, 10, 27, 2, 30, 0),
      zoomMode: "day",
      language: "en",
      overrideNightMode: true,
      overrideNowMin: 150,
    });
    expect(preFajr.isNightMode).toBe(true);
    expect(preFajr.nowPoint.u).toBeGreaterThan(0.5);
  });

  it("inspects scrub cursor time/event and supports 3-hour zoom + Auto scale rules", () => {
    const zoomed = computeDayArcGeometry({
      schedule: null,
      calendarEvents: [],
      tasks: [],
      nowDate: new Date(2026, 10, 26, 16, 41, 0),
      zoomMode: "next3h",
      language: "en",
      overrideNowMin: 16 * 60 + 41,
    });
    expect(zoomed.endMin - zoomed.startMin).toBe(200);
    const scrub = inspectArcAtSvgX(364, zoomed, "Nothing scheduled");
    expect(scrub.quarterBucket).toBeGreaterThan(0);

    expect(resolveAutoScaleFactor(1440)).toBe(1);
    expect(resolveAutoScaleFactor(1920)).toBe(1.15);
    expect(resolveAutoScaleFactor(2560)).toBe(1.3);
    expect(Math.round(BASE_GEOMETRY.homeExpanded.width * 1.5)).toBe(1140);
    expect(Math.round(BASE_GEOMETRY.homeExpanded.height * 1.5)).toBe(564);
  });
});
