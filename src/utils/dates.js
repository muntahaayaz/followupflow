// Dates are handled as local "YYYY-MM-DD" strings, which compare correctly as text.

function toDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getToday() {
  return toDateString(new Date());
}

export function getFollowUpState(date, today = getToday()) {
  if (!date) return "Not scheduled";
  if (date < today) return "Overdue";
  if (date === today) return "Due today";
  return "Upcoming";
}

export function formatDate(date) {
  if (!date) return "Not scheduled";
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;

  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function getWeekEnd(today = getToday()) {
  const date = new Date(`${today}T12:00:00`);
  const day = date.getDay();
  const daysUntilSunday = day === 0 ? 0 : 7 - day;
  date.setDate(date.getDate() + daysUntilSunday);
  return toDateString(date);
}
