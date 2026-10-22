// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.jsx";
import { leadsToCsv } from "./utils/csv";

const lead = (overrides = {}) => ({
  id: "lead-1",
  name: "Ada Lovelace",
  email: "",
  business: "Analytical Engines",
  phone: "",
  notes: "",
  dealValue: 0,
  activity: [],
  status: "New",
  followUpDate: "",
  createdAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

function seed(leads) {
  localStorage.setItem("followupflow-leads", JSON.stringify(leads));
}

function goTo(view) {
  fireEvent.click(screen.getByRole("button", { name: new RegExp(view) }));
}

function overdueStat() {
  return screen.getByText("Overdue follow-ups").parentElement.querySelector("strong")
    .textContent;
}

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("theme storage failures", () => {
  it("renders and toggles the theme when localStorage methods throw", () => {
    vi.stubGlobal("localStorage", {
      getItem() {
        throw new DOMException("The operation is insecure.", "SecurityError");
      },
      setItem() {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      },
    });

    expect(() => render(<App />)).not.toThrow();
    expect(document.documentElement.dataset.theme).toBe("light");

    fireEvent.click(screen.getByRole("button", { name: /switch to dark mode/i }));
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("renders when merely accessing localStorage throws", () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("denied", "SecurityError");
      },
    });

    try {
      expect(() => render(<App />)).not.toThrow();
      expect(screen.getByRole("heading", { name: "Dashboard" })).toBeTruthy();
    } finally {
      if (original) Object.defineProperty(globalThis, "localStorage", original);
    }
  });

  it("restores and persists the dark theme in normal browsers", () => {
    localStorage.setItem("followupflow-theme", "dark");
    render(<App />);
    expect(document.documentElement.dataset.theme).toBe("dark");

    fireEvent.click(screen.getByRole("button", { name: /switch to light mode/i }));
    expect(localStorage.getItem("followupflow-theme")).toBe("light");
  });
});

describe("converted leads and overdue follow-ups", () => {
  it("counts only open leads as overdue on the dashboard", () => {
    seed([
      lead({ id: "a", status: "New", followUpDate: "2020-01-01" }),
      lead({ id: "b", name: "Grace", status: "Converted", followUpDate: "2020-01-01" }),
    ]);
    render(<App />);
    expect(overdueStat()).toBe("1");
  });

  it("does not show an Overdue badge when a date is set on a converted lead", () => {
    seed([lead({ status: "Converted" })]);
    const { container } = render(<App />);
    goTo("My Leads");

    fireEvent.change(container.querySelector("#date-lead-1"), {
      target: { value: "2020-01-01" },
    });

    expect(container.querySelector(".followup-overdue")).toBeNull();
    expect(container.querySelector("#date-lead-1").value).toBe("");
    expect(screen.getByText("Converted leads don't need follow-ups.")).toBeTruthy();
  });

  it("clears the date and the overdue badge when a lead is converted", () => {
    seed([lead({ followUpDate: "2020-01-01" })]);
    const { container } = render(<App />);
    goTo("My Leads");
    expect(container.querySelector(".followup-overdue")).not.toBeNull();

    fireEvent.change(container.querySelector("#status-lead-1"), {
      target: { value: "Converted" },
    });

    expect(container.querySelector(".followup-overdue")).toBeNull();
    expect(container.querySelector("#date-lead-1").value).toBe("");
    goTo("Dashboard");
    expect(overdueStat()).toBe("0");
  });

  it("drops the follow-up date when a lead is added as Converted", () => {
    const { container } = render(<App />);
    fireEvent.change(container.querySelector("#customer-name"), { target: { value: "Won Deal" } });
    fireEvent.change(container.querySelector("#customer-status"), { target: { value: "Converted" } });
    fireEvent.change(container.querySelector("#customer-follow-up"), { target: { value: "2020-01-01" } });
    fireEvent.click(screen.getByRole("button", { name: /add lead/i }));

    const saved = JSON.parse(localStorage.getItem("followupflow-leads"));
    expect(saved).toHaveLength(1);
    expect(saved[0].followUpDate).toBe("");
    expect(overdueStat()).toBe("0");
  });
});

