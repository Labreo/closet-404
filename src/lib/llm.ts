export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatOptions {
  messages: ChatMessage[];
  json?: boolean;
  stream?: boolean;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  /** Called with the model that actually answered (primary or LLM_FALLBACK_MODEL). */
  onModel?: (model: string) => void;
  /** Streaming only: enqueued once per hidden reasoning chunk, so clients can show the model is working. */
  thinkingMarker?: string;
}

export type LLMErrorCode =
  | 'CONFIG_ERROR'
  | 'TIMEOUT'
  | 'HTTP_ERROR'
  | 'NETWORK_ERROR'
  | 'PARSE_ERROR'
  | 'EMPTY_RESPONSE';

export class LLMError extends Error {
  readonly code: LLMErrorCode;
  readonly status?: number;

  constructor(message: string, code: LLMErrorCode, status?: number) {
    super(message);
    this.name = 'LLMError';
    this.code = code;
    this.status = status;
  }
}

interface CompletionChoiceDelta {
  content?: string | null;
  reasoning?: string | null;
  reasoning_content?: string | null;
  extra_content?: {
    google?: {
      thought?: boolean;
    };
  };
}

interface CompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
    delta?: CompletionChoiceDelta;
  }>;
}

export async function chat(
  options: ChatOptions & { stream: true }
): Promise<ReadableStream<string>>;
export async function chat(
  options: ChatOptions & { stream?: false | undefined }
): Promise<string>;
export async function chat(
  options: ChatOptions
): Promise<string | ReadableStream<string>>;
export async function chat({
  messages,
  json,
  stream,
  maxTokens,
  temperature,
  timeoutMs = 60_000,
  onModel,
  thinkingMarker,
}: ChatOptions): Promise<string | ReadableStream<string>> {
  const rawBaseUrl = process.env.LLM_BASE_URL?.trim();
  const apiKey = process.env.LLM_API_KEY?.trim();
  const model = process.env.LLM_MODEL?.trim();
  // Optional second open-weight model tried when the primary returns 429/5xx.
  const fallbackModel = process.env.LLM_FALLBACK_MODEL?.trim();

  if (!rawBaseUrl || !apiKey || !model) {
    throw new LLMError(
      'Missing required environment variables: LLM_BASE_URL, LLM_MODEL, or LLM_API_KEY',
      'CONFIG_ERROR'
    );
  }

  const baseUrl = rawBaseUrl.replace(/\/+$/, '');
  const endpoint = `${baseUrl}/chat/completions`;
  const isLocal =
    baseUrl.includes('127.0.0.1') || baseUrl.includes('localhost');
  const isGoogleHosted = baseUrl.includes('generativelanguage.googleapis.com');

  const payload: Record<string, unknown> = {
    model,
    messages,
    stream: Boolean(stream),
  };

  if (maxTokens !== undefined) {
    payload.max_tokens = isGoogleHosted ? maxTokens + 4096 : maxTokens;
  }

  if (temperature !== undefined) {
    payload.temperature = temperature;
  }

  if (json) {
    payload.response_format = { type: 'json_object' };
  }

  if (isLocal) {
    payload.reasoning_effort = 'none';
  }

  const stripReasoning = (raw: string): string => {
    let cleaned = raw
      .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/<\|thought>[\s\S]*?<thought\|>/gi, '')
      .replace(/^[\s\S]*?<\/thought>/i, '')
      .replace(/^[\s\S]*?<\/think>/i, '')
      .replace(/<thought>[\s\S]*$/i, '')
      .replace(/<think>[\s\S]*$/i, '')
      .trim();

    if (json) {
      cleaned = cleaned
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
    }

    return cleaned;
  };

  let lastError: LLMError | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const isRetryableStatus =
        response.status === 429 ||
        (response.status >= 500 && response.status <= 599);

      if (!response.ok) {
        clearTimeout(timeoutId);
        const errorText = await response.text().catch(() => '');
        const httpError = new LLMError(
          `LLM HTTP ${response.status}: ${errorText.slice(0, 300)}`,
          'HTTP_ERROR',
          response.status
        );

        if (isRetryableStatus && attempt === 0) {
          lastError = httpError;
          if (fallbackModel && fallbackModel !== payload.model) {
            payload.model = fallbackModel;
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }

        throw httpError;
      }

      onModel?.(String(payload.model));

      if (stream) {
        if (!response.body) {
          clearTimeout(timeoutId);
          throw new LLMError('Response body is empty', 'EMPTY_RESPONSE');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let sseBuffer = '';
        let tagBuffer = '';
        let inThinkingBlock = false;
        let hasEmittedNonWhitespace = false;

        return new ReadableStream<string>({
          async pull(streamController) {
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) {
                  clearTimeout(timeoutId);
                  if (!inThinkingBlock && tagBuffer) {
                    const remaining = stripReasoning(tagBuffer);
                    if (remaining) {
                      streamController.enqueue(remaining);
                    }
                  }
                  streamController.close();
                  return;
                }

                sseBuffer += decoder.decode(value, { stream: true });
                const lines = sseBuffer.split('\n');
                sseBuffer = lines.pop() ?? '';

                for (const rawLine of lines) {
                  const line = rawLine.trim();
                  if (!line.startsWith('data:')) continue;
                  const dataStr = line.slice(5).trim();
                  if (!dataStr || dataStr === '[DONE]') continue;

                  let parsed: CompletionResponse;
                  try {
                    parsed = JSON.parse(dataStr) as CompletionResponse;
                  } catch {
                    continue;
                  }

                  const delta = parsed.choices?.[0]?.delta;
                  if (!delta) continue;

                  const content = delta.content ?? '';
                  if (!content) continue;
                  if (thinkingMarker && (inThinkingBlock || delta.extra_content?.google?.thought)) {
                    streamController.enqueue(thinkingMarker);
                  }

                  tagBuffer += content;

                  while (tagBuffer.length > 0) {
                    if (inThinkingBlock) {
                      const closeMatch =
                        tagBuffer.match(/<\/thought>|<\/think>|<thought\|>/i);
                      if (closeMatch && closeMatch.index !== undefined) {
                        tagBuffer = tagBuffer.slice(
                          closeMatch.index + closeMatch[0].length
                        );
                        inThinkingBlock = false;
                      } else {
                        if (tagBuffer.length > 32) {
                          tagBuffer = tagBuffer.slice(-32);
                        }
                        break;
                      }
                    } else {
                      const openMatch =
                        tagBuffer.match(/<thought>|<think>|<\|thought>/i);
                      if (openMatch && openMatch.index !== undefined) {
                        const before = tagBuffer.slice(0, openMatch.index);
                        if (before) {
                          const out = hasEmittedNonWhitespace
                            ? before
                            : before.trimStart();
                          if (out) {
                            hasEmittedNonWhitespace = true;
                            streamController.enqueue(out);
                          }
                        }
                        tagBuffer = tagBuffer.slice(
                          openMatch.index + openMatch[0].length
                        );
                        inThinkingBlock = true;
                      } else if (delta.extra_content?.google?.thought) {
                        tagBuffer = '';
                        break;
                      } else {
                        const partialTagMatch = tagBuffer.match(/<[^>]*$/);
                        if (partialTagMatch && partialTagMatch.index !== undefined) {
                          const safePart = tagBuffer.slice(
                            0,
                            partialTagMatch.index
                          );
                          tagBuffer = tagBuffer.slice(partialTagMatch.index);
                          if (safePart) {
                            const out = hasEmittedNonWhitespace
                              ? safePart
                              : safePart.trimStart();
                            if (out) {
                              hasEmittedNonWhitespace = true;
                              streamController.enqueue(out);
                            }
                          }
                        } else {
                          const out = hasEmittedNonWhitespace
                            ? tagBuffer
                            : tagBuffer.trimStart();
                          tagBuffer = '';
                          if (out) {
                            hasEmittedNonWhitespace = true;
                            streamController.enqueue(out);
                          }
                        }
                        break;
                      }
                    }
                  }
                }
              }
            } catch (err) {
              clearTimeout(timeoutId);
              if (err instanceof Error && err.name === 'AbortError') {
                streamController.error(
                  new LLMError(`LLM stream timed out after ${timeoutMs}ms`, 'TIMEOUT')
                );
              } else {
                streamController.error(
                  err instanceof LLMError
                    ? err
                    : new LLMError(
                        err instanceof Error ? err.message : 'Stream read error',
                        'NETWORK_ERROR'
                      )
                );
              }
            }
          },
          cancel() {
            clearTimeout(timeoutId);
            void reader.cancel();
          },
        });
      }

      let data: CompletionResponse;
      try {
        data = (await response.json()) as CompletionResponse;
      } catch {
        clearTimeout(timeoutId);
        throw new LLMError('Failed to parse LLM JSON response', 'PARSE_ERROR');
      } finally {
        clearTimeout(timeoutId);
      }

      const rawContent = data.choices?.[0]?.message?.content;
      if (typeof rawContent !== 'string') {
        throw new LLMError('LLM returned empty content', 'EMPTY_RESPONSE');
      }

      const finalAnswer = stripReasoning(rawContent);
      if (!finalAnswer) {
        throw new LLMError(
          'LLM returned empty content after stripping reasoning',
          'EMPTY_RESPONSE'
        );
      }

      return finalAnswer;
    } catch (err) {
      clearTimeout(timeoutId);

      if (err instanceof LLMError) {
        throw err;
      }

      if (err instanceof Error && err.name === 'AbortError') {
        throw new LLMError(`LLM request timed out after ${timeoutMs}ms`, 'TIMEOUT');
      }

      throw new LLMError(
        err instanceof Error ? err.message : 'Network request failed',
        'NETWORK_ERROR'
      );
    }
  }

  throw (
    lastError ??
    new LLMError('LLM request failed after retry', 'NETWORK_ERROR')
  );
}

