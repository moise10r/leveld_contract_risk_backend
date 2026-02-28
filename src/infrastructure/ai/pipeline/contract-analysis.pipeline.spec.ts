import { Subject } from 'rxjs';
import { ContractAnalysisPipeline, PipelineProgressEvent } from './contract-analysis.pipeline';
import { ChunkingStep } from './steps/chunking.step';
import { ClauseIdentificationStep } from './steps/clause-identification.step';
import { RiskScoringStep } from './steps/risk-scoring.step';
import { RecommendationStep } from './steps/recommendation.step';
import { SummaryStep } from './steps/summary.step';
import { RiskSeverity } from '../../../domain/contract/value-objects/risk-severity.vo';
import { ClauseType } from '../../../domain/contract/value-objects/clause-type.vo';

const mockClause = {
  id: 'clause_1',
  title: 'Limitation of Liability',
  type: ClauseType.LIABILITY,
  text: 'Liability is capped at £1,000.',
  location: 'Section 12',
};

const mockScoredClause = {
  ...mockClause,
  severity: RiskSeverity.HIGH,
  riskFactors: ['Low cap', 'Imbalanced'],
  explanation: 'The cap is too low.',
};

const mockAnalysedClause = {
  ...mockScoredClause,
  recommendation: 'Negotiate a higher cap.',
};

describe('ContractAnalysisPipeline', () => {
  let pipeline: ContractAnalysisPipeline;
  let chunkingStep: jest.Mocked<ChunkingStep>;
  let clauseIdentificationStep: jest.Mocked<ClauseIdentificationStep>;
  let riskScoringStep: jest.Mocked<RiskScoringStep>;
  let recommendationStep: jest.Mocked<RecommendationStep>;
  let summaryStep: jest.Mocked<SummaryStep>;

  beforeEach(() => {
    chunkingStep = { execute: jest.fn() } as any;
    clauseIdentificationStep = { execute: jest.fn() } as any;
    riskScoringStep = { execute: jest.fn() } as any;
    recommendationStep = { execute: jest.fn() } as any;
    summaryStep = { execute: jest.fn() } as any;

    pipeline = new ContractAnalysisPipeline(
      chunkingStep,
      clauseIdentificationStep,
      riskScoringStep,
      recommendationStep,
      summaryStep,
    );
  });

  it('runs the full pipeline and returns a complete analysis', async () => {
    chunkingStep.execute.mockReturnValue([{ index: 0, text: 'chunk text', wordCount: 2 }]);
    clauseIdentificationStep.execute.mockResolvedValue([mockClause]);
    riskScoringStep.execute.mockResolvedValue([mockScoredClause]);
    recommendationStep.execute.mockResolvedValue([mockAnalysedClause]);
    summaryStep.execute.mockResolvedValue({
      overallRisk: RiskSeverity.HIGH,
      executiveSummary: 'High risk contract.',
      keyThemes: ['liability'],
      criticalItems: [{ item: 'Liability cap', action: 'Negotiate' }],
      signalRecommendation: 'NEGOTIATE',
    });

    const subject = new Subject<PipelineProgressEvent>();
    const events: PipelineProgressEvent[] = [];
    subject.subscribe((e) => events.push(e));

    const result = await pipeline.run(
      { text: 'contract text', analysisId: 'test-id', fileName: 'test.pdf' },
      subject,
    );

    expect(result.status).toBe('complete');
    expect(result.clauses).toHaveLength(1);
    expect(result.summary?.overallRisk).toBe(RiskSeverity.HIGH);
    expect(events.some((e) => e.event === 'complete')).toBe(true);
  });

  it('returns empty result when no clauses are identified', async () => {
    chunkingStep.execute.mockReturnValue([{ index: 0, text: 'text', wordCount: 1 }]);
    clauseIdentificationStep.execute.mockResolvedValue([]);

    const subject = new Subject<PipelineProgressEvent>();
    const result = await pipeline.run(
      { text: 'text', analysisId: 'id2', fileName: 'empty.pdf' },
      subject,
    );

    expect(result.clauses).toHaveLength(0);
    expect(result.status).toBe('complete');
    expect(riskScoringStep.execute).not.toHaveBeenCalled();
  });

  it('emits progress events in order', async () => {
    chunkingStep.execute.mockReturnValue([{ index: 0, text: 'text', wordCount: 1 }]);
    clauseIdentificationStep.execute.mockResolvedValue([mockClause]);
    riskScoringStep.execute.mockResolvedValue([mockScoredClause]);
    recommendationStep.execute.mockResolvedValue([mockAnalysedClause]);
    summaryStep.execute.mockResolvedValue({
      overallRisk: RiskSeverity.MEDIUM,
      executiveSummary: '',
      keyThemes: [],
      criticalItems: [],
      signalRecommendation: 'REVIEW',
    });

    const subject = new Subject<PipelineProgressEvent>();
    const progressValues: number[] = [];
    subject.subscribe((e) => progressValues.push(e.progress));

    await pipeline.run({ text: 'text', analysisId: 'id3', fileName: 'f.pdf' }, subject);

    // Progress should be non-decreasing
    for (let i = 1; i < progressValues.length; i++) {
      expect(progressValues[i]).toBeGreaterThanOrEqual(progressValues[i - 1]);
    }
    // Final progress must be 100
    expect(progressValues[progressValues.length - 1]).toBe(100);
  });
});
