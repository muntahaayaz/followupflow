import { describe, expect, it } from "vitest";
import {
  MAX_IMPORT_ROWS,
  importLeadsFromCsv,
  leadsToCsv,
  parseCsv,
  summarizeImport,
} from "./csv";

const clock = { now: () => "2026-10-16T08:00:00.000Z", makeId: (() => {
  let n = 0;
  return () => `id-${++n}`;
})() };

const sampleLeads = [
  {
    id: "1",
    name: "Ada Lovelace",
    email: "ada@example.com",
    business: 'Acme, "Inc"',
    phone: "+92 300 1234567",
    status: "Interested",
    followUpDate: "2026-10-20",
    notes: 'Line one\nLine two, with "quotes"',
    dealValue: 1500,
    createdAt: "2026-10-01T00:00:00.000Z",
  },
  {
    id: "2",
    name: "Grace",
    email: "",
    business: "",
    phone: "0300-1234567",
    status: "Converted",
    followUpDate: "",
    notes: "",
    dealValue: 0,
    createdAt: "2026-10-02T00:00:00.000Z",
  },
];

describe("leadsToCsv", () => {
  // Reference copy of the export code that lived inline in App.jsx before import existed.
  function originalExport(leads) {
    const columns = ["Name", "Email", "Business", "Phone", "Status", "Follow-up Date", "Notes", "Deal Value", "Created At"];
    const cell = (value) => {
      let text = String(value == null ? "" : value);
      if (/^[\s]*[=+@]/.test(text) || /^[\s]*-/.test(text)) text = "'" + text;
      return '"' + text.replace(/"/g, '""') + '"';
    };
    const rows = leads.map((l) => [l.name, l.email, l.business, l.phone, l.status, l.followUpDate, l.notes, l.dealValue, l.createdAt]);
    return [columns, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  }

  it("produces exactly the same file as the original export", () => {
    const tricky = [
      ...sampleLeads,
      { ...sampleLeads[0], name: "=SUM(A1)", phone: "-5", notes: "  @x" },
      { ...sampleLeads[0], name: null, email: undefined },
    ];
    expect(leadsToCsv(tricky)).toBe(originalExport(tricky));
  });

  it("guards formula-looking cells and escapes quotes", () => {
    const csv = leadsToCsv([{ ...sampleLeads[0], name: "=1+1" }]);
    expect(csv).toContain(`"'=1+1"`);
    expect(csv).toContain(`"Acme, ""Inc"""`);
    expect(csv).toContain(`"'+92 300 1234567"`);
  });
});

describe("parseCsv", () => {
  it("parses quoted fields, escaped quotes and embedded newlines", () => {
    expect(parseCsv('a,"b,1","c ""q""","x\ny"\r\n1,2,3,4')).toEqual([
      ["a", "b,1", 'c "q"', "x\ny"],
      ["1", "2", "3", "4"],
    ]);
  });

  it("handles a BOM, CR-only line endings and a missing final newline", () => {
    expect(parseCsv("\uFEFFa,b\rc,d")).toEqual([["a", "b"], ["c", "d"]]);
  });

  it("skips blank lines and keeps empty cells", () => {
    expect(parseCsv("a,b\n\n,\n1,\n")).toEqual([["a", "b"], ["1", ""]]);
  });

  it("detects semicolon-separated files", () => {
    expect(parseCsv("Name;Email\nAda;a@x.com")).toEqual([["Name", "Email"], ["Ada", "a@x.com"]]);
  });

  it("returns no rows for empty input", () => {
    expect(parseCsv("")).toEqual([]);
    expect(parseCsv(null)).toEqual([]);
  });
});

describe("importLeadsFromCsv", () => {
  it("round-trips an export without losing data", () => {
    const result = importLeadsFromCsv(leadsToCsv(sampleLeads), [], clock);
    expect(result).toMatchObject({ added: 2, duplicates: 0, invalid: 0, ignoredDates: 0 });

    const [ada, grace] = result.leads;
    expect(ada).toMatchObject({
      name: "Ada Lovelace",
      email: "ada@example.com",
      business: 'Acme, "Inc"',
      phone: "+92 300 1234567",
      status: "Interested",
      followUpDate: "2026-10-20",
      notes: 'Line one\nLine two, with "quotes"',
      dealValue: 1500,
      createdAt: "2026-10-01T00:00:00.000Z",
    });
    expect(grace).toMatchObject({ status: "Converted", followUpDate: "", phone: "0300-1234567" });
  });

  it("round-trips formula-guarded values back to the originals", () => {
    const leads = [{ ...sampleLeads[0], name: "=SUM(A1)", phone: "-5", notes: "  @x" }];
    const [lead] = importLeadsFromCsv(leadsToCsv(leads), [], clock).leads;
    expect(lead.name).toBe("=SUM(A1)");
    expect(lead.phone).toBe("-5");
    expect(lead.notes).toBe("@x"); // surrounding whitespace is trimmed
  });

  it("gives imported leads new unique ids and an import history entry", () => {
    const { leads } = importLeadsFromCsv(leadsToCsv(sampleLeads), [], clock);
    expect(new Set(leads.map((lead) => lead.id)).size).toBe(2);
    expect(leads[0].id).not.toBe("1");
    expect(leads[0].activity[0]).toMatchObject({ message: "Imported from CSV", at: clock.now() });
  });

  it("skips leads that already exist, so re-importing a backup is safe", () => {
    const result = importLeadsFromCsv(leadsToCsv(sampleLeads), sampleLeads, clock);
    expect(result).toMatchObject({ added: 0, duplicates: 2 });
    expect(result.leads).toEqual([]);
  });

  it("matches duplicates ignoring case and spacing, and within the file itself", () => {
    const csv = "Name,Email,Business\nAda,ADA@x.com,Acme\n ada ,ada@x.com, acme \nAda,other@x.com,Acme";
    const result = importLeadsFromCsv(csv, [], clock);
    expect(result).toMatchObject({ added: 2, duplicates: 1 });
  });

  it("skips rows without a name", () => {
    const result = importLeadsFromCsv("Name,Email\n,a@x.com\n  ,b@x.com\nZed,z@x.com", [], clock);
    expect(result).toMatchObject({ added: 1, invalid: 2 });
  });

  it("falls back to New for unknown statuses and accepts any letter case", () => {
    const csv = "Name,Status\nA,bogus\nB,CONTACTED\nC,";
    const statuses = importLeadsFromCsv(csv, [], clock).leads.map((lead) => lead.status);
    expect(statuses).toEqual(["New", "Contacted", "New"]);
  });

  it("clears the follow-up date of converted leads", () => {
    const csv = "Name,Status,Follow-up Date\nA,Converted,2020-01-01";
    expect(importLeadsFromCsv(csv, [], clock).leads[0].followUpDate).toBe("");
  });

  it("ignores dates that are not real YYYY-MM-DD dates and counts them", () => {
    const csv = "Name,Follow-up Date\nA,10/16/2026\nB,2026-02-31\nC,2026-10-16";
    const result = importLeadsFromCsv(csv, [], clock);
    expect(result.ignoredDates).toBe(2);
    expect(result.leads.map((lead) => lead.followUpDate)).toEqual(["", "", "2026-10-16"]);
  });

  it("cleans deal values", () => {
    const csv = 'Name,Deal Value\nA,"1,250"\nB,-40\nC,abc\nD,1e999\nE,';
    expect(importLeadsFromCsv(csv, [], clock).leads.map((lead) => lead.dealValue)).toEqual([1250, 0, 0, 0, 0]);
  });

  it("uses the created date from the file, or now when it is missing or invalid", () => {
    const csv = "Name,Created At\nA,2026-01-02T03:04:05.000Z\nB,nonsense\nC,";
    const created = importLeadsFromCsv(csv, [], clock).leads.map((lead) => lead.createdAt);
    expect(created).toEqual(["2026-01-02T03:04:05.000Z", clock.now(), clock.now()]);
  });

  it("understands common header names and ignores unknown columns", () => {
    const csv = "Customer name,Company / business,Phone / WhatsApp,Mobile,Favourite colour\nAda,Acme,0300-1,999,blue";
    const [lead] = importLeadsFromCsv(csv, [], clock).leads;
    expect(lead).toMatchObject({ name: "Ada", business: "Acme", phone: "0300-1" });
    expect(lead).not.toHaveProperty("colour");
  });

  it("truncates oversized fields", () => {
    const csv = `Name,Notes\n${"n".repeat(500)},${"x".repeat(9000)}`;
    const [lead] = importLeadsFromCsv(csv, [], clock).leads;
    expect(lead.name).toHaveLength(200);
    expect(lead.notes).toHaveLength(5000);
  });

  it("does not execute or interpret markup in values", () => {
    const [lead] = importLeadsFromCsv('Name\n"<img src=x onerror=alert(1)>"', [], clock).leads;
    expect(lead.name).toBe("<img src=x onerror=alert(1)>");
  });

  it("rejects files that are not usable", () => {
    expect(importLeadsFromCsv("", [], clock).error).toMatch(/empty/i);
    expect(importLeadsFromCsv("Email,Phone\na@x.com,1", [], clock).error).toMatch(/Name column/);
    expect(importLeadsFromCsv("Name,Email", [], clock).error).toMatch(/no lead rows/i);
    expect(importLeadsFromCsv("PK\u0003\u0004binary", [], clock).error).toBeTruthy();
  });

  it("rejects files with too many rows", () => {
    const rows = Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => `Lead ${i}`);
    expect(importLeadsFromCsv(`Name\n${rows.join("\n")}`, [], clock).error).toMatch(/more than/);
    const ok = Array.from({ length: MAX_IMPORT_ROWS }, (_, i) => `Lead ${i}`);
    expect(importLeadsFromCsv(`Name\n${ok.join("\n")}`, [], clock).added).toBe(MAX_IMPORT_ROWS);
  });
});

describe("summarizeImport", () => {
  it("describes what happened", () => {
    expect(summarizeImport({ added: 1, duplicates: 0, invalid: 0, ignoredDates: 0 })).toBe("Imported 1 lead.");
    expect(summarizeImport({ added: 3, duplicates: 2, invalid: 1, ignoredDates: 1 })).toBe(
      "Imported 3 leads. Skipped 2 duplicates. Skipped 1 row without a name. 1 follow-up date not in YYYY-MM-DD format was left blank."
    );
    expect(summarizeImport({ added: 0, duplicates: 4, invalid: 0, ignoredDates: 0 })).toBe(
      "No new leads were imported. Skipped 4 duplicates."
    );
  });
});
