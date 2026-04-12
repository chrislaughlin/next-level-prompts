import { afterEach, describe, expect, it, vi } from 'vitest'
import { generatePromptWithSkills } from './openrouter'

const payload = {
  seed: 'Fix a slow React server function that times out during prompt generation',
  keywords: ['react', 'serverless'],
  buildMode: 'bug' as const,
  buildApproach: 'one-shot' as const,
  codebaseContext: 'Inspect the prompt generation route and any server function timeouts.',
  constraints: ['Keep the UI responsive while refinement happens in the background.'],
  verification: ['npm test'],
  nonGoals: ['Do not redesign the wizard UI.'],
}

describe('generatePromptWithSkills', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('makes a single OpenRouter call and appends deterministic skills', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: 'Refined coding-agent prompt',
            },
          },
        ],
      }),
    } as Response)

    const result = await generatePromptWithSkills(payload, {
      apiKey: 'test-key',
      fetchFn,
      timeoutMs: 50,
    })

    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(result.prompt).toContain('Refined coding-agent prompt')
    expect(result.prompt).toContain('/react-best-practices')
    expect(result.skillNames).toContain('vercel-functions')
  })

  it('returns the local fallback prompt when no API key is configured', async () => {
    const fetchFn = vi.fn()

    const result = await generatePromptWithSkills(payload, {
      apiKey: '',
      fetchFn,
    })

    expect(fetchFn).not.toHaveBeenCalled()
    expect(result.prompt).toContain('Mission')
    expect(result.prompt).toContain('/react-best-practices')
    expect(result.skillNames).toContain('vercel-functions')
  })

  it('returns the local fallback prompt when the OpenRouter request times out', async () => {
    vi.useFakeTimers()

    const fetchFn = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new Error('aborted'))
        })
      })
    })

    const promise = generatePromptWithSkills(payload, {
      apiKey: 'test-key',
      fetchFn,
      timeoutMs: 10,
    })

    await vi.advanceTimersByTimeAsync(10)
    const result = await promise

    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(result.prompt).toContain('Mission')
    expect(result.prompt).toContain('/react-best-practices')
    expect(result.skillNames).toContain('vercel-functions')
  })
})
