import { Section, Text, Button } from "@react-email/components";
import * as React from "react";
import { EmailLayout, styles } from "./_shared";

interface Props { lang: "de" | "en"; breachTitle: string; detectedAt: string; deadlineAt: string; hoursRemaining: number; affectedRecords?: number; recipientName: string; breachUrl: string; orgName?: string; }

const t = {
  de: { heading: "🔴 Datenpanne — 72h-Meldefrist", greeting: (n: string) => `${n},`, intro: "Eine meldepflichtige Datenpanne wurde erkannt. Die 72-Stunden-Meldefrist nach Art. 33 DSGVO läuft.", breach: "Datenpanne", detected: "Erkannt am", deadline: "Meldefrist", remaining: "Verbleibend", hours: "Stunden", affected: "Betroffene Datensätze", urgent: "Die Meldung an die Aufsichtsbehörde muss innerhalb von 72 Stunden erfolgen.", cta: "Datenpanne bearbeiten" },
  en: { heading: "🔴 Data Breach — 72h Notification Deadline", greeting: (n: string) => `${n},`, intro: "A reportable data breach has been detected. The 72-hour notification deadline under GDPR Art. 33 is running.", breach: "Data Breach", detected: "Detected at", deadline: "Deadline", remaining: "Remaining", hours: "hours", affected: "Affected records", urgent: "The supervisory authority must be notified within 72 hours.", cta: "Handle Breach" },
};

export function getSubject(data: Record<string, unknown>, lang: "de" | "en"): string {
  const h = data.hoursRemaining as number;
  return lang === "de" ? `⚠️ DRINGEND: Datenpanne — ${h}h bis Meldefrist` : `⚠️ URGENT: Data Breach — ${h}h until deadline`;
}

export const DataBreach72hWarning: React.FC<Props> = ({ lang, breachTitle, detectedAt, deadlineAt, hoursRemaining, affectedRecords, recipientName, breachUrl, orgName }) => {
  const l = t[lang];
  return (
    <EmailLayout lang={lang} preview={`${l.heading}: ${breachTitle}`} orgName={orgName}>
      <Text style={styles.heading}>{l.heading}</Text>
      <Text style={styles.text}>{l.greeting(recipientName)}</Text>
      <Text style={styles.text}>{l.intro}</Text>
      <Section style={styles.card}>
        <Text style={styles.cardLabel}>{l.breach}</Text>
        <Text style={styles.cardValue}>{breachTitle}</Text>
        <Text style={styles.cardLabel}>{l.detected}</Text>
        <Text style={styles.cardValue}>{detectedAt}</Text>
        <Text style={styles.cardLabel}>{l.deadline}</Text>
        <Text style={styles.cardValue}>{deadlineAt}</Text>
        <Text style={styles.cardLabel}>{l.remaining}</Text>
        <Text style={{ ...styles.badge, backgroundColor: hoursRemaining < 12 ? "#dc2626" : "#ea580c" }}>{hoursRemaining} {l.hours}</Text>
        {affectedRecords && <><Text style={styles.cardLabel}>{l.affected}</Text><Text style={styles.cardValue}>~{affectedRecords.toLocaleString()}</Text></>}
      </Section>
      <Section style={styles.urgentBanner}><Text style={styles.urgentText}>{l.urgent}</Text></Section>
      <Section style={styles.ctaSection}><Button style={styles.buttonDanger} href={breachUrl}>{l.cta}</Button></Section>
    </EmailLayout>
  );
};
export default DataBreach72hWarning;
