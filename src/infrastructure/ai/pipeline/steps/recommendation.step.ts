import { Injectable, Logger } from '@nestjs/common';
import { AiClientPort } from '../../ai-client.port';
import { batch } from '../../batch.util';
import { SYSTEM_RECOMMENDATION_ADVISOR, buildRecommendationPrompt } from '../../prompts';
import { ScoredClause } from './risk-scoring.step';

export interface AnalysedClause extends ScoredClause {
  recommendation: string;
}

interface RecommendationResponse {
  id: string;
  recommendation: string;
}

const BATCH_SIZE = 4;

@Injectable()
export class RecommendationStep {
  private readonly logger = new Logger(RecommendationStep.name);

  constructor(private readonly ai: AiClientPort) {}

  async execute(clauses: ScoredClause[]): Promise<AnalysedClause[]> {
    const batches = batch(clauses, BATCH_SIZE);
    const results = await Promise.allSettled(batches.map((b) => this.recommendClausesBatch(b)));
    return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  }

  /** Recommend a single batch and map raw AI responses onto AnalysedClause objects. */
  async recommendClausesBatch(clauses: ScoredClause[]): Promise<AnalysedClause[]> {
    try {
      const recs = await this.processBatch(clauses);
      const recsMap = new Map(recs.map((r) => [r.id, r.recommendation]));
      return clauses.map((clause) => ({
        ...clause,
        recommendation:
          recsMap.get(clause.id) ?? 'Seek legal advice before accepting this clause.',
      }));
    } catch (err) {
      this.logger.warn(`Recommendation batch failed: ${err}`);
      return clauses.map((clause) => ({
        ...clause,
        recommendation: 'Seek legal advice before accepting this clause.',
      }));
    }
  }

  private async processBatch(
    clauses: ScoredClause[],
  ): Promise<RecommendationResponse[]> {
    const input = clauses.map((c) => ({
      id: c.id,
      title: c.title,
      type: c.type,
      text: c.text,
      explanation: c.explanation,
      severity: c.severity,
    }));

    const prompt = buildRecommendationPrompt(input);
    const raw = await this.ai.complete(SYSTEM_RECOMMENDATION_ADVISOR, prompt);
    const parsed = this.ai.parseJsonResponse<RecommendationResponse[]>(raw);

    return Array.isArray(parsed) ? parsed : [];
  }
}
