import { STATUSES, createLeadId, normalizeLead } from "./leads";

export const CSV_COLUMNS = [
  "Name",
  "Email",
  "Business",
  "Phone",
  "Status",
  "Follow-up Date",
  "Notes",
  "Deal Value",
  "Created At",
];

export const MAX_IMPORT_ROWS = 5000;
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

const FIELD_LIMITS = { name: 200, email: 200, business: 200, phone: 50, notes: 5000 };

// Spreadsheets treat cells starting with = + @ - as formulas. Export prefixes
// such cells with an apostrophe; import removes it again.
const FORMULA_START = /^\s*[=+@-]/;
const GUARDED_CELL = /^'\s*[=+@-]/;

const HEADER_ALIASES = {
  name: "name",
  customername: "name",
  fullname: "name",
  email: "email",
  emailaddress: "email",
  business: "business",
  company: "business",
  companyname: "business",
  companybusiness: "business",
  phone: "phone",
  phonenumber: "phone",
  phonewhatsapp: "phone",
  whatsapp: "phone",
  mobile: "phone",
  status: "status",
  leadstatus: "status",
  followupdate: "followUpDate",
  nextfollowup: "followUpDate",
  followup: "followUpDate",
  notes: "notes",
  note: "notes",
  dealvalue: "dealValue",
  value: "dealValue",
  createdat: "createdAt",
  created: "createdAt",
};

function csvCell(value) {
  let text = String(value == null ? "" : value);
  if (FORMULA_START.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

/** Serializes leads to CSV text (without a BOM). */
export function leadsToCsv(leads) {
  const rows = leads.map((lead) => [
    lead.name,
    lead.email,
    lead.business,
    lead.phone,
    lead.status,
    lead.followUpDate,
    lead.notes,
    lead.dealValue,
    lead.createdAt,
  ]);
  return [CSV_COLUMNS, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
}

/** Parses CSV text into rows of strings. Handles quotes, BOM, CRLF and ";" files. */
export function parseCsv(text) {
  const source = String(text ?? "").replace(/^\uFEFF/, "");
  const firstLine = source.split(/\r\n|\n|\r/, 1)[0];
  const delimiter =
    !firstLine.includes(",") && firstLine.includes(";") ? ";" : ",";

  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];

    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

function normalizeHeader(header) {
  return String(header).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isRealDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function leadKey({ name, email, business }) {
  return [name, email, business]
    .map((part) => String(part || "").trim().toLowerCase())
    .join("|");
}

/**
 * Turns CSV text into new leads. Existing leads are never changed: rows that
 * match an existing lead (same name, email and business) are skipped.
 *
 * Returns { error } for unusable files, otherwise
 * { leads, added, duplicates, invalid, ignoredDates }.
 */
export function importLeadsFromCsv(
  text,
  existingLeads = [],
  { now = () => new Date().toISOString(), makeId = createLeadId } = {}
) {
  const rows = parseCsv(text);
  if (rows.length === 0) return { error: "The file is empty." };

  const fields = rows[0].map(
    (header) => HEADER_ALIASES[normalizeHeader(header)] || null
  );
  if (!fields.includes("name")) {
    return {
      error:
        "This doesn't look like a FollowUpFlow CSV: the Name column is missing.",
    };
  }

  const dataRows = rows.slice(1);
  if (dataRows.length === 0) return { error: "The file has no lead rows." };
  if (dataRows.length > MAX_IMPORT_ROWS) {
    return {
      error: `The file has more than ${MAX_IMPORT_ROWS} rows. Split it into smaller files.`,
    };
  }

  const seen = new Set(existingLeads.map(leadKey));
  const leads = [];
  let duplicates = 0;
  let invalid = 0;
  let ignoredDates = 0;

  for (const cells of dataRows) {
    const raw = {};
    fields.forEach((field, index) => {
      if (field && !(field in raw)) {
        const cell = cells[index] ?? "";
        raw[field] = GUARDED_CELL.test(cell) ? cell.slice(1) : cell;
      }
    });

    const clean = (field) =>
      String(raw[field] ?? "")
        .trim()
        .slice(0, FIELD_LIMITS[field]);

    const name = clean("name");
    if (!name) {
      invalid += 1;
      continue;
    }

    const email = clean("email");
    const business = clean("business");
    const key = leadKey({ name, email, business });
    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.add(key);

    const statusText = String(raw.status ?? "").trim().toLowerCase();
    const status =
      STATUSES.find((item) => item.toLowerCase() === statusText) || "New";

    let followUpDate = String(raw.followUpDate ?? "").trim();
    if (followUpDate && !isRealDate(followUpDate)) {
      ignoredDates += 1;
      followUpDate = "";
    }

    const dealNumber = Number(String(raw.dealValue ?? "").replace(/,/g, ""));
    const dealValue = Number.isFinite(dealNumber) ? Math.max(0, dealNumber) : 0;

    const createdText = String(raw.createdAt ?? "").trim();
    const createdAt =
      createdText && !Number.isNaN(Date.parse(createdText))
        ? new Date(createdText).toISOString()
        : now();

    leads.push(
      normalizeLead({
        id: makeId(),
        name,
        email,
        business,
        phone: clean("phone"),
        notes: clean("notes"),
        dealValue,
        status,
        followUpDate,
        createdAt,
        activity: [{ id: makeId(), message: "Imported from CSV", at: now() }],
      })
    );
  }

  return { leads, added: leads.length, duplicates, invalid, ignoredDates };
}

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** A short, human-readable summary of an import result. */
export function summarizeImport({ added, duplicates, invalid, ignoredDates }) {
  const parts = [
    added > 0 ? `Imported ${plural(added, "lead")}.` : "No new leads were imported.",
  ];
  if (duplicates > 0) {
    parts.push(`Skipped ${plural(duplicates, "duplicate")}.`);
  }
  if (invalid > 0) {
    parts.push(`Skipped ${plural(invalid, "row")} without a name.`);
  }
  if (ignoredDates > 0) {
    parts.push(
      `${plural(ignoredDates, "follow-up date")} not in YYYY-MM-DD format ${
        ignoredDates === 1 ? "was" : "were"
      } left blank.`
    );
  }
  return parts.join(" ");
}
