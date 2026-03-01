import { Injectable } from '@nestjs/common';

export interface TextChunk {
  index: number;
  text: string;
  wordCount: number;
}

const MAX_CHUNK_WORDS = 800;
const MIN_CHUNK_WORDS = 80;
const OVERLAP_SENTENCES = 2;

// Patterns that indicate the start of a new major section
const SECTION_HEADING_PATTERNS = [
  /^\s*\d+\.\s+[A-Z][A-Za-z\s]{3,}/m,          // "1. Clause Name"
  /^\s*\d+\.\d+\s+[A-Z][A-Za-z\s]{3,}/m,        // "1.1 Sub-clause Name"
  /^\s*[A-Z][A-Z\s]{4,}\s*$/m,                   // "ALL CAPS HEADING"
  /^\s*(?:CLAUSE|SECTION|ARTICLE)\s+\d+/im,      // "CLAUSE 12"
  /^\s*Schedule\s+\d+/im,                         // "Schedule 1"
  /^\s*Annex\s+[A-Z0-9]/im,                       // "Annex A"
];

function isNewSection(line: string): boolean {
  return SECTION_HEADING_PATTERNS.some((pattern) => pattern.test(line));
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z"'])/)
    .filter((s) => s.trim().length > 10);
}

@Injectable()
export class ChunkingStep {
  execute(text: string): TextChunk[] {
    const cleanedText = this.cleanText(text);
    const paragraphs = this.splitIntoParagraphs(cleanedText);
    const sections = this.groupIntoSections(paragraphs);
    return this.buildChunks(sections);
  }

  private cleanText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')      // collapse excessive blank lines
      .replace(/[ \t]+/g, ' ')          // collapse horizontal whitespace
      .trim();
  }

  private splitIntoParagraphs(text: string): string[] {
    return text
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter((p) => p.length > 20);
  }

  private groupIntoSections(paragraphs: string[]): string[][] {
    const sections: string[][] = [];
    let current: string[] = [];

    for (const para of paragraphs) {
      if (isNewSection(para) && current.length > 0) {
        sections.push(current);
        current = [para];
      } else {
        current.push(para);
      }
    }

    if (current.length > 0) sections.push(current);
    return sections;
  }

  private splitParagraphByWords(para: string): string[] {
    const words = para.split(/\s+/).filter(Boolean);
    const parts: string[] = [];
    for (let i = 0; i < words.length; i += MAX_CHUNK_WORDS) {
      parts.push(words.slice(i, i + MAX_CHUNK_WORDS).join(' '));
    }
    return parts;
  }

  private buildChunks(sections: string[][]): TextChunk[] {
    const chunks: TextChunk[] = [];
    let buffer: string[] = [];
    let bufferWords = 0;
    let lastSentences: string[] = [];

    const flush = (final = false) => {
      if (buffer.length === 0) return;
      const text = buffer.join('\n\n');
      if (final || countWords(text) >= MIN_CHUNK_WORDS) {
        chunks.push({ index: chunks.length, text, wordCount: countWords(text) });
      }
      // Keep last N sentences for overlap context
      const sentences = splitIntoSentences(text);
      lastSentences = sentences.slice(-OVERLAP_SENTENCES);
      buffer = [];
      bufferWords = 0;
    };

    for (const section of sections) {
      const sectionText = section.join('\n\n');
      const sectionWords = countWords(sectionText);

      if (bufferWords + sectionWords > MAX_CHUNK_WORDS && bufferWords > 0) {
        flush();
        // Prepend overlap context from previous chunk
        if (lastSentences.length > 0) {
          buffer.push(lastSentences.join(' '));
          bufferWords = countWords(lastSentences.join(' '));
        }
      }

      if (sectionWords > MAX_CHUNK_WORDS) {
        // Section itself is too large  split by paragraph, then by words if needed
        for (const para of section) {
          const paraWords = countWords(para);
          if (paraWords > MAX_CHUNK_WORDS) {
            // Paragraph has no breaks  word-split it
            if (bufferWords > 0) flush();
            for (const part of this.splitParagraphByWords(para)) {
              buffer.push(part);
              bufferWords += countWords(part);
              flush();
            }
          } else {
            if (bufferWords + paraWords > MAX_CHUNK_WORDS && bufferWords > 0) {
              flush();
            }
            buffer.push(para);
            bufferWords += paraWords;
          }
        }
      } else {
        buffer.push(...section);
        bufferWords += sectionWords;
      }
    }

    flush(true);
    return chunks;
  }
}
