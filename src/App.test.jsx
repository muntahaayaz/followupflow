// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.jsx";

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
