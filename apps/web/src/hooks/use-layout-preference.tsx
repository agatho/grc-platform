"use client";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";

type LayoutMode = "classic" | "modern";

const LayoutContext = createContext<{
  layout: LayoutMode;
  setLayout: (l: LayoutMode) => void;
}>({ layout: "modern", setLayout: () => {} });

// ---------------------------------------------------------------------------
// Der Browserspeicher als AEUSSERER SPEICHER
//
// [Welle 7b · OP-080, Gestalt C] Hier stand:
//
//   const [layout, setLayout] = useState<LayoutMode>("modern");
//   useEffect(() => {
//     const saved = localStorage.getItem("arctos-layout") as LayoutMode | null;
//     if (saved) setLayout(saved);
//   }, []);
//
// Das ist `react-hooks/set-state-in-effect`, und es ist NICHT die Gestalt, die
// die alte Registerbegruendung meinte: es wird nichts abgerufen, also loest
// `@tanstack/react-query` hier nichts. Der von React vorgesehene Weg fuer einen
// Wert, der ausserhalb von React lebt und den der Server anders sieht als der
// Browser, ist `useSyncExternalStore` mit einer eigenen Server-Momentaufnahme.
//
// Drei Dinge werden dabei nebenbei richtig, die vorher falsch waren:
//
//  1. `localStorage.getItem(...) as LayoutMode` war eine BEHAUPTUNG. Stand dort
//     etwas anderes als „classic" oder „modern" — eine aeltere Fassung, ein
//     fremdes Skript, eine halb geschriebene Zeichenkette —, wurde genau das
//     zum Layoutnamen, und keine der beiden Ansichten traf zu. Jetzt wird
//     geprueft.
//  2. Ein Zugriff auf `localStorage` kann WERFEN (Safari im privaten Modus,
//     gesperrter Speicher von Drittanbietern). Vorher haette das den Effekt und
//     damit den Aufbau des Anbieters abgebrochen; jetzt faellt es auf den
//     Standardwert zurueck.
//  3. Zwei Reiter derselben Sitzung liefen nicht gleich. Das
//     `storage`-Ereignis feuert nur in den ANDEREN Reitern, deshalb gehoert es
//     zum Abonnement; die Umschaltung im eigenen Reiter benachrichtigt selbst.
// ---------------------------------------------------------------------------

const STORAGE_KEY = "arctos-layout";
const DEFAULT_LAYOUT: LayoutMode = "modern";

const listeners = new Set<() => void>();

function isLayoutMode(v: string | null): v is LayoutMode {
  return v === "classic" || v === "modern";
}

function getLayoutSnapshot(): LayoutMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isLayoutMode(raw) ? raw : DEFAULT_LAYOUT;
  } catch {
    return DEFAULT_LAYOUT;
  }
}

// Der Server kennt den Browserspeicher nicht. React nimmt diesen Wert beim
// Anhydrieren und wechselt unmittelbar danach auf die Momentaufnahme oben —
// dieselbe Abfolge wie beim alten Effekt, aber ohne Zustandsfeld und ohne
// Abweichung beim Anhydrieren.
function getLayoutServerSnapshot(): LayoutMode {
  return DEFAULT_LAYOUT;
}

function subscribeLayout(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function writeLayout(l: LayoutMode) {
  try {
    localStorage.setItem(STORAGE_KEY, l);
  } catch {
    // Speicher voll oder gesperrt — die Wahl gilt dann nur fuer diese Ansicht.
  }
  for (const listener of listeners) listener();
}

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const layout = useSyncExternalStore(
    subscribeLayout,
    getLayoutSnapshot,
    getLayoutServerSnapshot,
  );

  const setLayout = useCallback((l: LayoutMode) => writeLayout(l), []);

  // Der Kontextwert war vorher ein bei JEDEM Rendern neu gebautes Objekt; jeder
  // Verbraucher rendert dann mit, auch wenn sich das Layout nicht geaendert hat.
  const value = useMemo(() => ({ layout, setLayout }), [layout, setLayout]);

  return (
    <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>
  );
}

export function useLayout() {
  return useContext(LayoutContext);
}
