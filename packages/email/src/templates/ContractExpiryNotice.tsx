import { Section, Text, Button } from "@react-email/components"; import * as React from "react"; import { EmailLayout, styles } from "./_shared";
interface Props { lang: "de" | "en"; contractTitle: string; vendorName: string; expirationDate: string; daysRemaining: number; noticePeriodDays: number; totalValue: string; recipientName: string; contractUrl: string; orgName?: string; }
export function getSubject(d: Record<string, unknown>, l: "de" | "en"): string { return l === "de" ? `Vertrag läuft aus: ${d.contractTitle} (${d.daysRemaining} Tage)` : `Contract expiring: ${d.contractTitle} (${d.daysRemaining} days)`; }
export const ContractExpiryNotice: React.FC<Props> = (p) => (
  <EmailLayout lang={p.lang} preview={`${p.contractTitle} — ${p.daysRemaining} ${p.lang === "de" ? "Tage" : "days"}`} orgName={p.orgName}>
    <Text style={styles.heading}>{p.lang === "de" ? "📄 Vertrag läuft aus" : "📄 Contract Expiring"}</Text>
    <Text style={styles.text}>{p.lang === "de" ? `${p.recipientName}, folgender Vertrag läuft in ${p.daysRemaining} Tagen aus:` : `${p.recipientName}, the following contract expires in ${p.daysRemaining} days:`}</Text>
    <Section style={styles.card}>
      <Text style={styles.cardLabel}>{p.lang === "de" ? "Vertrag" : "Contract"}</Text><Text style={styles.cardValue}>{p.contractTitle}</Text>
      <Text style={styles.cardLabel}>{p.lang === "de" ? "Lieferant" : "Vendor"}</Text><Text style={styles.cardValue}>{p.vendorName}</Text>
      <Text style={styles.cardLabel}>{p.lang === "de" ? "Ablaufdatum" : "Expiration"}</Text><Text style={styles.cardValue}>{p.expirationDate}</Text>
      <Text style={styles.cardLabel}>{p.lang === "de" ? "Jahreswert" : "Annual Value"}</Text><Text style={styles.cardValue}>{p.totalValue}</Text>
      <Text style={styles.cardLabel}>{p.lang === "de" ? "Kündigungsfrist" : "Notice Period"}</Text><Text style={styles.cardValue}>{p.noticePeriodDays} {p.lang === "de" ? "Tage" : "days"}</Text>
    </Section>
    {p.daysRemaining <= p.noticePeriodDays && <Section style={styles.urgentBanner}><Text style={styles.urgentText}>{p.lang === "de" ? "⚠️ Die Kündigungsfrist ist erreicht. Ohne Aktion wird der Vertrag automatisch verlängert oder ausläuft." : "⚠️ The notice period has been reached. Without action, the contract will auto-renew or expire."}</Text></Section>}
    <Section style={styles.ctaSection}><Button style={p.daysRemaining <= p.noticePeriodDays ? styles.buttonDanger : styles.button} href={p.contractUrl}>{p.lang === "de" ? "Vertrag prüfen" : "Review Contract"}</Button></Section>
  </EmailLayout>
);
export default ContractExpiryNotice;
