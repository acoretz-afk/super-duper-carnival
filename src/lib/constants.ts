// ============================================================
// Legal Constants for NYC Housing Court Case Analysis
// ============================================================

import { HoldoverSubtype } from './types';

// RPL § 733 - Petition must be filed 10-17 calendar days before return date
export const HOLDOVER_FILING_WINDOW = {
  minDays: 10,
  maxDays: 17,
  statute: 'RPL § 733',
};

// RPAPL § 735 - Service requirements
export const SERVICE_RULES = {
  workingHoursStart: 8, // 8:00 AM
  workingHoursEnd: 18,  // 6:00 PM
  minPersonalAttempts: 2,
  requireInsideWorkingHours: true,
  requireOutsideWorkingHours: true,
  statute: 'RPAPL § 735',
};

// RPL § 226-c - Notice periods for unregulated holdovers
export const UNREGULATED_NOTICE_PERIODS = {
  underOneYear: { days: 30, description: 'tenancy of less than 1 year' },
  oneToTwoYears: { days: 60, description: 'tenancy of 1 year but less than 2 years' },
  twoOrMoreYears: { days: 90, description: 'tenancy of 2 or more years' },
  statute: 'RPL § 226-c',
};

// Regulated non-renewal notice periods (DHCR/RSC)
export const REGULATED_NONRENEWAL_PERIODS = {
  underOneYear: { days: 90, description: 'tenancy of less than 1 year' },
  oneToTwoYears: { days: 120, description: 'tenancy of 1 year but less than 2 years' },
  twoOrMoreYears: { days: 150, description: 'tenancy of 2 or more years' },
  statute: 'RSC § 2524.2',
};

// Predicate notice requirements by holdover subtype
export const HOLDOVER_PREDICATE_NOTICE: Record<HoldoverSubtype, {
  noticeType: string;
  noticePeriod: string;
  notes: string;
}> = {
  lease_expiration: {
    noticeType: 'Termination Notice / Notice of Non-Renewal',
    noticePeriod: '30-150 days depending on tenancy type and length',
    notes: 'General lease expiration. Check regulatory status for specific requirements.',
  },
  lease_expiration_regulated: {
    noticeType: 'Notice of Non-Renewal (with good cause)',
    noticePeriod: '90/120/150 days before lease expiration (based on tenancy length)',
    notes: 'Must plead good cause (nuisance, failure to sign renewal, etc.). Simple lease expiration is not sufficient for regulated tenancies.',
  },
  lease_expiration_unregulated: {
    noticeType: 'Termination Notice',
    noticePeriod: '30/60/90 days (RPL § 226-c, based on tenancy length)',
    notes: 'Notice period depends on length of tenancy.',
  },
  licensee: {
    noticeType: '10-Day Notice to Quit',
    noticePeriod: '10 days',
    notes: 'Only 10 days predicate notice required for licensee holdovers.',
  },
  nuisance: {
    noticeType: 'Notice to Cure + Notice of Termination',
    noticePeriod: 'Cure period per lease terms + termination notice',
    notes: 'Two-step process: cure notice first, then termination if not cured.',
  },
  owner_use: {
    noticeType: 'Notice of Non-Renewal',
    noticePeriod: '90/120/150 days before lease expiration (based on tenancy length)',
    notes: 'Owner must be a natural person. LLCs cannot claim owner-use.',
  },
  nonprimary_residence: {
    noticeType: 'Notice of Non-Renewal',
    noticePeriod: '90/120/150 days before lease expiration (based on tenancy length)',
    notes: 'Alleging tenant does not maintain apartment as primary residence.',
  },
  chronic_nonpayment: {
    noticeType: 'Notice to Cure + Notice of Termination',
    noticePeriod: 'Per lease terms',
    notes: 'Must demonstrate pattern of chronic nonpayment.',
  },
  illegal_use: {
    noticeType: 'Notice of Termination',
    noticePeriod: '10 days',
    notes: 'For illegal use of premises.',
  },
  squatter: {
    noticeType: 'None required',
    noticePeriod: 'N/A',
    notes: 'No predicate notice required for squatters/those with no legal tenancy.',
  },
};

