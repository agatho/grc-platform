import { Section, Text, Button } from "@react-email/components";
import * as React from "react";
import { EmailLayout, styles } from "./_shared";

interface Props { lang: "de" | "en"; dsrType: string; dsrId: string; dataSubjectName: string; receivedAt: string; deadlineAt: string; handlerName: string; dsrUrl: string; orgName?: string; }

const t = {
  de: { heading: "Neue Betroffenenanfrage eingegangen", intro: (type: string) => `Eine neue ${type}-Anfrage nach DSGVO wurde eingegangen.`, type: "Anfrageart", id: "Referenz", subject: "Betroffener", received: "Eingegangen am", deadline: "Frist (30 Tage)", handler: "Bearbeiter", cta: "Anfrage bearbeiten" },
  en: { heading: "New Data Subject Request received", intro: (type: string) => `A new ${type} request under GDPR has been received.`, type: "Request Type", id: "Reference", subject: "Data Subject", received: "Received", deadline: "Deadline (30 days)", handler: "Handler", cta: "Handle Request" },
};

export function getSubject(data: Record<string, unknown>, lang: "de" | "en"): string {
  return lang === "de" ? `Betroffenenanfrage ${data.dsrId}: ${data.dsrType}` : `Data Subject Request ${data.dsrId}: ${data.dsrType}`;
}

export const DsrReceived: React.FC<Props> = ({ lang, dsrType, dsrId, dataSubjectName, receivedAt, deadlineAt, handlerName, dsrUrl, orgName }) => {
  const l = t[lang];
  return (
    <EmailLayout lang={lang} preview={`${l.heading}: ${dsrId}`} orgName={orgName}>
      <Text style={styles.heading}>{l.heading}</Text>
      <Text style={styles.text}>{l.intro(dsrType)}</Text>
      <Section style={styles.card}>
        <Text style={styles.cardLabel}>{l.id}</Text><Text style={styles.cardValue}>{dsrId}</Text>
        <Text style={styles.cardLabel}>{l.type}</Text><Text style={styles.cardValue}>{dsrType}</Text>
        <Text style={styles.cardLabel}>{l.subject}</Text><Text style={styles.cardValue}>{dataSubjectName}</Text>
        <Text style={styles.cardLabel}>{l.received}</Text><Text style={styles.cardValue}>{receivedAt}</Text>
        <Text style={styles.cardLabel}>{l.deadline}</Text><Text style={styles.cardValue}>{deadlineAt}</Text>
        <Text style={styles.cardLabel}>{l.handler}</Text><Text style={styles.cardValue}>{handlerName}</Text>
      </Section>
      <Section style={styles.ctaSection}><Button style={styles.button} href={dsrUrl}>{l.cta}</Button></Section>
    </EmailLayout>
  );
};
export default DsrReceived;
