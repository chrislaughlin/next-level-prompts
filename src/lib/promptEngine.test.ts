import { describe, expect, it } from 'vitest'
import { composePrompt } from './promptEngine'

describe('composePrompt', () => {
  it('generates structured sections', async () => {
    const res = await composePrompt({
      seed: 'Build a feature flag dashboard in React',
      keywords: ['react', 'flags'],
      multiPhasePreference: 'ask',
    })

    expect(res.starter.toLowerCase()).toContain('objective:')
    expect(res.questions.length).toBeLessThanOrEqual(2)
    expect(res.fullPrompt).toContain('Objective:')
    expect(res.fullPrompt).toContain('Skills')
    expect(res.fullPrompt).not.toContain('grill-me')
  })

  it('falls back when seed is empty-ish', async () => {
    const res = await composePrompt({ seed: '   ', multiPhasePreference: 'skip' })
    expect(res.fullPrompt.length).toBeGreaterThan(10)
  })
})
