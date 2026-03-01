import { Injectable, Logger } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { Subject } from 'rxjs';
import { ChunkingStep } from './steps/chunking.step';
import { ClauseIdentificationStep } from './steps/clause-identification.step';
import { IdentifiedClause } from './steps/clause-identification.step';
import { RiskScoringStep } from './steps/risk-scoring.step';
import { RecommendationStep, AnalysedClause } from './steps/recommendation.step';
import { SummaryStep } from './steps/summary.step';
import { ContractAnalysis } from '../../../domain/contract/entities/contract-analysis.entity';
import { RiskClause } from '../../../domain/contract/entities/risk-clause.entity';
import { RiskSeverity } from '../../../domain/contract/value-objects/risk-severity.vo';
import { batch } from '../batch.util';
// Import and re-export from domain to keep infrastructure aligned without circular deps
import { PipelineProgressEvent } from '../../../domain/contract/ports/analysis-repository.port';
export { PipelineProgressEvent };

export interface PipelineInput {
  text: string;
  analysisId: string;
  fileName: string;
}

// Score → recommend a batch of this size, then emit each clause immediately.
// Keeps the two AI calls per batch balanced in token usage.
const STREAMING_BATCH_SIZE = 4;

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
        return this.buildEmptyResult(input, progress$);
      }

      // Steps 3+4: Score and recommend in parallel batches, streaming each finished
      // clause to the client the moment its batch completes.
      emit('scoring', 50, `Assessing risk levels for ${identifiedClauses.length} clauses…`);
      const analysedClauses = await this.scoreThenRecommendStreaming(
        identifiedClauses,
        progress$,
      );

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
      Sentry.captureException(error);
      progress$.next({ event: 'error', stage: 'error', progress: 0, message, error: message });
      progress$.complete();
      throw error;
    }
  }

  /**
   * Splits clauses into batches, then for each batch concurrently:
   *   score → recommend → emit one `clause` SSE event per clause.
   * Batches race in parallel so the fastest arrive on the client first.
   */
  private async scoreThenRecommendStreaming(
    clauses: IdentifiedClause[],
    progress$: Subject<PipelineProgressEvent>,
  ): Promise<AnalysedClause[]> {
    const batches = batch(clauses, STREAMING_BATCH_SIZE);
    const allAnalysed: AnalysedClause[] = [];

    await Promise.allSettled(
      batches.map(async (scoringBatch) => {
        const scored = await this.riskScoringStep.scoreClausesBatch(scoringBatch);
        const analysed = await this.recommendationStep.recommendClausesBatch(scored);

        for (const clause of analysed) {
          allAnalysed.push(clause);
          progress$.next({
            event: 'clause',
            stage: 'scoring',
            progress: 50,
            message: clause.title,
            clause: {
              id: clause.id,
              title: clause.title,
              type: clause.type,
              text: clause.text,
              location: clause.location,
              severity: clause.severity,
              riskFactors: clause.riskFactors,
              explanation: clause.explanation,
              recommendation: clause.recommendation,
            },
          });
        }
      }),
    );

    return allAnalysed;
  }

  private buildEmptyResult(
    input: PipelineInput,
    progress$: Subject<PipelineProgressEvent>,
  ): ContractAnalysis {
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

    progress$.next({ event: 'complete', stage: 'complete', progress: 100, message: 'Analysis complete', data: result });
    progress$.complete();

    return result;
  }
}
