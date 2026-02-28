import { Injectable } from '@nestjs/common';
import { AnthropicClient } from '../../anthropic.client';
import { SYSTEM_SUMMARISER, buildSummaryPrompt } from '../../prompts';
import { AnalysedClause } from './recommendation.step';
import { ContractSummary, SignalRecommendation } from '../../../../domain/contract/entities/contract-analysis.entity';
import { RiskSeverity, computeOverallSeverity } from '../../../../domain/contract/value-objects/risk-severity.vo';

interface SummaryResponse {
  overallRisk: string;
  executiveSummary: string;
  keyThemes: string[];
  criticalItems: Array<{ item: string; action: string }>;
  signalRecommendation: string;
}

@Injectable()
export class SummaryStep {
  constructor(private readonly ai: AnthropicClient) {}

  async execute(clauses: AnalysedClause[]): Promise<ContractSummary> {
    if (clauses.length === 0) {
      return this.fallbackSummary();
    }

    const riskInput = clauses.map((c) => ({
      title: c.title,
      type: c.type,
      severity: c.severity,
      explanation: c.explanation,
      recommendation: c.recommendation,
    }));

    const prompt = buildSummaryPrompt(riskInput);
    const raw = await this.ai.complete(SYSTEM_SUMMARISER, prompt);
    const parsed = this.ai.parseJsonResponse<SummaryResponse>(raw);

    return {
      overallRisk: this.normaliseSeverity(parsed.overallRisk),
      executiveSummary: parsed.executiveSummary ?? '',
      keyThemes: Array.isArray(parsed.keyThemes) ? parsed.keyThemes : [],
      criticalItems: Array.isArray(parsed.criticalItems) ? parsed.criticalItems : [],
      signalRecommendation: this.normaliseSignal(parsed.signalRecommendation),
    };
  }

  private fallbackSummary(): ContractSummary {
    return {
      overallRisk: RiskSeverity.LOW,
      executiveSummary: 'No significant risk clauses were identified in this document.',
      keyThemes: [],
      criticalItems: [],
      signalRecommendation: 'REVIEW',
    };
  }

  private normaliseSignal(raw: string): SignalRecommendation {
    const upper = (raw ?? '').toUpperCase();
    if (['SIGN', 'NEGOTIATE', 'REJECT', 'REVIEW'].includes(upper)) {
      return upper as SignalRecommendation;
    }
    return 'REVIEW';
  }

  private normaliseSeverity(raw: string): RiskSeverity {
    const upper = (raw ?? '').toUpperCase();
    if (upper === RiskSeverity.HIGH) return RiskSeverity.HIGH;
    if (upper === RiskSeverity.MEDIUM) return RiskSeverity.MEDIUM;
    return RiskSeverity.LOW;
  }
}
