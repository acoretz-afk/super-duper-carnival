/**
 * Predicate Notice Checker
 *
 * Validates predicate notices (rent demands, notices to cure,
 * notices of termination, etc.) for compliance with NYC law.
 */

import {
  CaseType,
  HoldoverSubtype,
  DefenseIssue,
  ExtractedPetitionData,
  ExtractedPredicateNoticeData,
} from '../types';
import { LEGAL_RULES } from '../constants';

export interface PredicateNoticeResult {
  issues: DefenseIssue[];
  isValid: boolean;
}

export function checkPredicateNotice(
  noticeData: ExtractedPredicateNoticeData,
  petitionData: ExtractedPetitionData,
  caseType: CaseType,
  holdoverSubtype?: HoldoverSubtype
): PredicateNoticeResult {
  const issues: DefenseIssue[] = [];

  if (caseType === 'nonpayment') {
    checkNonpaymentRentDemand(noticeData, petitionData, issues);
  } else if (caseType === 'holdover') {
    checkHoldoverPredicateNotice(noticeData, petitionData, holdoverSubtype, issues);
  }

  return {
    issues,
    isValid: issues.filter(i => i.severity === 'critical').length === 0,
  };
}

function checkNonpaymentRentDemand(
  noticeData: ExtractedPredicateNoticeData,
  petitionData: ExtractedPetitionData,
  issues: DefenseIssue[]
): void {
  // 1. Check if rent demand was served
  if (!noticeData.dateServed) {
    issues.push({
      category: 'predicate_notice',
      severity: 'critical',
      title: 'No rent demand served or service date missing',
      description:
        'A nonpayment proceeding requires service of a written rent demand at least ' +
        '14 days before commencement of the proceeding. No service date was found.',
      legalBasis: 'RPAPL § 711(2)',
      recommendation: 'Move to dismiss for failure to serve proper rent demand.',
    });
  }

  // 2. Check notice period (14 days for nonpayment)
  if (noticeData.noticePeriodDays !== undefined && noticeData.noticePeriodDays !== null) {
    const requiredDays = LEGAL_RULES.nonpayment_demand_notice_days;
    if (noticeData.noticePeriodDays < requiredDays) {
      issues.push({
        category: 'predicate_notice',
        severity: 'critical',
        title: `Insufficient rent demand notice period: ${noticeData.noticePeriodDays} days (requires ${requiredDays})`,
        description:
          `The rent demand provided only ${noticeData.noticePeriodDays} days' notice. ` +
          `RPAPL § 711(2) requires at least ${requiredDays} days' written notice demanding ` +
          `payment before a nonpayment proceeding can be commenced.`,
        legalBasis: 'RPAPL § 711(2)',
        recommendation:
          'Move to dismiss for insufficient notice period. This is a jurisdictional defect.',
      });
    }
  }

  // 3. Check for non-rent charges in the demand
  if (petitionData.nonRentChargesIncluded) {
    issues.push({
      category: 'predicate_notice',
      severity: 'high',
      title: 'Non-rent charges included in rent demand',
      description:
        `The rent demand appears to include non-rent charges: ` +
        `${petitionData.nonRentChargesDescription || 'unspecified charges'}. ` +
        `A nonpayment rent demand should only demand rent. Including non-rent charges ` +
        `(late fees, legal fees, utilities, etc.) can invalidate the demand.`,
      legalBasis: 'RPAPL § 711(2); Civ. Ct. Act § 409',
      recommendation:
        'Move to dismiss or, at minimum, seek reduction of the demand to only lawful rent charges. ' +
        'Late fees and legal fees are generally not recoverable in a nonpayment proceeding.',
    });
  }

  // 4. Check "good faith" amount claimed
  if (
    noticeData.goodFaithEstimate &&
    petitionData.arrearsAmount &&
    Math.abs(noticeData.goodFaithEstimate - petitionData.arrearsAmount) > 500
  ) {
    issues.push({
      category: 'predicate_notice',
      severity: 'medium',
      title: 'Discrepancy between rent demand and petition amounts',
      description:
        `The rent demand claims $${noticeData.goodFaithEstimate.toLocaleString()} but the ` +
        `petition claims $${petitionData.arrearsAmount.toLocaleString()} in arrears. ` +
        `A significant discrepancy may indicate the demand was not made in "good faith."`,
      legalBasis: 'RPAPL § 711(2)',
      recommendation:
        'Challenge the rent demand as not being a good-faith estimate of rent owed.',
    });
  }

  // 5. Check regulatory status disclosure
  if (petitionData.regulatoryStatus === 'not_stated') {
    issues.push({
      category: 'predicate_notice',
      severity: 'medium',
      title: 'Regulatory status not stated in petition',
      description:
        'The petition does not state whether the unit is rent-stabilized, rent-controlled, ' +
        'or unregulated. Under RPAPL § 741(4), the petition must state the facts upon which ' +
        'the proceeding is based, which includes the regulatory status.',
      legalBasis: 'RPAPL § 741(4)',
      recommendation:
        'Request that the court order the landlord to disclose regulatory status. ' +
        'If rent-stabilized, additional protections apply.',
    });
  }
}

