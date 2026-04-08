export type Period = "daily" | "weekly" | "monthly" | "alltime";

export const PERIOD_LABELS: Record<Period, string> = {
  daily: "Today",
  weekly: "This Week",
  monthly: "This Month",
  alltime: "All Time",
};

export function getPeriodStart(period: Period): number {
  if (period === "alltime") return 0;

  const now = new Date();
  switch (period) {
    case "daily":
      now.setHours(0, 0, 0, 0);
      return Math.floor(now.getTime() / 1000);
    case "weekly": {
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1;
      now.setDate(now.getDate() - diff);
      now.setHours(0, 0, 0, 0);
      return Math.floor(now.getTime() / 1000);
    }
    case "monthly":
      now.setDate(1);
      now.setHours(0, 0, 0, 0);
      return Math.floor(now.getTime() / 1000);
  }
}

export function parsePeriod(input: string | undefined): Period {
  if (!input) return "weekly";
  const lower = input.toLowerCase();
  if (lower === "daily" || lower === "day" || lower === "today" || lower === "d") return "daily";
  if (lower === "weekly" || lower === "week" || lower === "w") return "weekly";
  if (lower === "monthly" || lower === "month" || lower === "m") return "monthly";
  if (lower === "alltime" || lower === "all" || lower === "a" || lower === "all-time") return "alltime";
  return "weekly";
}
