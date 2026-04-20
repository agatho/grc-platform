import { Section, Text, Button } from "@react-email/components";
import * as React from "react";
import { EmailLayout, styles } from "./_shared";
interface Props {
  lang: "de" | "en";
  bcpTitle: string;
  lastReviewed: string;
  nextReviewDate: string;
  recipientName: string;
  bcpUrl: string;
  orgName?: string;
}
export function getSubject(d: Record<string, unknown>, l: "de" | "en"): string {
  return l === "de"
    ? `BCP-Review fällig: ${d.bcpTitle}`
    : `BCP review due: ${d.bcpTitle}`;
}
export const BcpReviewDue: React.FC<Props> = (p) => (
  <EmailLayout
    lang={p.lang}
    preview={`BCP Review: ${p.bcpTitle}`}
    orgName={p.orgName}
  >
    <Text style={styles.heading}>
      {p.lang === "de"
        ? "📄 Notfallplan — Review fällig"
        : "📄 Continuity Plan — Review Due"}
    </Text>
    <Text style={styles.text}>
      {p.lang === "de"
        ? `${p.recipientName}, der Review für folgenden BCP ist fällig:`
        : `${p.recipientName}, the review for the following BCP is due:`}
    </Text>
    <Section style={styles.card}>
      <Text style={styles.cardLabel}>BCP</Text>
      <Text style={styles.cardValue}>{p.bcpTitle}</Text>
      <Text style={styles.cardLabel}>
        {p.lang === "de" ? "Letzter Review" : "Last Review"}
      </Text>
      <Text style={styles.cardValue}>{p.lastReviewed}</Text>
      <Text style={styles.cardLabel}>
        {p.lang === "de" ? "Fällig am" : "Due"}
      </Text>
      <Text style={styles.cardValue}>{p.nextReviewDate}</Text>
    </Section>
    <Section style={styles.ctaSection}>
      <Button style={styles.button} href={p.bcpUrl}>
        {p.lang === "de" ? "BCP reviewen" : "Review BCP"}
      </Button>
    </Section>
  </EmailLayout>
);
export default BcpReviewDue;
