export abstract class AiClientPort {
  abstract complete(systemPrompt: string, userPrompt: string): Promise<string>;
  abstract parseJsonResponse<T>(raw: string): T;
}
