import { Section, Text, Button } from "@react-email/components"; import * as React from "react"; import { EmailLayout, styles } from "./_shared";
interface Props { lang: "de" | "en"; ropaTitle: string; lastReviewed: string; recipientName: string; ropaUrl: string; orgName?: string; }
export function getSubject(data: Record<string, unknown>, lang: "de" | "en"): string { return lang === "de" ? `Jährlicher Review fällig: ${data.ropaTitle}` : `Annual review due: ${data.ropaTitle}`; }
export const RopaReviewDue: React.FC<Props> = ({ lang, ropaTitle, lastReviewed, recipientName, ropaUrl, orgName }) => (
  <EmailLayout lang={lang} preview={lang === "de" ? `VVT-Review fällig: ${ropaTitle}` : `RoPA review due: ${ropaTitle}`} orgName={orgName}>
    <Text style={styles.heading}>{lang === "de" ? "📋 Verarbeitungsverzeichnis — Review fällig" : "📋 Processing Register — Review Due"}</Text>
    <Text style={styles.text}>{lang === "de" ? `${recipientName}, der jährliche Review für die folgende Verarbeitungstätigkeit ist fällig:` : `${recipientName}, the annual review for the following processing activity is due:`}</Text>
    <Section style={styles.card}>
      <Text style={styles.cardLabel}>{lang === "de" ? "Verarbeitungstätigkeit" : "Processing Activity"}</Text><Text style={styles.cardValue}>{ropaTitle}</Text>
      <Text style={styles.cardLabel}>{lang === "de" ? "Letzter Review" : "Last Reviewed"}</Text><Text style={styles.cardValue}>{lastReviewed}</Text>
    </Section>
    <Section style={styles.ctaSection}><Button style={styles.button} href={ropaUrl}>{lang === "de" ? "Review durchführen" : "Conduct Review"}</Button></Section>
  </EmailLayout>
);
export default RopaReviewDue;
