// Sprint 30: PDF Renderer — Puppeteer HTML-to-PDF
// Renders resolved sections + branding into A4 PDF

import type {
  ReportBrandingConfig,
  ReportSectionConfig,
} from "@grc/shared";
import type { TableData, ChartData, KPIData } from "../section-data-fetcher";

export interface ResolvedSection {
  type: ReportSectionConfig["type"];
  config: ReportSectionConfig["config"];
  content?: string;
  data?: TableData | ChartData;
  value?: KPIData;
}

/**
 * Build complete HTML document for PDF rendering.
 */
export function buildReportHTML(
  sections: ResolvedSection[],
  branding?: ReportBrandingConfig | null,
): string {
  const primaryColor = branding?.primaryColor || "#1e3a5f";
  const footerText = branding?.footerText || "";
  const confidentiality = branding?.confidentiality || "";

  const sectionHtml = sections.map(renderSection).join("\n");

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <style>
    @page {
      size: A4;
      margin: 2cm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      font-size: 10pt;
      line-height: 1.5;
      color: #1a1a1a;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid ${primaryColor};
      padding-bottom: 12px;
      margin-bottom: 24px;
    }
    .header-logo img {
      max-height: 48px;
    }
    .header-meta {
      text-align: right;
      font-size: 8pt;
      color: #666;
    }
    .section { margin-bottom: 20px; }
    .section-title {
      font-size: 18pt;
      font-weight: 700;
      color: ${primaryColor};
      margin-bottom: 12px;
      page-break-after: avoid;
    }
    .section-text {
      font-size: 10pt;
      line-height: 1.6;
      margin-bottom: 8px;
    }
    .kpi-card {
      display: inline-block;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px 24px;
      margin: 8px 12px 8px 0;
      min-width: 150px;
      text-align: center;
    }
    .kpi-value {
      font-size: 28pt;
      font-weight: 700;
      color: ${primaryColor};
    }
    .kpi-label {
      font-size: 9pt;
      color: #64748b;
      margin-top: 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
      font-size: 9pt;
    }
    th {
      background-color: ${primaryColor};
      color: white;
      padding: 8px 10px;
      text-align: left;
      font-weight: 600;
    }
    td {
      padding: 6px 10px;
      border-bottom: 1px solid #e2e8f0;
    }
    tr:nth-child(even) td {
      background-color: #f8fafc;
    }
    .chart-placeholder {
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      padding: 32px;
      text-align: center;
      color: #94a3b8;
      font-style: italic;
      margin-bottom: 12px;
    }
    .page-break { page-break-after: always; }
    .footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      text-align: center;
      font-size: 7pt;
      color: #94a3b8;
      padding: 8px 2cm;
      border-top: 1px solid #e2e8f0;
    }
    .confidentiality {
      font-size: 7pt;
      color: #ef4444;
      font-weight: 600;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-logo">
      ${branding?.logoUrl ? `<img src="${escapeHtml(branding.logoUrl)}" alt="Logo" />` : ""}
    </div>
    <div class="header-meta">
      <div>Generated: ${new Date().toLocaleDateString("de-DE")}</div>
      ${confidentiality ? `<div class="confidentiality">${escapeHtml(confidentiality)}</div>` : ""}
    </div>
  </div>
  ${sectionHtml}
  ${footerText ? `<div class="footer">${escapeHtml(footerText)}</div>` : ""}
</body>
</html>`;
}

function renderSection(section: ResolvedSection): string {
  switch (section.type) {
    case "title":
      return `<div class="section"><h1 class="section-title">${escapeHtml(section.content || section.config.text || "")}</h1></div>`;

    case "text":
      return `<div class="section"><p class="section-text">${escapeHtml(section.content || section.config.text || "")}</p></div>`;

    case "table":
      return renderTable(section.data as TableData | undefined);

    case "chart":
      return renderChart(section.data as ChartData | undefined, section.config);

    case "kpi":
      return renderKPI(section.value);

    case "page_break":
      return '<div class="page-break"></div>';

    default:
      return "";
  }
}

function renderTable(data: TableData | undefined): string {
  if (!data || data.rows.length === 0) {
    return '<div class="section"><p class="section-text">No data available.</p></div>';
  }

  const headerHtml = data.headers
    .map((h) => `<th>${escapeHtml(h)}</th>`)
    .join("");

  const rowsHtml = data.rows
    .map(
      (row) =>
        `<tr>${data.headers
          .map(
            (h) =>
              `<td>${escapeHtml(String(row[h] ?? row[h.toLowerCase().replace(/ /g, "_")] ?? ""))}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");

  return `<div class="section"><table><thead><tr>${headerHtml}</tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
}

function renderChart(
  data: ChartData | undefined,
  config: ReportSectionConfig["config"],
): string {
  if (!data || data.datasets.length === 0) {
    return '<div class="chart-placeholder">Chart: No data available</div>';
  }

  // For PDF, render a simple SVG bar chart (no JavaScript needed)
  const chartType = config.chartType || "bar";
  if (chartType === "bar") {
    return renderSVGBarChart(data);
  }

  return `<div class="chart-placeholder">Chart type: ${escapeHtml(chartType)} (${data.labels.length} data points)</div>`;
}

function renderSVGBarChart(data: ChartData): string {
  const width = 600;
  const height = 300;
  const padding = 60;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  const dataset = data.datasets[0];
  if (!dataset || dataset.data.length === 0) {
    return '<div class="chart-placeholder">No chart data</div>';
  }

  const maxVal = Math.max(...dataset.data, 1);
  const barWidth = Math.min(40, chartWidth / dataset.data.length - 4);
  const gap = (chartWidth - barWidth * dataset.data.length) / (dataset.data.length + 1);

  let bars = "";
  for (let i = 0; i < dataset.data.length; i++) {
    const x = padding + gap + i * (barWidth + gap);
    const barHeight = (dataset.data[i] / maxVal) * chartHeight;
    const y = padding + chartHeight - barHeight;
    bars += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="#3b82f6" rx="2" />`;
    bars += `<text x="${x + barWidth / 2}" y="${padding + chartHeight + 14}" text-anchor="middle" font-size="7" fill="#666">${escapeHtml(data.labels[i] || "")}</text>`;
    bars += `<text x="${x + barWidth / 2}" y="${y - 4}" text-anchor="middle" font-size="8" fill="#333">${dataset.data[i]}</text>`;
  }

  return `<div class="section">
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${padding + chartHeight}" stroke="#e2e8f0" stroke-width="1" />
      <line x1="${padding}" y1="${padding + chartHeight}" x2="${padding + chartWidth}" y2="${padding + chartHeight}" stroke="#e2e8f0" stroke-width="1" />
      ${bars}
    </svg>
  </div>`;
}

function renderKPI(kpi: KPIData | undefined): string {
  if (!kpi) return "";
  const trendIcon =
    kpi.trend === "up" ? "&#9650;" : kpi.trend === "down" ? "&#9660;" : "";
  return `<div class="kpi-card">
    <div class="kpi-value">${escapeHtml(String(kpi.value))} ${trendIcon}</div>
    <div class="kpi-label">${escapeHtml(kpi.label)}</div>
  </div>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Generate PDF buffer using Puppeteer.
 * Puppeteer is lazy-loaded to avoid import errors in environments without it.
 */
export async function renderPDF(
  sections: ResolvedSection[],
  branding?: ReportBrandingConfig | null,
): Promise<Buffer> {
  const html = buildReportHTML(sections, branding);

  // Dynamic import — puppeteer may not be available in all environments
  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "2cm", bottom: "2cm", left: "2cm", right: "2cm" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
