// Helpers for the user-facing "diary day" of an entry (entryDate).
// Stored on the server as an ISO timestamp; picked in the UI as YYYY-MM-DD.

export function toLocalDateKey(d) {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayLocalKey() {
  return toLocalDateKey(new Date());
}

export function isValidDateKey(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const dt = new Date(`${s}T12:00:00`);
  return !Number.isNaN(dt.getTime()) && toLocalDateKey(dt) === s;
}

// Noon local time → ISO. Midday avoids timezone day-shifts when the
// server/client converts the timestamp back to a calendar day.
export function dateKeyToISO(dateKey) {
  return new Date(`${dateKey}T12:00:00`).toISOString();
}

export function formatDateKey(dateKey) {
  if (!isValidDateKey(dateKey)) return '';
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

// The diary day of an entry object (new field, falls back to createdAt
// for entries written before entryDate existed).
export function entryDayKey(entry) {
  if (!entry) return '';
  return toLocalDateKey(entry.entryDate || entry.createdAt);
}
