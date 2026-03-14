const ISO_DT_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

type ParsedApiDateTime = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  offset: string | null;
};

function parseApiDateTime(value?: string | null): ParsedApiDateTime | null {
  if (!value) return null;
  const raw = String(value).trim();
  const m = raw.match(ISO_DT_RE);
  if (!m) return null;

  return {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
    hour: Number(m[4] || "0"),
    minute: Number(m[5] || "0"),
    offset: m[7] || null,
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function extractApiGMT(value?: string | null): string {
  const parsed = parseApiDateTime(value);
  if (!parsed?.offset) return "";
  if (parsed.offset === "Z") return "GMT+0";

  const normalized = parsed.offset.replace(/^([+-]\d{2})(\d{2})$/, "$1:$2");
  const m = normalized.match(/^([+-])(\d{2}):(\d{2})$/);
  if (!m) return "";

  const sign = m[1];
  const h = Number(m[2]);
  const mm = m[3];
  return mm === "00" ? `GMT${sign}${h}` : `GMT${sign}${h}:${mm}`;
}

export function formatApiTime(value?: string | null, opts?: { withGMT?: boolean }): string {
  if (!value) return "--:--";
  const parsed = parseApiDateTime(value);
  if (!parsed) return String(value);

  const time = `${pad2(parsed.hour)}:${pad2(parsed.minute)}`;
  if (!opts?.withGMT) return time;

  const gmt = extractApiGMT(value);
  return gmt ? `${time} ${gmt}` : time;
}

export function formatApiDate(value?: string | null, opts?: { year?: "2-digit" | "numeric" }): string {
  if (!value) return "";
  const parsed = parseApiDateTime(value);
  if (!parsed) return "";

  const weekday = WEEKDAYS[new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)).getUTCDay()];
  const month = MONTHS[parsed.month - 1] || "";
  const year = opts?.year === "numeric" ? String(parsed.year) : String(parsed.year).slice(-2);

  return `${weekday}, ${parsed.day} ${month} ${year}`;
}

export function formatApiShortDate(value?: string | null): string {
  if (!value) return "";
  const parsed = parseApiDateTime(value);
  if (!parsed) return "";

  const weekday = WEEKDAYS[new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)).getUTCDay()];
  const month = MONTHS[parsed.month - 1] || "";
  return `${weekday}, ${pad2(parsed.day)} ${month}`;
}

export function isApiNextDay(depart?: string | null, arrive?: string | null): boolean {
  const d = parseApiDateTime(depart);
  const a = parseApiDateTime(arrive);
  if (!d || !a) return false;
  return d.year !== a.year || d.month !== a.month || d.day !== a.day;
}

export function getApiLocalHour(value?: string | null): number | null {
  const parsed = parseApiDateTime(value);
  if (!parsed) return null;
  return parsed.hour;
}
