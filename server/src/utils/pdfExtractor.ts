import { PDFParse } from 'pdf-parse';

export interface ExtractedPdfContent {
  text: string;
  numPages: number;
  info?: Record<string, any>;
}

/**
 * Extracts plain text securely from a PDF buffer using in-memory parsing.
 * Rejects corrupt, empty, or unparseable buffers.
 */
export const extractTextFromPdf = async (buffer: Buffer): Promise<ExtractedPdfContent> => {
  if (!buffer || buffer.length === 0) {
    throw new Error('PDF buffer is empty');
  }

  // Magic bytes check for PDF (%PDF-)
  const magic = buffer.subarray(0, 4).toString('ascii');
  if (magic !== '%PDF') {
    throw new Error('Invalid file format: Not a valid PDF document.');
  }

  const parser = new PDFParse({ data: buffer });
  try {
    const textResult = await parser.getText();
    const cleanedText = (textResult.text || '').replace(/\r\n/g, '\n').trim();

    return {
      text: cleanedText,
      numPages: textResult.total || textResult.pages?.length || 1,
    };
  } catch (error: any) {
    throw new Error(`Failed to parse PDF document: ${error.message || 'Corrupted file'}`);
  } finally {
    try {
      await parser.destroy();
    } catch {
      // Ignore parser cleanup error
    }
  }
};
