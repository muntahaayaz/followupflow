import { getFollowUpState, getToday } from "./dates";
import { getStorage, safeGetItem } from "./storage";

export const STORAGE_KEY = "followupflow-leads";
export const STATUSES = ["New", "Contacted", "Interested", "Converted"];
export const CONVERTED = "Converted";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ACTIVITY_ENTRIES = 30;

const ACTIVITY_LABELS = {
  status: "Status updated",
  followUpDate: "Follow-up date updated",
  name: "Customer name updated",
  email: "Email updated",
  business: "Business updated",
  phone: "Phone updated",
  notes: "Notes updated",
  dealValue: "Deal value updated",
  lastFollowUpCompletedAt: "Follow-up marked done",
};

export function createLeadId() {
  return (
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

/** Cleans one stored lead. Converted leads never keep a follow-up date. */
export function normalizeLead(lead) {
  return {
    id: lead.id,
    name: lead.name || "",
    email: lead.email || "",
    business: lead.business || "",
    phone: lead.phone || "",
    notes: lead.notes || "",
    dealValue: Number(lead.dealValue) || 0,
    activity: Array.isArray(lead.activity) ? lead.activity : [],
    status: STATUSES.includes(lead.status) ? lead.status : "New",
    followUpDate:
      lead.status === CONVERTED
        ? ""
        : typeof lead.followUpDate === "string"
          ? lead.followUpDate
          : "",
    createdAt: lead.createdAt || new Date().toISOString(),
  };
}

export function loadLeads(storage = getStorage()) {
  try {
    const saved = safeGetItem(STORAGE_KEY, storage);
    if (!saved) return [];

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (lead) => lead && lead.id != null && typeof lead.name === "string"
      )
      .map(normalizeLead);
  } catch {
    return [];
  }
}

/** True only for open leads with a valid follow-up date. Converted leads never qualify. */
export function hasScheduledFollowUp(lead) {
  return (
    lead.status !== CONVERTED && DATE_PATTERN.test(lead.followUpDate || "")
  );
}

export function getScheduledLeads(leads) {
  return leads
    .filter(hasScheduledFollowUp)
    .sort((a, b) => a.followUpDate.localeCompare(b.followUpDate));
}

/** Follow-up state for one lead; Converted or undated leads are "Not scheduled". */
export function getLeadFollowUpState(lead, today = getToday()) {
  if (!hasScheduledFollowUp(lead)) return "Not scheduled";
  return getFollowUpState(lead.followUpDate, today);
}

export function countOverdue(leads, today = getToday()) {
  return leads.filter(
    (lead) => getLeadFollowUpState(lead, today) === "Overdue"
  ).length;
}

export function countDueToday(leads, today = getToday()) {
  return leads.filter(
    (lead) => getLeadFollowUpState(lead, today) === "Due today"
  ).length;
}

/**
 * Applies edits to a lead and records activity history.
 * Converting a lead (or editing one that is already converted) always clears
 * its follow-up date, so converted leads can never turn up as overdue.
 */
export function applyLeadChanges(
  lead,
  changes,
  { now = () => new Date().toISOString(), makeId = createLeadId } = {}
) {
  const nextStatus = changes.status ?? lead.status;
  const effectiveChanges =
    nextStatus === CONVERTED ? { ...changes, followUpDate: "" } : changes;

  const entries = Object.keys(effectiveChanges)
    .filter((key) => lead[key] !== effectiveChanges[key])
    .map((key) => ({
      id: makeId(),
      message:
        key === "status"
          ? `Status changed from ${lead.status} to ${effectiveChanges.status}`
          : ACTIVITY_LABELS[key] || `${key} updated`,
      at: now(),
    }));

  return {
    ...lead,
    ...effectiveChanges,
    activity: [...entries, ...(lead.activity || [])].slice(
      0,
      MAX_ACTIVITY_ENTRIES
    ),
  };
}
