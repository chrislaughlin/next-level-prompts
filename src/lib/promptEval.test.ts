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

      expect(res.fullPrompt).toMatch(/Objective:/)
      expect(res.fullPrompt).toMatch(/Deliverable:/)
      expect(res.fullPrompt).toMatch(/Constraints:/)
      expect(res.questions.length).toBeGreaterThanOrEqual(3)
      expect(res.fullPrompt).not.toMatch(BANNED)
    })
  })
})
