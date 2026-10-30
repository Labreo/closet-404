import { chat } from '../src/lib/llm';

async function main(): Promise<void> {
  const model = process.env.LLM_MODEL ?? 'unknown';
  const start = performance.now();

  const reply = await chat({
    messages: [{ role: 'user', content: 'say hi in 5 words' }],
  });

  const latencyMs = Math.round(performance.now() - start);

  console.log(`model: ${model}`);
  console.log(`latency: ${latencyMs}ms`);
  console.log(`reply: ${reply}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

