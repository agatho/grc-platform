import { Section, Text, Button } from "@react-email/components";
import * as React from "react";
import { EmailLayout, styles } from "./_shared";
interface Props {
  lang: "de" | "en";
  crisisName: string;
  severity: string;
  activatedAt: string;
  activatedBy: string;
  teamRole: string;
  recipientName: string;
  crisisUrl: string;
  orgName?: string;
}
export function getSubject(d: Record<string, unknown>, l: "de" | "en"): string {
  return l === "de"
    ? `🚨 KRISE AKTIVIERT: ${d.crisisName}`
    : `🚨 CRISIS ACTIVATED: ${d.crisisName}`;
}
export const CrisisActivated: React.FC<Props> = ({
  lang,
  crisisName,
  severity,
  activatedAt,
  activatedBy,
  teamRole,
  recipientName,
  crisisUrl,
  orgName,
}) => (
  <EmailLayout lang={lang} preview={`🚨 ${crisisName}`} orgName={orgName}>
    <Text style={styles.heading}>
      {lang === "de" ? "🚨 KRISE AKTIVIERT" : "🚨 CRISIS ACTIVATED"}
    </Text>
    <Section style={styles.urgentBanner}>
      <Text style={styles.urgentText}>
        {lang === "de"
          ? `${recipientName}, Sie wurden als Mitglied des Krisenteams aktiviert. Bitte reagieren Sie sofort.`
          : `${recipientName}, you have been activated as a crisis team member. Please respond immediately.`}
      </Text>
    </Section>
    <Section style={styles.card}>
      <Text style={styles.cardLabel}>{lang === "de" ? "Krise" : "Crisis"}</Text>
      <Text style={styles.cardValue}>{crisisName}</Text>
      <Text style={styles.cardLabel}>
        {lang === "de" ? "Schweregrad" : "Severity"}
      </Text>
      <Text style={{ ...styles.badge, backgroundColor: "#dc2626" }}>
        {severity}
      </Text>
      <Text style={styles.cardLabel}>
        {lang === "de" ? "Aktiviert am" : "Activated"}
      </Text>
      <Text style={styles.cardValue}>{activatedAt}</Text>
      <Text style={styles.cardLabel}>
        {lang === "de" ? "Aktiviert von" : "Activated by"}
      </Text>
      <Text style={styles.cardValue}>{activatedBy}</Text>
      <Text style={styles.cardLabel}>
        {lang === "de" ? "Ihre Rolle" : "Your Role"}
      </Text>
      <Text style={styles.cardValue}>{teamRole}</Text>
    </Section>
    <Section style={styles.ctaSection}>
      <Button style={styles.buttonDanger} href={crisisUrl}>
        {lang === "de" ? "Zum Krisenlog" : "Open Crisis Log"}
      </Button>
    </Section>
  </EmailLayout>
);
export default CrisisActivated;
