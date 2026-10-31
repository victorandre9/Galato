/**
 * Metas por DIA ÚTIL (seções 27, 32, 33).
 * Nunca usa dias corridos. Calendário (dias da semana úteis + feriados) é parâmetro.
 */
import type { PlatformParameters } from "../config/parameters.js";
import { addDays, parseIsoDate, toIsoDate, weekday, type IsoDate } from "./dates.js";

export type WorkCalendar = PlatformParameters["workCalendar"];

export function isBusinessDay(date: IsoDate, cal: WorkCalendar): boolean {
  return cal.workWeekdays.includes(weekday(date)) && !cal.holidays.includes(date);
}

export function monthBounds(date: IsoDate): { first: IsoDate; last: IsoDate } {
  const d = parseIsoDate(date);
  const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  return { first: toIsoDate(first), last: toIsoDate(last) };
}

export function businessDaysBetween(from: IsoDate, to: IsoDate, cal: WorkCalendar): number {
  let n = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) if (isBusinessDay(d, cal)) n++;
  return n;
}

export function businessDaysInMonth(date: IsoDate, cal: WorkCalendar): number {
  const { first, last } = monthBounds(date);
  return businessDaysBetween(first, last, cal);
}

/** Dias úteis restantes no mês, INCLUINDO hoje se hoje for útil. */
export function remainingBusinessDays(today: IsoDate, cal: WorkCalendar): number {
  return businessDaysBetween(today, monthBounds(today).last, cal);
}

export interface GoalProgress {
  monthlyGoalCents: number;
  achievedMonthCents: number;
  achievedTodayCents: number;
  businessDaysInMonth: number;
  remainingBusinessDays: number;
  /** meta mensal / dias úteis do mês */
  dailyGoalCents: number;
  /** % da meta mensal (0..∞) */
  monthAttainmentPct: number;
  /** % da meta do dia (0..∞) */
  dayAttainmentPct: number;
  missingMonthCents: number;
  missingTodayCents: number;
  /** quanto falta / dias úteis restantes (inclui hoje) */
  requiredPerRemainingDayCents: number;
}

export function goalProgress(input: {
  today: IsoDate;
  monthlyGoalCents: number;
  achievedMonthCents: number;
  achievedTodayCents: number;
  calendar: WorkCalendar;
}): GoalProgress {
  const bdm = businessDaysInMonth(input.today, input.calendar);
  const rem = remainingBusinessDays(input.today, input.calendar);
  const daily = bdm > 0 ? Math.round(input.monthlyGoalCents / bdm) : 0;
  const missingMonth = Math.max(0, input.monthlyGoalCents - input.achievedMonthCents);
  const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);
  return {
    monthlyGoalCents: input.monthlyGoalCents,
    achievedMonthCents: input.achievedMonthCents,
    achievedTodayCents: input.achievedTodayCents,
    businessDaysInMonth: bdm,
    remainingBusinessDays: rem,
    dailyGoalCents: daily,
    monthAttainmentPct: pct(input.achievedMonthCents, input.monthlyGoalCents),
    dayAttainmentPct: pct(input.achievedTodayCents, daily),
    missingMonthCents: missingMonth,
    missingTodayCents: Math.max(0, daily - input.achievedTodayCents),
    // Sem dias úteis restantes, todo o faltante "vence" agora.
    requiredPerRemainingDayCents: rem > 0 ? Math.ceil(missingMonth / rem) : missingMonth,
  };
}
