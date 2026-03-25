import {
  ShieldAlert,
  Workflow,
  ShieldCheck,
  FileText,
  Shield,
  LifeBuoy,
  Lock,
  ClipboardCheck,
  Handshake,
  FileSignature,
  Leaf,
  Megaphone,
  Box,
  Building2,
  Database,
  Server,
  Layers,
  type LucideIcon,
} from "lucide-react";

/**
 * Maps Lucide icon name strings (stored in module_definition.icon) to
 * actual icon components. This avoids dynamic imports and keeps the
 * bundle deterministic.
 */
const ICON_MAP: Record<string, LucideIcon> = {
  ShieldAlert,
  Workflow,
  ShieldCheck,
  FileText,
  Shield,
  LifeBuoy,
  Lock,
  ClipboardCheck,
  Handshake,
  FileSignature,
  Leaf,
  Megaphone,
  Box,
  Building2,
  Database,
  Server,
  Layers,
};

/**
 * Returns the Lucide icon component for the given name.
 * Falls back to `Box` if the icon name is not recognized.
 */
export function getLucideIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? Box;
}
