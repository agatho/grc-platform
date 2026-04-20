import { Section, Text, Button } from "@react-email/components";
import * as React from "react";
import { EmailLayout, styles } from "./_shared";
interface Props {
  lang: "de" | "en";
  contractTitle: string;
  vendorName: string;
  metricName: string;
  targetValue: string;
  actualValue: string;
  unit: string;
  measurementPeriod: string;
  recipientName: string;
  contractUrl: string;
  orgName?: string;
}
export function getSubject(d: Record<string, unknown>, l: "de" | "en"): string {
  return l === "de"
    ? `🔴 SLA-Verletzung: ${d.metricName} bei ${d.vendorName}`
    : `🔴 SLA Breach: ${d.metricName} at ${d.vendorName}`;
}
export const SlaBreachAlert: React.FC<Props> = (p) => (
  <EmailLayout
    lang={p.lang}
    preview={`SLA: ${p.metricName} ${p.actualValue}${p.unit} < ${p.targetValue}${p.unit}`}
    orgName={p.orgName}
  >
    <Text style={styles.heading}>
      {p.lang === "de" ? "🔴 SLA-Verletzung erkannt" : "🔴 SLA Breach Detected"}
    </Text>
    <Text style={styles.text}>
      {p.lang === "de"
        ? `${p.recipientName}, eine SLA-Verletzung wurde festgestellt:`
        : `${p.recipientName}, an SLA breach has been detected:`}
    </Text>
    <Section style={styles.card}>
      <Text style={styles.cardLabel}>
        {p.lang === "de" ? "Vertrag" : "Contract"}
      </Text>
      <Text style={styles.cardValue}>
        {p.contractTitle} ({p.vendorName})
      </Text>
      <Text style={styles.cardLabel}>
        {p.lang === "de" ? "Metrik" : "Metric"}
      </Text>
      <Text style={styles.cardValue}>{p.metricName}</Text>
      <Text style={styles.cardLabel}>
        {p.lang === "de" ? "Zielwert" : "Target"}
      </Text>
      <Text style={styles.cardValue}>
        {p.targetValue}
        {p.unit}
      </Text>
      <Text style={styles.cardLabel}>
        {p.lang === "de" ? "Istwert" : "Actual"}
      </Text>
      <Text style={{ ...styles.badge, backgroundColor: "#dc2626" }}>
        {p.actualValue}
        {p.unit}
      </Text>
      <Text style={styles.cardLabel}>
        {p.lang === "de" ? "Messzeitraum" : "Period"}
      </Text>
      <Text style={styles.cardValue}>{p.measurementPeriod}</Text>
    </Section>
    <Section style={styles.ctaSection}>
      <Button style={styles.buttonDanger} href={p.contractUrl}>
        {p.lang === "de" ? "SLA-Details" : "SLA Details"}
      </Button>
    </Section>
  </EmailLayout>
);
export default SlaBreachAlert;
