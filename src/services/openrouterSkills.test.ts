import { describe, expect, it, vi } from 'vitest'
import {
  appendOpenRouterSkillCalls,
  appendSkillCalls,
  extractKeywordsViaOpenRouter,
  findSkillsForKeywords,
} from './openrouterSkills'

describe('openrouterSkills', () => {
  it('extracts keywords from an OpenRouter JSON response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({ keywords: ['react', 'dashboard', 'oauth'] }),
            },
          },
        ],
      }),
    })

    const keywords = await extractKeywordsViaOpenRouter('user prompt', 'generated prompt', {
      apiKey: 'test-key',
      fetchImpl: fetchMock as any,
    })


    expect(fetchMock).toHaveBeenCalledTimes(1)
    const req = fetchMock.mock.calls[0]?.[1]
    const body = JSON.parse(String(req?.body ?? '{}'))
    expect(body.model).toBe('minimax/minimax-m2.5:free')
    expect(keywords).toEqual(['react', 'dashboard', 'oauth'])
  })

  it('finds and normalizes skill names from skills api payload shapes', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [{ slug: 'Frontend-Design' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([{ name: 'agent-browser' }]),
      })

    const skills = await findSkillsForKeywords(['react', 'browser'], fetchMock as any)

    expect(skills).toEqual(['frontend-design', 'agent-browser'])
  })

  it('appends slash-prefixed skill calls separated by spaces', () => {
    const prompt = appendSkillCalls('Plan goes here', ['frontend-design', 'agent-browser'])
    expect(prompt.endsWith('/frontend-design /agent-browser')).toBe(true)
  })

  it('adds skill calls via OpenRouter keyword extraction + skills search', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({ keywords: ['react'] }),
              },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [{ slug: 'frontend-design' }] }),
      })

    const output = await appendOpenRouterSkillCalls('user', 'generated', {
      apiKey: 'test-key',
      fetchImpl: fetchMock as any,
    })

    expect(output).toContain('/frontend-design')
  })
})
