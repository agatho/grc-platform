import { Section, Text, Button } from "@react-email/components"; import * as React from "react"; import { EmailLayout, styles } from "./_shared";
interface Props { lang: "de" | "en"; breachTitle: string; orgName: string; whatHappened: string; dataAffected: string; measuresTaken: string; contactInfo: string; }
export function getSubject(data: Record<string, unknown>, lang: "de" | "en"): string { return lang === "de" ? `Wichtige Information: Datenschutzvorfall bei ${data.orgName}` : `Important Notice: Data Protection Incident at ${data.orgName}`; }
export const DataBreachIndividualNotification: React.FC<Props> = ({ lang, breachTitle, orgName, whatHappened, dataAffected, measuresTaken, contactInfo }) => (
  <EmailLayout lang={lang} preview={lang === "de" ? "Wichtige Information zu Ihren Daten" : "Important information about your data"} orgName={orgName}>
    <Text style={styles.heading}>{lang === "de" ? "Wichtige Mitteilung zu Ihren personenbezogenen Daten" : "Important Notice Regarding Your Personal Data"}</Text>
    <Text style={styles.text}>{lang === "de" ? "Sehr geehrte Damen und Herren," : "Dear Sir or Madam,"}</Text>
    <Text style={styles.text}>{lang === "de" ? "wir möchten Sie gemäß Art. 34 DSGVO über einen Datenschutzvorfall informieren, der Ihre personenbezogenen Daten betreffen kann." : "We are writing to inform you, in accordance with GDPR Art. 34, about a data protection incident that may affect your personal data."}</Text>
    <Section style={styles.card}>
      <Text style={styles.cardLabel}>{lang === "de" ? "Was ist passiert" : "What happened"}</Text><Text style={{ ...styles.cardValue, fontWeight: "400" as const }}>{whatHappened}</Text>
      <Text style={styles.cardLabel}>{lang === "de" ? "Betroffene Daten" : "Data affected"}</Text><Text style={{ ...styles.cardValue, fontWeight: "400" as const }}>{dataAffected}</Text>
      <Text style={styles.cardLabel}>{lang === "de" ? "Ergriffene Maßnahmen" : "Measures taken"}</Text><Text style={{ ...styles.cardValue, fontWeight: "400" as const }}>{measuresTaken}</Text>
    </Section>
    <Text style={styles.text}>{lang === "de" ? `Bei Fragen wenden Sie sich bitte an: ${contactInfo}` : `For questions please contact: ${contactInfo}`}</Text>
  </EmailLayout>
);
export default DataBreachIndividualNotification;
