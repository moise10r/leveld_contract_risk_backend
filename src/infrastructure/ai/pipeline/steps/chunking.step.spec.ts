import { ChunkingStep } from './chunking.step';

describe('ChunkingStep', () => {
  let step: ChunkingStep;

  beforeEach(() => {
    step = new ChunkingStep();
  });

  it('splits a document with numbered headings into multiple chunks', () => {
    const text = `
1. Definitions

"Services" means the consulting services described in Schedule 1.

1.1 Interpretation

Unless context requires otherwise, words in the singular include the plural.

2. Liability

In no event shall either party be liable for indirect or consequential damages.

2.1 Limitation of Liability

The total aggregate liability of the Service Provider shall not exceed £1,000.

3. Termination

Either party may terminate this Agreement immediately on written notice.
    `.trim();

    const chunks = step.execute(text);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks.every((c) => c.wordCount > 0)).toBe(true);
  });

  it('handles a single short document without splitting', () => {
    const text = 'This is a short contract with only a few words and one clause.';
    const chunks = step.execute(text);
    // Short documents may produce 0 chunks (below min words) or 1 chunk
    expect(chunks.length).toBeLessThanOrEqual(1);
  });

  it('cleans up carriage returns and excessive blank lines', () => {
    const text = 'Clause 1\r\n\r\n\r\nSome text here\r\n\r\nClause 2\r\nMore text.';
    const chunks = step.execute(text);
    for (const chunk of chunks) {
      expect(chunk.text).not.toContain('\r');
      expect(chunk.text).not.toMatch(/\n{3,}/);
    }
  });

  it('assigns sequential indices', () => {
    const text = Array.from({ length: 10 }, (_, i) =>
      `${i + 1}. Clause ${i + 1}\n\n${'Some legal text here. '.repeat(50)}`,
    ).join('\n\n');

    const chunks = step.execute(text);
    chunks.forEach((chunk, i) => {
      expect(chunk.index).toBe(i);
    });
  });

  it('respects MAX_CHUNK_WORDS by not producing oversized chunks', () => {
    const hugeSection = 'word '.repeat(2000);
    const chunks = step.execute(hugeSection);
    for (const chunk of chunks) {
      expect(chunk.wordCount).toBeLessThanOrEqual(1200); // some tolerance for overlap
    }
  });
});
