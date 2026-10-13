
import { useEffect, useMemo, useState } from "react";
import "./App.css";

const STORAGE_KEY = "followupflow-leads";
const STATUSES = ["New", "Contacted", "Interested", "Converted"];

const MESSAGE_TEMPLATES = {
  introduction: {
    label: "First follow-up",
    subject: "Following up on our conversation",
    body: (name, business) =>
      `Hi ${name},\n\nI hope you're doing well. I wanted to follow up on our recent conversation${business ? ` about ${business}` : ""}. Please let me know if you have any questions or if there is anything I can help you with.\n\nLooking forward to hearing from you!`,
  },
  interested: {
    label: "Interested customer",
    subject: "Checking in",
    body: (name, business) =>
      `Hi ${name},\n\nThank you for your interest${business ? ` in ${business}` : ""}. I wanted to check in and see if you'd like any additional information. I'm happy to answer your questions and help you decide on the next steps.\n\nHope to hear from you soon!`,
  },
  quote: {
    label: "Quote or proposal",
    subject: "Following up on your quote",
    body: (name, business) =>
      `Hi ${name},\n\nI'm following up on the quote or proposal I shared${business ? ` regarding ${business}` : ""}. Have you had a chance to review it? Please let me know if you'd like any changes or have questions.\n\nThank you for your time!`,
  },
  reminder: {
    label: "Polite reminder",
    subject: "A quick follow-up",
    body: (name, business) =>
      `Hi ${name},\n\nI hope all is well. This is a friendly follow-up${business ? ` about ${business}` : ""}. When you have a moment, please let me know if there are any updates or if I can provide anything else.\n\nThanks, and have a great day!`,
  },
  closing: {
    label: "Closing the conversation",
    subject: "Checking in one last time",
    body: (name, business) =>
      `Hi ${name},\n\nI'm checking in one last time${business ? ` about ${business}` : ""}. I understand the timing may not be right, so there's no pressure. If you'd like to reconnect in the future, I'll be happy to help.\n\nWishing you all the best!`,
  },
};

function getToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
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
  if (!date) return "Not scheduled";
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;

  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function loadLeads() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (lead) =>
          lead && lead.id != null && typeof lead.name === "string"
      )
      .map((lead) => ({
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
          typeof lead.followUpDate === "string"
            ? lead.followUpDate
            : "",
        createdAt: lead.createdAt || new Date().toISOString(),
      }));
  } catch {
    return [];
  }
}

