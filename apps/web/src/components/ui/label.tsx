"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@grc/ui";
import { useFieldContext } from "@/components/ui/field";

const labelVariants = cva(
  "text-sm font-medium leading-none text-gray-700 dark:text-gray-500 peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
);

const Label = React.forwardRef<
  React.ComponentRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
    VariantProps<typeof labelVariants>
>(({ className, htmlFor, id, ...props }, ref) => {
  // [WP12 · S14-09] 639 of 753 labels carried no `htmlFor`. Inside a `<Field>`
  // the association is automatic and cannot drift: the label takes the field's
  // control id as `htmlFor` and publishes its own id so controls that `htmlFor`
  // cannot name (Radix SelectTrigger, custom comboboxes — `<label for>` only
  // names *labelable* elements) can point back with `aria-labelledby`.
  // An explicit `htmlFor`/`id` from the call site still wins.
  const ctx = useFieldContext();
  return (
    <LabelPrimitive.Root
      ref={ref}
      htmlFor={htmlFor ?? ctx?.controlId}
      id={id ?? ctx?.labelId}
      className={cn(labelVariants(), className)}
      {...props}
    />
  );
});
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
