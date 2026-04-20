import { Section, Text, Button } from "@react-email/components";
import * as React from "react";
import { EmailLayout, styles } from "./_shared";
interface Props {
  lang: "de" | "en";
  dsrId: string;
  dsrType: string;
  completedAt: string;
  dataSubjectEmail: string;
  dsrUrl: string;
  orgName?: string;
}
export function getSubject(
  data: Record<string, unknown>,
  lang: "de" | "en",
): string {
  return lang === "de"
    ? `Betroffenenanfrage ${data.dsrId} abgeschlossen`
    : `Data Subject Request ${data.dsrId} completed`;
}
export const DsrCompleted: React.FC<Props> = ({
  lang,
  dsrId,
  dsrType,
  completedAt,
  dataSubjectEmail,
  dsrUrl,
  orgName,
}) => (
  <EmailLayout
    lang={lang}
    preview={`DSR ${dsrId} ${lang === "de" ? "abgeschlossen" : "completed"}`}
    orgName={orgName}
  >
    <Text style={styles.heading}>
      {lang === "de"
        ? "✅ Betroffenenanfrage abgeschlossen"
        : "✅ Data Subject Request completed"}
    </Text>
    <Text style={styles.text}>
      {lang === "de"
        ? `Die Betroffenenanfrage ${dsrId} (${dsrType}) wurde erfolgreich bearbeitet.`
        : `DSR ${dsrId} (${dsrType}) has been successfully processed.`}
    </Text>
    <Section style={styles.card}>
      <Text style={styles.cardLabel}>
        {lang === "de" ? "Referenz" : "Reference"}
      </Text>
      <Text style={styles.cardValue}>{dsrId}</Text>
      <Text style={styles.cardLabel}>
        {lang === "de" ? "Abgeschlossen am" : "Completed"}
      </Text>
      <Text style={styles.cardValue}>{completedAt}</Text>
      <Text style={styles.cardLabel}>
        {lang === "de" ? "Betroffener" : "Data Subject"}
      </Text>
      <Text style={styles.cardValue}>{dataSubjectEmail}</Text>
    </Section>
    <Section style={styles.ctaSection}>
      <Button style={styles.button} href={dsrUrl}>
        {lang === "de" ? "Details anzeigen" : "View Details"}
      </Button>
    </Section>
  </EmailLayout>
);
export default DsrCompleted;
