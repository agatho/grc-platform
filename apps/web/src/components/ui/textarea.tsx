"use client";

import * as React from "react";

import { cn } from "@grc/ui";
import {
  deriveFallbackName,
  useAccessibleNameFallback,
  useFieldControlProps,
} from "@/components/ui/field";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    // [WP12 · S14-09] See components/ui/field.tsx for the rationale.
    const fieldProps = useFieldControlProps(props.id);
    const composedRef = useAccessibleNameFallback<HTMLTextAreaElement>(
      ref,
      () => deriveFallbackName(props),
    );

    return (
      <textarea
        className={cn(
          "flex min-h-[60px] w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-inner shadow-gray-100/30 transition-all duration-150 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:placeholder:text-slate-400 dark:focus-visible:ring-blue-400/20 dark:focus-visible:border-blue-400",
          className,
        )}
        {...props}
        {...fieldProps}
        ref={composedRef}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
