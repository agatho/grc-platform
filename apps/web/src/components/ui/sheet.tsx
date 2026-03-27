"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

// Sheet implemented as a Dialog with slide-over styling
// Wraps the existing Dialog component for consistency

interface SheetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

function Sheet({ open, onOpenChange, children }: SheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children}
    </Dialog>
  );
}

interface SheetContentProps {
  side?: "left" | "right";
  className?: string;
  children: React.ReactNode;
}

function SheetContent({ side = "right", className, children }: SheetContentProps) {
  return (
    <DialogContent
      className={`fixed inset-y-0 ${side === "right" ? "right-0" : "left-0"} h-full max-h-full rounded-none border-l ${className ?? ""}`}
    >
      {children}
    </DialogContent>
  );
}

function SheetHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <DialogHeader className={className}>{children}</DialogHeader>;
}

function SheetTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <DialogTitle className={className}>{children}</DialogTitle>;
}

function SheetFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return <DialogFooter className={className}>{children}</DialogFooter>;
}

export { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter };
