/**
 * Case Analysis Orchestrator
 *
 * Coordinates all analysis modules to produce a comprehensive
 * defense report for a housing court case.
 */

import { CaseType, HoldoverSubtype, DefenseIssue, DocumentCategory } from '../types';
import { parsePDF } from '../pdf/parser';
import {
  classifyDocument,
  extractPetitionData,
  extractServiceData,
  extractNoticeOfPetitionData,
  extractPredicateNoticeData,
} from '../llm/claude';
import { validateService } from './service-validator';
import { analyzeGCEL } from './gcel-analyzer';
import { checkPredicateNotice } from './predicate-notice-checker';
import { validateNoticeOfPetition } from './nop-validator';
import { checkFilingDates } from './filing-date-checker';
import { lookupHPD } from '../external/hpd';
import { lookupACRISMortgages } from '../external/acris';
import { lookupJustFix } from '../external/justfix';

export interface CaseDocument {
  id: string;
  filename: string;
  nyscefLabel?: string;
  buffer: Buffer;
  text?: string;
  category?: DocumentCategory;
}

export interface CaseAnalysisInput {
  caseType: CaseType;
  holdoverSubtype?: HoldoverSubtype;
  indexNumber?: string;
  filingDate?: string;
  documents: CaseDocument[];
}

export interface CaseAnalysisResult {
  caseType: CaseType;
  holdoverSubtype?: HoldoverSubtype;
  indexNumber?: string;
  issues: DefenseIssue[];
  petitionData: Record<string, unknown> | null;
  gcelAnalysis: Record<string, unknown> | null;
  externalData: {
    hpd: Record<string, unknown> | null;
    acris: Record<string, unknown>[];
    justfix: Record<string, unknown> | null;
  };
  documentClassifications: Array<{ filename: string; category: DocumentCategory }>;
  summary: string;
}

