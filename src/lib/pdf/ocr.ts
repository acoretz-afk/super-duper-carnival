import Tesseract from 'tesseract.js';

/**
 * Perform OCR on a PDF that contains scanned images.
 * Converts each page to an image and runs Tesseract OCR.
 *
 * Note: For server-side PDF-to-image conversion, we rely on
 * the LLM to process image-based PDFs when text extraction fails.
 * This module handles direct image files (JPG, PNG, TIFF).
 */
export async function performOCR(imageBuffer: Buffer): Promise<string> {
  const worker = await Tesseract.createWorker('eng');
  const result = await worker.recognize(imageBuffer);
  const text = result.data.text;
  await worker.terminate();
  return text;
}

/**
 * For scanned PDFs where text extraction fails, we use the LLM
 * vision capabilities to extract text. This function prepares
 * the image data for LLM processing.
 */
export function prepareForLLMOCR(buffer: Buffer): string {
  return buffer.toString('base64');
}
