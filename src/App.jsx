import { useEffect, useState } from "react";
import "./App.css";

const STORAGE_KEY = "followupflow-leads";

const STATUSES = ["New", "Contacted", "Interested", "Converted"];

const MESSAGE_TEMPLATES = {
  introduction: {
    label: "First follow-up",
    subject: "Following up on our conversation",
    body: (name, business) =>
      `Hi ${name},

I hope you're doing well. I wanted to follow up and introduce how we might be able to help${
        business ? ` ${business}` : ""
      }.

Would you be available for a quick conversation? I'd be happy to answer any questions.

Best regards`,
  },
  interested: {
    label: "Interested customer",
    subject: "Checking in",
    body: (name, business) =>
      `Hi ${name},

Thank you for your interest${
        business ? ` in working with ${business}` : ""
      }. I wanted to check whether you have any questions or need any additional information.

I'd be happy to help you with the next steps.

Best regards`,
  },
  quote: {
    label: "Quote or proposal",
    subject: "Following up on your quote",
    body: (name, business) =>
      `Hi ${name},

I hope you're doing well. I'm following up on the quote or proposal we discussed${
        business ? ` regarding ${business}` : ""
      }.

Have you had a chance to review it? Please let me know if you'd like any clarification.

Thank you for your time.

Best regards`,
  },
  reminder: {
    label: "Polite reminder",
    subject: "A quick follow-up",
    body: (name, business) =>
      `Hi ${name},

I wanted to send a quick, friendly reminder about our previous conversation${
        business ? ` concerning ${business}` : ""
      }.

Whenever you have a moment, please let me know if there are any updates. No rush, and thank you for your time.

Best regards`,
  },
  closing: {
    label: "Closing the conversation",
    subject: "Checking in one last time",
    body: (name, business) =>
      `Hi ${name},

I'm checking in one last time regarding our previous conversation${
        business ? ` about ${business}` : ""
      }.

I understand you may be busy or your priorities may have changed. If you'd like to reconnect in the future, I'd be happy to hear from you.

Thank you, and I wish you all the best.

Best regards`,
  },
};

function getToday() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getFollowUpState(date) {
  if (!date) return "Not scheduled";

  const today = getToday();

  if (date < today) return "Overdue";
  if (date === today) return "Due today";

  return "Upcoming";
}

function formatDate(date) {
  if (!date) return "No date set";

  const parsed = new Date(`${date}T12:00:00`);

  if (Number.isNaN(parsed.getTime())) return "Invalid date";

  return parsed.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function loadLeads() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);

    if (!saved) return [];

    const parsed = JSON.parse(saved);

    if (!Array.isArray(parsed)) return [];

    // Ignore invalid records rather than crashing the whole dashboard.
    return parsed.filter(
      (lead) =>
        lead &&
        typeof lead === "object" &&
        lead.id != null &&
        typeof lead.name === "string"
    );
  } catch (error) {
    console.error("Could not load saved leads:", error);
    return [];
  }
}

function createLeadId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getStatusClass(status) {
  return String(status || "New").toLowerCase().replace(/\s+/g, "-");
}

function getFollowUpClass(status) {
  return String(status || "Not scheduled")
    .toLowerCase()
    .replace(/\s+/g, "-");
}

