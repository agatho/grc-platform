// Server-side helper for impressum / privacy data.
//
// Reads from IMPRINT_* environment variables. The intent is that on a
// production deploy you set these in /opt/arctos/.env (or whatever env
// source) and the legal pages render the operator's data without code
// changes. For local dev / private deploys an "[bitte konfigurieren]"
// placeholder is rendered so it's obvious the operator still has work
// to do before going public.
//
// Required by § 5 DDG (vormals TMG, Telemediengesetz). Bei Verstoß
// drohen Abmahnungen + Bußgelder bis 50 000 EUR.

export interface ImprintData {
  /** Diensteanbieter — Name oder Firma */
  companyName: string;
  /** Rechtsform (z.B. "GmbH", "Einzelunternehmen", "e.K.") */
  legalForm?: string;
  /** Anschrift — Straße + Hausnummer */
  street: string;
  /** PLZ + Ort */
  city: string;
  /** Land (Default: Deutschland) */
  country: string;
  /** E-Mail für schnelle Kontaktaufnahme — Pflicht */
  email: string;
  /** Telefonnummer — empfohlen, oft als Pflicht ausgelegt */
  phone?: string;
  /** Vertretungsberechtigte (Geschäftsführer etc.) */
  managingDirectors?: string;
  /** Handelsregister (z.B. "Amtsgericht München") */
  registerCourt?: string;
  /** Handelsregisternummer (z.B. "HRB 123456") */
  registerNumber?: string;
  /** Umsatzsteuer-Identifikationsnummer (§ 27a UStG) */
  vatId?: string;
  /** Wirtschafts-IdNr. (§ 139c AO) — optional */
  businessId?: string;
  /** Aufsichtsbehörde (für reglementierte Berufe) */
  supervisoryAuthority?: string;
  /** Berufsbezeichnung + verleihender Staat */
  professionalTitle?: string;
  /** Verantwortlich i.S.v. § 18 Abs. 2 MStV (für redaktionelle Inhalte) */
  responsibleForContent?: string;
  /** EU-Streitschlichtung-Hinweis (Online-Plattform-Pflicht) */
  showEuDisputeResolutionNotice: boolean;
  /** Freier Zusatz-Text (HTML wird escapet) */
  additionalText?: string;
}

const PLACEHOLDER = "[bitte konfigurieren]";

function env(key: string, fallback?: string): string | undefined {
  const v = process.env[key];
  if (v && v.trim().length > 0) return v.trim();
  return fallback;
}

export function getImprintData(): ImprintData {
  return {
    companyName: env("IMPRINT_COMPANY_NAME") ?? PLACEHOLDER,
    legalForm: env("IMPRINT_LEGAL_FORM"),
    street: env("IMPRINT_STREET") ?? PLACEHOLDER,
    city: env("IMPRINT_CITY") ?? PLACEHOLDER,
    country: env("IMPRINT_COUNTRY", "Deutschland")!,
    email: env("IMPRINT_EMAIL") ?? PLACEHOLDER,
    phone: env("IMPRINT_PHONE"),
    managingDirectors: env("IMPRINT_MANAGING_DIRECTORS"),
    registerCourt: env("IMPRINT_REGISTER_COURT"),
    registerNumber: env("IMPRINT_REGISTER_NUMBER"),
    vatId: env("IMPRINT_VAT_ID"),
    businessId: env("IMPRINT_BUSINESS_ID"),
    supervisoryAuthority: env("IMPRINT_SUPERVISORY_AUTHORITY"),
    professionalTitle: env("IMPRINT_PROFESSIONAL_TITLE"),
    responsibleForContent: env("IMPRINT_RESPONSIBLE_FOR_CONTENT"),
    showEuDisputeResolutionNotice:
      env("IMPRINT_SHOW_EU_DISPUTE_NOTICE", "true") === "true",
    additionalText: env("IMPRINT_ADDITIONAL_TEXT"),
  };
}

export interface PrivacyData {
  /** Verantwortlicher i.S.v. Art. 4 Nr. 7 DSGVO */
  controllerName: string;
  controllerAddress: string;
  /** Datenschutzbeauftragter — Name oder Org */
  dpoName?: string;
  dpoEmail?: string;
  /** Standort der Datenverarbeitung */
  hostingLocation: string;
  /** Aufsichtsbehörde für Datenschutz */
  supervisoryAuthority: string;
  /** Freier Zusatz-Text */
  additionalText?: string;
}

export function getPrivacyData(): PrivacyData {
  const imprint = getImprintData();
  return {
    controllerName:
      env("PRIVACY_CONTROLLER_NAME") ?? imprint.companyName,
    controllerAddress:
      env("PRIVACY_CONTROLLER_ADDRESS") ??
      `${imprint.street}, ${imprint.city}, ${imprint.country}`,
    dpoName: env("PRIVACY_DPO_NAME"),
    dpoEmail: env("PRIVACY_DPO_EMAIL"),
    hostingLocation: env("PRIVACY_HOSTING_LOCATION", "Hetzner Online GmbH, Deutschland")!,
    supervisoryAuthority:
      env("PRIVACY_SUPERVISORY_AUTHORITY") ??
      "Bayerisches Landesamt für Datenschutzaufsicht (BayLDA), Promenade 18, 91522 Ansbach",
    additionalText: env("PRIVACY_ADDITIONAL_TEXT"),
  };
}

export function isImprintConfigured(): boolean {
  const i = getImprintData();
  return (
    i.companyName !== PLACEHOLDER &&
    i.street !== PLACEHOLDER &&
    i.city !== PLACEHOLDER &&
    i.email !== PLACEHOLDER
  );
}