export async function analyzeCase(input: CaseAnalysisInput): Promise<CaseAnalysisResult> {
  const allIssues: DefenseIssue[] = [];
  const classifications: Array<{ filename: string; category: DocumentCategory }> = [];

  // Step 1: Parse all PDFs and classify documents
  for (const doc of input.documents) {
    if (!doc.text) {
      const parsed = await parsePDF(doc.buffer);
      doc.text = parsed.text;
    }
    const category = await classifyDocument(doc.text, doc.nyscefLabel);
    doc.category = category;
    classifications.push({ filename: doc.filename, category });
  }

  // Step 2: Extract data from key documents
  const petitionDoc = input.documents.find(d => d.category === 'petition');
  const nopDoc = input.documents.find(d => d.category === 'notice_of_petition');
  const predicateDoc = input.documents.find(d => d.category === 'predicate_notice');
  const petitionServiceDoc = input.documents.find(d => d.category === 'affidavit_of_service_petition');
  const predicateServiceDoc = input.documents.find(d => d.category === 'affidavit_of_service_predicate');
  const gcelDoc = input.documents.find(d => d.category === 'gcel_notice');

  // Extract petition data
  let petitionData = null;
  if (petitionDoc?.text) {
    petitionData = await extractPetitionData(
      petitionDoc.text,
      input.caseType,
      input.holdoverSubtype
    );
  }

  // Extract NOP data
  let nopData = null;
  if (nopDoc?.text) {
    nopData = await extractNoticeOfPetitionData(nopDoc.text);
  }

  // Extract predicate notice data
  let predicateData = null;
  if (predicateDoc?.text) {
    predicateData = await extractPredicateNoticeData(
      predicateDoc.text,
      input.caseType,
      input.holdoverSubtype
    );
  }

  // Extract service data
  let petitionServiceData = null;
  if (petitionServiceDoc?.text) {
    petitionServiceData = await extractServiceData(petitionServiceDoc.text);
  }

  let predicateServiceData = null;
  if (predicateServiceDoc?.text) {
    predicateServiceData = await extractServiceData(predicateServiceDoc.text);
  }

  // Step 3: External lookups (if we have address info)
  let hpdData = null;
  let acrisData: Record<string, unknown>[] = [];
  let justfixData = null;

  if (petitionData?.address && petitionData?.borough) {
    const [hpd, justfix] = await Promise.all([
      lookupHPD(petitionData.address as string, petitionData.borough as string),
      lookupJustFix(petitionData.address as string, petitionData.borough as string),
    ]);
    hpdData = hpd;
    justfixData = justfix;

    // ACRIS lookup needs BBL
    if (hpdData?.boroId && hpdData?.block && hpdData?.lot) {
      const mortgages = await lookupACRISMortgages(
        petitionData.borough as string,
        hpdData.block,
        hpdData.lot
      );
      acrisData = mortgages as unknown as Record<string, unknown>[];
    }
  }

  // Step 4: Run analysis modules
  // Service validation
  if (petitionServiceData) {
    const serviceResult = validateService(
      petitionServiceData,
      'petition',
      input.caseType,
      input.filingDate,
      nopData?.returnDate
    );
    allIssues.push(...serviceResult.issues);
  }

  if (predicateServiceData) {
    const serviceResult = validateService(
      predicateServiceData,
      'predicate',
      input.caseType
    );
    allIssues.push(...serviceResult.issues);
  }

  // NOP validation
  if (nopData) {
    const serviceDate = petitionServiceData?.attempts?.find(
      (a: { result: string }) => a.result === 'served'
    )?.date;
    const nopResult = validateNoticeOfPetition(
      nopData,
      input.filingDate,
      serviceDate
    );
    allIssues.push(...nopResult.issues);
  }

  // Predicate notice validation
  if (predicateData && petitionData) {
    const predicateResult = checkPredicateNotice(
      predicateData,
      petitionData,
      input.caseType,
      input.holdoverSubtype
    );
    allIssues.push(...predicateResult.issues);
  }

  // Filing date checks
  if (input.filingDate) {
    const serviceDate = petitionServiceData?.attempts?.find(
      (a: { result: string }) => a.result === 'served'
    )?.date;
    const filingResult = checkFilingDates(
      input.filingDate,
      predicateData,
      input.caseType,
      serviceDate,
      nopData?.returnDate
    );
    allIssues.push(...filingResult.issues);
  }

  // GCEL analysis
  let gcelAnalysis = null;
  if (petitionData) {
    const gcelResult = analyzeGCEL(
      petitionData,
      input.caseType,
      input.holdoverSubtype,
      hpdData,
      acrisData as any,
      justfixData,
      !!gcelDoc
    );
    gcelAnalysis = gcelResult as unknown as Record<string, unknown>;
    allIssues.push(...gcelResult.issues);
  }

  // Step 5: Sort issues by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  allIssues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  // Step 6: Generate summary
  const criticalCount = allIssues.filter(i => i.severity === 'critical').length;
  const highCount = allIssues.filter(i => i.severity === 'high').length;
  const summary = generateSummary(criticalCount, highCount, allIssues.length, input.caseType);

  return {
    caseType: input.caseType,
    holdoverSubtype: input.holdoverSubtype,
    indexNumber: input.indexNumber,
    issues: allIssues,
    petitionData: petitionData as unknown as Record<string, unknown>,
    gcelAnalysis,
    externalData: {
      hpd: hpdData as unknown as Record<string, unknown>,
      acris: acrisData,
      justfix: justfixData as unknown as Record<string, unknown>,
    },
    documentClassifications: classifications,
    summary,
  };
}

function generateSummary(
  criticalCount: number,
  highCount: number,
  totalCount: number,
  caseType: CaseType
): string {
  const parts: string[] = [];

  if (criticalCount > 0) {
    parts.push(
      `Found ${criticalCount} CRITICAL issue${criticalCount > 1 ? 's' : ''} ` +
      `that may be grounds for immediate dismissal.`
    );
  }

  if (highCount > 0) {
    parts.push(
      `Found ${highCount} HIGH-priority issue${highCount > 1 ? 's' : ''} ` +
      `that should be raised as defenses.`
    );
  }

  if (totalCount === 0) {
    parts.push(
      `No procedural defects identified in the ${caseType} case documents. ` +
      `However, substantive defenses should still be explored with the tenant.`
    );
  } else {
    parts.push(`Total of ${totalCount} potential issue${totalCount > 1 ? 's' : ''} identified.`);
  }

  return parts.join(' ');
}
