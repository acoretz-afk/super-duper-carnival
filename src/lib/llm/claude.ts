import Anthropic from '@anthropic-ai/sdk';
import {
  CaseType,
  HoldoverSubtype,
  ExtractedPetitionData,
  ExtractedServiceData,
  ExtractedNoticeOfPetitionData,
  ExtractedPredicateNoticeData,
  DocumentCategory,
} from '../types';

const anthropic = new Anthropic();

// ============================================================
// Document Classification
// ============================================================

export async function classifyDocument(
  text: string,
  nyscefLabel?: string
): Promise<DocumentCategory> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 200,
    messages: [
      {
        role: 'user',
        content: `You are analyzing a document from a NYC Housing Court case filed on NYSCEF.

NYSCEF label (if available): "${nyscefLabel || 'unknown'}"

Document text (first 2000 chars):
"""
${text.substring(0, 2000)}
"""

Classify this document into exactly ONE of these categories:
- petition: The verified petition / complaint
- notice_of_petition: The notice of petition (court scheduling document with return date)
- predicate_notice: Predicate notice (rent demand, notice to cure, notice of termination, notice of non-renewal, etc.)
- affidavit_of_service_petition: Affidavit/affirmation of service for the petition and notice of petition
- affidavit_of_service_predicate: Affidavit/affirmation of service for the predicate notice
- gcel_notice: Good Cause Eviction Law (RPL § 231-c) notice
- other: Does not fit any above category

Note: A single document may contain multiple items (e.g., petition + predicate notice). Classify by the PRIMARY document type.
If it contains a predicate notice embedded in the petition, classify as "petition" (we will extract the predicate notice separately).

Respond with ONLY the category name, nothing else.`,
      },
    ],
  });

  const category = (message.content[0] as { type: string; text: string }).text
    .trim()
    .toLowerCase() as DocumentCategory;

  const validCategories: DocumentCategory[] = [
    'petition', 'notice_of_petition', 'predicate_notice',
    'affidavit_of_service_petition', 'affidavit_of_service_predicate',
    'gcel_notice', 'other',
  ];

  return validCategories.includes(category) ? category : 'other';
}

// ============================================================
// Petition Data Extraction
// ============================================================

export async function extractPetitionData(
  text: string,
  caseType: CaseType,
  holdoverSubtype?: HoldoverSubtype
): Promise<ExtractedPetitionData> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: `You are a NYC tenant attorney analyzing a housing court petition. Extract the following information as JSON.

Case type: ${caseType}${holdoverSubtype ? `, subtype: ${holdoverSubtype}` : ''}

Document text:
"""
${text}
"""

Extract and return a JSON object with these fields (use null for anything not found):
{
  "petitionerName": "name of petitioner/landlord",
  "petitionerIsLLC": true/false - is the petitioner an LLC or corporate entity?,
  "respondentName": "name of respondent/tenant",
  "address": "property address",
  "apartmentNumber": "apartment/unit number",
  "borough": "NYC borough",
  "regulatoryStatus": "rent_stabilized" | "rent_controlled" | "unregulated" | "not_stated",
  "monthlyRent": numeric amount or null,
  "arrearsAmount": total arrears claimed (nonpayment cases) or null,
  "arrearsBreakdown": "description of how arrears are broken down, if provided",
  "nonRentChargesIncluded": true/false - are there non-rent charges (late fees, legal fees, utilities, etc.) included in the demand?,
  "nonRentChargesDescription": "description of any non-rent charges if found",
  "nychaOrSection8Mentioned": true/false,
  "nychaOrSection8Details": "any details about NYCHA/Section 8/HUD if mentioned",
  "federalFundingMentioned": true/false,
  "federalFundingDetails": "any details about federal funding if mentioned",
  "coopShareholder": true/false - is the respondent described as a co-op shareholder?,
  "tenancyStartDate": "date if stated",
  "leaseExpirationDate": "date if stated",
  "gcelPleading": {
    "included": true/false - is there any mention of Good Cause Eviction Law / RPL 231-c?,
    "subjectToGCEL": true/false/null - does the notice state the premises IS subject to GCEL?,
    "exceptionClaimed": "name of exception if GCEL does not apply",
    "exceptionDetails": "details of the exception claimed"
  }
}

IMPORTANT: For regulatoryStatus, if the petition does not explicitly state whether the unit is rent stabilized, rent controlled, or unregulated, set this to "not_stated" - this is itself a defect.

For nonRentChargesIncluded, carefully check if the arrears include anything beyond base rent (like late fees, legal fees, utilities, water charges, repairs, etc.). For co-op cases, maintenance charges and assessments may be valid.

Respond with ONLY valid JSON, no markdown formatting.`,
      },
    ],
  });

  const responseText = (message.content[0] as { type: string; text: string }).text.trim();
  try {
    return JSON.parse(responseText);
  } catch {
    // Try to extract JSON from response if wrapped in markdown
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Failed to parse petition data from LLM response');
  }
}

