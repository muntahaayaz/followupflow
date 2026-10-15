import { describe, expect, it } from "vitest";
import { getFollowUpState, getWeekEnd } from "./dates";

describe("getFollowUpState", () => {
  const today = "2026-10-15";

  it("classifies dates relative to today", () => {
    expect(getFollowUpState("2026-10-14", today)).toBe("Overdue");
    expect(getFollowUpState("2026-10-15", today)).toBe("Due today");
    expect(getFollowUpState("2026-10-16", today)).toBe("Upcoming");
  });

  it("treats a missing date as not scheduled", () => {
    expect(getFollowUpState("", today)).toBe("Not scheduled");
    expect(getFollowUpState(undefined, today)).toBe("Not scheduled");
  });
});

describe("getWeekEnd", () => {
  it("returns the coming Sunday", () => {
    expect(getWeekEnd("2026-10-14")).toBe("2026-10-18"); // Wednesday
    expect(getWeekEnd("2026-10-12")).toBe("2026-10-18"); // Monday
  });

  it("returns the same day when today is Sunday", () => {
    expect(getWeekEnd("2026-10-18")).toBe("2026-10-18");
  });

  it("crosses month and year boundaries", () => {
    expect(getWeekEnd("2026-12-30")).toBe("2027-01-03");
  });
});
