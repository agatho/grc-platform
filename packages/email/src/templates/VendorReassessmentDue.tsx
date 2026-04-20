import { Section, Text, Button } from "@react-email/components";
import * as React from "react";
import { EmailLayout, styles } from "./_shared";
interface Props {
  lang: "de" | "en";
  vendorName: string;
  tier: string;
  lastAssessment: string;
  nextAssessment: string;
  daysOverdue?: number;
  recipientName: string;
  vendorUrl: string;
  orgName?: string;
}
export function getSubject(d: Record<string, unknown>, l: "de" | "en"): string {
  return l === "de"
    ? `Lieferantenbewertung fällig: ${d.vendorName}`
    : `Vendor reassessment due: ${d.vendorName}`;
}
export const VendorReassessmentDue: React.FC<Props> = (p) => (
  <EmailLayout
    lang={p.lang}
    preview={`${p.vendorName} — ${p.lang === "de" ? "Bewertung fällig" : "assessment due"}`}
    orgName={p.orgName}
  >
    <Text style={styles.heading}>
      {p.lang === "de"
        ? "🔄 Lieferantenbewertung fällig"
        : "🔄 Vendor Reassessment Due"}
    </Text>
    <Text style={styles.text}>
      {p.lang === "de"
        ? `${p.recipientName}, die periodische Risikobewertung für folgenden Lieferanten ist fällig:`
        : `${p.recipientName}, the periodic risk assessment for the following vendor is due:`}
    </Text>
    <Section style={styles.card}>
      <Text style={styles.cardLabel}>
        {p.lang === "de" ? "Lieferant" : "Vendor"}
      </Text>
      <Text style={styles.cardValue}>{p.vendorName}</Text>
      <Text style={styles.cardLabel}>Tier</Text>
      <Text
        style={{
          ...styles.badge,
          backgroundColor:
            p.tier === "critical"
              ? "#dc2626"
              : p.tier === "important"
                ? "#ea580c"
                : "#6b7280",
        }}
      >
        {p.tier}
      </Text>
      <Text style={styles.cardLabel}>
        {p.lang === "de" ? "Letzte Bewertung" : "Last Assessment"}
      </Text>
      <Text style={styles.cardValue}>{p.lastAssessment}</Text>
      <Text style={styles.cardLabel}>
        {p.lang === "de" ? "Fällig am" : "Due"}
      </Text>
      <Text style={styles.cardValue}>{p.nextAssessment}</Text>
      {p.daysOverdue && p.daysOverdue > 0 && (
        <>
          <Text style={styles.cardLabel}>
            {p.lang === "de" ? "Überfällig" : "Overdue"}
          </Text>
          <Text style={{ ...styles.badge, backgroundColor: "#dc2626" }}>
            {p.daysOverdue} {p.lang === "de" ? "Tage" : "days"}
          </Text>
        </>
      )}
    </Section>
    <Section style={styles.ctaSection}>
      <Button
        style={p.daysOverdue ? styles.buttonDanger : styles.button}
        href={p.vendorUrl}
      >
        {p.lang === "de" ? "Bewertung starten" : "Start Assessment"}
      </Button>
    </Section>
  </EmailLayout>
);
export default VendorReassessmentDue;
