import { Section, Text, Button } from "@react-email/components"; import * as React from "react"; import { EmailLayout, styles } from "./_shared";
interface Props { lang: "de" | "en"; processingName: string; triggerCriteria: string[]; recipientName: string; dpiaUrl: string; orgName?: string; }
export function getSubject(d: Record<string, unknown>, l: "de" | "en"): string { return l === "de" ? `DSFA erforderlich: ${d.processingName}` : `DPIA required: ${d.processingName}`; }
export const DpiaRequired: React.FC<Props> = ({ lang, processingName, triggerCriteria, recipientName, dpiaUrl, orgName }) => (
  <EmailLayout lang={lang} preview={lang === "de" ? `DSFA-Pflicht für: ${processingName}` : `DPIA required for: ${processingName}`} orgName={orgName}>
    <Text style={styles.heading}>{lang === "de" ? "📊 Datenschutz-Folgenabschätzung erforderlich" : "📊 Data Protection Impact Assessment Required"}</Text>
    <Text style={styles.text}>{lang === "de" ? `${recipientName}, für die folgende Verarbeitung wurde eine DSFA-Pflicht nach Art. 35 DSGVO festgestellt:` : `${recipientName}, a DPIA obligation under Art. 35 GDPR has been identified for:`}</Text>
    <Section style={styles.card}>
      <Text style={styles.cardLabel}>{lang === "de" ? "Verarbeitung" : "Processing"}</Text><Text style={styles.cardValue}>{processingName}</Text>
      <Text style={styles.cardLabel}>{lang === "de" ? "Auslösende Kriterien" : "Trigger Criteria"}</Text>
      {triggerCriteria.map((c, i) => <Text key={i} style={{ ...styles.cardValue, fontWeight: "400" as const }}>• {c}</Text>)}
    </Section>
    <Section style={styles.ctaSection}><Button style={styles.button} href={dpiaUrl}>{lang === "de" ? "DSFA starten" : "Start DPIA"}</Button></Section>
  </EmailLayout>
);
export default DpiaRequired;
