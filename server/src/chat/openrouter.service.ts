import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OpenRouterService {
  private readonly logger = new Logger(OpenRouterService.name);
  private readonly DEFAULT_MODEL = 'nvidia/nemotron-3-nano-30b-a3b:free';
  private readonly FALLBACK_MSG =
    "I'm having trouble reaching GridBot AI right now, but I can still point you in the right direction: ask about paper printing, 3D printing, pricing, delivery, or your order steps here, or start a Human Support chat for urgent help.";

  constructor(private readonly config: ConfigService) {}

  async complete(
    messages: Array<{ role: string; content: string }>,
  ): Promise<string> {
    const model =
      this.config.get<string>('OPENROUTER_MODEL') ?? this.DEFAULT_MODEL;
    try {
      return await this.callOpenRouter(model, messages);
    } catch (primary) {
      this.logger.warn(`Primary model ${model} failed: ${String(primary)}`);
      const fallback = this.config.get<string>('OPENROUTER_FALLBACK_MODEL');
      if (fallback) {
        try {
          return await this.callOpenRouter(fallback, messages);
        } catch (fb) {
          this.logger.error(`Fallback model ${fallback} failed: ${String(fb)}`);
        }
      }
      return this.FALLBACK_MSG;
    }
  }

  private async callOpenRouter(
    model: string,
    messages: Array<{ role: string; content: string }>,
  ): Promise<string> {
    const apiKey = this.config.get<string>('OPENROUTER_API_KEY');
    if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured');
    const baseUrl = this.config.get<string>(
      'OPENROUTER_BASE_URL',
      'https://openrouter.ai/api/v1',
    );

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model, messages }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = json?.choices?.[0]?.message?.content;
      if (!content) throw new Error('Empty response');
      return content;
    } finally {
      clearTimeout(timeout);
    }
  }
}
