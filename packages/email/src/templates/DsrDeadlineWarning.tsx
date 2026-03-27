import { Section, Text, Button } from "@react-email/components";
import * as React from "react";
import { EmailLayout, styles } from "./_shared";

interface Props { lang: "de" | "en"; dsrId: string; dsrType: string; daysRemaining: number; deadlineAt: string; handlerName: string; dsrUrl: string; orgName?: string; }

export function getSubject(data: Record<string, unknown>, lang: "de" | "en"): string {
  const d = data.daysRemaining as number;
  return lang === "de" ? `⚠️ DSR ${data.dsrId}: Nur noch ${d} Tage bis Fristablauf` : `⚠️ DSR ${data.dsrId}: Only ${d} days until deadline`;
}

export const DsrDeadlineWarning: React.FC<Props> = ({ lang, dsrId, dsrType, daysRemaining, deadlineAt, handlerName, dsrUrl, orgName }) => (
  <EmailLayout lang={lang} preview={`DSR ${dsrId}: ${daysRemaining} ${lang === "de" ? "Tage verbleibend" : "days remaining"}`} orgName={orgName}>
    <Text style={styles.heading}>{lang === "de" ? `⚠️ Betroffenenanfrage — ${daysRemaining} Tage verbleibend` : `⚠️ Data Subject Request — ${daysRemaining} days remaining`}</Text>
    <Text style={styles.text}>{lang === "de" ? `Die 30-Tage-Frist für die Betroffenenanfrage ${dsrId} läuft in ${daysRemaining} Tagen ab.` : `The 30-day deadline for DSR ${dsrId} expires in ${daysRemaining} days.`}</Text>
    <Section style={styles.card}>
      <Text style={styles.cardLabel}>{lang === "de" ? "Referenz" : "Reference"}</Text><Text style={styles.cardValue}>{dsrId} ({dsrType})</Text>
      <Text style={styles.cardLabel}>{lang === "de" ? "Frist" : "Deadline"}</Text><Text style={styles.cardValue}>{deadlineAt}</Text>
      <Text style={styles.cardLabel}>{lang === "de" ? "Verbleibend" : "Remaining"}</Text>
      <Text style={{ ...styles.badge, backgroundColor: daysRemaining <= 5 ? "#dc2626" : "#ea580c" }}>{daysRemaining} {lang === "de" ? "Tage" : "days"}</Text>
    </Section>
    <Section style={styles.ctaSection}><Button style={daysRemaining <= 5 ? styles.buttonDanger : styles.button} href={dsrUrl}>{lang === "de" ? "Anfrage bearbeiten" : "Handle Request"}</Button></Section>
  </EmailLayout>
);
export default DsrDeadlineWarning;
