/**
 * Service of Process Validator
 *
 * Validates whether service of process was properly executed
 * according to NYC Housing Court rules (RPAPL, CCA, CPLR).
 */

import { CaseType, DefenseIssue, ExtractedServiceData } from '../types';
import { LEGAL_RULES } from '../constants';

export interface ServiceValidationResult {
  issues: DefenseIssue[];
  serviceType: string;
  isValid: boolean;
}

export function validateService(
  serviceData: ExtractedServiceData,
  documentType: 'petition' | 'predicate',
  caseType: CaseType,
  filingDate?: string,
  returnDate?: string
): ServiceValidationResult {
  const issues: DefenseIssue[] = [];

  // 1. Check service type requirements
  if (serviceData.serviceType === 'conspicuous' || serviceData.serviceType === 'nail_and_mail') {
    // For "nail and mail" / conspicuous place service, need prior attempts
    const attempts = serviceData.attempts || [];
    const failedAttempts = attempts.filter(a => a.result === 'not_served');

    if (failedAttempts.length < 1) {
      issues.push({
        category: 'service',
        severity: 'high',
        title: 'Insufficient service attempts before conspicuous/nail-and-mail service',
        description:
          'For conspicuous place or nail-and-mail service, the process server must first attempt personal delivery. ' +
          'No prior failed attempts are documented.',
        legalBasis: 'CPLR § 308(4); RPAPL § 735',
        recommendation: 'Move to dismiss for improper service.',
      });
    }

    // Check that mailing was completed for nail-and-mail
    if (serviceData.serviceType === 'nail_and_mail' && !serviceData.mailingCompleted) {
      issues.push({
        category: 'service',
        severity: 'critical',
        title: 'Mailing not completed for nail-and-mail service',
        description:
          'Nail-and-mail service requires both affixing to the door AND mailing a copy. ' +
          'The affidavit does not indicate mailing was completed.',
        legalBasis: 'RPAPL § 735(1)',
        recommendation: 'Move to dismiss for defective service. This is a jurisdictional defect.',
      });
    }

    if (serviceData.serviceType === 'nail_and_mail' && !serviceData.affixCompleted) {
      issues.push({
        category: 'service',
        severity: 'critical',
        title: 'Affixing not documented for nail-and-mail service',
        description:
          'Nail-and-mail service requires the papers to be affixed to the door. ' +
          'The affidavit does not document affixing.',
        legalBasis: 'RPAPL § 735(1)',
        recommendation: 'Move to dismiss for defective service.',
      });
    }
  }

  // 2. Check substituted service requirements
  if (serviceData.serviceType === 'substituted') {
    if (!serviceData.mailingCompleted) {
      issues.push({
        category: 'service',
        severity: 'critical',
        title: 'No mailing after substituted service',
        description:
          'Substituted service requires a follow-up mailing to the respondent. ' +
          'The affidavit does not indicate mailing was completed.',
        legalBasis: 'CPLR § 308(2)',
        recommendation: 'Move to dismiss for defective service.',
      });
    }
  }

  // 3. Check timing for petition service relative to return date
  if (documentType === 'petition' && returnDate && serviceData.attempts?.length) {
    const serviceDate = getEarliestServiceDate(serviceData);
    if (serviceDate && returnDate) {
      const daysBetween = daysDifference(serviceDate, returnDate);
      const requiredDays = LEGAL_RULES.petition_service_days_before_return;

      if (daysBetween < requiredDays) {
        issues.push({
          category: 'service',
          severity: 'critical',
          title: `Insufficient notice period: ${daysBetween} days (requires ${requiredDays})`,
          description:
            `The petition was served ${daysBetween} days before the return date. ` +
            `Under RPAPL § 733, at least ${requiredDays} days of notice are required ` +
            `between service of the notice of petition and the return date.`,
          legalBasis: 'RPAPL § 733(1)',
          recommendation:
            'Move to dismiss for insufficient notice period. This is a jurisdictional defect ' +
            'that cannot be cured.',
        });
      }
    }
  }

  // 4. Check NYCHA service requirement for public housing cases
  if (serviceData.nychaServed === false) {
    issues.push({
      category: 'service',
      severity: 'medium',
      title: 'No service on NYCHA documented',
      description:
        'If the premises are NYCHA public housing, NYCHA must be served with the petition. ' +
        'Check whether this is a NYCHA property.',
      legalBasis: 'NYC Admin Code § 26-408(a)',
      recommendation:
        'Verify if property is NYCHA. If so, move to dismiss for failure to serve a necessary party.',
    });
  }

  // 5. Check service timing relative to filing date
  if (documentType === 'petition' && filingDate && serviceData.attempts?.length) {
    const serviceDate = getEarliestServiceDate(serviceData);
    if (serviceDate) {
      const serviceDateObj = new Date(serviceDate);
      const filingDateObj = new Date(filingDate);

      if (serviceDateObj < filingDateObj) {
        // Service before filing is not necessarily wrong, but note it
      }
    }
  }

  return {
    issues,
    serviceType: serviceData.serviceType,
    isValid: issues.filter(i => i.severity === 'critical').length === 0,
  };
}

function getEarliestServiceDate(serviceData: ExtractedServiceData): string | null {
  const successfulAttempts = (serviceData.attempts || []).filter(a => a.result === 'served');
  if (successfulAttempts.length === 0) return null;
  return successfulAttempts[0].date;
}

function daysDifference(dateStr1: string, dateStr2: string): number {
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  const diffMs = d2.getTime() - d1.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
