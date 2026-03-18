import pdfParse from 'pdf-parse';

export interface ParsedPDF {
  text: string;
  numPages: number;
  ocrUsed: boolean;
}

/**
 * Parse a PDF buffer and extract text content.
 * If text extraction yields minimal content, flags that OCR may be needed.
 */
export async function parsePDF(buffer: Buffer): Promise<ParsedPDF> {
  const result = await pdfParse(buffer);

  const text = result.text.trim();
  const numPages = result.numpages;

  // If text is very sparse relative to page count, likely a scanned image
  const avgCharsPerPage = text.length / Math.max(numPages, 1);
  const ocrNeeded = avgCharsPerPage < 100;

  return {
    text,
    numPages,
    ocrUsed: false,
  };
}

/**
 * Check if a PDF buffer likely contains scanned images needing OCR.
 */
export function needsOCR(text: string, numPages: number): boolean {
  const avgCharsPerPage = text.length / Math.max(numPages, 1);
  return avgCharsPerPage < 100;
}
