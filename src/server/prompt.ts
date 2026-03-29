import { composePrompt } from '../lib/promptEngine'
import type { PromptRequest, PromptSections } from '../lib/promptEngine'

// Placeholder server/edge handler signature; actual wiring depends on deployment (Vercel / TanStack Start server entry).
export async function generatePromptFromServer(body: PromptRequest): Promise<PromptSections> {
  // Note: Transformers.js now runs on the client; server invocations always use the fallback text path.
  return composePrompt(body)
}

// If you wire to a fetch handler, re-export a default for edge/serverless use:
export default async function handler(request: Request) {
  const payload = (await request.json()) as PromptRequest
  const result = await composePrompt(payload)
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}
