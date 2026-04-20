import { Section, Text, Button } from "@react-email/components";
import * as React from "react";
import { EmailLayout, styles } from "./_shared";
interface Props {
  lang: "de" | "en";
  auditName: string;
  auditType: string;
  plannedStart: string;
  plannedEnd: string;
  leadAuditor: string;
  recipientName: string;
  auditUrl: string;
  orgName?: string;
}
export function getSubject(d: Record<string, unknown>, l: "de" | "en"): string {
  return l === "de"
    ? `Audit geplant: ${d.auditName} (${d.plannedStart})`
    : `Audit scheduled: ${d.auditName} (${d.plannedStart})`;
}
export const AuditScheduled: React.FC<Props> = (p) => (
  <EmailLayout
    lang={p.lang}
    preview={`${p.auditName} — ${p.plannedStart}`}
    orgName={p.orgName}
  >
    <Text style={styles.heading}>
      {p.lang === "de" ? "📅 Audit geplant" : "📅 Audit Scheduled"}
    </Text>
    <Text style={styles.text}>
      {p.lang === "de"
        ? `${p.recipientName}, ein Audit wurde für Sie geplant:`
        : `${p.recipientName}, an audit has been scheduled for you:`}
    </Text>
    <Section style={styles.card}>
      <Text style={styles.cardLabel}>Audit</Text>
      <Text style={styles.cardValue}>{p.auditName}</Text>
      <Text style={styles.cardLabel}>{p.lang === "de" ? "Typ" : "Type"}</Text>
      <Text style={styles.cardValue}>{p.auditType}</Text>
      <Text style={styles.cardLabel}>
        {p.lang === "de" ? "Zeitraum" : "Period"}
      </Text>
      <Text style={styles.cardValue}>
        {p.plannedStart} — {p.plannedEnd}
      </Text>
      <Text style={styles.cardLabel}>
        {p.lang === "de" ? "Lead Auditor" : "Lead Auditor"}
      </Text>
      <Text style={styles.cardValue}>{p.leadAuditor}</Text>
    </Section>
    <Section style={styles.ctaSection}>
      <Button style={styles.button} href={p.auditUrl}>
        {p.lang === "de" ? "Audit ansehen" : "View Audit"}
      </Button>
    </Section>
  </EmailLayout>
);
export default AuditScheduled;
