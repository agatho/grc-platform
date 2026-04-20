import { Section, Text, Button } from "@react-email/components";
import * as React from "react";
import { EmailLayout, styles } from "./_shared";

interface Props {
  lang: "de" | "en";
  breachTitle: string;
  detectedAt: string;
  deadlineAt: string;
  hoursOverdue: number;
  recipientName: string;
  breachUrl: string;
  orgName?: string;
}

const t = {
  de: {
    heading: "🚨 ÜBERFÄLLIG: Datenpanne nicht gemeldet",
    intro: "Die 72-Stunden-Meldefrist nach Art. 33 DSGVO ist abgelaufen!",
    overdue: "Überfällig seit",
    hours: "Stunden",
    urgent:
      "Sofortiges Handeln erforderlich. Die Meldung an die Aufsichtsbehörde hätte bereits erfolgen müssen. Jede weitere Verzögerung erhöht das Bußgeldrisiko.",
    cta: "JETZT melden",
  },
  en: {
    heading: "🚨 OVERDUE: Data Breach not reported",
    intro: "The 72-hour notification deadline under GDPR Art. 33 has expired!",
    overdue: "Overdue by",
    hours: "hours",
    urgent:
      "Immediate action required. The supervisory authority should have been notified already. Further delay increases the risk of penalties.",
    cta: "Report NOW",
  },
};

export function getSubject(
  data: Record<string, unknown>,
  lang: "de" | "en",
): string {
  return lang === "de"
    ? `🚨 ÜBERFÄLLIG: Datenpanne "${data.breachTitle}" — Meldefrist abgelaufen`
    : `🚨 OVERDUE: Data Breach "${data.breachTitle}" — deadline passed`;
}

export const DataBreach72hOverdue: React.FC<Props> = ({
  lang,
  breachTitle,
  detectedAt,
  deadlineAt,
  hoursOverdue,
  recipientName,
  breachUrl,
  orgName,
}) => {
  const l = t[lang];
  return (
    <EmailLayout lang={lang} preview={l.heading} orgName={orgName}>
      <Text style={styles.heading}>{l.heading}</Text>
      <Text style={styles.text}>{l.intro}</Text>
      <Section style={styles.card}>
        <Text style={styles.cardLabel}>
          {lang === "de" ? "Datenpanne" : "Breach"}
        </Text>
        <Text style={styles.cardValue}>{breachTitle}</Text>
        <Text style={styles.cardLabel}>{l.overdue}</Text>
        <Text style={{ ...styles.badge, backgroundColor: "#dc2626" }}>
          {hoursOverdue} {l.hours}
        </Text>
      </Section>
      <Section style={styles.urgentBanner}>
        <Text style={styles.urgentText}>{l.urgent}</Text>
      </Section>
      <Section style={styles.ctaSection}>
        <Button style={styles.buttonDanger} href={breachUrl}>
          {l.cta}
        </Button>
      </Section>
    </EmailLayout>
  );
};
export default DataBreach72hOverdue;
