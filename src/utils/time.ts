export type Period =
  | "daily"
  | "weekly"
  | "monthly"
  | "alltime"
  | `${number}${"d" | "w" | "m" | "y"}`;

function startOfToday(): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.floor(now.getTime() / 1000);
}

function startOfWeek(): number {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  now.setDate(now.getDate() - diff);
  now.setHours(0, 0, 0, 0);
  return Math.floor(now.getTime() / 1000);
}

function startOfMonth(): number {
  const now = new Date();
  now.setDate(1);
  now.setHours(0, 0, 0, 0);
  return Math.floor(now.getTime() / 1000);
}

export function formatPeriodLabel(period: Period): string {
  switch (period) {
    case "daily":
      return "Today";
    case "weekly":
      return "This Week";
    case "monthly":
      return "This Month";
    case "alltime":
      return "All Time";
  }

  const match = period.match(/^(\d+)([dwmy])$/);
  if (!match) return "This Week";

  const amount = Number(match[1]);
  const unit = match[2];
  const label =
    unit === "d"
      ? amount === 1
        ? "Day"
        : "Days"
      : unit === "w"
        ? amount === 1
          ? "Week"
          : "Weeks"
        : unit === "m"
          ? amount === 1
            ? "Month"
            : "Months"
          : amount === 1
            ? "Year"
            : "Years";

  return `Last ${amount} ${label}`;
}

export function getPeriodStart(period: Period): number {
  if (period === "alltime") return 0;
  if (period === "daily") return startOfToday();
  if (period === "weekly") return startOfWeek();
  if (period === "monthly") return startOfMonth();

  const match = period.match(/^(\d+)([dwmy])$/);
  if (!match) return startOfWeek();

  const amount = Number(match[1]);
  const unit = match[2];
  const secondsPerUnit =
    unit === "d"
      ? 24 * 60 * 60
      : unit === "w"
        ? 7 * 24 * 60 * 60
        : unit === "m"
          ? 30 * 24 * 60 * 60
          : 365 * 24 * 60 * 60;

  return Math.floor(Date.now() / 1000) - amount * secondsPerUnit;
}

export function isValidPeriodInput(input: string): boolean {
  const lower = input.toLowerCase();
  if (
    [
      "daily",
      "day",
      "today",
      "d",
      "weekly",
      "week",
      "w",
      "monthly",
      "month",
      "m",
      "alltime",
      "all",
      "a",
      "at",
      "all-time",
    ].includes(lower)
  ) {
    return true;
  }

  const match = lower.match(/^(\d+)([dwmy])$/);
  return Boolean(match && Number(match[1]) > 0);
}

export function parsePeriod(input: string | undefined): Period {
  if (!input) return "weekly";

  const lower = input.toLowerCase();
  if (lower === "daily" || lower === "day" || lower === "today" || lower === "d")
    return "daily";
  if (lower === "weekly" || lower === "week" || lower === "w") return "weekly";
  if (lower === "monthly" || lower === "month" || lower === "m") return "monthly";
  if (lower === "alltime" || lower === "all" || lower === "a" || lower === "at" || lower === "all-time")
    return "alltime";
  if (isValidPeriodInput(lower)) return lower as Period;

  return "weekly";
}
