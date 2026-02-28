import { Injectable, Logger } from '@nestjs/common';
import { AiClientPort } from '../../ai-client.port';
import {
  SYSTEM_CLAUSE_IDENTIFIER,
  buildClauseIdentificationPrompt,
} from '../../prompts';
import { TextChunk } from './chunking.step';
import { ClauseType } from '../../../../domain/contract/value-objects/clause-type.vo';

export interface IdentifiedClause {
  id: string;
  title: string;
  type: ClauseType;
  text: string;
  location: string;
}

interface RawClauseResponse {
  id: string;
  title: string;
  type: string;
  text: string;
  location: string;
}

const CLAUSE_TYPE_MAP: Record<string, ClauseType> = {
  liability: ClauseType.LIABILITY,
  ip: ClauseType.INTELLECTUAL_PROPERTY,
  'intellectual property': ClauseType.INTELLECTUAL_PROPERTY,
  termination: ClauseType.TERMINATION,
  payment: ClauseType.PAYMENT,
  'change-control': ClauseType.CHANGE_CONTROL,
  'change control': ClauseType.CHANGE_CONTROL,
  confidentiality: ClauseType.CONFIDENTIALITY,
  indemnification: ClauseType.INDEMNIFICATION,
  warranty: ClauseType.WARRANTY,
  'dispute-resolution': ClauseType.DISPUTE_RESOLUTION,
  'dispute resolution': ClauseType.DISPUTE_RESOLUTION,
  'governing-law': ClauseType.GOVERNING_LAW,
  'governing law': ClauseType.GOVERNING_LAW,
  'force-majeure': ClauseType.FORCE_MAJEURE,
  'force majeure': ClauseType.FORCE_MAJEURE,
};

@Injectable()
export class ClauseIdentificationStep {
  private readonly logger = new Logger(ClauseIdentificationStep.name);

  constructor(private readonly ai: AiClientPort) {}

  async execute(chunks: TextChunk[]): Promise<IdentifiedClause[]> {
    const results = await Promise.allSettled(
      chunks.map((chunk) => this.processChunk(chunk, chunks.length)),
    );

    const clauses: IdentifiedClause[] = [];
    const seenTexts = new Set<string>();

    for (const result of results) {
      if (result.status === 'fulfilled') {
        for (const clause of result.value) {
          const fingerprint = clause.text.trim().slice(0, 120).toLowerCase();
          if (!seenTexts.has(fingerprint)) {
            seenTexts.add(fingerprint);
            clauses.push(clause);
          }
        }
      } else {
        this.logger.warn(`Chunk analysis failed: ${result.reason}`);
      }
    }

    return clauses;
  }

  private async processChunk(chunk: TextChunk, totalChunks: number): Promise<IdentifiedClause[]> {
    const prompt = buildClauseIdentificationPrompt(chunk.text, chunk.index, totalChunks);
    const raw = await this.ai.complete(SYSTEM_CLAUSE_IDENTIFIER, prompt);
    const parsed = this.ai.parseJsonResponse<RawClauseResponse[]>(raw);

    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((c) => c.text && c.title && c.type)
      .map((c, i) => ({
        id: c.id || `clause_${chunk.index}_${i}`,
        title: c.title,
        type: this.normaliseType(c.type),
        text: c.text,
        location: c.location || '',
      }));
  }

  private normaliseType(raw: string): ClauseType {
    return CLAUSE_TYPE_MAP[raw.toLowerCase()] ?? ClauseType.OTHER;
  }
}
