import Link from "next/link";
import { cn } from "@/lib/utils";

/** Wordmark. The serif face is reserved for the brand and big moments. */
export function Brand({
  className,
  href = "/rooms",
}: {
  className?: string;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-baseline gap-2 select-none outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm",
        className
      )}
    >
      <span
        aria-hidden
        className="self-center grid size-6 place-items-center rounded-[5px] bg-primary text-primary-foreground font-serif text-[15px] leading-none"
      >
        S
      </span>
      <span className="font-serif text-xl tracking-tight">Strongroom</span>
    </Link>
  );
}
