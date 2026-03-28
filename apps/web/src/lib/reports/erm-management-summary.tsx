// Sprint 54: ERM Management Summary PDF Report (5 pages)
// Uses @react-pdf/renderer (installed via Sprint 4 DMS)

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    borderBottom: "2px solid #0d9488",
    paddingBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#0d9488",
  },
  subtitle: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 10,
    marginTop: 16,
  },
  table: {
    marginTop: 8,
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "1px solid #e5e7eb",
    paddingVertical: 4,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottom: "2px solid #0d9488",
    paddingVertical: 6,
    backgroundColor: "#f0fdfa",
  },
  tableCell: {
    flex: 1,
    paddingHorizontal: 4,
  },
  tableCellBold: {
    flex: 1,
    paddingHorizontal: 4,
    fontWeight: "bold",
  },
  kpiRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  kpiCard: {
    width: "23%",
    padding: 8,
    backgroundColor: "#f0fdfa",
    borderRadius: 4,
    textAlign: "center",
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#0d9488",
  },
  kpiLabel: {
    fontSize: 8,
    color: "#6b7280",
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 8,
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#9ca3af",
  },
  pageNumber: {
    fontSize: 8,
    color: "#9ca3af",
  },
});

// ─── Types ────────────────────────────────────────────────────

interface ManagementSummaryData {
  language: "de" | "en";
  period: { start: string; end: string };
  generatedAt: string;
  generatedBy: string;
  summary: {
    totalRisks: number;
    newRisksInPeriod: number;
  };
  categoryDistribution: { category: string; count: number }[];
  valueDistribution: { range: string; count: number }[];
  topRisks: {
    id: string;
    title: string;
    riskCategory: string;
    riskScoreInherent: number | null;
    riskScoreResidual: number | null;
    riskValue: number | null;
  }[];
  treatmentSummary: { status: string; count: number }[];
}

interface ManagementSummaryProps {
  data: ManagementSummaryData;
  orgName: string;
}

// ─── Localization ─────────────────────────────────────────────

function t(key: string, lang: "de" | "en"): string {
  const translations: Record<string, Record<string, string>> = {
    title: { de: "ERM Management-Zusammenfassung", en: "ERM Management Summary" },
    period: { de: "Berichtszeitraum", en: "Reporting Period" },
    generated: { de: "Erstellt am", en: "Generated on" },
    by: { de: "von", en: "by" },
    keyFigures: { de: "Kennzahlen", en: "Key Figures" },
    totalRisks: { de: "Gesamtrisiken", en: "Total Risks" },
    newRisks: { de: "Neue Risiken", en: "New Risks" },
    topRisks: { de: "Top 10 Risiken", en: "Top 10 Risks" },
    rank: { de: "Rang", en: "Rank" },
    riskTitle: { de: "Risikotitel", en: "Risk Title" },
    category: { de: "Kategorie", en: "Category" },
    inherent: { de: "Brutto", en: "Inherent" },
    residual: { de: "Netto", en: "Residual" },
    riskValue: { de: "Risikowert", en: "Risk Value" },
    measures: { de: "Massnahmen nach Status", en: "Measures by Status" },
    distribution: { de: "Risikoverteilung nach Kategorie", en: "Risk Distribution by Category" },
    valueDistribution: { de: "Risikobewertungsverteilung", en: "Risk Value Distribution" },
    page: { de: "Seite", en: "Page" },
  };
  return translations[key]?.[lang] ?? key;
}

// ─── Document Component ───────────────────────────────────────

