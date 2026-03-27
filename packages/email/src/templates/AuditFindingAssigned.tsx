import { Section, Text, Button } from "@react-email/components"; import * as React from "react"; import { EmailLayout, styles } from "./_shared";
interface Props { lang: "de" | "en"; findingTitle: string; findingId: string; severity: string; auditName: string; dueDate: string; recipientName: string; findingUrl: string; orgName?: string; }
export function getSubject(d: Record<string, unknown>, l: "de" | "en"): string { return l === "de" ? `Audit-Feststellung zugewiesen: ${d.findingId}` : `Audit finding assigned: ${d.findingId}`; }
export const AuditFindingAssigned: React.FC<Props> = (p) => (
  <EmailLayout lang={p.lang} preview={`${p.findingId}: ${p.findingTitle}`} orgName={p.orgName}>
    <Text style={styles.heading}>{p.lang === "de" ? "📋 Audit-Feststellung zugewiesen" : "📋 Audit Finding Assigned"}</Text>
    <Text style={styles.text}>{p.lang === "de" ? `${p.recipientName}, Ihnen wurde eine Feststellung aus einem Audit zugewiesen:` : `${p.recipientName}, you have been assigned a finding from an audit:`}</Text>
    <Section style={styles.card}>
      <Text style={styles.cardLabel}>{p.lang === "de" ? "Feststellung" : "Finding"}</Text><Text style={styles.cardValue}>{p.findingId}: {p.findingTitle}</Text>
      <Text style={styles.cardLabel}>{p.lang === "de" ? "Schweregrad" : "Severity"}</Text><Text style={{ ...styles.badge, backgroundColor: p.severity === "major" ? "#dc2626" : "#ea580c" }}>{p.severity}</Text>
      <Text style={styles.cardLabel}>Audit</Text><Text style={styles.cardValue}>{p.auditName}</Text>
      <Text style={styles.cardLabel}>{p.lang === "de" ? "Frist" : "Due"}</Text><Text style={styles.cardValue}>{p.dueDate}</Text>
    </Section>
    <Section style={styles.ctaSection}><Button style={styles.button} href={p.findingUrl}>{p.lang === "de" ? "Feststellung bearbeiten" : "Handle Finding"}</Button></Section>
  </EmailLayout>
);
export default AuditFindingAssigned;
