import { Provider, Logger } from '@nestjs/common';
import { AiClientPort } from './ai-client.port';
import { AnthropicClient } from './anthropic.client';

export const aiClientProvider: Provider = {
  provide: AiClientPort,
  useFactory: (): AiClientPort => {
    const logger = new Logger('AiClientFactory');
    const provider = (process.env.AI_PROVIDER ?? 'anthropic').toLowerCase();

    switch (provider) {
      case 'anthropic':
      default:
        logger.log('AI provider: Anthropic');
        return new AnthropicClient();
    }
  },
};