describe("WhatsApp links and phone validation", () => {
  it("opens a normalized wa.me link for a valid number", () => {
    seed([lead({ phone: "0300-1234567" })]);
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<App />);
    goTo("My Leads");

    fireEvent.click(screen.getByRole("button", { name: "WhatsApp" }));

    expect(open).toHaveBeenCalledTimes(1);
    const [url, target, features] = open.mock.calls[0];
    expect(url.startsWith("https://wa.me/923001234567?text=")).toBe(true);
    expect(url).toContain("Ada%20Lovelace");
    expect(target).toBe("_blank");
    expect(features).toBe("noopener,noreferrer");
  });

  it("shows a notice instead of opening WhatsApp for an invalid number", () => {
    seed([lead({ phone: "not a number" })]);
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<App />);
    goTo("My Leads");

    fireEvent.click(screen.getByRole("button", { name: "WhatsApp" }));

    expect(open).not.toHaveBeenCalled();
    expect(screen.getByText("Enter a valid phone number with 8-15 digits.")).toBeTruthy();
  });

  it("refuses to save a lead with an invalid phone number", () => {
    const { container } = render(<App />);
    fireEvent.change(container.querySelector("#customer-name"), { target: { value: "Bad Phone" } });
    fireEvent.change(container.querySelector("#customer-phone"), { target: { value: "12ab" } });
    fireEvent.click(screen.getByRole("button", { name: /add lead/i }));

    expect(screen.getByText(/valid phone number/i)).toBeTruthy();
    expect(JSON.parse(localStorage.getItem("followupflow-leads") || "[]")).toHaveLength(0);
  });

  it("saves a lead with a valid international phone number", () => {
    const { container } = render(<App />);
    fireEvent.change(container.querySelector("#customer-name"), { target: { value: "Good Phone" } });
    fireEvent.change(container.querySelector("#customer-phone"), { target: { value: "+44 (0)20 7946 0958" } });
    fireEvent.click(screen.getByRole("button", { name: /add lead/i }));

    const saved = JSON.parse(localStorage.getItem("followupflow-leads"));
    expect(saved[0].phone).toBe("+44 (0)20 7946 0958");
  });
});

describe("message generator", () => {
  it("explains why Generate is disabled until a customer is chosen", () => {
    seed([lead()]);
    render(<App />);
    const generate = screen.getByRole("button", { name: "Generate message" });
    expect(generate.disabled).toBe(true);
    expect(screen.getByText("Choose a customer above to generate a message.")).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/choose customer/i), {
      target: { value: "lead-1" },
    });

    expect(generate.disabled).toBe(false);
    expect(screen.queryByText("Choose a customer above to generate a message.")).toBeNull();
  });
});

