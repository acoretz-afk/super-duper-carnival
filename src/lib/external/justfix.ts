/**
 * JustFix WhoOwnsWhat integration
 * https://whoownswhat.justfix.org/
 *
 * Provides building ownership info, links to HPD, DOB, ACRIS data.
 * Used to cross-reference GCEL exceptions, unit counts, and ownership.
 */

export interface JustFixBuildingData {
  address: string;
  borough: string;
  bbl?: string;
  unitsRes?: number;
  ownerName?: string;
  registrationId?: string;
  hpdViolations?: number;
  hpdComplaints?: number;
  evictions?: number;
  associatedBuildings?: number;
  portfolioSize?: number;
  rawData?: Record<string, unknown>;
}

/**
 * Look up building data via JustFix WhoOwnsWhat.
 * This queries their public API endpoint.
 */
export async function lookupJustFix(
  address: string,
  borough: string
): Promise<JustFixBuildingData | null> {
  try {
    // JustFix WhoOwnsWhat uses the NYC geoclient/geosearch API for address lookup
    // and then queries their own database. We'll use their address search endpoint.
    const searchUrl = `https://whoownswhat.justfix.org/api/address?address=${encodeURIComponent(address)}&borough=${encodeURIComponent(borough)}`;

    const response = await fetch(searchUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'NYC-Tenant-Defense-Tool/1.0',
      },
    });

    if (!response.ok) {
      console.error(`JustFix lookup failed: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (!data || !data.result) {
      return null;
    }

    const result = data.result;
    return {
      address: result.address || address,
      borough: result.borough || borough,
      bbl: result.bbl,
      unitsRes: result.unitsres ? parseInt(result.unitsres) : undefined,
      ownerName: result.ownername,
      registrationId: result.registrationid,
      hpdViolations: result.totalviolations,
      hpdComplaints: result.totalcomplaints,
      evictions: result.evictions,
      associatedBuildings: result.assocbuildings,
      portfolioSize: result.portfoliosize,
      rawData: result,
    };
  } catch (error) {
    console.error('JustFix lookup error:', error);
    return null;
  }
}
