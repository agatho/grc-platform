import { cn } from "@grc/ui";

export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-[pulse_1s_ease-in-out_0ms_infinite]" />
      <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-[pulse_1s_ease-in-out_150ms_infinite]" />
      <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-[pulse_1s_ease-in-out_300ms_infinite]" />
    </span>
  );
}

export function LoadingPage() {
  return (
    <div className="flex items-center justify-center py-20">
      <LoadingSpinner className="scale-150" />
    </div>
  );
}