// ============================================================
// Service Affidavit Data Extraction
// ============================================================

export async function extractServiceData(text: string): Promise<ExtractedServiceData> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    messages: [
      {
        role: 'user',
        content: `You are a NYC tenant attorney analyzing an affidavit/affirmation of service from a housing court case. Extract service details as JSON.

Document text:
"""
${text}
"""

Extract and return a JSON object:
{
  "servedParty": "who was served (e.g., respondent/tenant name, NYCHA, etc.)",
  "serviceType": "personal" | "substituted" | "conspicuous" | "nail_and_mail" | "other",
  "attempts": [
    {
      "date": "YYYY-MM-DD or date as stated",
      "time": "HH:MM AM/PM as stated in document",
      "result": "served" | "not_served"
    }
  ],
  "mailingCompleted": true/false/null - was mailing alleged for conspicuous/nail-and-mail service?,
  "mailingDate": "date of mailing if stated",
  "mailingProof": true/false - is there proof/certificate of mailing referenced?,
  "affixCompleted": true/false/null - was affixing alleged for nail-and-mail service?,
  "nychaServed": true/false - does this affidavit cover service on NYCHA?,
  "nychaServiceDetails": "details of NYCHA service if applicable"
}

For each service attempt, record the EXACT date and time as stated. If time is approximate (e.g., "approximately 2:00 PM"), record it as stated.

Respond with ONLY valid JSON.`,
      },
    ],
  });

  const responseText = (message.content[0] as { type: string; text: string }).text.trim();
  try {
    return JSON.parse(responseText);
  } catch {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Failed to parse service data from LLM response');
  }
}

// ============================================================
// Notice of Petition Analysis
// ============================================================

export async function extractNoticeOfPetitionData(
  text: string
): Promise<ExtractedNoticeOfPetitionData> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    messages: [
      {
        role: 'user',
        content: `You are a NYC tenant attorney analyzing a Notice of Petition from a housing court case.

The court requires landlords to use a STANDARD FORM notice of petition. Any deviation from the standard form — including reformatting, using different language, or omitting required language — is an unamendable defect.

The standard form must include language about:
- The respondent being notified to appear before the court
- The specific return date and time
- Warning that judgment may be entered if respondent fails to appear
- Right to an attorney
- Right to free legal services
- Information about the court location

Document text:
"""
${text}
"""

Extract and return a JSON object:
{
  "returnDate": "YYYY-MM-DD - the date respondent must appear in court",
  "usesStandardForm": true/false - does this appear to use the court's standard form notice of petition, or has the landlord deviated from the form?,
  "deviations": ["list of specific deviations from the standard form if any are found, e.g., 'missing right to attorney language', 'non-standard formatting', 'uses custom language instead of form language'"]
}

Be thorough in checking for deviations. Common deviations include:
- Using the landlord's own letterhead/formatting instead of the court form
- Omitting required advisements about tenant rights
- Changing the wording of required provisions
- Missing information about free legal services
- Non-standard formatting that departs from the official court form

Respond with ONLY valid JSON.`,
      },
    ],
  });

  const responseText = (message.content[0] as { type: string; text: string }).text.trim();
  try {
    return JSON.parse(responseText);
  } catch {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Failed to parse notice of petition data from LLM response');
  }
}

// ============================================================
// Predicate Notice Data Extraction
// ============================================================

export async function extractPredicateNoticeData(
  text: string,
  caseType: CaseType,
  holdoverSubtype?: HoldoverSubtype
): Promise<ExtractedPredicateNoticeData> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    messages: [
      {
        role: 'user',
        content: `You are a NYC tenant attorney analyzing a predicate notice from a housing court ${caseType} case${holdoverSubtype ? ` (${holdoverSubtype} holdover)` : ''}.

Document text:
"""
${text}
"""

Extract and return a JSON object:
{
  "noticeType": "type of notice (e.g., 'rent demand', 'notice to cure', 'notice of termination', 'notice of non-renewal', '10-day notice to quit')",
  "dateServed": "YYYY-MM-DD or date as stated when notice was served",
  "terminationDate": "YYYY-MM-DD - the date by which tenant must comply/vacate (if stated)",
  "noticePeriodDays": number - calculated days between service and termination/compliance date,
  "goodFaithEstimate": number or null - for nonpayment rent demands, the total amount demanded,
  "arrearsBreakdown": "how the arrears are broken down if stated (e.g., by month, by charge type)"
}

For nonpayment rent demands, check carefully whether the amount includes ONLY rent or also includes non-rent charges. Note any non-rent charges in the arrearsBreakdown.

Respond with ONLY valid JSON.`,
      },
    ],
  });

  const responseText = (message.content[0] as { type: string; text: string }).text.trim();
  try {
    return JSON.parse(responseText);
  } catch {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Failed to parse predicate notice data from LLM response');
  }
}