function checkHoldoverPredicateNotice(
  noticeData: ExtractedPredicateNoticeData,
  petitionData: ExtractedPetitionData,
  holdoverSubtype: HoldoverSubtype | undefined,
  issues: DefenseIssue[]
): void {
  // Check notice period based on subtype
  if (holdoverSubtype === 'lease_expiration') {
    checkLeaseExpirationNotice(noticeData, petitionData, issues);
  } else if (holdoverSubtype === 'nuisance') {
    checkNuisanceNotice(noticeData, issues);
  } else if (holdoverSubtype === 'illegal_use') {
    checkIllegalUseNotice(noticeData, issues);
  } else if (holdoverSubtype === 'owner_use') {
    checkOwnerUseNotice(noticeData, petitionData, issues);
  } else if (holdoverSubtype === 'chronic_nonpayment') {
    checkChronicNonpaymentNotice(noticeData, issues);
  }

  // General holdover checks
  if (petitionData.regulatoryStatus === 'rent_stabilized') {
    // Rent-stabilized tenants get additional protections
    checkRentStabilizedHoldoverNotice(noticeData, petitionData, holdoverSubtype, issues);
  }
}

function checkLeaseExpirationNotice(
  noticeData: ExtractedPredicateNoticeData,
  petitionData: ExtractedPetitionData,
  issues: DefenseIssue[]
): void {
  // For rent-stabilized units, landlord must offer renewal lease
  if (petitionData.regulatoryStatus === 'rent_stabilized') {
    issues.push({
      category: 'predicate_notice',
      severity: 'high',
      title: 'Rent-stabilized unit: was a renewal lease offered?',
      description:
        'For rent-stabilized units, the landlord must offer a renewal lease 90-150 days ' +
        'before the current lease expires. Failure to offer a renewal lease means the tenant ' +
        'is entitled to continue on the same terms.',
      legalBasis: 'RSC § 2523.5(a); RSL § 26-511(c)(9)',
      recommendation:
        'Request proof that a renewal lease was timely offered. If not offered, ' +
        'the holdover should be dismissed.',
    });
  }

  // Check notice period requirements
  if (noticeData.noticePeriodDays !== undefined) {
    const requiredDays = LEGAL_RULES.holdover_termination_notice_days;
    if (noticeData.noticePeriodDays < requiredDays) {
      issues.push({
        category: 'predicate_notice',
        severity: 'high',
        title: `Insufficient termination notice: ${noticeData.noticePeriodDays} days`,
        description:
          `The notice provided ${noticeData.noticePeriodDays} days. ` +
          `Depending on the length of tenancy, 30-90 days may be required under RPL § 226-c.`,
        legalBasis: 'RPL § 226-c',
        recommendation: 'Check tenant\'s length of tenancy to determine required notice period.',
      });
    }
  }
}

