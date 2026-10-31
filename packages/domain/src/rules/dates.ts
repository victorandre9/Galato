/**
 * Datas de negócio são tratadas como string ISO `YYYY-MM-DD` (data civil no fuso
 * da empresa). Cálculo em UTC puro para evitar erro de horário de verão/fuso.
 */
export type IsoDate = string;

export function parseIsoDate(d: IsoDate): Date {
  const [y, m, day] = d.split("-").map(Number);
  if (!y || !m || !day) throw new Error(`Data inválida: ${d}`);
  return new Date(Date.UTC(y, m - 1, day));
}

export function toIsoDate(d: Date): IsoDate {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: IsoDate, n: number): IsoDate {
  const x = parseIsoDate(d);
  x.setUTCDate(x.getUTCDate() + n);
  return toIsoDate(x);
}

export function weekday(d: IsoDate): number {
  return parseIsoDate(d).getUTCDay();
}

/** dias corridos de `from` até `to` (to - from) */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((parseIsoDate(to).getTime() - parseIsoDate(from).getTime()) / 86_400_000);
}

/** Data civil de um instante num fuso IANA (ex.: America/Sao_Paulo). */
export function isoDateInTimezone(instant: Date, timezone: string): IsoDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
  return parts; // en-CA => YYYY-MM-DD
}

/** Hora local HH:mm de um instante num fuso. */
export function timeInTimezone(instant: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(instant);
}

export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}
