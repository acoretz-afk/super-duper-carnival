/**
 * ACRIS (Automated City Register Information System) lookup.
 * Checks mortgage records to identify federally-backed mortgages.
 * Uses NYC Open Data ACRIS datasets.
 */

export interface ACRISMortgageData {
  documentId?: string;
  documentType?: string;
  documentDate?: string;
  partyName?: string; // lender name
  amount?: number;
  isFederallyBacked: boolean;
  federalBackingEntity?: string;
  rawData?: Record<string, unknown>;
}

// Known federal mortgage backing entities and lenders
const FEDERAL_ENTITIES = [
  'fannie mae',
  'freddie mac',
  'federal national mortgage',
  'federal home loan mortgage',
  'fha',
  'federal housing administration',
  'hud',
  'department of housing and urban development',
  'ginnie mae',
  'government national mortgage',
  'usda',
  'rural housing service',
  'veterans affairs',
  'department of veterans affairs',
  'va ',
  'fhlmc',
  'fnma',
  'gnma',
];

/**
 * Look up mortgage records from ACRIS to check for federal backing.
 * Uses the ACRIS Real Property Master and Parties datasets.
 */
export async function lookupACRISMortgages(
  borough: string,
  block: string,
  lot: string
): Promise<ACRISMortgageData[]> {
  try {
    const boroCode = boroughToCode(borough);

    // Step 1: Get document IDs for mortgages on this property
    // ACRIS Real Property Master dataset: bnx9-e6tj
    const masterUrl = `https://data.cityofnewyork.us/resource/bnx9-e6tj.json?` +
      `borough=${boroCode}&block=${block}&lot=${lot}` +
      `&$where=doc_type='MTGE' OR doc_type='AGMT'` +
      `&$order=document_date DESC&$limit=10`;

    const masterResponse = await fetch(masterUrl, {
      headers: { 'Accept': 'application/json' },
    });

    if (!masterResponse.ok) {
      console.error(`ACRIS master lookup failed: ${masterResponse.status}`);
      return [];
    }

    const masterData = await masterResponse.json();
    if (!masterData || masterData.length === 0) return [];

    // Step 2: For each mortgage, look up the parties to find lender
    const mortgages: ACRISMortgageData[] = [];

    for (const doc of masterData.slice(0, 5)) {
      const docId = doc.document_id;
      if (!docId) continue;

      // ACRIS Parties dataset: 636b-3b5g
      const partiesUrl = `https://data.cityofnewyork.us/resource/636b-3b5g.json?` +
        `document_id=${docId}&$where=party_type='2'`; // party_type 2 = lender/grantee

      try {
        const partiesResponse = await fetch(partiesUrl, {
          headers: { 'Accept': 'application/json' },
        });

        if (!partiesResponse.ok) continue;

        const partiesData = await partiesResponse.json();
        const lenderName = partiesData?.[0]?.name || '';

        const federalMatch = checkFederalBacking(lenderName);

        mortgages.push({
          documentId: docId,
          documentType: doc.doc_type,
          documentDate: doc.document_date,
          partyName: lenderName,
          amount: doc.document_amt ? parseFloat(doc.document_amt) : undefined,
          isFederallyBacked: federalMatch.isFederal,
          federalBackingEntity: federalMatch.entity,
          rawData: doc,
        });
      } catch {
        continue;
      }
    }

    return mortgages;
  } catch (error) {
    console.error('ACRIS lookup error:', error);
    return [];
  }
}

function checkFederalBacking(lenderName: string): {
  isFederal: boolean;
  entity?: string;
} {
  const lowerName = lenderName.toLowerCase();
  for (const entity of FEDERAL_ENTITIES) {
    if (lowerName.includes(entity)) {
      return { isFederal: true, entity };
    }
  }
  return { isFederal: false };
}

function boroughToCode(borough: string): string {
  const map: Record<string, string> = {
    'manhattan': '1',
    'bronx': '2',
    'brooklyn': '3',
    'queens': '4',
    'staten island': '5',
    'new york': '1',
  };
  return map[borough.toLowerCase()] || '1';
}
