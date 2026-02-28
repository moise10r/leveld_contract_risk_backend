import { jsonrepair } from 'jsonrepair';

export function parseJsonResponse<T>(raw: string): T {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\n?/i, '')
    .replace(/\n?```$/i, '')
    .trim();

  // Fast path: valid JSON
  try {
    return JSON.parse(cleaned) as T;
  } catch { /* continue */ }

  // Extract the first JSON structure if there is surrounding text
  const match = cleaned.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  const candidate = match ? match[1] : cleaned;

  // Try jsonrepair (handles unescaped quotes, trailing commas, etc.)
  try {
    return JSON.parse(jsonrepair(candidate)) as T;
  } catch { /* continue */ }

  // Truncated array recovery: keep all complete objects before the cut-off point
  if (candidate.trimStart().startsWith('[')) {
    const lastComplete = candidate.lastIndexOf('},');
    if (lastComplete !== -1) {
      try {
        return JSON.parse(candidate.slice(0, lastComplete + 1) + ']') as T;
      } catch { /* continue */ }
    }
  }

  throw new Error(`Failed to parse JSON response: ${cleaned.slice(0, 200)}`);
}