export function ERMManagementSummaryPDF({
  data,
  orgName,
}: ManagementSummaryProps) {
  const lang = data.language;

  return (
    <Document>
      {/* Page 1: Cover */}
      <Page size="A4" style={styles.page}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ fontSize: 28, fontWeight: "bold", color: "#0d9488" }}>
            {orgName}
          </Text>
          <Text style={{ fontSize: 22, marginTop: 20, color: "#111827" }}>
            {t("title", lang)}
          </Text>
          <Text style={{ fontSize: 14, marginTop: 12, color: "#6b7280" }}>
            {t("period", lang)}: {data.period.start} - {data.period.end}
          </Text>
          <Text style={{ fontSize: 10, marginTop: 20, color: "#9ca3af" }}>
            {t("generated", lang)}: {data.generatedAt} {t("by", lang)} {data.generatedBy}
          </Text>
        </View>
        <View style={styles.footer}>
          <Text>ARCTOS GRC Platform</Text>
          <Text>{t("page", lang)} 1</Text>
        </View>
      </Page>

      {/* Page 2: Key Figures */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{t("keyFigures", lang)}</Text>
        </View>

        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{data.summary.totalRisks}</Text>
            <Text style={styles.kpiLabel}>{t("totalRisks", lang)}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{data.summary.newRisksInPeriod}</Text>
            <Text style={styles.kpiLabel}>{t("newRisks", lang)}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>
              {data.treatmentSummary.reduce((sum, s) => sum + Number(s.count), 0)}
            </Text>
            <Text style={styles.kpiLabel}>{t("measures", lang)}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{data.categoryDistribution.length}</Text>
            <Text style={styles.kpiLabel}>{t("category", lang)}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text>ARCTOS GRC Platform</Text>
          <Text>{t("page", lang)} 2</Text>
        </View>
      </Page>

      {/* Page 3: Top 10 Risks */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{t("topRisks", lang)}</Text>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCellBold, { flex: 0.5 }]}>#</Text>
            <Text style={[styles.tableCellBold, { flex: 3 }]}>{t("riskTitle", lang)}</Text>
            <Text style={styles.tableCellBold}>{t("category", lang)}</Text>
            <Text style={styles.tableCellBold}>{t("inherent", lang)}</Text>
            <Text style={styles.tableCellBold}>{t("residual", lang)}</Text>
            <Text style={styles.tableCellBold}>{t("riskValue", lang)}</Text>
          </View>
          {data.topRisks.map((risk, idx) => (
            <View key={risk.id} style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 0.5 }]}>{idx + 1}</Text>
              <Text style={[styles.tableCell, { flex: 3 }]}>{risk.title}</Text>
              <Text style={styles.tableCell}>{risk.riskCategory}</Text>
              <Text style={styles.tableCell}>{risk.riskScoreInherent ?? "-"}</Text>
              <Text style={styles.tableCell}>{risk.riskScoreResidual ?? "-"}</Text>
              <Text style={styles.tableCell}>{risk.riskValue ?? "-"}</Text>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <Text>ARCTOS GRC Platform</Text>
          <Text>{t("page", lang)} 3</Text>
        </View>
      </Page>

      {/* Page 4: Measures by Status */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{t("measures", lang)}</Text>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCellBold, { flex: 2 }]}>Status</Text>
            <Text style={styles.tableCellBold}>Count</Text>
          </View>
          {data.treatmentSummary.map((item) => (
            <View key={item.status} style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 2 }]}>{item.status}</Text>
              <Text style={styles.tableCell}>{item.count}</Text>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <Text>ARCTOS GRC Platform</Text>
          <Text>{t("page", lang)} 4</Text>
        </View>
      </Page>

      {/* Page 5: Risk Distribution by Category */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{t("distribution", lang)}</Text>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCellBold, { flex: 2 }]}>{t("category", lang)}</Text>
            <Text style={styles.tableCellBold}>Count</Text>
          </View>
          {data.categoryDistribution.map((item) => (
            <View key={item.category} style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 2 }]}>{item.category}</Text>
              <Text style={styles.tableCell}>{item.count}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>{t("valueDistribution", lang)}</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCellBold, { flex: 2 }]}>Range</Text>
            <Text style={styles.tableCellBold}>Count</Text>
          </View>
          {data.valueDistribution.map((item) => (
            <View key={item.range} style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 2 }]}>{item.range}</Text>
              <Text style={styles.tableCell}>{item.count}</Text>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <Text>ARCTOS GRC Platform</Text>
          <Text>{t("page", lang)} 5</Text>
        </View>
      </Page>
    </Document>
  );
}
