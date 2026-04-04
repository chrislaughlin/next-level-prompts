// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import type { BuildMode } from '../components/PromptWizardControls'
import { BuildModeSelector, WizardStepIndicator } from '../components/PromptWizardControls'
import { getPersistedWizardState, hydrateWizardState } from '../lib/wizardState'

const theme = createTheme()

function renderWithTheme(node: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{node}</ThemeProvider>)
}

afterEach(() => {
  cleanup()
})

describe('WizardStepIndicator', () => {
  it('renders a compact mobile indicator', () => {
    renderWithTheme(<WizardStepIndicator activeStep={1} isMobile />)

    expect(screen.getByText('Step 2 of 4')).toBeTruthy()
    expect(screen.getByText('Approach')).toBeTruthy()
    expect(screen.queryByText('Context')).toBeNull()
  })

  it('renders the full desktop stepper labels', () => {
    renderWithTheme(<WizardStepIndicator activeStep={1} isMobile={false} />)

    expect(screen.getByText('Mode')).toBeTruthy()
    expect(screen.getAllByText('Approach')).toHaveLength(1)
    expect(screen.getByText('Context')).toBeTruthy()
    expect(screen.getByText('Brief')).toBeTruthy()
  })
})

describe('BuildModeSelector', () => {
  it('uses vertical orientation on mobile and emits mode changes', () => {
    const onChange = vi.fn<
      (_: React.MouseEvent<HTMLElement>, val: BuildMode | null) => void
    >()

    renderWithTheme(
      <BuildModeSelector
        value="feature"
        onChange={onChange}
        isMobile
      />,
    )

    const group = screen.getByLabelText('Build mode')
    expect(group.className).toContain('MuiToggleButtonGroup-vertical')

    screen.getByRole('button', { name: 'Bug fix' }).click()
    expect(onChange).toHaveBeenCalled()
  })

  it('uses horizontal orientation on desktop', () => {
    renderWithTheme(
      <BuildModeSelector
        value="feature"
        onChange={() => {}}
        isMobile={false}
      />,
    )

    const group = screen.getByLabelText('Build mode')
    expect(group.className).toContain('MuiToggleButtonGroup-horizontal')
  })

  it('shows the clicked option as selected', () => {
    const onChange = vi.fn<
      (_: React.MouseEvent<HTMLElement>, val: BuildMode | null) => void
    >()
    const { rerender } = renderWithTheme(
      <BuildModeSelector value="feature" onChange={onChange} isMobile={false} />,
    )

    const newApp = screen.getByRole('button', { name: 'New app' })
    const feature = screen.getByRole('button', { name: 'Feature' })
    const change = screen.getByRole('button', { name: 'Existing change' })

    expect(feature.getAttribute('aria-pressed')).toBe('true')
    expect(newApp.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(newApp)
    expect(onChange).toHaveBeenLastCalledWith(expect.anything(), 'app')

    rerender(
      <ThemeProvider theme={theme}>
        <BuildModeSelector value="app" onChange={onChange} isMobile={false} />
      </ThemeProvider>,
    )

    expect(screen.getByRole('button', { name: 'New app' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Feature' }).getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByRole('button', { name: 'Existing change' }).getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(change)
    expect(onChange).toHaveBeenLastCalledWith(expect.anything(), 'change')
  })
})

describe('wizard persistence helpers', () => {
  it('does not persist the task brief fields', () => {
    const persisted = getPersistedWizardState({
      buildMode: 'app',
      buildApproach: 'multi-phase',
      phaseCount: 4,
      milestones: ['plan'],
      keywords: ['react'],
      seed: 'ship the new app',
      codebaseContext: 'inspect src/routes',
      constraints: ['do not break auth'],
      verification: ['npm test'],
      nonGoals: ['redesign'],
    })

    expect(persisted).toEqual({
      buildMode: 'app',
      buildApproach: 'multi-phase',
      phaseCount: 4,
      milestones: ['plan'],
      keywords: ['react'],
    })
  })

  it('clears previously saved brief fields when hydrating state', () => {
    const hydrated = hydrateWizardState({
      buildMode: 'bug',
      buildApproach: 'one-shot',
      phaseCount: 2,
      milestones: ['investigate'],
      keywords: ['tanstack'],
      seed: 'old prompt',
      codebaseContext: 'old repo note',
      constraints: ['old constraint'],
      verification: ['old check'],
      nonGoals: ['old non-goal'],
    })

    expect(hydrated.buildMode).toBe('bug')
    expect(hydrated.keywords).toEqual(['tanstack'])
    expect(hydrated.seed).toBe('')
    expect(hydrated.codebaseContext).toBe('')
    expect(hydrated.constraints).toEqual([])
    expect(hydrated.verification).toEqual([])
    expect(hydrated.nonGoals).toEqual([])
  })
})