// Nonpayment predicate notice requirements
export const NONPAYMENT_RULES = {
  standardNoticeDays: 14,
  caresActNoticeDays: 30,
  statute: 'RPAPL § 711(2)',
  caresActStatute: 'CARES Act § 4024',
};

// GCEL - Good Cause Eviction Law
export const GCEL_RULES = {
  noticeRequirement: 'RPL § 231-c notice must be served with predicate notice and petition',
  smallLandlordThreshold: 10, // units
  exceptions: [
    {
      name: 'Small Landlord',
      description: 'Owner-occupied building with 10 or fewer units',
      verificationNotes: 'Cross-reference HPD/DOB for unit count. If petitioner is LLC, cannot claim this exception (LLC is not a natural person).',
    },
    {
      name: 'New Construction',
      description: 'Buildings with certificate of occupancy issued after 2009',
      verificationNotes: 'Cross-reference DOB for certificate of occupancy date.',
    },
    {
      name: 'Owner-Occupied',
      description: 'Owner-occupied building with 10 or fewer units',
      verificationNotes: 'Petitioner must be a natural person, not an LLC or corporate entity.',
    },
  ],
};

// Williams Consent Decree - NYCHA/Section 8 service requirements
export const WILLIAMS_RULES = {
  description: 'Under Williams consent decree, landlord must serve NYCHA with pleadings and predicate notices for NYCHA/Section 8 tenancies.',
  requiredService: 'Separate affidavit of service on NYCHA or service documented in same affidavit.',
};

// Required documents for any housing court proceeding
export const REQUIRED_DOCUMENTS = [
  'petition',
  'notice_of_petition',
  'predicate_notice',
  'affidavit_of_service_petition',
  'affidavit_of_service_predicate',
  'gcel_notice',
] as const;

// NYSCEF document label mappings to our categories
export const NYSCEF_LABEL_MAP: Record<string, string> = {
  'petition': 'petition',
  'verified petition': 'petition',
  'notice of petition': 'notice_of_petition',
  'notice of petition - assigned': 'notice_of_petition',
  'affidavit of service': 'affidavit_of_service_petition',
  'affirmation of service': 'affidavit_of_service_petition',
  'affidavit/affirmation of service': 'affidavit_of_service_petition',
  'notice': 'predicate_notice',
  'predicate notice': 'predicate_notice',
  'rent demand': 'predicate_notice',
  'notice to cure': 'predicate_notice',
  'notice of termination': 'predicate_notice',
  'notice of non-renewal': 'predicate_notice',
  'termination notice': 'predicate_notice',
  '231-c notice': 'gcel_notice',
  'gcel notice': 'gcel_notice',
  'good cause eviction notice': 'gcel_notice',
};

// Standard Notice of Petition form language (key phrases that must appear)
export const STANDARD_NOP_PHRASES = [
  'you are hereby notified',
  'to appear before this court',
  'if you fail to appear',
  'judgment may be entered against you',
  'you may be evicted',
  'you have the right to an attorney',
  'you may be entitled to free legal services',
  'housing court',
];

// Apartment number patterns that suggest more than 10 units
export const HIGH_UNIT_PATTERNS = [
  /\b(?:apt|unit|apartment|#)\s*(\d{2,})/i,    // Apt 11, Unit 12, etc.
  /\b(\d{2,})[A-Z]\b/,                           // 10F, 12A, etc.
  /\b[A-Z]?(\d{2,})\b/,                          // Plain numbers 11+
];

// Consolidated legal rules for analysis modules
export const LEGAL_RULES = {
  nonpayment_demand_notice_days: NONPAYMENT_RULES.standardNoticeDays,
  petition_service_days_before_return: 5, // RPAPL § 733(1) - at least 5 days before return date
  holdover_termination_notice_days: 30, // minimum for tenancy < 1 year
  gcel_small_landlord_threshold: GCEL_RULES.smallLandlordThreshold,
};

// Re-export GCEL exceptions for analysis modules
export const GCEL_EXCEPTIONS = GCEL_RULES.exceptions;