function checkNuisanceNotice(
  noticeData: ExtractedPredicateNoticeData,
  issues: DefenseIssue[]
): void {
  if (!noticeData.terminationDate) {
    issues.push({
      category: 'predicate_notice',
      severity: 'high',
      title: 'Nuisance notice missing cure/termination date',
      description:
        'The nuisance notice does not specify a cure or termination date. ' +
        'A proper notice must give the tenant an opportunity to cure.',
      legalBasis: 'RPAPL § 711(1)',
      recommendation: 'Move to dismiss for defective notice.',
    });
  }
}

function checkIllegalUseNotice(
  noticeData: ExtractedPredicateNoticeData,
  issues: DefenseIssue[]
): void {
  // Illegal use holdovers have specific requirements
  issues.push({
    category: 'predicate_notice',
    severity: 'medium',
    title: 'Verify specificity of illegal use allegations',
    description:
      'An illegal use holdover must specifically describe the illegal use alleged. ' +
      'Vague or conclusory allegations are insufficient.',
    legalBasis: 'RPAPL § 711(5); RPAPL § 715',
    recommendation:
      'Review the notice for specificity. If allegations are vague, move to dismiss ' +
      'for failure to state a cause of action.',
  });
}

function checkOwnerUseNotice(
  noticeData: ExtractedPredicateNoticeData,
  petitionData: ExtractedPetitionData,
  issues: DefenseIssue[]
): void {
  if (petitionData.regulatoryStatus === 'rent_stabilized') {
    issues.push({
      category: 'predicate_notice',
      severity: 'high',
      title: 'Owner-use holdover in rent-stabilized unit: strict requirements apply',
      description:
        'For rent-stabilized units, owner-use proceedings are limited to the owner\'s ' +
        'primary residence and immediate family. The owner must demonstrate a genuine ' +
        'intent to occupy and maintain the unit as a primary residence.',
      legalBasis: 'RSC § 2524.4(a)',
      recommendation:
        'Challenge whether the owner meets the requirements for owner-use recovery. ' +
        'Request discovery on owner\'s current residence and intent.',
    });
  }

  // Check if petitioner is an LLC
  if (petitionData.petitionerIsLLC) {
    issues.push({
      category: 'predicate_notice',
      severity: 'critical',
      title: 'LLC cannot bring owner-use holdover',
      description:
        'The petitioner appears to be an LLC or corporate entity. Only natural persons ' +
        '(individuals) may bring an owner-use holdover. LLCs and corporations cannot ' +
        '"personally occupy" a unit.',
      legalBasis: 'RSC § 2524.4(a); Pultz v. Economakis, 10 NY3d 542 (2008)',
      recommendation:
        'Move to dismiss. An LLC has no standing to bring an owner-use holdover.',
    });
  }
}

function checkChronicNonpaymentNotice(
  noticeData: ExtractedPredicateNoticeData,
  issues: DefenseIssue[]
): void {
  issues.push({
    category: 'predicate_notice',
    severity: 'medium',
    title: 'Chronic nonpayment holdover: verify specificity',
    description:
      'A chronic nonpayment holdover must allege specific dates and amounts of late payments. ' +
      'The notice must demonstrate a pattern of persistent late payment.',
    legalBasis: 'RPAPL § 711; RSC § 2524.3(f)',
    recommendation:
      'Review the notice for specificity of dates and amounts. Challenge if vague.',
  });
}

function checkRentStabilizedHoldoverNotice(
  noticeData: ExtractedPredicateNoticeData,
  petitionData: ExtractedPetitionData,
  holdoverSubtype: HoldoverSubtype | undefined,
  issues: DefenseIssue[]
): void {
  // Rent-stabilized tenants have enhanced protections
  issues.push({
    category: 'predicate_notice',
    severity: 'medium',
    title: 'Rent-stabilized unit: verify DHCR registration',
    description:
      'For rent-stabilized units, verify that the building is properly registered with DHCR. ' +
      'If not registered, the landlord may be barred from collecting rent increases.',
    legalBasis: 'RSL § 26-517(e)',
    recommendation: 'Check DHCR registration status at rentguidelinesboard.cityofnewyork.us.',
  });
}
