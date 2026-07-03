import Link from "next/link";
import { cn } from "@/lib/utils";

// The Day | Week switch shared by both timesheet views. Plain links (the view
// lives in the URL, like the date), so this stays a server component.
export function TimesheetTabs({
  active,
  dayHref,
  weekHref,
}: {
  active: "day" | "week";
  dayHref: string;
  weekHref: string;
}) {
  const tabClass = (isActive: boolean) =>
    cn(
      "rounded px-2.5 py-1 transition-colors",
      isActive
        ? "bg-accent text-accent-foreground"
        : "text-muted-foreground hover:text-foreground",
    );
  return (
    <div className="flex items-center rounded-md border p-0.5 text-sm font-medium">
      <Link href={dayHref} className={tabClass(active === "day")}>
        Day
      </Link>
      <Link href={weekHref} className={tabClass(active === "week")}>
        Week
      </Link>
    </div>
  );
}
