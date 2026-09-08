/**
 * Ein Modulsymbol als Komponente — statt eines Nachschlags an der
 * Aufrufstelle.
 *
 * [Welle 7a · OP-080] Mehrere Stellen schrieben
 *
 *   const Icon = getLucideIcon(mod.icon);
 *   …
 *   <Icon size={20} />
 *
 * und `react-hooks/static-components` meldete dort „Cannot create components
 * during render". Die Regel sieht nur, dass der Elementtyp aus einem AUFRUF
 * stammt; über die Funktionsgrenze kann sie nicht nachsehen, ob dabei immer
 * dieselbe Komponente herauskommt. Sie hat damit recht in der Sache: ein
 * wechselnder Typ an derselben Stelle hängt den Teilbaum aus und wieder ein.
 * Hier kommt er zwar immer aus derselben Zuordnung auf Modulebene — aber das
 * ist eine Eigenschaft, die niemand prüft.
 *
 * Nachgemessen, welche Form die Regel akzeptiert:
 *
 *   const Icon = MAP[name] ?? Box;  <Icon/>   → keine Meldung
 *   const Icon = f(name);           <Icon/>   → Meldung
 *
 * Deshalb steht der Nachschlag hier, wo er nachprüfbar ist. `getLucideIcon`
 * bleibt für Aufrufer bestehen, die den Typ ohne JSX brauchen.
 */
import { Box, type LucideProps } from "lucide-react";
import { ICON_MAP } from "./icon-map";

export function ModuleIcon({
  name,
  ...props
}: LucideProps & { name: string | null | undefined }) {
  const Icon = (name ? ICON_MAP[name] : undefined) ?? Box;
  return <Icon {...props} />;
}
