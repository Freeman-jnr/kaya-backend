/**
 * @file Minimal SSE (Server-Sent Events) line parser. All three provider
 * APIs stream as `data: {json}\n\n` frames (with a literal `data: [DONE]`
 * or provider-specific terminal event) — this generator yields each raw
 * data payload string; the caller is responsible for JSON.parse-ing it
 * according to that provider's own event shape.
 */

export async function* parseSSE(response: Response): AsyncGenerator<string> {
  const body = response.body;
  if (!body) return;

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      // Keep the last (possibly incomplete) line in the buffer for the next chunk.
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice('data:'.length).trim();
        if (payload === '[DONE]') return;
        if (payload.length > 0) yield payload;
      }
    }
  } finally {
    reader.releaseLock();
  }
}
