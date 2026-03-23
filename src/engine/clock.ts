import { CALENDAR_DEF } from "./defaults";
import { CalendarDef, ClockState, MonthDef } from "./types";

function totalDaysPerYear(calendarDef: CalendarDef): number {
  return calendarDef.months.reduce((sum, month) => sum + month.days, 0);
}

function totalMinutesPerYear(calendarDef: CalendarDef): number {
  return totalDaysPerYear(calendarDef) * calendarDef.hoursPerDay * calendarDef.minutesPerHour;
}

function totalMinutesBeforeMonth(monthIndex: number, calendarDef: CalendarDef): number {
  const days = calendarDef.months
    .slice(0, monthIndex - 1)
    .reduce((sum, month) => sum + month.days, 0);
  return days * calendarDef.hoursPerDay * calendarDef.minutesPerHour;
}

export function buildClockState(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  calendarDef: CalendarDef = CALENDAR_DEF,
): ClockState {
  const baseYear = year - 1;
  const totalMinutes =
    baseYear * totalMinutesPerYear(calendarDef) +
    totalMinutesBeforeMonth(month, calendarDef) +
    (day - 1) * calendarDef.hoursPerDay * calendarDef.minutesPerHour +
    hour * calendarDef.minutesPerHour +
    minute;
  return {
    year,
    month,
    day,
    hour,
    minute,
    season: getMonthDef(month, calendarDef).season,
    totalMinutes,
  };
}

export function getMonthDef(monthIndex: number, calendarDef: CalendarDef = CALENDAR_DEF): MonthDef {
  return calendarDef.months[monthIndex - 1];
}

export function advanceClock(clock: ClockState, minutes: number, calendarDef: CalendarDef = CALENDAR_DEF): ClockState {
  const totalMinutes = Math.max(0, clock.totalMinutes + minutes);
  return decomposeClock(totalMinutes, calendarDef);
}

export function decomposeClock(totalMinutes: number, calendarDef: CalendarDef = CALENDAR_DEF): ClockState {
  const minutesPerDay = calendarDef.hoursPerDay * calendarDef.minutesPerHour;
  const minutesPerYear = totalMinutesPerYear(calendarDef);

  let remainder = totalMinutes;
  const year = Math.floor(remainder / minutesPerYear) + 1;
  remainder %= minutesPerYear;

  let month = 1;
  for (const monthDef of calendarDef.months) {
    const monthMinutes = monthDef.days * minutesPerDay;
    if (remainder < monthMinutes) {
      break;
    }
    remainder -= monthMinutes;
    month += 1;
  }

  const monthDef = getMonthDef(month, calendarDef);
  const day = Math.floor(remainder / minutesPerDay) + 1;
  remainder %= minutesPerDay;
  const hour = Math.floor(remainder / calendarDef.minutesPerHour);
  const minute = remainder % calendarDef.minutesPerHour;

  return {
    day,
    month,
    year,
    hour,
    minute,
    season: monthDef.season,
    totalMinutes,
  };
}

export function formatDate(clock: ClockState, calendarDef: CalendarDef = CALENDAR_DEF): string {
  const month = getMonthDef(clock.month, calendarDef);
  return `${clock.day} ${month.name}, Year ${clock.year}`;
}

export function formatTime(clock: ClockState): string {
  const hh = String(clock.hour).padStart(2, "0");
  const mm = String(clock.minute).padStart(2, "0");
  return `${hh}:${mm} (${describeBell(clock.hour)})`;
}

export function describeBell(hour: number): string {
  if (hour < 5) {
    return "Night Watch";
  }
  if (hour < 8) {
    return "Dawn Bell";
  }
  if (hour < 12) {
    return "Morning Bell";
  }
  if (hour < 15) {
    return "Midday Bell";
  }
  if (hour < 19) {
    return "Afternoon Bell";
  }
  if (hour < 22) {
    return "Evening Bell";
  }
  return "Late Watch";
}
