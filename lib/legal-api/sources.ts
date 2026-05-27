export type LegalSourceKind =
  | "law"
  | "article"
  | "precedent"
  | "constitutional_case"
  | "interpretation"
  | "administrative_appeal";

export type LegalSourceMetadata = {
  kind: LegalSourceKind;
  title: string;
  source: string;
  caseNumber?: string;
  courtName?: string;
  decisionDate?: string;
  originalUrl?: string;
  apiId?: string;
  retrievedAt: string;
};
