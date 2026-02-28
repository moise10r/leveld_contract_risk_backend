import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class PdfParserAdapter {
  private readonly logger = new Logger(PdfParserAdapter.name);

  async extractText(buffer: Buffer): Promise<string> {
    try {
      // Dynamic import to avoid issues with pdf-parse native bindings
      const pdfParse = await import('pdf-parse');
      const parse = (pdfParse as any).default ?? pdfParse;
      const data = await parse(buffer);

      if (!data.text || data.text.trim().length < 50) {
        throw new Error('PDF appears to be empty or image-only (no extractable text)');
      }

      return this.postProcess(data.text);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'PDF parsing failed';
      this.logger.error(`PDF extraction failed: ${msg}`);
      throw new Error(`Unable to extract text from PDF: ${msg}`);
    }
  }

  private postProcess(raw: string): string {
    return raw
      .replace(/\f/g, '\n\n')                    // form feeds → paragraph breaks
      .replace(/(\w)-\n(\w)/g, '$1$2')           // rejoin hyphenated line breaks
      .replace(/(?<!\n)\n(?!\n)(?![•\-\d])/g, ' ') // join soft-wrapped lines (not lists)
      .replace(/\n{3,}/g, '\n\n')                // collapse excess blank lines
      .trim();
  }
}
