import { describe, expect, it } from 'vitest'
import { composePrompt } from './promptEngine'

describe('composePrompt', () => {
  it('generates structured sections', async () => {
    const res = await composePrompt({
      seed: 'Build a feature flag dashboard in React',
      keywords: ['react', 'flags'],
      multiPhasePreference: 'ask',
    })

    expect(res.copyPrompt).toContain('Mission')
    expect(res.copyPrompt).toContain('Expected output')
    expect(res.copyPrompt).toContain('Suggested skills/patterns')
    expect(res.fullPrompt).toBe(res.copyPrompt)
    expect(res.skills.length).toBeGreaterThan(0)
  })

  it('falls back when seed is empty-ish', async () => {
    const res = await composePrompt({ seed: '   ', multiPhasePreference: 'skip' })
    expect(res.fullPrompt.length).toBeGreaterThan(10)
  })

  it('treats app planning prompts as product work instead of design by substring accident', async () => {
    const res = await composePrompt({
      seed: 'Build a todo app',
      multiPhasePreference: 'ask',
    })

    expect(res.archetype).toBe('greenfield')
    expect(res.copyPrompt).toContain('minimal, shippable implementation plan')
    expect(res.copyPrompt).not.toContain('design artifact')
    expect(res.copyPrompt).not.toContain('accessibility targets are required')
  })

  it('treats dark mode changes as implementation work', async () => {
    const res = await composePrompt({
      seed: 'Add dark mode to a dashboard',
      multiPhasePreference: 'ask',
    })

    expect(res.archetype).toBe('feature')
    expect(res.copyPrompt).toContain('plan to implement Add dark mode to a dashboard')
    expect(res.copyPrompt).toContain('Return a plan before editing files')
  })

  it('treats existing-app feature prompts as feature work instead of greenfield work', async () => {
    const res = await composePrompt({
      seed: 'Add search to an existing app',
      multiPhasePreference: 'ask',
    })

    expect(res.archetype).toBe('feature')
    expect(res.copyPrompt).toContain('plan to implement Add search to an existing app')
    expect(res.copyPrompt).not.toContain('minimal, shippable implementation plan')
  })

  it('treats bugfix prompts as bugfix work with verification language', async () => {
    const res = await composePrompt({
      seed: 'Fix a login bug in a React app',
      keywords: ['react', 'oauth'],
      multiPhasePreference: 'ask',
    })

    expect(res.archetype).toBe('bugfix')
    expect(res.copyPrompt).toContain('safe bugfix plan')
    expect(res.copyPrompt).toContain('reproduced before the fix')
  })

  it('treats api work as integration work', async () => {
    const res = await composePrompt({
      seed: 'Create an API endpoint for user profiles',
      keywords: ['api', 'typescript'],
      multiPhasePreference: 'ask',
    })

    expect(res.archetype).toBe('integration')
    expect(res.copyPrompt).toContain('integration plan')
    expect(res.copyPrompt).toContain('contracts and operational constraints')
  })

  it('returns a stable deterministic prompt when model polishing is unavailable', async () => {
    const res = await composePrompt({
      seed: 'Refactor a messy data-fetching component',
      keywords: ['react', 'refactor'],
      multiPhasePreference: 'ask',
    })

    expect(res.copyPrompt).toContain('Working rules')
    expect(res.copyPrompt).toContain('Verification')
    expect(res.assumptions.length).toBeGreaterThan(0)
  })
})
