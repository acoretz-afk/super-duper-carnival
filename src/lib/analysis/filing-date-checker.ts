/**
 * Filing Date Checker
 *
 * Validates filing dates and timing requirements for
 * NYC Housing Court proceedings.
 */

import { CaseType, DefenseIssue, ExtractedPredicateNoticeData } from '../types';
import { LEGAL_RULES } from '../constants';

export interface FilingDateResult {
  issues: DefenseIssue[];
  isTimely: boolean;
}

/**
 * Check that the case was filed within the proper timeframe
 * after predicate notices expired.
 */
export function checkFilingDates(
  filingDate: string,
  predicateNoticeData: ExtractedPredicateNoticeData | null,
  caseType: CaseType,
  serviceOfPetitionDate?: string,
  returnDate?: string
): FilingDateResult {
  const issues: DefenseIssue[] = [];

  // 1. For nonpayment: verify filing after 14-day demand period expired
  if (caseType === 'nonpayment' && predicateNoticeData?.dateServed) {
    const demandDate = new Date(predicateNoticeData.dateServed);
    const filing = new Date(filingDate);
    const requiredWait = LEGAL_RULES.nonpayment_demand_notice_days;
    const daysBetween = Math.floor(
      (filing.getTime() - demandDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysBetween < requiredWait) {
      issues.push({
        category: 'filing_dates',
        severity: 'critical',
        title: `Case filed too early: ${daysBetween} days after rent demand (requires ${requiredWait})`,
        description:
          `The case was filed on ${filingDate}, only ${daysBetween} days after the rent demand ` +
          `was served on ${predicateNoticeData.dateServed}. RPAPL § 711(2) requires at least ` +
          `${requiredWait} days between the rent demand and commencement of the proceeding.`,
        legalBasis: 'RPAPL § 711(2)',
        recommendation:
          'Move to dismiss. The proceeding was commenced prematurely, before the ' +
          'statutory notice period expired. This is a jurisdictional defect.',
      });
    }
  }

  // 2. For holdover: verify filing after termination date
  if (caseType === 'holdover' && predicateNoticeData?.terminationDate) {
    const terminationDate = new Date(predicateNoticeData.terminationDate);
    const filing = new Date(filingDate);

    if (filing < terminationDate) {
      issues.push({
        category: 'filing_dates',
        severity: 'critical',
        title: 'Case filed before termination date',
        description:
          `The holdover was filed on ${filingDate}, before the termination date of ` +
          `${predicateNoticeData.terminationDate}. The proceeding cannot be commenced ` +
          `until after the termination date has passed.`,
        legalBasis: 'RPAPL § 711(1)',
        recommendation:
          'Move to dismiss. The proceeding was commenced prematurely.',
      });
    }
  }

  // 3. Check petition service timing relative to return date
  if (serviceOfPetitionDate && returnDate) {
    const serviceDate = new Date(serviceOfPetitionDate);
    const returnDateObj = new Date(returnDate);
    const daysBetween = Math.floor(
      (returnDateObj.getTime() - serviceDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const requiredDays = LEGAL_RULES.petition_service_days_before_return;

    if (daysBetween < requiredDays) {
      issues.push({
        category: 'filing_dates',
        severity: 'critical',
        title: `Service to return date: ${daysBetween} days (requires ${requiredDays})`,
        description:
          `The petition was served on ${serviceOfPetitionDate} with a return date of ` +
          `${returnDate}, leaving only ${daysBetween} days. At least ${requiredDays} ` +
          `days are required between service and the return date.`,
        legalBasis: 'RPAPL § 733(1)',
        recommendation:
          'Move to dismiss for insufficient notice period between service and return date.',
      });
    }
  }

  // 4. Check for stale predicate notices
  if (predicateNoticeData?.dateServed && filingDate) {
    const noticeDate = new Date(predicateNoticeData.dateServed);
    const filing = new Date(filingDate);
    const daysBetween = Math.floor(
      (filing.getTime() - noticeDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysBetween > 365) {
      issues.push({
        category: 'filing_dates',
        severity: 'medium',
        title: `Stale predicate notice: ${daysBetween} days old`,
        description:
          `The predicate notice was served ${daysBetween} days before filing. ` +
          `A notice served more than a year before filing may be considered stale ` +
          `and no longer effective as a predicate for the proceeding.`,
        legalBasis: 'Case law on stale notices',
        recommendation:
          'Argue that the predicate notice is stale and can no longer serve as the ' +
          'basis for the proceeding.',
      });
    }
  }

  const hasCritical = issues.some(i => i.severity === 'critical');
  return {
    issues,
    isTimely: !hasCritical,
  };
}
