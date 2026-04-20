import { Section, Text, Button } from "@react-email/components";
import * as React from "react";
import { EmailLayout, styles } from "./_shared";
interface Props {
  lang: "de" | "en";
  planName: string;
  year: string;
  auditCount: number;
  approvedBy: string;
  recipientName: string;
  planUrl: string;
  orgName?: string;
}
export function getSubject(d: Record<string, unknown>, l: "de" | "en"): string {
  return l === "de"
    ? `Audit-Plan ${d.year} genehmigt`
    : `Audit Plan ${d.year} approved`;
}
export const AuditPlanApproved: React.FC<Props> = (p) => (
  <EmailLayout
    lang={p.lang}
    preview={`${p.planName} — ${p.lang === "de" ? "genehmigt" : "approved"}`}
    orgName={p.orgName}
  >
    <Text style={styles.heading}>
      {p.lang === "de" ? "✅ Audit-Plan genehmigt" : "✅ Audit Plan Approved"}
    </Text>
    <Text style={styles.text}>
      {p.lang === "de"
        ? `${p.recipientName}, der Audit-Plan wurde genehmigt:`
        : `${p.recipientName}, the audit plan has been approved:`}
    </Text>
    <Section style={styles.card}>
      <Text style={styles.cardLabel}>
        {p.lang === "de" ? "Audit-Plan" : "Audit Plan"}
      </Text>
      <Text style={styles.cardValue}>{p.planName}</Text>
      <Text style={styles.cardLabel}>
        {p.lang === "de" ? "Geplante Audits" : "Planned Audits"}
      </Text>
      <Text style={styles.cardValue}>{p.auditCount}</Text>
      <Text style={styles.cardLabel}>
        {p.lang === "de" ? "Genehmigt von" : "Approved by"}
      </Text>
      <Text style={styles.cardValue}>{p.approvedBy}</Text>
    </Section>
    <Section style={styles.ctaSection}>
      <Button style={styles.button} href={p.planUrl}>
        {p.lang === "de" ? "Plan ansehen" : "View Plan"}
      </Button>
    </Section>
  </EmailLayout>
);
export default AuditPlanApproved;
