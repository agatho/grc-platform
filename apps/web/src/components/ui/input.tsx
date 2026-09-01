"use client";

import * as React from "react";

import { cn } from "@grc/ui";
import {
  deriveFallbackName,
  useAccessibleNameFallback,
  useFieldControlProps,
} from "@/components/ui/field";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    // [WP12 · S14-09] Inside a `<Field>` this picks up the shared id (so the
    // sibling `<Label htmlFor>` names the control) plus aria-describedby /
    // aria-invalid. Outside one it only passes `id` through.
    const fieldProps = useFieldControlProps(props.id);
    // Safety net for the call sites that predate `<Field>`: applied only when
    // the mounted element genuinely has no accessible name (see field.tsx).
    // Hidden inputs are not in the accessibility tree — skip them so we do not
    // annotate elements no assistive technology will ever reach.
    const composedRef = useAccessibleNameFallback<HTMLInputElement>(ref, () =>
      type === "hidden" ? undefined : deriveFallbackName({ ...props, type }),
    );

    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-lg border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-inner shadow-gray-100/30 transition-all duration-150 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-slate-950 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:file:text-slate-50 dark:placeholder:text-slate-400 dark:focus-visible:ring-blue-400/20 dark:focus-visible:border-blue-400",
          className,
        )}
        {...props}
        {...fieldProps}
        ref={composedRef}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
