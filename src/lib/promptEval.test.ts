import { describe, expect, it } from 'vitest'
import { composePrompt } from './promptEngine'
import { PROMPT_EVAL_SAMPLES } from './promptEvalSamples'

const BANNED = /(awesome|amazing|incredible|revolutionary|synergy|epic)/i

describe('prompt quality heuristics (lightweight)', () => {
  PROMPT_EVAL_SAMPLES.forEach((sample) => {
    it(`structures prompt for ${sample.label}`, async () => {
      const res = await composePrompt({
        seed: sample.seed,
        keywords: sample.keywords,
        multiPhasePreference: 'ask',
      })

      expect(res.copyPrompt).toMatch(/Mission/)
      expect(res.copyPrompt).toMatch(/Context you should use/)
      expect(res.copyPrompt).toMatch(/Working rules/)
      expect(res.copyPrompt).toMatch(/Expected output/)
      expect(res.copyPrompt).toMatch(/Verification/)
      expect(res.copyPrompt).toMatch(/Suggested skills\/patterns/)
      expect(res.copyPrompt).toMatch(/plan/i)
      expect(res.copyPrompt).toMatch(/Explore the repository/i)
      expect(res.copyPrompt).not.toMatch(BANNED)
      expect(res.copyPrompt).not.toMatch(/design artifact/i)
      expect(res.copyPrompt).not.toMatch(/audience and what action/i)
      expect(res.missingContext.length).toBeGreaterThan(0)
    })
  })
})
