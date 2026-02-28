import { Injectable, Logger } from '@nestjs/common';
import { AnthropicClient } from '../../anthropic.client';
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

  constructor(private readonly ai: AnthropicClient) {}

  async execute(clauses: ScoredClause[]): Promise<AnalysedClause[]> {
    const batches = this.batch(clauses, BATCH_SIZE);
    const recsMap = new Map<string, string>();

    const results = await Promise.allSettled(
      batches.map((b) => this.processBatch(b)),
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        for (const r of result.value) {
          recsMap.set(r.id, r.recommendation);
        }
      } else {
        this.logger.warn(`Recommendation batch failed: ${result.reason}`);
      }
    }

    return clauses.map((clause) => ({
      ...clause,
      recommendation:
        recsMap.get(clause.id) ?? 'Seek legal advice before accepting this clause.',
    }));
  }

  private async processBatch(clauses: ScoredClause[]): Promise<RecommendationResponse[]> {
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

  private batch<T>(items: T[], size: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
      batches.push(items.slice(i, i + size));
    }
    return batches;
  }
}
