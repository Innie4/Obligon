// Presentation formatting — the frontend renders server strings verbatim,
// so every list/metric endpoint returns display-ready values.

export const naira = (kobo, { sign = false } = {}) => {
  const n = (Number(kobo) || 0) / 100;
  const abs = Math.abs(n).toLocaleString("en-NG", { minimumFractionDigits: n % 1 !== 0 ? 2 : 0, maximumFractionDigits: 2 });
  if (sign) return `${n < 0 ? "-" : "+"} ₦${abs}`;
  return `₦${abs}`;
};

export const nairaShort = (kobo) => {
  const n = (Number(kobo) || 0) / 100;
  if (Math.abs(n) >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `₦${(n / 1_000).toFixed(0)}K`;
  return `₦${n.toLocaleString("en-NG")}`;
};

export const fmtDate = (d) =>
  new Date(d).toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" });

export const fmtDateTime = (d) =>
  new Date(d).toLocaleString("en-NG", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

export const fmtTime = (d) => new Date(d).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", hour12: true });

/** "2h ago", "Yesterday, 09:15", "Oct 12" */
export function relativeTime(d) {
  const then = new Date(d).getTime();
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return `Yesterday, ${fmtTime(d).replace(" ", "").toLowerCase()}`;
  if (days < 7) return `${days} days ago`;
  return fmtDate(d);
}

export function dayGroup(d) {
  const date = new Date(d);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (date.toDateString() === today.toDateString()) return "TODAY";
  if (date.toDateString() === yesterday.toDateString()) return "YESTERDAY";
  return "OLDER";
}

export const percent = (v) => `${Math.round(Number(v) || 0)}%`;

export const maskPan = (pan) => {
  const digits = String(pan).replace(/\D/g, "");
  if (!digits) return "•••• •••• •••• 0000";
  return `•••• •••• •••• ${digits.slice(-4)}`;
};

export const maskAccount = (acct) => {
  const digits = String(acct).replace(/\D/g, "");
  return digits ? `•••• ${digits.slice(-4)}` : "•••• 0000";
};

export const initials = (name) =>
  String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";

export const distanceLabel = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  const km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return `${(km * 0.621371).toFixed(1)} mi`;
};

export const reference = (prefix) =>
  `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 46656).toString(36).toUpperCase().padStart(3, "0")}`;

export function toCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}
