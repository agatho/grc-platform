import { Section, Text, Button } from "@react-email/components";
import * as React from "react";
import { EmailLayout, styles } from "./_shared";
interface Props {
  lang: "de" | "en";
  crisisName: string;
  resolvedAt: string;
  duration: string;
  recipientName: string;
  crisisUrl: string;
  orgName?: string;
}
export function getSubject(d: Record<string, unknown>, l: "de" | "en"): string {
  return l === "de"
    ? `✅ Krise aufgelöst: ${d.crisisName}`
    : `✅ Crisis resolved: ${d.crisisName}`;
}
export const CrisisResolved: React.FC<Props> = ({
  lang,
  crisisName,
  resolvedAt,
  duration,
  recipientName,
  crisisUrl,
  orgName,
}) => (
  <EmailLayout
    lang={lang}
    preview={`✅ ${crisisName} ${lang === "de" ? "aufgelöst" : "resolved"}`}
    orgName={orgName}
  >
    <Text style={styles.heading}>
      {lang === "de" ? "✅ Krise aufgelöst" : "✅ Crisis Resolved"}
    </Text>
    <Text style={styles.text}>
      {lang === "de"
        ? `${recipientName}, die folgende Krise wurde aufgelöst:`
        : `${recipientName}, the following crisis has been resolved:`}
    </Text>
    <Section style={styles.card}>
      <Text style={styles.cardLabel}>{lang === "de" ? "Krise" : "Crisis"}</Text>
      <Text style={styles.cardValue}>{crisisName}</Text>
      <Text style={styles.cardLabel}>
        {lang === "de" ? "Aufgelöst am" : "Resolved"}
      </Text>
      <Text style={styles.cardValue}>{resolvedAt}</Text>
      <Text style={styles.cardLabel}>
        {lang === "de" ? "Dauer" : "Duration"}
      </Text>
      <Text style={styles.cardValue}>{duration}</Text>
    </Section>
    <Section style={styles.ctaSection}>
      <Button style={styles.button} href={crisisUrl}>
        {lang === "de" ? "Post-Mortem ansehen" : "View Post-Mortem"}
      </Button>
    </Section>
  </EmailLayout>
);
export default CrisisResolved;