describe("CSV import and export", () => {
  const csvFile = (text, name = "leads.csv") => new File([text], name, { type: "text/csv" });
  const fileInput = (container) => container.querySelector('input[type="file"]');
  const choose = (container, file) =>
    fireEvent.change(fileInput(container), { target: { files: [file] } });
  const savedLeads = () => JSON.parse(localStorage.getItem("followupflow-leads") || "[]");
  const backup = leadsToCsv([
    lead({ id: "a", name: "Ada Lovelace", email: "ada@example.com", phone: "+92 300 1234567", status: "Interested", followUpDate: "2026-12-01" }),
    lead({ id: "b", name: "Grace Hopper", status: "Converted" }),
  ]);

  it("opens the file picker from the Import button", () => {
    const { container } = render(<App />);
    const click = vi.spyOn(fileInput(container), "click").mockImplementation(() => {});
    fireEvent.click(screen.getByRole("button", { name: "Import leads CSV" }));
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("restores leads from a backup into an empty app", async () => {
    const { container } = render(<App />);
    choose(container, csvFile(backup));

    expect(await screen.findByText("Imported 2 leads.")).toBeTruthy();
    await waitFor(() => expect(savedLeads()).toHaveLength(2));
    const saved = savedLeads();
    expect(saved.map((item) => item.name).sort()).toEqual(["Ada Lovelace", "Grace Hopper"]);
    expect(saved.find((item) => item.name === "Ada Lovelace")).toMatchObject({
      phone: "+92 300 1234567",
      status: "Interested",
      followUpDate: "2026-12-01",
    });
    await waitFor(() =>
      expect(screen.getByText("Total leads").parentElement.querySelector("strong").textContent).toBe("2")
    );
  });

  it("keeps existing leads and skips duplicates when the same file is imported again", async () => {
    seed([lead({ id: "keep", name: "Existing Person" })]);
    const { container } = render(<App />);

    choose(container, csvFile(backup));
    expect(await screen.findByText("Imported 2 leads.")).toBeTruthy();
    await waitFor(() => expect(savedLeads()).toHaveLength(3));

    choose(container, csvFile(backup));
    expect(await screen.findByText("No new leads were imported. Skipped 2 duplicates.")).toBeTruthy();
    await waitFor(() => expect(savedLeads()).toHaveLength(3));
    expect(savedLeads().some((item) => item.id === "keep")).toBe(true);
  });

  it("rejects a file without a Name column and changes nothing", async () => {
    const { container } = render(<App />);
    choose(container, csvFile("Email,Phone\nx@example.com,123"));

    expect(await screen.findByText(/Name column is missing/)).toBeTruthy();
    expect(savedLeads()).toHaveLength(0);
  });

  it("rejects files over the size limit without reading them", () => {
    const { container } = render(<App />);
    const big = csvFile("Name\nA");
    Object.defineProperty(big, "size", { value: 3 * 1024 * 1024 });
    choose(container, big);

    expect(screen.getByText(/too large to import/)).toBeTruthy();
    expect(savedLeads()).toHaveLength(0);
  });

  it("still exports a CSV that matches the shared serializer, with a BOM", async () => {
    const leads = [lead({ name: "Ada Lovelace", phone: "+92 300 1234567" })];
    seed(leads);
    let exported;
    URL.createObjectURL = vi.fn((blob) => {
      exported = blob;
      return "blob:test";
    });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Export leads CSV" }));

    expect(await screen.findByText("CSV export downloaded.")).toBeTruthy();
    // Read raw bytes: readAsText would silently strip the BOM we want to check.
    const bytes = new Uint8Array(
      await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsArrayBuffer(exported);
      })
    );
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder().decode(bytes.slice(3));
    expect(text).toBe(leadsToCsv(JSON.parse(localStorage.getItem("followupflow-leads"))));
    expect(text).toContain("'+92 300 1234567");
  });
});

describe("custom templates and the edit dialog", () => {
  it("fills {name} and {business} in a custom template's subject as well as its body", () => {
    seed([lead({ name: "Ada Lovelace", business: "Analytical Engines" })]);
    render(<App />);

    fireEvent.change(screen.getByLabelText(/template name/i), { target: { value: "Thanks note" } });
    fireEvent.change(screen.getByLabelText(/email subject/i), { target: { value: "Thanks {name} from {business}" } });
    fireEvent.change(screen.getByLabelText(/message body/i), { target: { value: "Hi {name}, thanks for visiting {business}." } });
    fireEvent.click(screen.getByRole("button", { name: "Save custom template" }));

    fireEvent.change(screen.getByLabelText(/choose customer/i), { target: { value: "lead-1" } });
    const purpose = screen.getByRole("option", { name: /Thanks note/ }).value;
    fireEvent.change(screen.getByLabelText(/message purpose/i), { target: { value: purpose } });
    fireEvent.click(screen.getByRole("button", { name: "Generate message" }));

    const message = screen.getByLabelText(/your message/i).value;
    expect(message).toContain("Subject: Thanks Ada Lovelace from Analytical Engines");
    expect(message).toContain("Hi Ada Lovelace, thanks for visiting Analytical Engines.");
    expect(message).not.toMatch(/\{(name|business)\}/);
  });

  it("closes the edit dialog with the Escape key without saving", () => {
    seed([lead()]);
    render(<App />);
    goTo("My Leads");

    fireEvent.click(screen.getByRole("button", { name: "Edit lead" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.change(document.getElementById("edit-name"), { target: { value: "Changed" } });

    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(JSON.parse(localStorage.getItem("followupflow-leads"))[0].name).toBe("Ada Lovelace");
  });
});
