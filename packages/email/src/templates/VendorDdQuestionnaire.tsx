import { Section, Text, Button } from "@react-email/components"; import * as React from "react"; import { EmailLayout, styles } from "./_shared";
interface Props { lang: "de" | "en"; vendorName: string; requestingOrgName: string; deadline: string; questionnaireUrl: string; contactEmail: string; }
export function getSubject(d: Record<string, unknown>, l: "de" | "en"): string { return l === "de" ? `Due-Diligence-Fragebogen von ${d.requestingOrgName}` : `Due Diligence Questionnaire from ${d.requestingOrgName}`; }
export const VendorDdQuestionnaire: React.FC<Props> = (p) => (
  <EmailLayout lang={p.lang} preview={p.lang === "de" ? `DD-Fragebogen von ${p.requestingOrgName}` : `DD Questionnaire from ${p.requestingOrgName}`} orgName={p.requestingOrgName}>
    <Text style={styles.heading}>{p.lang === "de" ? "📋 Due-Diligence-Fragebogen" : "📋 Due Diligence Questionnaire"}</Text>
    <Text style={styles.text}>{p.lang === "de"
      ? `Sehr geehrte Damen und Herren bei ${p.vendorName},\n\nim Rahmen unserer Lieferantenbewertung bitten wir Sie, den folgenden Fragebogen auszufüllen.`
      : `Dear ${p.vendorName} team,\n\nAs part of our vendor assessment process, we kindly ask you to complete the following questionnaire.`}</Text>
    <Section style={styles.card}>
      <Text style={styles.cardLabel}>{p.lang === "de" ? "Auftraggeber" : "Requesting Organization"}</Text><Text style={styles.cardValue}>{p.requestingOrgName}</Text>
      <Text style={styles.cardLabel}>{p.lang === "de" ? "Frist" : "Deadline"}</Text><Text style={styles.cardValue}>{p.deadline}</Text>
      <Text style={styles.cardLabel}>{p.lang === "de" ? "Kontakt" : "Contact"}</Text><Text style={styles.cardValue}>{p.contactEmail}</Text>
    </Section>
    <Text style={styles.text}>{p.lang === "de"
      ? "Der Link ist nur einmal gültig. Bitte füllen Sie den Fragebogen vollständig aus und senden ihn vor Ablauf der Frist ab."
      : "The link is valid for one-time use. Please complete the questionnaire in full and submit before the deadline."}</Text>
    <Section style={styles.ctaSection}><Button style={styles.button} href={p.questionnaireUrl}>{p.lang === "de" ? "Fragebogen öffnen" : "Open Questionnaire"}</Button></Section>
  </EmailLayout>
);
export default VendorDdQuestionnaire;
