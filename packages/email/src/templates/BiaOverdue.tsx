import { Section, Text, Button } from "@react-email/components";
import * as React from "react";
import { EmailLayout, styles } from "./_shared";
interface Props {
  lang: "de" | "en";
  processName: string;
  biaName: string;
  recipientName: string;
  biaUrl: string;
  orgName?: string;
}
export function getSubject(d: Record<string, unknown>, l: "de" | "en"): string {
  return l === "de"
    ? `BIA überfällig: ${d.processName}`
    : `BIA overdue: ${d.processName}`;
}
export const BiaOverdue: React.FC<Props> = (p) => (
  <EmailLayout
    lang={p.lang}
    preview={`BIA: ${p.processName}`}
    orgName={p.orgName}
  >
    <Text style={styles.heading}>
      {p.lang === "de"
        ? "⚠️ BIA-Bewertung überfällig"
        : "⚠️ BIA Assessment Overdue"}
    </Text>
    <Text style={styles.text}>
      {p.lang === "de"
        ? `${p.recipientName}, der Prozess „${p.processName}" wurde im Rahmen der BIA „${p.biaName}" noch nicht bewertet.`
        : `${p.recipientName}, the process "${p.processName}" has not yet been assessed in BIA "${p.biaName}".`}
    </Text>
    <Section style={styles.ctaSection}>
      <Button style={styles.button} href={p.biaUrl}>
        {p.lang === "de" ? "BIA fortsetzen" : "Continue BIA"}
      </Button>
    </Section>
  </EmailLayout>
);
export default BiaOverdue;
