import { Injectable, Logger } from '@nestjs/common';
import { Subject } from 'rxjs';
import { ChunkingStep } from './steps/chunking.step';
import { ClauseIdentificationStep } from './steps/clause-identification.step';
import { RiskScoringStep } from './steps/risk-scoring.step';
import { RecommendationStep } from './steps/recommendation.step';
import { SummaryStep } from './steps/summary.step';
import { ContractAnalysis } from '../../../domain/contract/entities/contract-analysis.entity';
import { RiskClause } from '../../../domain/contract/entities/risk-clause.entity';
import { RiskSeverity } from '../../../domain/contract/value-objects/risk-severity.vo';
// Import and re-export from domain to keep infrastructure aligned without circular deps
import { PipelineProgressEvent } from '../../../domain/contract/ports/analysis-repository.port';
export { PipelineProgressEvent };

export interface PipelineInput {
  text: string;
  analysisId: string;
  fileName: string;
}

@Injectable()
export class ContractAnalysisPipeline {
  private readonly logger = new Logger(ContractAnalysisPipeline.name);

  constructor(
    private readonly chunkingStep: ChunkingStep,
    private readonly clauseIdentificationStep: ClauseIdentificationStep,
    private readonly riskScoringStep: RiskScoringStep,
    private readonly recommendationStep: RecommendationStep,
    private readonly summaryStep: SummaryStep,
  ) {}

  async run(
    input: PipelineInput,
    progress$: Subject<PipelineProgressEvent>,
  ): Promise<ContractAnalysis> {
    const emit = (stage: string, pct: number, message: string) => {
      progress$.next({ event: 'progress', stage, progress: pct, message });
    };

    try {
      // Step 1: Chunk the document
      emit('chunking', 10, 'Identifying clause boundaries…');
      const chunks = this.chunkingStep.execute(input.text);
      this.logger.log(`Document split into ${chunks.length} chunks`);

      // Step 2: Identify clauses across all chunks
      emit('identifying', 25, `Classifying clauses across ${chunks.length} sections…`);
      const identifiedClauses = await this.clauseIdentificationStep.execute(chunks);
      this.logger.log(`Identified ${identifiedClauses.length} clauses`);

      if (identifiedClauses.length === 0) {
        return this.buildEmptyResult(input);
      }

      // Step 3: Score risk for each clause
      emit('scoring', 50, `Assessing risk levels for ${identifiedClauses.length} clauses…`);
      const scoredClauses = await this.riskScoringStep.execute(identifiedClauses);

      // Step 4: Generate recommendations
      emit('recommending', 70, 'Generating negotiation recommendations…');
      const analysedClauses = await this.recommendationStep.execute(scoredClauses);

      // Step 5: Generate overall summary
      emit('summarising', 88, 'Creating executive risk summary…');
      const summary = await this.summaryStep.execute(analysedClauses);

      const result: ContractAnalysis = {
        id: input.analysisId,
        status: 'complete',
        fileName: input.fileName,
        createdAt: new Date(),
        completedAt: new Date(),
        clauses: analysedClauses.map((c): RiskClause => ({
          id: c.id,
          title: c.title,
          type: c.type,
          text: c.text,
          location: c.location,
          severity: c.severity,
          riskFactors: c.riskFactors,
          explanation: c.explanation,
          recommendation: c.recommendation,
        })),
        summary,
      };

      emit('complete', 100, 'Analysis complete');
      progress$.next({ event: 'complete', stage: 'complete', progress: 100, message: 'Analysis complete', data: result });
      progress$.complete();

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown pipeline error';
      this.logger.error(`Pipeline failed: ${message}`);
      progress$.next({ event: 'error', stage: 'error', progress: 0, message, error: message });
      progress$.complete();
      throw error;
    }
  }

  private buildEmptyResult(input: PipelineInput): ContractAnalysis {
    const result: ContractAnalysis = {
      id: input.analysisId,
      status: 'complete',
      fileName: input.fileName,
      createdAt: new Date(),
      completedAt: new Date(),
      clauses: [],
      summary: {
        overallRisk: RiskSeverity.LOW,
        executiveSummary: 'No significant risk clauses were identified. This document may be a summary or contain no substantive legal terms requiring risk assessment.',
        keyThemes: [],
        criticalItems: [],
        signalRecommendation: 'REVIEW',
      },
    };

    return result;
  }
}
