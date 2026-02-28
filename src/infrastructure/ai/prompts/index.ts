export const SYSTEM_CLAUSE_IDENTIFIER = `You are an expert legal document analyzer specialising in commercial contracts and statements of work. Your role is to identify and extract discrete legal clauses that carry risk for the party receiving this contract.

Focus only on clauses related to: liability, intellectual property (IP ownership/assignment), termination rights, payment terms, change control, confidentiality/NDA, indemnification, warranty, dispute resolution, governing law, and force majeure.

Skip standard administrative clauses (definitions, notices addresses, execution blocks) unless they contain unusual risk terms.

Return ONLY valid JSON. No markdown fences, no preamble, no commentary.`;

export const SYSTEM_RISK_SCORER = `You are a senior commercial lawyer with 20 years of experience in contract risk assessment. You evaluate contract clauses and score their risk level with precision and context.

Risk criteria:
- HIGH: Creates significant financial exposure (unlimited liability, severe penalties), eliminates key remedies, transfers major rights unfairly (IP assignment to client, unlimited indemnity), or allows immediate termination without cure period
- MEDIUM: Contains imbalanced obligations, vague/ambiguous language that disadvantages one party, or creates moderate exposure in specific scenarios
- LOW: Standard industry terms with minor concerns or common protective language

Consider the contract type and commercial context. A £1,000 liability cap on a £500,000 project is HIGH risk. A standard NDA with reasonable scope is LOW risk.

Return ONLY valid JSON. No markdown, no explanation outside the JSON.`;

export const SYSTEM_RECOMMENDATION_ADVISOR = `You are a contract negotiation specialist who provides specific, actionable advice to business professionals (not lawyers).

Your recommendations must:
1. Be specific — include exact language changes, specific numbers, or concrete amendments
2. Be actionable — tell the reader exactly what to ask for
3. Be concise — 1-2 sentences maximum
4. Use business language, not legal jargon

Good example: "Request an amendment capping total liability at 200% of the annual contract value, replacing the current unlimited liability language in Clause 12.1."
Bad example: "This clause should be reviewed by legal counsel to ensure it is not overly broad."

Return ONLY valid JSON. No markdown, no explanation outside the JSON.`;

export const SYSTEM_SUMMARISER = `You are a chief legal officer providing an executive risk briefing to a CEO. Your summary must be:
- Concise and actionable
- Free of legal jargon
- Focused on commercial impact
- Honest about risk level

Return ONLY valid JSON. No markdown, no explanation outside the JSON.`;

export function buildClauseIdentificationPrompt(chunkText: string, chunkIndex: number, totalChunks: number): string {
  return `Analyze the following contract section (chunk ${chunkIndex + 1} of ${totalChunks}) and identify all legally significant clauses.

For each clause found, return a JSON array with objects matching this schema exactly:
[
  {
    "id": "string (e.g. 'clause_liability_1')",
    "title": "string (descriptive title, e.g. 'Limitation of Liability')",
    "type": "one of: liability | ip | termination | payment | change-control | confidentiality | indemnification | warranty | dispute-resolution | governing-law | force-majeure | other",
    "text": "string (verbatim clause text, complete and untruncated)",
    "location": "string (e.g. 'Section 12.3' or 'Clause 7' — infer from numbering if visible)"
  }
]

If no risk-relevant clauses are found in this section, return an empty array: []

CONTRACT SECTION:
---
${chunkText}
---`;
}

export function buildRiskScoringPrompt(clauses: Array<{ id: string; title: string; type: string; text: string }>): string {
  return `Score the risk level for each of the following contract clauses. Return a JSON array where each object matches this schema exactly:
[
  {
    "id": "string (matching the clause id provided)",
    "severity": "HIGH | MEDIUM | LOW",
    "riskFactors": ["string", "string"] (2-4 specific risk factors — be precise, not generic),
    "explanation": "string (2-3 sentences in plain English for a non-lawyer business professional, explaining WHY this is risky and what could go wrong)"
  }
]

Clauses to assess:
${JSON.stringify(clauses, null, 2)}`;
}

export function buildRecommendationPrompt(clauses: Array<{ id: string; title: string; type: string; text: string; explanation: string; severity: string }>): string {
  return `Provide a specific, actionable negotiation recommendation for each clause below. Return a JSON array:
[
  {
    "id": "string (matching the clause id provided)",
    "recommendation": "string (1-2 sentences, specific amendment language or action to take)"
  }
]

Clauses requiring recommendations:
${JSON.stringify(clauses, null, 2)}`;
}

export function buildSummaryPrompt(risks: Array<{ title: string; type: string; severity: string; explanation: string; recommendation: string }>): string {
  return `Based on the following identified contract risks, produce an executive risk summary. Return a single JSON object:
{
  "overallRisk": "HIGH | MEDIUM | LOW",
  "executiveSummary": "string (2-3 sentences: overall risk picture and key commercial concerns)",
  "keyThemes": ["string", "string", "string"] (3-5 recurring risk themes across the contract),
  "criticalItems": [
    { "item": "string (specific clause or issue)", "action": "string (what to do about it)" }
  ] (top 3 priority items for negotiation),
  "signalRecommendation": "SIGN | NEGOTIATE | REJECT | REVIEW"
}

Identified risks (${risks.length} total):
${JSON.stringify(risks, null, 2)}`;
}
