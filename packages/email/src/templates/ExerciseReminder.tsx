import { Section, Text, Button } from "@react-email/components"; import * as React from "react"; import { EmailLayout, styles } from "./_shared";
interface Props { lang: "de" | "en"; exerciseTitle: string; exerciseType: string; plannedDate: string; recipientName: string; exerciseUrl: string; orgName?: string; }
export function getSubject(d: Record<string, unknown>, l: "de" | "en"): string { return l === "de" ? `BC-Übung geplant: ${d.exerciseTitle} am ${d.plannedDate}` : `BC Exercise planned: ${d.exerciseTitle} on ${d.plannedDate}`; }
export const ExerciseReminder: React.FC<Props> = (p) => (
  <EmailLayout lang={p.lang} preview={`${p.exerciseTitle} — ${p.plannedDate}`} orgName={p.orgName}>
    <Text style={styles.heading}>{p.lang === "de" ? "🏋 BC-Übung — Erinnerung" : "🏋 BC Exercise — Reminder"}</Text>
    <Text style={styles.text}>{p.lang === "de" ? `${p.recipientName}, folgende BC-Übung steht bevor:` : `${p.recipientName}, the following BC exercise is upcoming:`}</Text>
    <Section style={styles.card}>
      <Text style={styles.cardLabel}>{p.lang === "de" ? "Übung" : "Exercise"}</Text><Text style={styles.cardValue}>{p.exerciseTitle}</Text>
      <Text style={styles.cardLabel}>{p.lang === "de" ? "Typ" : "Type"}</Text><Text style={styles.cardValue}>{p.exerciseType}</Text>
      <Text style={styles.cardLabel}>{p.lang === "de" ? "Datum" : "Date"}</Text><Text style={styles.cardValue}>{p.plannedDate}</Text>
    </Section>
    <Section style={styles.ctaSection}><Button style={styles.button} href={p.exerciseUrl}>{p.lang === "de" ? "Details" : "Details"}</Button></Section>
  </EmailLayout>
);
export default ExerciseReminder;
