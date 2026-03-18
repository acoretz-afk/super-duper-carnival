/**
 * Notice of Petition Validator
 *
 * Checks that the Notice of Petition uses the standard court form
 * and complies with RPAPL requirements.
 */

import { DefenseIssue, ExtractedNoticeOfPetitionData } from '../types';
import { LEGAL_RULES } from '../constants';

export interface NOPValidationResult {
  issues: DefenseIssue[];
  returnDate: string | null;
  usesStandardForm: boolean;
}

export function validateNoticeOfPetition(
  nopData: ExtractedNoticeOfPetitionData,
  filingDate?: string,
  serviceDate?: string
): NOPValidationResult {
  const issues: DefenseIssue[] = [];

  // 1. Check standard form usage
  if (!nopData.usesStandardForm) {
    issues.push({
      category: 'notice_of_petition',
      severity: 'critical',
      title: 'Notice of Petition does not use standard court form',
      description:
        'The Notice of Petition deviates from the standard court-issued form. ' +
        'Under RPAPL § 731 and court rules, the Notice of Petition must use the ' +
        'prescribed form. Deviations from the standard form are an unamendable jurisdictional defect.' +
        (nopData.deviations?.length
          ? `\n\nSpecific deviations found:\n- ${nopData.deviations.join('\n- ')}`
          : ''),
      legalBasis: 'RPAPL § 731(1); CCA § 400',
      recommendation:
        'Move to dismiss for failure to use the standard Notice of Petition form. ' +
        'This is a jurisdictional defect that cannot be amended.',
    });
  }

  // 2. Check return date
  if (!nopData.returnDate) {
    issues.push({
      category: 'notice_of_petition',
      severity: 'critical',
      title: 'No return date specified in Notice of Petition',
      description:
        'The Notice of Petition does not contain a return date. ' +
        'A return date is required for the court to have jurisdiction.',
      legalBasis: 'RPAPL § 731; RPAPL § 733',
      recommendation: 'Move to dismiss for defective Notice of Petition.',
    });
  }

  // 3. Check timing between service and return date
  if (nopData.returnDate && serviceDate) {
    const daysBetween = daysDifference(serviceDate, nopData.returnDate);
    const requiredDays = LEGAL_RULES.petition_service_days_before_return;

    if (daysBetween < requiredDays) {
      issues.push({
        category: 'notice_of_petition',
        severity: 'critical',
        title: `Insufficient time between service and return date: ${daysBetween} days`,
        description:
          `Only ${daysBetween} days between service of the Notice of Petition ` +
          `(${serviceDate}) and the return date (${nopData.returnDate}). ` +
          `At least ${requiredDays} days are required.`,
        legalBasis: 'RPAPL § 733(1)',
        recommendation:
          'Move to dismiss for insufficient notice. This is a jurisdictional defect.',
      });
    }
  }

  // 4. Check filing date constraints
  if (nopData.returnDate && filingDate) {
    const filingToReturn = daysDifference(filingDate, nopData.returnDate);

    // Return date should generally be within a reasonable timeframe of filing
    if (filingToReturn > 365) {
      issues.push({
        category: 'notice_of_petition',
        severity: 'low',
        title: 'Unusually long gap between filing and return date',
        description:
          `The return date is ${filingToReturn} days after filing. ` +
          `This is unusual and may indicate stale proceedings.`,
        legalBasis: 'RPAPL § 733',
        recommendation: 'Investigate whether there were adjournments or refiling.',
      });
    }
  }

  return {
    issues,
    returnDate: nopData.returnDate ?? null,
    usesStandardForm: nopData.usesStandardForm,
  };
}

function daysDifference(dateStr1: string, dateStr2: string): number {
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  const diffMs = d2.getTime() - d1.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
