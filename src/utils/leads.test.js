import { describe, expect, it } from "vitest";
import {
  STORAGE_KEY,
  applyLeadChanges,
  countDueToday,
  countOverdue,
  getLeadFollowUpState,
  getScheduledLeads,
  hasScheduledFollowUp,
  loadLeads,
} from "./leads";

const TODAY = "2026-10-15";
const makeLead = (overrides = {}) => ({
  id: "1",
  name: "Sam",
  status: "New",
  followUpDate: "",
  activity: [],
  ...overrides,
});
const clock = { now: () => "2026-10-15T09:00:00.000Z", makeId: () => "evt" };

describe("overdue counting", () => {
  const leads = [
    makeLead({ id: "a", status: "New", followUpDate: "2026-10-01" }),
    makeLead({ id: "b", status: "Interested", followUpDate: "2026-10-15" }),
    makeLead({ id: "c", status: "Contacted", followUpDate: "2026-11-01" }),
    makeLead({ id: "d", status: "Converted", followUpDate: "2026-09-01" }),
    makeLead({ id: "e", status: "New", followUpDate: "" }),
  ];

  it("does not count converted leads as overdue, even with a past date", () => {
    expect(countOverdue(leads, TODAY)).toBe(1);
  });

  it("counts only open leads due today", () => {
    expect(countDueToday(leads, TODAY)).toBe(1);
    expect(
      countDueToday([makeLead({ status: "Converted", followUpDate: TODAY })], TODAY)
    ).toBe(0);
  });

  it("reports converted and undated leads as not scheduled", () => {
    expect(getLeadFollowUpState(leads[3], TODAY)).toBe("Not scheduled");
    expect(getLeadFollowUpState(leads[4], TODAY)).toBe("Not scheduled");
    expect(getLeadFollowUpState(leads[0], TODAY)).toBe("Overdue");
    expect(getLeadFollowUpState(leads[2], TODAY)).toBe("Upcoming");
  });

  it("excludes converted and invalid-date leads from the schedule", () => {
    expect(hasScheduledFollowUp(makeLead({ followUpDate: "soon" }))).toBe(false);
    expect(getScheduledLeads(leads).map((lead) => lead.id)).toEqual(["a", "b", "c"]);
  });

  it("does not count an empty date as overdue", () => {
    expect(countOverdue([makeLead({ followUpDate: "" })], TODAY)).toBe(0);
  });
});

describe("applyLeadChanges", () => {
  it("clears the follow-up date when a lead is converted", () => {
    const lead = makeLead({ followUpDate: "2026-10-01" });
    const updated = applyLeadChanges(lead, { status: "Converted" }, clock);
    expect(updated.status).toBe("Converted");
    expect(updated.followUpDate).toBe("");
    expect(countOverdue([updated], TODAY)).toBe(0);
  });

  it("ignores a follow-up date set on an already converted lead", () => {
    const lead = makeLead({ status: "Converted" });
    const updated = applyLeadChanges(lead, { followUpDate: "2020-01-01" }, clock);
    expect(updated.followUpDate).toBe("");
    expect(updated.activity).toHaveLength(0);
  });

  it("clears the date when an edit keeps a lead converted", () => {
    const lead = makeLead({ status: "Converted" });
    const updated = applyLeadChanges(
      lead,
      { status: "Converted", followUpDate: "2020-01-01", notes: "hi" },
      clock
    );
    expect(updated.followUpDate).toBe("");
    expect(updated.notes).toBe("hi");
  });

  it("keeps follow-up dates for open leads", () => {
    const updated = applyLeadChanges(makeLead(), { followUpDate: "2026-12-01" }, clock);
    expect(updated.followUpDate).toBe("2026-12-01");
  });

  it("restores scheduling when a lead is reopened with a date", () => {
    const lead = makeLead({ status: "Converted" });
    const updated = applyLeadChanges(
      lead,
      { status: "Interested", followUpDate: "2026-12-01" },
      clock
    );
    expect(updated.followUpDate).toBe("2026-12-01");
  });
});

describe("status history", () => {
  it("records the old and new status", () => {
    const updated = applyLeadChanges(makeLead({ status: "New" }), { status: "Contacted" }, clock);
    expect(updated.activity[0]).toEqual({
      id: "evt",
      message: "Status changed from New to Contacted",
      at: "2026-10-15T09:00:00.000Z",
    });
  });

  it("does not log unchanged fields", () => {
    const updated = applyLeadChanges(makeLead({ status: "New" }), { status: "New" }, clock);
    expect(updated.activity).toHaveLength(0);
  });

  it("puts the newest entry first and keeps at most 30", () => {
    const old = Array.from({ length: 30 }, (_, i) => ({ id: `o${i}`, message: "old", at: "x" }));
    const updated = applyLeadChanges(makeLead({ activity: old }), { notes: "n" }, clock);
    expect(updated.activity).toHaveLength(30);
    expect(updated.activity[0].message).toBe("Notes updated");
    expect(updated.activity[1].id).toBe("o0");
  });

  it("uses readable labels for other fields", () => {
    const updated = applyLeadChanges(makeLead(), { phone: "+923001234567" }, clock);
    expect(updated.activity[0].message).toBe("Phone updated");
  });
});

describe("loadLeads", () => {
  const storageWith = (value) => ({
    getItem: (key) => (key === STORAGE_KEY ? value : null),
  });

  it("returns [] for empty, corrupt or non-array data", () => {
    expect(loadLeads(storageWith(null))).toEqual([]);
    expect(loadLeads(storageWith("{not json"))).toEqual([]);
    expect(loadLeads(storageWith('{"a":1}'))).toEqual([]);
  });

  it("returns [] when storage throws", () => {
    const blocked = {
      getItem() {
        throw new DOMException("denied", "SecurityError");
      },
    };
    expect(loadLeads(blocked)).toEqual([]);
    expect(loadLeads(null)).toEqual([]);
  });

  it("drops malformed entries and repairs fields", () => {
    const saved = JSON.stringify([
      null,
      { id: 1 },
      { id: 2, name: "Ada", status: "Bogus", dealValue: "12" },
    ]);
    const [lead, ...rest] = loadLeads(storageWith(saved));
    expect(rest).toHaveLength(0);
    expect(lead).toMatchObject({ id: 2, name: "Ada", status: "New", dealValue: 12, followUpDate: "" });
  });

  it("clears stale follow-up dates on converted leads", () => {
    const saved = JSON.stringify([
      { id: 1, name: "Ada", status: "Converted", followUpDate: "2020-01-01" },
    ]);
    expect(loadLeads(storageWith(saved))[0].followUpDate).toBe("");
  });
});
