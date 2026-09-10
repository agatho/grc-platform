/// <reference lib="dom" />

/**
 * Ansage jeder Bedienhandlung an die Live-Region.
 *
 * Der Auftrag ist hier eng: **jede Aktion meldet ihr Ergebnis an die
 * Live-Region des Viewers.** Genau deshalb legt dieser Dienst keine zweite
 * Region an, wenn es schon eine gibt: `GraphA11y` (`src/viewer/a11y.ts`)
 * erzeugt `.arctos-bpmn-live` am äußeren Container, und zwei konkurrierende
 * `aria-live`-Bereiche im selben Bauteil sind für einen Screenreader schlimmer
 * als einer — sie unterbrechen sich gegenseitig und die Reihenfolge der
 * Ansagen wird unvorhersagbar.
 *
 * Der Dienst sucht deshalb aufwärts nach einer vorhandenen Region und legt nur
 * dann eine eigene an, wenn der Editor ohne Betrachterschicht läuft (Tests,
 * serverseitige Nutzung).
 *
 * `aria-live="polite"` und nicht `assertive`: eine Bedienhandlung, die der
 * Nutzer selbst ausgelöst hat, muss nichts unterbrechen. `assertive` bleibt
 * Fehlermeldungen vorbehalten — dafür gibt es {@link EditorAnnouncer.reject}.
 */

const LIVE_CLASS = "arctos-bpmn-live";
const ALERT_CLASS = "arctos-bpmn-alert";

interface CanvasContainerLike {
  getContainer(): HTMLElement;
}

export class EditorAnnouncer {
  static $inject = ["canvas"];

  private readonly host: HTMLElement;
  private owned: HTMLElement | null = null;
  private alertRegion: HTMLElement | null = null;
  private lastMessage = "";

  constructor(canvas: CanvasContainerLike) {
    this.host = canvas.getContainer();
  }

  /**
   * Ergebnis einer Bedienhandlung ansagen.
   *
   * Wiederholt sich der Text, wird die Region kurz geleert — sonst meldet ein
   * Screenreader die zweite gleiche Meldung nicht, und „nichts gehört" ist
   * nicht von „nichts passiert" zu unterscheiden.
   */
  announce(message: string): void {
    const region = this.region();
    if (!region) return;
    if (message === this.lastMessage) {
      region.textContent = "";
    }
    region.textContent = message;
    this.lastMessage = message;
  }

  /** Eine Handlung, die die Regeln verweigert haben. */
  reject(message: string): void {
    const region = this.alert();
    if (!region) return;
    region.textContent = "";
    region.textContent = message;
    this.lastMessage = message;
  }

  /** Nur für Tests und Fehlersuche. */
  last(): string {
    return this.lastMessage;
  }

  private region(): HTMLElement | null {
    const existing = findUpwards(this.host, LIVE_CLASS);
    if (existing) return existing;
    if (!this.owned) {
      this.owned = createRegion(LIVE_CLASS, "status", "polite");
      (this.host.parentElement ?? this.host).appendChild(this.owned);
    }
    return this.owned;
  }

  private alert(): HTMLElement | null {
    const existing = findUpwards(this.host, ALERT_CLASS);
    if (existing) return existing;
    if (!this.alertRegion) {
      this.alertRegion = createRegion(ALERT_CLASS, "alert", "assertive");
      (this.host.parentElement ?? this.host).appendChild(this.alertRegion);
    }
    return this.alertRegion;
  }
}

export default EditorAnnouncer;

/**
 * Vom Canvas-Container aufwärts nach einer vorhandenen Region suchen.
 *
 * Bewusst aufwärts und nicht global: in einer Anwendung mit zwei Diagrammen auf
 * einer Seite darf die Ansage des einen nicht in der Region des anderen landen.
 */
function findUpwards(
  start: HTMLElement,
  className: string,
): HTMLElement | null {
  let node: HTMLElement | null = start;
  while (node) {
    const found = node.querySelector<HTMLElement>(`.${className}`);
    if (found) return found;
    node = node.parentElement;
  }
  return null;
}

function createRegion(
  className: string,
  role: string,
  live: string,
): HTMLElement {
  const region = document.createElement("div");
  region.className = className;
  region.setAttribute("role", role);
  region.setAttribute("aria-live", live);
  region.setAttribute("aria-atomic", "true");
  // Für Screenreader vorhanden, visuell nicht — ohne auf ein Stylesheet zu bauen.
  region.style.position = "absolute";
  region.style.width = "1px";
  region.style.height = "1px";
  region.style.overflow = "hidden";
  region.style.clip = "rect(0 0 0 0)";
  region.style.whiteSpace = "nowrap";
  return region;
}