export default function App() {
  const [leads, setLeads] = useState(loadLeads);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [business, setBusiness] = useState("");
  const [status, setStatus] = useState("New");
  const [followUpDate, setFollowUpDate] = useState("");

  const [activeView, setActiveView] = useState("Dashboard");
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [messageType, setMessageType] = useState("introduction");
  const [generatedMessage, setGeneratedMessage] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

  const [storageWarning, setStorageWarning] = useState("");
  const [notice, setNotice] = useState("");

  // Save changes safely without crashing if browser storage is unavailable.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
      setStorageWarning("");
    } catch (error) {
      console.error("Could not save leads:", error);
      setStorageWarning(
        "Your browser could not save changes. Do not clear this page or browser data; make a backup of your leads."
      );
    }
  }, [leads]);

  // Clear message selection if its customer is deleted.
  useEffect(() => {
    if (
      selectedLeadId &&
      !leads.some((lead) => String(lead.id) === selectedLeadId)
    ) {
      setSelectedLeadId("");
      setGeneratedMessage("");
      setCopyStatus("");
    }
  }, [leads, selectedLeadId]);

  function addLead(event) {
    event.preventDefault();

    const cleanName = name.trim();
    const cleanEmail = email.trim();

    if (!cleanName) {
      setNotice("Please enter the customer's name.");
      return;
    }

    // The email field is optional, but validate it if supplied.
    if (
      cleanEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
    ) {
      setNotice("Please enter a valid email address.");
      return;
    }

    const newLead = {
      id: createLeadId(),
      name: cleanName,
      email: cleanEmail,
      business: business.trim(),
      status,
      followUpDate,
      createdAt: new Date().toISOString(),
    };

    setLeads((current) => [newLead, ...current]);

    setName("");
    setEmail("");
    setBusiness("");
    setStatus("New");
    setFollowUpDate("");
    setNotice("Lead added successfully.");
  }

  function updateLead(id, changes) {
    setLeads((current) =>
      current.map((lead) =>
        String(lead.id) === String(id)
          ? { ...lead, ...changes }
          : lead
      )
    );
  }

  function handleStatusChange(lead, newStatus) {
    if (lead.status === newStatus) return;

    updateLead(lead.id, { status: newStatus });
    setNotice(`${lead.name}'s status updated to ${newStatus}.`);
  }

  function handleFollowUpChange(lead, newDate) {
    updateLead(lead.id, { followUpDate: newDate });
    setNotice(
      newDate
        ? `Follow-up date updated for ${lead.name}.`
        : `Follow-up date removed for ${lead.name}.`
    );
  }

  function deleteLead(id) {
    const lead = leads.find(
      (item) => String(item.id) === String(id)
    );

    if (!lead) return;

    const confirmed = window.confirm(
      `Delete ${lead.name} from your leads? This cannot be undone.`
    );

    if (!confirmed) return;

    setLeads((current) =>
      current.filter((item) => String(item.id) !== String(id))
    );

    setNotice(`${lead.name} was removed from your leads.`);
  }

  const selectedLead = leads.find(
    (lead) => String(lead.id) === selectedLeadId
  );

  function generateMessage() {
    if (!selectedLead) {
      setCopyStatus("Please select a customer first.");
      return;
    }

    const template = MESSAGE_TEMPLATES[messageType];

    if (!template) {
      setCopyStatus("Please choose a valid message purpose.");
      return;
    }

    const message = template.body(
      selectedLead.name,
      selectedLead.business || ""
    );

    setGeneratedMessage(`${template.subject}\n\n${message}`);
    setCopyStatus("");
  }

  async function copyMessage() {
    if (!generatedMessage.trim()) {
      setCopyStatus("Generate a message first.");
      return;
    }

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard access is unavailable.");
      }

      await navigator.clipboard.writeText(generatedMessage);

      setCopyStatus(
        "Message copied! You can paste it into your email or chat."
      );
    } catch {
      setCopyStatus(
        "Automatic copying was blocked. Select the message and press Ctrl+C."
      );
    }
  }

  const newCount = leads.filter(
    (lead) => lead.status === "New"
  ).length;

  const convertedCount = leads.filter(
    (lead) => lead.status === "Converted"
  ).length;

  const scheduledLeads = leads
    .filter(
      (lead) =>
        typeof lead.followUpDate === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(lead.followUpDate)
    )
    .sort((a, b) => a.followUpDate.localeCompare(b.followUpDate));

  const overdueCount = scheduledLeads.filter(
    (lead) => getFollowUpState(lead.followUpDate) === "Overdue"
  ).length;

  const todayCount = scheduledLeads.filter(
    (lead) => getFollowUpState(lead.followUpDate) === "Due today"
  ).length;

  const visibleLeads =
    activeView === "Follow-ups" ? scheduledLeads : leads;

  return (
    <div className="app">
      <aside className="sidebar">
        <h2 className="logo">
          FollowUp<span>Flow</span>
        </h2>

        <p className="nav-label">WORKSPACE</p>

        {["Dashboard", "My Leads", "Follow-ups"].map((view) => (
          <button
            key={view}
            type="button"
            className={`nav-item ${
              activeView === view ? "active" : ""
            }`}
            onClick={() => setActiveView(view)}
          >
            {view === "Dashboard" && "▦"}
            {view === "My Leads" && "♙"}
            {view === "Follow-ups" && "✓"}
            &nbsp; {view}
          </button>
        ))}

        <div className="sidebar-bottom">
          Your business, organized.
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">YOUR WORKSPACE</p>
            <h1>{activeView}</h1>
          </div>

          <span className="avatar">F</span>
        </header>

        {notice && (
          <p className="app-notice" role="status">
            {notice}
            <button
              type="button"
              className="dismiss-notice"
              onClick={() => setNotice("")}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </p>
        )}

        {storageWarning && (
          <div className="storage-warning" role="alert">
            <strong>Storage warning:</strong> {storageWarning}
          </div>
        )}

        {activeView === "Dashboard" && (
          <>
            <section className="welcome">
              <p className="eyebrow">LET'S GROW YOUR BUSINESS</p>
              <h2>Every customer deserves a follow-up.</h2>
              <p>
                Keep your potential customers organized in one place.
              </p>
            </section>

            <section className="stats">
              <div className="stat-card">
                <span>Total leads</span>
                <strong>{leads.length}</strong>
              </div>

              <div className="stat-card">
                <span>New leads</span>
                <strong>{newCount}</strong>
              </div>

              <div className="stat-card">
                <span>Converted</span>
                <strong>{convertedCount}</strong>
              </div>
            </section>

            <section className="followup-summary">
              <div>
                <span>Overdue follow-ups</span>
                <strong>{overdueCount}</strong>
              </div>

              <div>
                <span>Due today</span>
                <strong>{todayCount}</strong>
              </div>

              <button
                type="button"
                onClick={() => setActiveView("Follow-ups")}
              >
                View follow-ups →
              </button>
            </section>
          </>
        )}

        <section className="content-grid">
          {activeView !== "Follow-ups" && (
            <div className="panel">
              <h2>Add a lead</h2>
              <p className="muted">Save a potential customer.</p>

              <form onSubmit={addLead}>
                <label htmlFor="customer-name">
                  Customer name *
                </label>
                <input
                  id="customer-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Ayesha Khan"
                  autoComplete="name"
                  required
                />

                <label htmlFor="customer-email">
                  Email address
                </label>
                <input
                  id="customer-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="customer@example.com"
                  autoComplete="email"
                />

                <label htmlFor="customer-business">
                  Business or company
                </label>
                <input
                  id="customer-business"
                  value={business}
                  onChange={(event) => setBusiness(event.target.value)}
                  placeholder="e.g. Bright Studio"
                />

                <label htmlFor="lead-status">Lead status</label>
                <select
                  id="lead-status"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  {STATUSES.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>

                <label htmlFor="new-follow-up">
                  Next follow-up date
                </label>
                <input
                  id="new-follow-up"
                  type="date"
                  value={followUpDate}
                  onChange={(event) =>
                    setFollowUpDate(event.target.value)
                  }
                />

                <p className="field-hint">
                  You can select a past date for a missed follow-up.
                </p>

                <button type="submit">+ Add customer</button>
              </form>
            </div>
          )}

          <div className="panel leads-panel">
            <div className="panel-heading">
              <div>
                <h2>
                  {activeView === "Follow-ups"
                    ? "Scheduled follow-ups"
                    : activeView === "My Leads"
                      ? "All your leads"
                      : "Your leads"}
                </h2>

                <p className="muted">
                  {activeView === "Follow-ups"
                    ? "Sorted by the next follow-up date."
                    : "Manage your customer pipeline and next contact dates."}
                </p>
              </div>

              <span className="count">{visibleLeads.length}</span>
            </div>

            {visibleLeads.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">✓</div>
                <h3>
                  {activeView === "Follow-ups"
                    ? "No scheduled follow-ups"
                    : "No leads yet"}
                </h3>
                <p>
                  {activeView === "Follow-ups"
                    ? "Add a follow-up date to a lead to see it here."
                    : "Add your first customer using the form."}
                </p>
              </div>
            ) : (
              <div className="lead-list">
                {visibleLeads.map((lead) => {
                  const followUpState = getFollowUpState(
                    lead.followUpDate
                  );

                  return (
                    <article className="lead" key={lead.id}>
                      <div className="lead-avatar">
                        {(lead.name || "?").charAt(0).toUpperCase()}
                      </div>

                      <div className="lead-info">
                        <strong>{lead.name}</strong>

                        <p>
                          {lead.business || lead.email || "New customer"}
                        </p>

                        {lead.email && lead.business && (
                          <p>{lead.email}</p>
                        )}

                        <span
                          className={`status status-${getStatusClass(
                            lead.status
                          )}`}
                        >
                          {lead.status}
                        </span>

                        <div className="followup-date">
                          <label htmlFor={`date-${lead.id}`}>
                            Next follow-up
                          </label>

                          <input
                            id={`date-${lead.id}`}
                            type="date"
                            value={lead.followUpDate || ""}
                            onChange={(event) =>
                              handleFollowUpChange(
                                lead,
                                event.target.value
                              )
                            }
                          />

                          <span
                            className={`followup-badge followup-${getFollowUpClass(
                              followUpState
                            )}`}
                          >
                            {followUpState}
                          </span>

                          {lead.followUpDate && (
                            <p className="date-caption">
                              {formatDate(lead.followUpDate)}
                            </p>
                          )}
                        </div>

                        <label
                          className="status-label"
                          htmlFor={`status-${lead.id}`}
                        >
                          Lead status
                        </label>

                        <select
                          id={`status-${lead.id}`}
                          value={lead.status}
                          onChange={(event) =>
                            handleStatusChange(lead, event.target.value)
                          }
                        >
                          {STATUSES.map((item) => (
                            <option key={item}>{item}</option>
                          ))}
                        </select>

                        <button
                          type="button"
                          className="generate-for-lead"
                          onClick={() => {
                            setSelectedLeadId(String(lead.id));
                            setGeneratedMessage("");
                            setCopyStatus("");
                            setActiveView("Dashboard");
                          }}
                        >
                          Write follow-up message
                        </button>
                      </div>

                      <button
                        type="button"
                        className="delete-button"
                        onClick={() => deleteLead(lead.id)}
                        aria-label={`Delete ${lead.name}`}
                        title="Delete lead"
                      >
                        ×
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="panel message-panel">
          <div className="message-heading">
            <div>
              <p className="eyebrow">SAVE TIME</p>
              <h2>Follow-up Message Generator</h2>
              <p className="muted">
                Create a personalized English message for your customer.
              </p>
            </div>

            <span className="message-icon">✉</span>
          </div>

          {leads.length === 0 ? (
            <div className="empty">
              <h3>Add a customer to get started</h3>
              <p>
                Your generated message will be personalized for that lead.
              </p>
            </div>
          ) : (
            <>
              <div className="message-controls">
                <div>
                  <label htmlFor="message-lead">Choose customer</label>
                  <select
                    id="message-lead"
                    value={selectedLeadId}
                    onChange={(event) => {
                      setSelectedLeadId(event.target.value);
                      setGeneratedMessage("");
                      setCopyStatus("");
                    }}
                  >
                    <option value="">Select a customer...</option>
                    {leads.map((lead) => (
                      <option key={lead.id} value={String(lead.id)}>
                        {lead.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="message-type">Message purpose</label>
                  <select
                    id="message-type"
                    value={messageType}
                    onChange={(event) => {
                      setMessageType(event.target.value);
                      setGeneratedMessage("");
                      setCopyStatus("");
                    }}
                  >
                    {Object.entries(MESSAGE_TEMPLATES).map(
                      ([key, template]) => (
                        <option key={key} value={key}>
                          {template.label}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>

              {selectedLead && (
                <div className="selected-customer">
                  Writing a message for{" "}
                  <strong>{selectedLead.name}</strong>
                  {selectedLead.business
                    ? ` · ${selectedLead.business}`
                    : ""}
                </div>
              )}

              <button
                type="button"
                className="generate-button"
                onClick={generateMessage}
                disabled={!selectedLead}
              >
                Generate message
              </button>

              <label
                className="generated-label"
                htmlFor="generated-message"
              >
                Your message (you can edit it)
              </label>

              <textarea
                id="generated-message"
                className="generated-message"
                rows={10}
                value={generatedMessage}
                onChange={(event) => {
                  setGeneratedMessage(event.target.value);
                  setCopyStatus("");
                }}
                placeholder="Choose a customer and click Generate message..."
              />

              <div className="message-actions">
                <button
                  type="button"
                  className="copy-message-button"
                  onClick={copyMessage}
                  disabled={!generatedMessage.trim()}
                >
                  Copy message
                </button>

                <button
                  type="button"
                  className="secondary-message-button"
                  onClick={() => {
                    setGeneratedMessage("");
                    setCopyStatus("");
                  }}
                >
                  Clear
                </button>
              </div>

              {copyStatus && (
                <p className="copy-status" role="status">
                  {copyStatus}
                </p>
              )}

              <p className="message-note">
                Your leads and message templates are stored locally in
                this browser when storage is available. Review messages
                before sending. No email or WhatsApp message is sent
                automatically.
              </p>
            </>
          )}
        </section>

        <footer>
          FollowUpFlow · Never lose a lead again.
        </footer>
      </main>
    </div>
  );
}