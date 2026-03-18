// ============================================================
// Core Types for NYC Housing Court Case Intake Analyzer
// ============================================================

export type CaseType = 'nonpayment' | 'holdover' | 'hp' | 'lockout_illegal_eviction';

export type HoldoverSubtype =
  | 'lease_expiration'
  | 'lease_expiration_regulated'
  | 'lease_expiration_unregulated'
  | 'licensee'
  | 'nuisance'
  | 'owner_use'
  | 'nonprimary_residence'
  | 'chronic_nonpayment'
  | 'illegal_use'
  | 'squatter';

export const CASE_TYPE_LABELS: Record<CaseType, string> = {
  nonpayment: 'Nonpayment',
  holdover: 'Holdover',
  hp: 'HP (Housing Part)',
  lockout_illegal_eviction: 'Lockout / Illegal Eviction',
};

export const HOLDOVER_SUBTYPE_LABELS: Record<HoldoverSubtype, string> = {
  lease_expiration: 'Lease Expiration (General)',
  lease_expiration_regulated: 'Lease Expiration (Rent Regulated)',
  lease_expiration_unregulated: 'Lease Expiration (Unregulated)',
  licensee: 'Licensee / Squatter',
  nuisance: 'Nuisance',
  owner_use: 'Owner Use',
  nonprimary_residence: 'Non-Primary Residence',
  chronic_nonpayment: 'Chronic Nonpayment',
  illegal_use: 'Illegal Use',
  squatter: 'Squatter',
};

export interface CaseInfo {
  id?: string;
  indexNumber: string;
  caseType: CaseType;
  holdoverSubtype?: HoldoverSubtype;
  address: string;
  borough: string;
  apartmentNumber?: string;
  petitionerName: string;
  respondentName: string;
  createdAt?: string;
  status?: 'pending' | 'analyzed' | 'reviewed';
}

// ============================================================
// Document Types as filed on NYSCEF
// ============================================================

export type DocumentCategory =
  | 'petition'
  | 'notice_of_petition'
  | 'predicate_notice'
  | 'affidavit_of_service_petition'
  | 'affidavit_of_service_predicate'
  | 'gcel_notice'
  | 'other';

export interface CaseDocument {
  id: string;
  fileName: string;
  category: DocumentCategory;
  nyscefLabel?: string;
  filingDate?: string;
  text: string;
  ocrUsed: boolean;
}

// ============================================================
// Analysis Results
// ============================================================

export type FindingSeverity = 'defect' | 'flag';

export type FindingCategory =
  | 'document_completeness'
  | 'filing_window'
  | 'service_defect'
  | 'gcel'
  | 'predicate_notice'
  | 'notice_of_petition'
  | 'notice_period'
  | 'cares_act'
  | 'williams_consent_decree'
  | 'rent_demand'
  | 'regulatory_status'
  | 'other';

export interface Finding {
  id: string;
  severity: FindingSeverity;
  category: FindingCategory;
  title: string;
  description: string;
  legalBasis: string;
  sourceDocument?: string;
  sourceText?: string;
  actionRequired?: string;
}

export type DefenseSeverity = 'critical' | 'high' | 'medium' | 'low';

export type DefenseCategory =
  | 'service'
  | 'predicate_notice'
  | 'notice_of_petition'
  | 'filing_dates'
  | 'gcel'
  | 'petition'
  | 'other';

export interface DefenseIssue {
  category: DefenseCategory;
  severity: DefenseSeverity;
  title: string;
  description: string;
  legalBasis?: string;
  recommendation?: string;
}

export interface ExternalLookupResult {
  source: string;
  url: string;
  data: Record<string, unknown>;
  relevantFindings: string[];
}

export interface AnalysisReport {
  caseInfo: CaseInfo;
  documents: CaseDocument[];
  findings: Finding[];
  externalLookups: ExternalLookupResult[];
  summary: {
    totalFindings: number;
    facialDefects: number;
    flagsForInvestigation: number;
    documentsAnalyzed: number;
    missingDocuments: DocumentCategory[];
  };
  analyzedAt: string;
}

// ============================================================
// Extracted Data from Documents (LLM output)
// ============================================================

export interface ExtractedPetitionData {
  petitionerName?: string;
  petitionerIsLLC?: boolean;
  respondentName?: string;
  address?: string;
  apartmentNumber?: string;
  borough?: string;
  caseType?: CaseType;
  regulatoryStatus?: 'rent_stabilized' | 'rent_controlled' | 'unregulated' | 'not_stated';
  monthlyRent?: number;
  arrearsAmount?: number;
  arrearsBreakdown?: string;
  nonRentChargesIncluded?: boolean;
  nonRentChargesDescription?: string;
  nychaOrSection8Mentioned?: boolean;
  nychaOrSection8Details?: string;
  federalFundingMentioned?: boolean;
  federalFundingDetails?: string;
  coopShareholder?: boolean;
  tenancyStartDate?: string;
  leaseExpirationDate?: string;
  gcelPleading?: {
    included: boolean;
    subjectToGCEL?: boolean;
    exceptionClaimed?: string;
    exceptionDetails?: string;
  };
  rawText?: string;
}

export interface ExtractedServiceData {
  servedParty: string;
  serviceType: 'personal' | 'substituted' | 'conspicuous' | 'nail_and_mail' | 'other';
  attempts: ServiceAttempt[];
  mailingCompleted?: boolean;
  mailingDate?: string;
  mailingProof?: boolean;
  affixCompleted?: boolean;
  nychaServed?: boolean;
  nychaServiceDetails?: string;
  rawText?: string;
}

export interface ServiceAttempt {
  date: string;
  time: string;
  result: 'served' | 'not_served';
  duringWorkingHours?: boolean; // 8am-6pm
}

export interface ExtractedNoticeOfPetitionData {
  returnDate?: string;
  usesStandardForm: boolean;
  deviations?: string[];
  rawText?: string;
}

export interface ExtractedPredicateNoticeData {
  noticeType?: string;
  dateServed?: string;
  terminationDate?: string;
  noticePeriodDays?: number;
  goodFaithEstimate?: number;
  arrearsBreakdown?: string;
  rawText?: string;
}

export interface ExtractedDocumentData {
  petition?: ExtractedPetitionData;
  noticeOfPetition?: ExtractedNoticeOfPetitionData;
  predicateNotice?: ExtractedPredicateNoticeData;
  serviceAffidavits: ExtractedServiceData[];
  gcelNotice?: {
    included: boolean;
    subjectToGCEL?: boolean;
    exceptionClaimed?: string;
    exceptionDetails?: string;
    rawText?: string;
  };
}
