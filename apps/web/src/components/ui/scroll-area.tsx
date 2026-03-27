"use client";

import * as React from "react";

// Lightweight scroll area (no radix dependency)
const ScrollArea = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={`relative overflow-auto ${className ?? ""}`}
    {...props}
  >
    {children}
  </div>
));
ScrollArea.displayName = "ScrollArea";

export { ScrollArea };
