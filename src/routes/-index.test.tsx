// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import type { BuildMode } from '../components/PromptWizardControls'
import { BuildModeSelector, WizardStepIndicator } from '../components/PromptWizardControls'

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
    expect(screen.queryByText('Keywords')).toBeNull()
  })

  it('renders the full desktop stepper labels', () => {
    renderWithTheme(<WizardStepIndicator activeStep={1} isMobile={false} />)

    expect(screen.getByText('Mode')).toBeTruthy()
    expect(screen.getAllByText('Approach')).toHaveLength(1)
    expect(screen.getByText('Keywords')).toBeTruthy()
    expect(screen.getByText('Goal')).toBeTruthy()
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

    screen.getByRole('button', { name: 'Fix a bug' }).click()
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

  it('keeps exactly one option pressed after switching modes', () => {
    const onChange = vi.fn<
      (_: React.MouseEvent<HTMLElement>, val: BuildMode | null) => void
    >()
    const { rerender } = renderWithTheme(
      <BuildModeSelector value="feature" onChange={onChange} isMobile={false} />,
    )

    const fullApp = screen.getByRole('button', { name: 'Full application' })
    const feature = screen.getByRole('button', { name: 'Feature in app' })
    const change = screen.getByRole('button', { name: 'Change existing feature' })

    expect(feature.getAttribute('aria-pressed')).toBe('true')
    expect(fullApp.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(fullApp)
    expect(onChange).toHaveBeenLastCalledWith(expect.anything(), 'app')

    rerender(
      <ThemeProvider theme={theme}>
        <BuildModeSelector value="app" onChange={onChange} isMobile={false} />
      </ThemeProvider>,
    )

    expect(screen.getByRole('button', { name: 'Full application' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Feature in app' }).getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByRole('button', { name: 'Change existing feature' }).getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(change)
    expect(onChange).toHaveBeenLastCalledWith(expect.anything(), 'change')

    rerender(
      <ThemeProvider theme={theme}>
        <BuildModeSelector value="change" onChange={onChange} isMobile={false} />
      </ThemeProvider>,
    )

    expect(screen.getByRole('button', { name: 'Change existing feature' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Full application' }).getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByRole('button', { name: 'Feature in app' }).getAttribute('aria-pressed')).toBe('false')
  })
})
