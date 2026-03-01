import { Injectable, Logger } from '@nestjs/common';
import { AiClientPort } from '../../ai-client.port';
import { batch } from '../../batch.util';
import { SYSTEM_RISK_SCORER, buildRiskScoringPrompt } from '../../prompts';
import { IdentifiedClause } from './clause-identification.step';
import { RiskSeverity, normaliseSeverity } from '../../../../domain/contract/value-objects/risk-severity.vo';

export interface ScoredClause extends IdentifiedClause {
  severity: RiskSeverity;
  riskFactors: string[];
  explanation: string;
}

interface ScoreResponse {
  id: string;
  severity: string;
  riskFactors: string[];
  explanation: string;
}

const BATCH_SIZE = 5; // Clauses per API call to stay within token limits

@Injectable()
export class RiskScoringStep {
  private readonly logger = new Logger(RiskScoringStep.name);

  constructor(private readonly ai: AiClientPort) {}

  async execute(clauses: IdentifiedClause[]): Promise<ScoredClause[]> {
    const batches = batch(clauses, BATCH_SIZE);
    const results = await Promise.allSettled(batches.map((b) => this.scoreClausesBatch(b)));
    return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  }

  /** Score a single batch and map raw AI responses onto ScoredClause objects. */
  async scoreClausesBatch(clauses: IdentifiedClause[]): Promise<ScoredClause[]> {
    try {
      const scores = await this.scoreBatch(clauses);
      const scoredMap = new Map(scores.map((s) => [s.id, s]));
      return clauses.map((clause) => {
        const score = scoredMap.get(clause.id);
        return {
          ...clause,
          severity: score ? normaliseSeverity(score.severity) : RiskSeverity.MEDIUM,
          riskFactors: score?.riskFactors ?? [],
          explanation: score?.explanation ?? 'Risk assessment unavailable for this clause.',
        };
      });
    } catch (err) {
      this.logger.warn(`Scoring batch failed: ${err}`);
      return clauses.map((clause) => ({
        ...clause,
        severity: RiskSeverity.MEDIUM,
        riskFactors: [],
        explanation: 'Risk assessment unavailable for this clause.',
      }));
    }
  }

  private async scoreBatch(
    clauses: IdentifiedClause[],
  ): Promise<ScoreResponse[]> {
    const input = clauses.map((c) => ({
      id: c.id,
      title: c.title,
      type: c.type,
      text: c.text,
    }));

    const prompt = buildRiskScoringPrompt(input);
    const raw = await this.ai.complete(SYSTEM_RISK_SCORER, prompt);
    const parsed = this.ai.parseJsonResponse<ScoreResponse[]>(raw);

    return Array.isArray(parsed) ? parsed : [];
  }
}