function createLeadId() {
  return (
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

function getStatusClass(status) {
  return `status status-${String(status || "new").toLowerCase()}`;
}

function getFollowUpClass(state) {
  return `followup-badge followup-${String(state)
    .toLowerCase()
    .replaceAll(" ", "-")}`;
}

function getWeekEnd() {
  const date = new Date(`${getToday()}T12:00:00`);
  const day = date.getDay();
  const daysUntilSunday = day === 0 ? 0 : 7 - day;
  date.setDate(date.getDate() + daysUntilSunday);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const dayOfMonth = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${dayOfMonth}`;
}

export default function App() {
  const [leads, setLeads] = useState(loadLeads);
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("followupflow-theme") === "dark"
  );

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
    localStorage.setItem("followupflow-theme", darkMode ? "dark" : "light");
  }, [darkMode]);
  const [today, setToday] = useState(getToday);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [business, setBusiness] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [dealValue, setDealValue] = useState("");
  const [status, setStatus] = useState("New");
  const [followUpDate, setFollowUpDate] = useState("");

  const [activeView, setActiveView] = useState("Dashboard");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [editingLeadId, setEditingLeadId] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    business: "",
    phone: "",
    notes: "",
    dealValue: "",
    status: "New",
    followUpDate: "",
  });

  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [messageType, setMessageType] = useState("introduction");
  const [generatedMessage, setGeneratedMessage] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [messageTone, setMessageTone] = useState("Friendly");
  const [customTemplates, setCustomTemplates] = useState(() => {
    try {
      const saved = localStorage.getItem("followupflow-custom-templates-v1");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [customTemplateName, setCustomTemplateName] = useState("");
  const [customTemplateSubject, setCustomTemplateSubject] = useState("");
  const [customTemplateBody, setCustomTemplateBody] = useState("");
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [messageSettings, setMessageSettings] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("followupflow-message-settings-v1")) || {
        senderName: "",
        senderBusiness: ""
      };
    } catch {
      return { senderName: "", senderBusiness: "" };
    }
  });

  const [storageWarning, setStorageWarning] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem(
        "followupflow-message-settings-v1",
        JSON.stringify(messageSettings)
      );
    } catch {
      setNotice("Settings could not be saved in this browser.");
    }
  }, [messageSettings]);

  useEffect(() => {
    const refreshToday = () => setToday(getToday());
    const intervalId = window.setInterval(refreshToday, 60_000);

    window.addEventListener("focus", refreshToday);
    document.addEventListener("visibilitychange", refreshToday);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshToday);
      document.removeEventListener("visibilitychange", refreshToday);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
      setStorageWarning("");
    } catch {
      setStorageWarning(
        "Your browser could not save changes. Check browser storage settings or available space."
      );
    }
  }, [leads]);

  useEffect(() => {
    if (
      selectedLeadId &&
      !leads.some(
        (lead) => String(lead.id) === String(selectedLeadId)
      )
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

    if (
      cleanEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
    ) {
      setNotice("Please enter a valid email address or leave it blank.");
      return;
    }

    const newLead = {
      id: createLeadId(),
      name: cleanName,
      email: cleanEmail,
      business: business.trim(),
      phone: phone.trim(),
      notes: notes.trim(),
      dealValue: Number(dealValue) || 0,
      activity: [{
        id: createLeadId(),
        message: "Lead created",
        at: new Date().toISOString(),
      }],
      status,
      followUpDate,
      createdAt: new Date().toISOString(),
    };

    setLeads((current) => [newLead, ...current]);
    setName("");
    setEmail("");
    setBusiness("");
    setPhone("");
    setNotes("");
    setDealValue("");
    setStatus("New");
    setFollowUpDate("");
    setNotice(`${cleanName} was added successfully.`);
  }

  function updateLead(id, changes) {
    setLeads((current) =>
      current.map((lead) => {
        if (String(lead.id) !== String(id)) return lead;

        const labels = {
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

        const changed = Object.keys(changes).filter(
          (key) => lead[key] !== changes[key]
        );
        const entries = changed.map((key) => ({
          id: createLeadId(),
          message: labels[key] || (key + " updated"),
          at: new Date().toISOString(),
        }));

        return {
          ...lead,
          ...changes,
          activity: [...entries, ...(lead.activity || [])].slice(0, 30),
        };
      })
    );
  }

  function handleStatusChange(lead, nextStatus) {
    updateLead(lead.id, { status: nextStatus });
    setNotice(`${lead.name}'s status was updated.`);
  }

  function handleFollowUpChange(lead, nextDate) {
    updateLead(lead.id, { followUpDate: nextDate });
    setNotice(`Follow-up date updated for ${lead.name}.`);
  }

  function deleteLead(id) {
    const lead = leads.find(
      (item) => String(item.id) === String(id)
    );

    if (!lead) return;

    if (window.confirm(`Delete ${lead.name}? This cannot be undone.`)) {
      setLeads((current) =>
        current.filter((item) => String(item.id) !== String(id))
      );
      setNotice(`${lead.name} was deleted.`);
    }
  }

  function startEditing(lead) {
    setEditingLeadId(lead.id);

    setEditForm({
      name: lead.name || "",
      email: lead.email || "",
      business: lead.business || "",
      phone: lead.phone || "",
      notes: lead.notes || "",
      dealValue: String(lead.dealValue || ""),
      status: lead.status || "New",
      followUpDate: lead.followUpDate || "",
    });

    setNotice("");
  }

  function saveEdit(event) {
    event.preventDefault();

    const cleanName = editForm.name.trim();
    const cleanEmail = editForm.email.trim();

    if (!cleanName) {
      setNotice("Customer name cannot be empty.");
      return;
    }

    if (
      cleanEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
    ) {
      setNotice("Please enter a valid email address or leave it blank.");
      return;
    }

    updateLead(editingLeadId, {
      name: cleanName,
      email: cleanEmail,
      business: editForm.business.trim(),
      phone: editForm.phone.trim(),
      notes: editForm.notes.trim(),
      dealValue: Number(editForm.dealValue) || 0,
      status: editForm.status,
      followUpDate: editForm.followUpDate,
    });

    setEditingLeadId(null);
    setNotice(`${cleanName}'s details were saved.`);
  }

  const selectedLead = leads.find(
    (lead) => String(lead.id) === String(selectedLeadId)
  );

  useEffect(() => {
    if (!selectedLead) {
      setGeneratedMessage("");
      setCopyStatus("");
      return;
    }

    const suggestions = {
      New: "introduction",
      Contacted: "reminder",
      Interested: "interested",
      Converted: "closing"
    };

    setMessageType(suggestions[selectedLead.status] || "introduction");
    setGeneratedMessage("");
    setCopyStatus("");
  }, [selectedLeadId, selectedLead?.status]);

  useEffect(() => {
    try {
      localStorage.setItem(
        "followupflow-custom-templates-v1",
        JSON.stringify(customTemplates)
      );
    } catch {
      setNotice("Custom templates could not be saved in this browser.");
    }
  }, [customTemplates]);

  function saveCustomTemplate() {
    const label = customTemplateName.trim();
    const subject = customTemplateSubject.trim();
    const body = customTemplateBody.trim();

    if (!label || !subject || !body) {
      setNotice("Enter a template name, subject, and message.");
      return;
    }

    const duplicate = customTemplates.some(
      (item) =>
        item.id !== editingTemplateId &&
        item.label.trim().toLowerCase() === label.toLowerCase()
    );

    if (duplicate) {
      setNotice("A template with this name already exists.");
      return;
    }

    if (editingTemplateId) {
      setCustomTemplates((current) =>
        current.map((item) =>
          item.id === editingTemplateId
            ? { ...item, label, subject, body }
            : item
        )
      );
      setMessageType(editingTemplateId);
      setNotice("Custom template updated.");
    } else {
      const id = "custom-" + Date.now();
      setCustomTemplates((current) => [
        ...current,
        { id, label, subject, body }
      ]);
      setMessageType(id);
      setNotice("Custom template saved.");
    }

    setEditingTemplateId(null);
    setCustomTemplateName("");
    setCustomTemplateSubject("");
    setCustomTemplateBody("");
    setGeneratedMessage("");
    setCopyStatus("");
  }

  function editCustomTemplate(template) {
    setEditingTemplateId(template.id);
    setCustomTemplateName(template.label);
    setCustomTemplateSubject(template.subject);
    setCustomTemplateBody(template.body);
    setNotice("Editing custom template.");
  }

  function deleteCustomTemplate(template) {
    if (!window.confirm('Delete the template "' + template.label + '"?')) {
      return;
    }

    setCustomTemplates((current) =>
      current.filter((item) => item.id !== template.id)
    );

    if (messageType === template.id) {
      setMessageType("introduction");
      setGeneratedMessage("");
      setCopyStatus("");
    }

    if (editingTemplateId === template.id) {
      setEditingTemplateId(null);
      setCustomTemplateName("");
      setCustomTemplateSubject("");
      setCustomTemplateBody("");
    }

    setNotice("Custom template deleted.");
  }

  function generateMessage() {
    if (!selectedLead) {
      setNotice("Please select a customer first.");
      return;
    }

    const customTemplate = customTemplates.find(
      (item) => item.id === messageType
    );
    const template =
      customTemplate ||
      MESSAGE_TEMPLATES[messageType] ||
      MESSAGE_TEMPLATES.introduction;

    let body = typeof template.body === "function"
      ? template.body(selectedLead.name, selectedLead.business)
      : template.body
          .replace(/\{name\}/g, selectedLead.name || "")
          .replace(/\{business\}/g, selectedLead.business || "")
          .replace(/\{senderName\}/g, messageSettings.senderName || "")
          .replace(/\{senderBusiness\}/g, messageSettings.senderBusiness || "");

    if (messageTone === "Formal") {
      body = body.replace(/^Hi\b/gm, "Dear");
      body = body.replace(/Thanks,/g, "Thank you,");
      body = body.replace(/!$/gm, ".");
    } else if (messageTone === "Short") {
      body = body.split(/\n\s*\n/).slice(0, 2).join("\n\n");
    }

    const signature = [
      messageSettings.senderName.trim(),
      messageSettings.senderBusiness.trim()
    ].filter(Boolean).join("\n");

    if (signature) {
      body += "\n\nBest regards,\n" + signature;
    }

    setGeneratedMessage(
      `Subject: ${template.subject}\n\n${body}`
    );
    setCopyStatus("");
  }

  function openMessageEmail() {
    if (!generatedMessage.trim()) return;

    const parts = generatedMessage.split("\n\n");
    const subject = (parts.shift() || "").replace(/^Subject: /, "");
    const body = parts.join("\n\n");
    const recipient = selectedLead?.email || "";

    window.location.href =
      "mailto:" + encodeURIComponent(recipient) +
      "?subject=" + encodeURIComponent(subject) +
      "&body=" + encodeURIComponent(body);
  }

  function openMessageWhatsApp() {
    if (!generatedMessage.trim()) return;

    const phone = (selectedLead?.phone || "").replace(/[^0-9]/g, "");
    if (!phone) {
      setNotice("Add a phone number to this customer first.");
      return;
    }

    const parts = generatedMessage.split("\n\n");
    parts.shift();
    const body = parts.join("\n\n");

    window.open(
      "https://wa.me/" + phone + "?text=" + encodeURIComponent(body),
      "_blank",
      "noopener,noreferrer"
    );
  }

  async function copyMessage() {
    if (!generatedMessage.trim()) return;

    try {
      await navigator.clipboard.writeText(generatedMessage);
      setCopyStatus(
        "Message copied. You can now paste it into your email or chat."
      );
    } catch {
      setCopyStatus(
        "Copy was blocked by your browser. Select the message text and copy it manually."
      );
    }
  }

  const newCount = leads.filter(
    (lead) => lead.status === "New"
  ).length;

  const convertedCount = leads.filter(
    (lead) => lead.status === "Converted"
  ).length;

  const scheduledLeads = useMemo(
    () =>
      leads
        .filter((lead) =>
          /^\d{4}-\d{2}-\d{2}$/.test(lead.followUpDate || "")
        )
        .sort((a, b) =>
          a.followUpDate.localeCompare(b.followUpDate)
        ),
    [leads]
  );

  const overdueCount = scheduledLeads.filter(
    (lead) => getFollowUpState(lead.followUpDate) === "Overdue"
  ).length;

  const todayCount = scheduledLeads.filter(
    (lead) => getFollowUpState(lead.followUpDate) === "Due today"
  ).length;

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const baseVisibleLeads =
    activeView === "Follow-ups" ? scheduledLeads : leads;

  const visibleLeads = baseVisibleLeads.filter((lead) => {
    const matchesSearch = [
      lead.name,
      lead.email,
      lead.business,
    ].some((value) =>
      String(value || "").toLowerCase().includes(normalizedSearch)
    );

    const matchesStatus =
      statusFilter === "All" || lead.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const weekEnd = getWeekEnd();

  const followUpGroups = [
    {
      title: "Overdue",
      description: "Follow-ups that need attention",
      leads: visibleLeads.filter(
        (lead) => lead.followUpDate < today
      ),
    },
    {
      title: "Today",
      description: "Follow up with these customers today",
      leads: visibleLeads.filter(
        (lead) => lead.followUpDate === today
      ),
    },
    {
      title: "This Week",
      description: "Upcoming follow-ups through the end of this week",
      leads: visibleLeads.filter(
        (lead) =>
          lead.followUpDate > today &&
          lead.followUpDate <= weekEnd
      ),
    },
    {
      title: "Later",
      description: "Follow-ups scheduled for a future week",
      leads: visibleLeads.filter(
        (lead) => lead.followUpDate > weekEnd
      ),
    },
  ];

  const navItems = ["Dashboard", "My Leads", "Follow-ups"];

  function markFollowUpDone(lead) {
    updateLead(lead.id, {
      followUpDate: "",
      lastFollowUpCompletedAt: new Date().toISOString(),
    });
    setNotice("Follow-up marked as done.");
  }

  function rescheduleFollowUp(lead, days) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + days);
    const nextDate =
      date.getFullYear() + "-" +
      String(date.getMonth() + 1).padStart(2, "0") + "-" +
      String(date.getDate()).padStart(2, "0");

    updateLead(lead.id, { followUpDate: nextDate });
    setNotice("Follow-up rescheduled for " + nextDate + ".");
  }

  function openLeadWhatsApp(lead) {
    const phone = (lead.phone || "").replace(/\\D/g, "");
    if (!phone) {
      setNotice("Add a phone number first.");
      return;
    }
    const template =
      MESSAGE_TEMPLATES[messageType] || MESSAGE_TEMPLATES.introduction;
    const message = template.body(lead.name, lead.business);
    window.open(
      "https://wa.me/" + phone + "?text=" + encodeURIComponent(message),
      "_blank",
      "noopener,noreferrer"
    );
  }

  function exportLeadsCSV() {
    if (!leads.length) {
      setNotice("There are no leads to export yet.");
      return;
    }
    const columns = [
      "Name", "Email", "Business", "Phone", "Status",
      "Follow-up Date", "Notes", "Deal Value", "Created At"
    ];
    const cell = (value) =>
      '"' + String(value == null ? "" : value).replace(/"/g, '""') + '"';
    const rows = leads.map((lead) => [
      lead.name, lead.email, lead.business, lead.phone, lead.status,
      lead.followUpDate, lead.notes, lead.dealValue, lead.createdAt
    ]);
    const csv = [columns, ...rows]
      .map((row) => row.map(cell).join(","))
      .join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "followupflow-leads.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setNotice("CSV export downloaded.");
  }

  function renderLead(lead) {
    const followUpState = getFollowUpState(lead.followUpDate);

    return (
      <article className="lead" key={lead.id}>
        <div className="lead-avatar">
          {(lead.name || "?").trim().charAt(0).toUpperCase()}
        </div>

        <div className="lead-info">
          <strong>{lead.name}</strong>

          <p>
            {lead.business || "No company added"}
            {lead.email ? ` Â· ${lead.email}` : ""}
          </p>

          <span className={getStatusClass(lead.status)}>
            {lead.status}
          </span>

          {lead.phone && <p>Phone: {lead.phone}</p>}
          {Number(lead.dealValue) > 0 && (
            <p>Deal value: {Number(lead.dealValue).toLocaleString()}</p>
          )}
          {lead.notes && (
            <div className="lead-notes">
              <strong>Notes</strong>
              <p>{lead.notes}</p>
            </div>
          )}
          {lead.activity?.length > 0 && (
            <details className="lead-activity">
              <summary>Activity history ({lead.activity.length})</summary>
              <ul>
                {lead.activity.map((item) => (
                  <li key={item.id}>
                    {item.message} â€” {new Date(item.at).toLocaleString()}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="followup-date">
            <label htmlFor={`date-${lead.id}`}>Next follow-up</label>

            <input
              id={`date-${lead.id}`}
              type="date"
              value={lead.followUpDate || ""}
              onChange={(event) =>
                handleFollowUpChange(lead, event.target.value)
              }
            />

            <span className={getFollowUpClass(followUpState)}>
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
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <div className="lead-actions">
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

            <button
              type="button"
              className="edit-button"
              onClick={() => startEditing(lead)}
            >
              Edit lead
            </button>
          </div>

          <div className="lead-actions followup-actions">
            <button type="button" onClick={() => markFollowUpDone(lead)}>
              Mark done
            </button>
            <button type="button" onClick={() => rescheduleFollowUp(lead, 3)}>
              +3 days
            </button>
            <button type="button" onClick={() => rescheduleFollowUp(lead, 7)}>
              +7 days
            </button>
            <button type="button" onClick={() => rescheduleFollowUp(lead, 14)}>
              +14 days
            </button>
            {lead.phone && (
              <button type="button" onClick={() => openLeadWhatsApp(lead)}>
                WhatsApp
              </button>
            )}
          </div>
        </div>

        <button
          type="button"
          className="delete-button"
          onClick={() => deleteLead(lead.id)}
          aria-label={`Delete ${lead.name}`}
          title="Delete lead"
        >
          Ã—
        </button>
      </article>
    );
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <h2 className="logo">
          FollowUp<span>Flow</span>
        </h2>

        <p className="nav-label">WORKSPACE</p>

        <nav aria-label="Main navigation">
          {navItems.map((view) => (
            <button
              key={view}
              type="button"
              className={`nav-item ${
                activeView === view ? "active" : ""
              }`}
              onClick={() => setActiveView(view)}
            >
              {view === "Dashboard" && "â–¦"}
              {view === "My Leads" && "â™™"}
              {view === "Follow-ups" && "âœ“"}
              &nbsp; {view}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          Your customer workspace
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">YOUR WORKSPACE</p>
            <h1>{activeView}</h1>
          </div>

          <button
            type="button"
            className="theme-toggle"
            onClick={() => setDarkMode((current) => !current)}
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? "Light mode" : "Dark mode"}
          </button>
          <span className="avatar">F</span>
        </header>

        {notice && (
          <div className="app-notice" role="status">
            <span>{notice}</span>
            <button
              type="button"
              className="dismiss-notice"
              aria-label="Dismiss notification"
              onClick={() => setNotice("")}
            >
              Ã—
            </button>
          </div>
        )}

        {storageWarning && (
          <div className="storage-warning" role="alert">
            {storageWarning}
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

            <section className="stats" aria-label="Lead statistics">
              <div className="stat-card">
                <span>Total leads</span>
                <strong>{leads.length}</strong>
              </div>

              <div className="stat-card">
                <span>New leads</span>
                <strong>{newCount}</strong>
              </div>

              <div className="stat-card">
                <span>Converted leads</span>
                <strong>{convertedCount}</strong>
              </div>

              <div className="stat-card">
                <span>Overdue follow-ups</span>
                <strong>{overdueCount}</strong>
              </div>

              <div className="stat-card">
                <span>Due today</span>
                <strong>{todayCount}</strong>
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
                View follow-ups â†’
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
                  required
                />

                <label htmlFor="customer-email">Email address</label>
                <input
                  id="customer-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                />

                <label htmlFor="customer-business">
                  Company / business
                </label>
                <input
                  id="customer-business"
                  value={business}
                  onChange={(event) => setBusiness(event.target.value)}
                  placeholder="Company name"
                />

                <label htmlFor="customer-phone">Phone / WhatsApp</label>
                <input
                  id="customer-phone"
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="e.g. +923001234567"
                />

                <label htmlFor="customer-notes">Notes</label>
                <textarea
                  id="customer-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Customer needs, discussion, next steps..."
                  rows={3}
                />

                <label htmlFor="customer-deal-value">Deal value (optional)</label>
                <input
                  id="customer-deal-value"
                  type="number"
                  min="0"
                  step="0.01"
                  value={dealValue}
                  onChange={(event) => setDealValue(event.target.value)}
                  placeholder="e.g. 15000"
                />

                <label htmlFor="customer-status">Lead status</label>
                <select
                  id="customer-status"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  {STATUSES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>

                <label htmlFor="customer-follow-up">
                  Follow-up date
                </label>
                <input
                  id="customer-follow-up"
                  type="date"
                  value={followUpDate}
                  onChange={(event) =>
                    setFollowUpDate(event.target.value)
                  }
                />

                <p className="field-hint">
                  You can add a follow-up date now or schedule it later.
                </p>

                <button type="submit">+ Add lead</button>
              </form>
            </div>
          )}

          <div
            className={`panel leads-panel ${
              activeView === "Follow-ups" ? "full-panel" : ""
            }`}
          >
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
                    ? "Organized by when you need to follow up."
                    : "Search, filter, and manage your customer pipeline."}
                </p>
              </div>

              <span className="count">{visibleLeads.length}</span>
            </div>

            <div className="lead-filters">
              <label className="search-field">
                <span>Search leads</span>
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) =>
                    setSearchTerm(event.target.value)
                  }
                  placeholder="Name, email, or company..."
                />
              </label>

              <label className="status-filter">
                <span>Filter by status</span>
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value)
                  }
                >
                  <option value="All">All statuses</option>
                  {STATUSES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              {(searchTerm || statusFilter !== "All") && (
                <button
                  type="button"
                  className="clear-filters"
                  onClick={() => {
                    setSearchTerm("");
                    setStatusFilter("All");
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>

            {visibleLeads.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">âŒ•</div>

                <h3>
                  {normalizedSearch || statusFilter !== "All"
                    ? "No matching leads"
                    : activeView === "Follow-ups"
                      ? "No scheduled follow-ups"
                      : "No leads yet"}
                </h3>

                <p>
                  {normalizedSearch || statusFilter !== "All"
                    ? "Try another search or clear your filters."
                    : activeView === "Follow-ups"
                      ? "Add a follow-up date to a lead to see it here."
                      : "Add your first customer using the form."}
                </p>
              </div>
            ) : activeView === "Follow-ups" ? (
              <div className="grouped-followups">
                {followUpGroups.map(
                  (group) =>
                    group.leads.length > 0 && (
                      <section
                        className="followup-group"
                        key={group.title}
                      >
                        <div className="group-heading">
                          <div>
                            <h3>{group.title}</h3>
                            <p>{group.description}</p>
                          </div>
                          <span className="count">
                            {group.leads.length}
                          </span>
                        </div>

                        <div className="lead-list">
                          {group.leads.map((lead) => renderLead(lead))}
                        </div>
                      </section>
                    )
                )}
              </div>
            ) : (
              <div className="lead-list">
                {visibleLeads.map((lead) => renderLead(lead))}
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
            <span className="message-icon">âœ‰</span>
          </div>

          <button
            type="button"
            onClick={exportLeadsCSV}
            className="export-csv-button"
          >
            Export leads CSV
          </button>

          {leads.length === 0 ? (
            <div className="empty">
              <h3>Add a lead to get started</h3>
              <p>Your personalized follow-up message will appear here.</p>
            </div>
          ) : (
            <>
              <div className="message-settings">
                <h3>Your business settings</h3>
                <label>
                  Your name
                  <input
                    value={messageSettings.senderName}
                    onChange={(event) =>
                      setMessageSettings((current) => ({
                        ...current,
                        senderName: event.target.value
                      }))
                    }
                    placeholder="Enter your name"
                  />
                </label>
                <label>
                  Your business name
                  <input
                    value={messageSettings.senderBusiness}
                    onChange={(event) =>
                      setMessageSettings((current) => ({
                        ...current,
                        senderBusiness: event.target.value
                      }))
                    }
                    placeholder="Enter your business name"
                  />
                </label>
                <label>
                  Message tone
                  <select
                    value={messageTone}
                    onChange={(event) => setMessageTone(event.target.value)}
                  >
                    <option value="Friendly">Friendly</option>
                    <option value="Formal">Formal</option>
                    <option value="Short">Short</option>
                  </select>
                </label>
              </div>

              <div className="message-controls">
                <label>
                  Choose customer
                  <select
                    value={selectedLeadId}
                    onChange={(event) => {
                      setSelectedLeadId(event.target.value);
                      setGeneratedMessage("");
                      setCopyStatus("");
                    }}
                  >
                    <option value="">Select a customer</option>
                    {leads.map((lead) => (
                      <option key={lead.id} value={String(lead.id)}>
                        {lead.name}
                        {lead.business ? ` â€” ${lead.business}` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Message purpose
                  <select
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
                    {customTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.label} (Custom)
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="message-settings">
                <h3>Custom message templates</h3>
                <label>
                  Template name
                  <input
                    value={customTemplateName}
                    onChange={(event) => setCustomTemplateName(event.target.value)}
                    placeholder="e.g. New customer welcome"
                  />
                </label>
                <label>
                  Email subject
                  <input
                    value={customTemplateSubject}
                    onChange={(event) => setCustomTemplateSubject(event.target.value)}
                    placeholder="Enter message subject"
                  />
                </label>
                <label>
                  Message body
                  <textarea
                    value={customTemplateBody}
                    onChange={(event) => setCustomTemplateBody(event.target.value)}
                    placeholder="Write your message. You can use {name} and {business}."
                    rows={4}
                  />
                </label>
                <button
                  type="button"
                  className="generate-button"
                  onClick={saveCustomTemplate}
                >
                  {editingTemplateId ? "Save changes" : "Save custom template"}
                </button>

                {customTemplates.length > 0 && (
                  <div className="custom-template-list">
                    <h4>Saved custom templates</h4>
                    {customTemplates.map((template) => (
                      <div
                        key={template.id}
                        className="custom-template-item"
                      >
                        <strong>{template.label}</strong>
                        <div className="message-actions">
                          <button
                            type="button"
                            onClick={() => editCustomTemplate(template)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteCustomTemplate(template)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {editingTemplateId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTemplateId(null);
                      setCustomTemplateName("");
                      setCustomTemplateSubject("");
                      setCustomTemplateBody("");
                    }}
                  >
                    Cancel editing
                  </button>
                )}
              </div>

              {selectedLead && (
                <div className="selected-customer">
                  Selected customer: <strong>{selectedLead.name}</strong>
                  {selectedLead.email ? ` Â· ${selectedLead.email}` : ""}
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
                Your message (you can edit it before copying)
              </label>

              <textarea
                id="generated-message"
                className="generated-message"
                value={generatedMessage}
                onChange={(event) => {
                  setGeneratedMessage(event.target.value);
                  setCopyStatus("");
                }}
                placeholder="Choose a customer and click Generate message."
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
                  onClick={openMessageEmail}
                  disabled={!generatedMessage.trim()}
                >
                  Open Email
                </button>

                <button
                  type="button"
                  className="secondary-message-button"
                  onClick={openMessageWhatsApp}
                  disabled={!generatedMessage.trim()}
                >
                  Open WhatsApp
                </button>

                <button
                  type="button"
                  className="secondary-message-button"
                  onClick={() => {
                    setGeneratedMessage("");
                    setCopyStatus("");
                  }}
                >
                  Clear message
                </button>
              </div>

              {copyStatus && (
                <p className="copy-status" role="status">
                  {copyStatus}
                </p>
              )}

              <p className="message-note">
                Review the message before sending. Messages are generated
                in your browser and are not sent automatically.
              </p>
            </>
          )}
        </section>

        <footer>FollowUpFlow Â· Never lose a lead again.</footer>
      </main>

      {editingLeadId !== null && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setEditingLeadId(null);
            }
          }}
        >
          <section
            className="edit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-lead-title"
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">UPDATE CUSTOMER</p>
                <h2 id="edit-lead-title">Edit lead details</h2>
              </div>

              <button
                type="button"
                className="dismiss-notice"
                aria-label="Close edit form"
                onClick={() => setEditingLeadId(null)}
              >
                Ã—
              </button>
            </div>

            <form onSubmit={saveEdit}>
              <label htmlFor="edit-name">Customer name *</label>
              <input
                id="edit-name"
                value={editForm.name}
                onChange={(event) =>
                  setEditForm((old) => ({
                    ...old,
                    name: event.target.value,
                  }))
                }
                required
              />

              <label htmlFor="edit-email">Email address</label>
              <input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(event) =>
                  setEditForm((old) => ({
                    ...old,
                    email: event.target.value,
                  }))
                }
              />

              <label htmlFor="edit-business">Company / business</label>
              <input
                id="edit-business"
                value={editForm.business}
                onChange={(event) =>
                  setEditForm((old) => ({
                    ...old,
                    business: event.target.value,
                  }))
                }
              />

              <label htmlFor="edit-phone">Phone / WhatsApp</label>
              <input
                id="edit-phone"
                type="tel"
                value={editForm.phone}
                onChange={(event) =>
                  setEditForm((old) => ({ ...old, phone: event.target.value }))
                }
              />

              <label htmlFor="edit-notes">Notes</label>
              <textarea
                id="edit-notes"
                rows={3}
                value={editForm.notes}
                onChange={(event) =>
                  setEditForm((old) => ({ ...old, notes: event.target.value }))
                }
              />

              <label htmlFor="edit-deal-value">Deal value</label>
              <input
                id="edit-deal-value"
                type="number"
                min="0"
                step="0.01"
                value={editForm.dealValue}
                onChange={(event) =>
                  setEditForm((old) => ({ ...old, dealValue: event.target.value }))
                }
              />

              <label htmlFor="edit-status">Lead status</label>
              <select
                id="edit-status"
                value={editForm.status}
                onChange={(event) =>
                  setEditForm((old) => ({
                    ...old,
                    status: event.target.value,
                  }))
                }
              >
                {STATUSES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              <label htmlFor="edit-date">Follow-up date</label>
              <input
                id="edit-date"
                type="date"
                value={editForm.followUpDate}
                onChange={(event) =>
                  setEditForm((old) => ({
                    ...old,
                    followUpDate: event.target.value,
                  }))
                }
              />

              <div className="modal-actions">
                <button type="submit" className="generate-button">
                  Save changes
                </button>
                <button
                  type="button"
                  className="secondary-message-button"
                  onClick={() => setEditingLeadId(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
