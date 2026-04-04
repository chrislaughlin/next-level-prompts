import type { BuildMode } from '../components/PromptWizardControls'

export type BuildApproach = 'one-shot' | 'multi-phase'

export type WizardState = {
  buildMode: BuildMode
  buildApproach: BuildApproach
  phaseCount: number
  milestones: string[]
  keywords: string[]
  seed: string
  codebaseContext: string
  constraints: string[]
  verification: string[]
  nonGoals: string[]
}

export const DEFAULT_WIZARD_STATE: WizardState = {
  buildMode: 'feature',
  buildApproach: 'one-shot',
  phaseCount: 3,
  milestones: [],
  keywords: [],
  seed: '',
  codebaseContext: '',
  constraints: [],
  verification: [],
  nonGoals: [],
}

export function hydrateWizardState(state: Partial<WizardState>): WizardState {
  return {
    ...DEFAULT_WIZARD_STATE,
    ...state,
    seed: '',
    codebaseContext: '',
    constraints: [],
    verification: [],
    nonGoals: [],
  }
}

export function getPersistedWizardState(state: WizardState): Partial<WizardState> {
  const {
    seed: _seed,
    codebaseContext: _codebaseContext,
    constraints: _constraints,
    verification: _verification,
    nonGoals: _nonGoals,
    ...persisted
  } = state

  return persisted
}
