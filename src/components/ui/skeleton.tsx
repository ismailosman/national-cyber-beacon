import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-shimmer rounded-md bg-muted relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-[hsl(var(--foreground)/0.04)] before:to-transparent", className)} {...props} />;
}

export { Skeleton };
