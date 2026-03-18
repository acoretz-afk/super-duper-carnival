/**
 * NYC HPD (Housing Preservation & Development) Building Registration lookup.
 * Uses NYC Open Data API for building registration and unit counts.
 */

export interface HPDBuildingData {
  boroId?: string;
  block?: string;
  lot?: string;
  buildingId?: string;
  registrationId?: string;
  buildingAddress?: string;
  totalUnits?: number;
  ownerName?: string;
  ownerType?: string; // individual, corporation, LLC, etc.
  registrationDate?: string;
  expirationDate?: string;
  rawData?: Record<string, unknown>;
}

/**
 * Look up building registration data from HPD via NYC Open Data.
 * The HPD registration dataset includes unit counts and owner info.
 */
export async function lookupHPD(
  address: string,
  borough: string
): Promise<HPDBuildingData | null> {
  try {
    // NYC Open Data - HPD Building Registrations
    // Dataset: tesw-yqqr (building registrations)
    const boroCode = boroughToCode(borough);
    const normalizedAddress = normalizeAddress(address);

    const url = `https://data.cityofnewyork.us/resource/tesw-yqqr.json?$where=` +
      encodeURIComponent(
        `boroid='${boroCode}' AND upper(streetaddress) LIKE '%${normalizedAddress}%'`
      ) +
      `&$limit=5`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`HPD lookup failed: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      return null;
    }

    const building = data[0];
    return {
      boroId: building.boroid,
      block: building.block,
      lot: building.lot,
      buildingId: building.buildingid,
      registrationId: building.registrationid,
      buildingAddress: building.streetaddress,
      totalUnits: building.totalunits ? parseInt(building.totalunits) : undefined,
      ownerName: building.ownername,
      ownerType: building.ownertype,
      registrationDate: building.registrationdate,
      expirationDate: building.expirationdate,
      rawData: building,
    };
  } catch (error) {
    console.error('HPD lookup error:', error);
    return null;
  }
}

/**
 * Look up the number of residential units via HPD registration contacts dataset.
 */
export async function lookupHPDUnitCount(
  boroId: string,
  block: string,
  lot: string
): Promise<number | null> {
  try {
    const url = `https://data.cityofnewyork.us/resource/tesw-yqqr.json?` +
      `boroid=${boroId}&block=${block}&lot=${lot}&$limit=1`;

    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    if (data && data.length > 0 && data[0].totalunits) {
      return parseInt(data[0].totalunits);
    }
    return null;
  } catch {
    return null;
  }
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

function normalizeAddress(address: string): string {
  return address
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/\./g, '')
    .trim();
}
