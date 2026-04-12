import { describe, expect, it } from 'vitest'
import {
  applyPromptRefinement,
  buildPromptRequest,
  buildServerPayload,
  mergeSkillMatches,
} from './PromptBuilderApp'
import type { PromptSections } from '../lib/promptEngine'
import type { WizardState } from '../lib/wizardState'

const baseState: WizardState = {
  buildMode: 'bug',
  buildApproach: 'one-shot',
  phaseCount: 3,
  milestones: ['investigate'],
  keywords: ['react', 'serverless'],
  seed: 'Fix the slow prompt generation request',
  codebaseContext: 'Inspect the server function timeout path.',
  constraints: ['Keep the UI responsive.'],
  verification: ['npm test'],
  nonGoals: ['Do not redesign the wizard.'],
}

describe('PromptBuilderApp helpers', () => {
  it('builds the local compose request with the prompt-engine defaults', () => {
    expect(buildPromptRequest(baseState)).toEqual({
      seed: 'Fix the slow prompt generation request',
      keywords: ['react', 'serverless'],
      buildMode: 'bug',
      buildApproach: 'one-shot',
      phaseCount: undefined,
      milestones: undefined,
      codebaseContext: 'Inspect the server function timeout path.',
      constraints: ['Keep the UI responsive.'],
      verification: ['npm test'],
      nonGoals: ['Do not redesign the wizard.'],
      multiPhasePreference: 'ask',
    })
  })

  it('builds the server payload without phase metadata for one-shot requests', () => {
    expect(buildServerPayload(baseState)).toEqual({
      seed: 'Fix the slow prompt generation request',
      keywords: ['react', 'serverless'],
      buildMode: 'bug',
      buildApproach: 'one-shot',
      phaseCount: undefined,
      milestones: undefined,
      codebaseContext: 'Inspect the server function timeout path.',
      constraints: ['Keep the UI responsive.'],
      verification: ['npm test'],
      nonGoals: ['Do not redesign the wizard.'],
    })
  })

  it('deduplicates local and refined skills', () => {
    expect(
      mergeSkillMatches(
        [
          {
            skill: 'react-best-practices',
            reason: 'React component structure and performance patterns',
          },
        ],
        ['react-best-practices', 'vercel-functions'],
      ),
    ).toEqual([
      {
        skill: 'react-best-practices',
        reason: 'React component structure and performance patterns',
      },
      {
        skill: 'vercel-functions',
        reason: 'Matched from local deterministic skill detection',
      },
    ])
  })

  it('applies a refined prompt without losing the local sections', () => {
    const localResult: PromptSections = {
      archetype: 'bugfix',
      copyPrompt: 'Local fallback prompt',
      fullPrompt: 'Local fallback prompt',
      missingContext: ['Relevant repository areas to inspect first.'],
      assumptions: ['Keep the change minimal and convention-preserving.'],
      skills: [
        {
          skill: 'react-best-practices',
          reason: 'React component structure and performance patterns',
        },
      ],
    }

    expect(
      applyPromptRefinement(localResult, {
        prompt: 'Server refined prompt',
        skillNames: ['vercel-functions'],
      }),
    ).toEqual({
      archetype: 'bugfix',
      copyPrompt: 'Server refined prompt',
      fullPrompt: 'Server refined prompt',
      missingContext: ['Relevant repository areas to inspect first.'],
      assumptions: ['Keep the change minimal and convention-preserving.'],
      skills: [
        {
          skill: 'react-best-practices',
          reason: 'React component structure and performance patterns',
        },
        {
          skill: 'vercel-functions',
          reason: 'Matched from local deterministic skill detection',
        },
      ],
    })
  })
})
