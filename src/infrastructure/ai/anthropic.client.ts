import Anthropic from '@anthropic-ai/sdk';
import { Logger } from '@nestjs/common';
import { AiClientPort } from './ai-client.port';
import { parseJsonResponse } from './json-parser.util';

export class AnthropicClient extends AiClientPort {
  private readonly client: Anthropic;
  private readonly logger = new Logger(AnthropicClient.name);
  private readonly model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';
  private readonly maxRetries = 2;

  constructor() {
    super();
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async complete(systemPrompt: string, userPrompt: string): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.client.messages.create({
          model: this.model,
          max_tokens: 8192,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        });

        const content = response.content[0];
        if (content.type !== 'text') {
          throw new Error('Unexpected response type from Anthropic');
        }

        return content.text;
      } catch (error) {
        lastError = error as Error;
        if (!this.isRetryable(error) || attempt >= this.maxRetries) break;
        this.logger.warn(`Anthropic call attempt ${attempt + 1} failed, retrying...`);
        await new Promise((res) => setTimeout(res, 1000 * (attempt + 1)));
      }
    }

    throw lastError ?? new Error('Anthropic API call failed after retries');
  }

  parseJsonResponse<T>(raw: string): T {
    return parseJsonResponse<T>(raw);
  }

  private isRetryable(error: unknown): boolean {
    if (error instanceof Anthropic.APIError) {
      // 429 rate limit and 5xx server errors are transient — safe to retry
      // 400/401/403/422 are permanent failures — retrying won't help
      return error.status === 429 || error.status >= 500;
    }
    // Retry on network-level errors (no status code)
    return true;
  }
}
