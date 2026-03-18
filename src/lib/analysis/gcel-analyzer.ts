/**
 * Good Cause Eviction Law (GCEL) Analyzer
 * RPL § 231-c (effective April 20, 2024)
 *
 * Analyzes whether GCEL applies and whether the landlord has properly
 * complied with GCEL notice requirements.
 */

import { DefenseIssue, ExtractedPetitionData, CaseType, HoldoverSubtype } from '../types';
import { GCEL_EXCEPTIONS } from '../constants';
import { HPDBuildingData } from '../external/hpd';
import { ACRISMortgageData } from '../external/acris';
import { JustFixBuildingData } from '../external/justfix';

export interface GCELAnalysisResult {
  likelySubjectToGCEL: boolean;
  confidence: 'high' | 'medium' | 'low';
  exceptionsFound: string[];
  issues: DefenseIssue[];
  reasoning: string;
}

export function analyzeGCEL(
  petitionData: ExtractedPetitionData,
  caseType: CaseType,
  holdoverSubtype: HoldoverSubtype | undefined,
  hpdData: HPDBuildingData | null,
  acrisData: ACRISMortgageData[],
  justfixData: JustFixBuildingData | null,
  gcelNoticePresent: boolean
): GCELAnalysisResult {
  const issues: DefenseIssue[] = [];
  const exceptionsFound: string[] = [];
  const reasoning: string[] = [];

  // Step 1: Check unit count
  const unitCount = hpdData?.totalUnits || justfixData?.unitsRes;
  let unitCountExceeds10 = true; // default assumption favoring tenant

  if (unitCount !== undefined) {
    if (unitCount <= 10) {
      // Check if there's a federally-backed mortgage (which would still make GCEL apply)
      const hasFederalMortgage = acrisData.some(m => m.isFederallyBacked);
      if (!hasFederalMortgage) {
        unitCountExceeds10 = false;
        reasoning.push(
          `Building has ${unitCount} units (≤10) and no federally-backed mortgage found. ` +
          `GCEL may not apply under the small building exception.`
        );
      } else {
        reasoning.push(
          `Building has ${unitCount} units (≤10) BUT has a federally-backed mortgage ` +
          `(${acrisData.find(m => m.isFederallyBacked)?.federalBackingEntity}), ` +
          `so GCEL still applies.`
        );
      }
    } else {
      reasoning.push(`Building has ${unitCount} units (>10), so GCEL applies based on unit count.`);
    }
  } else {
    reasoning.push(
      'Unable to determine unit count from public records. ' +
      'Further investigation needed to determine GCEL applicability.'
    );
  }

  // Step 2: Check regulatory status exceptions
  if (petitionData.regulatoryStatus === 'rent_stabilized') {
    exceptionsFound.push('rent_stabilized');
    reasoning.push(
      'Unit is rent-stabilized. Rent-stabilized tenants already have stronger protections ' +
      'under RSL/RSC; GCEL does not add protections but the unit is exempt from GCEL.'
    );
  }

  if (petitionData.regulatoryStatus === 'rent_controlled') {
    exceptionsFound.push('rent_controlled');
    reasoning.push('Unit is rent-controlled and exempt from GCEL.');
  }

  // Step 3: Check owner-occupancy exception
  if (unitCount && unitCount <= 10) {
    // Only check owner-occupancy for small buildings
    reasoning.push(
      'For buildings with ≤10 units, check if the owner occupies a unit in the building ' +
      '(owner-occupancy exception). This requires further investigation.'
    );
  }

  // Step 4: Check co-op exception
  if (petitionData.coopShareholder) {
    exceptionsFound.push('coop_shareholder');
    reasoning.push('Respondent is described as a co-op shareholder. Co-op shareholders are exempt from GCEL.');
  }

  // Step 5: Check GCEL notice compliance
  const likelySubject =
    unitCountExceeds10 &&
    !exceptionsFound.includes('rent_stabilized') &&
    !exceptionsFound.includes('rent_controlled') &&
    !exceptionsFound.includes('coop_shareholder');

  if (likelySubject) {
    // GCEL requires specific notice
    if (!gcelNoticePresent && !petitionData.gcelPleading?.included) {
      issues.push({
        category: 'gcel',
        severity: 'critical',
        title: 'Missing GCEL notice/pleading',
        description:
          'The premises appear to be subject to the Good Cause Eviction Law (RPL § 231-c), ' +
          'but the petition does not include the required GCEL notice or pleading. ' +
          'Under GCEL, the landlord must provide notice regarding whether the premises are ' +
          'subject to GCEL and, if claiming an exception, must specify the exception.',
        legalBasis: 'RPL § 231-c',
        recommendation:
          'Raise GCEL as an affirmative defense. The landlord\'s failure to plead GCEL ' +
          'compliance may be grounds for dismissal.',
      });
    }

    if (petitionData.gcelPleading?.included && !petitionData.gcelPleading?.subjectToGCEL) {
      // Landlord claims GCEL does not apply - check their exception
      if (petitionData.gcelPleading.exceptionClaimed) {
        issues.push({
          category: 'gcel',
          severity: 'medium',
          title: `Landlord claims GCEL exception: ${petitionData.gcelPleading.exceptionClaimed}`,
          description:
            `The landlord claims the premises are exempt from GCEL based on: ` +
            `${petitionData.gcelPleading.exceptionDetails || petitionData.gcelPleading.exceptionClaimed}. ` +
            `This claim should be investigated and challenged if unsupported.`,
          legalBasis: 'RPL § 231-c(2)',
          recommendation:
            'Investigate the claimed exception. Request documentation supporting the exception. ' +
            'If the exception is not valid, raise GCEL as a defense.',
        });
      } else {
        issues.push({
          category: 'gcel',
          severity: 'high',
          title: 'Landlord claims GCEL does not apply without specifying exception',
          description:
            'The landlord\'s GCEL notice states the premises are not subject to GCEL ' +
            'but does not specify which exception applies. Under GCEL, the landlord must ' +
            'specify the basis for claiming an exception.',
          legalBasis: 'RPL § 231-c(2)',
          recommendation:
            'Challenge the blanket exemption claim. Move to compel specification of the exception.',
        });
      }
    }

    // For holdover cases, check "good cause" requirement
    if (caseType === 'holdover') {
      issues.push({
        category: 'gcel',
        severity: 'high',
        title: 'GCEL "good cause" requirement applies to this holdover',
        description:
          'Under GCEL, the landlord must demonstrate "good cause" for eviction. ' +
          'The enumerated grounds include: non-payment of rent, violation of lease terms, ' +
          'nuisance, illegal use, refusal of access, owner occupancy (with conditions), ' +
          'and others. The landlord bears the burden of proving good cause.',
        legalBasis: 'RPL § 231-c(5)',
        recommendation:
          'Evaluate whether the landlord has adequately pleaded and can prove "good cause" ' +
          'under the GCEL framework.',
      });
    }

    // For nonpayment cases, check unreasonable rent increase
    if (caseType === 'nonpayment') {
      issues.push({
        category: 'gcel',
        severity: 'medium',
        title: 'GCEL rent increase limitation may apply',
        description:
          'Under GCEL, rent increases exceeding the lesser of 10% or CPI + 5% may be ' +
          'considered unreasonable unless the landlord can justify them. ' +
          'Check whether the rent being demanded includes an unreasonable increase.',
        legalBasis: 'RPL § 231-c(6)',
        recommendation:
          'Request rent history and compare against CPI-based limits. ' +
          'If the rent was increased unreasonably, this is a defense to nonpayment.',
      });
    }
  }

  const confidence: 'high' | 'medium' | 'low' =
    unitCount !== undefined ? (exceptionsFound.length === 0 ? 'high' : 'medium') : 'low';

  return {
    likelySubjectToGCEL: likelySubject,
    confidence,
    exceptionsFound,
    issues,
    reasoning: reasoning.join('\n'),
  };
}
