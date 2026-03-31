// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { describe, expect, it, vi } from 'vitest'
import type { BuildMode } from './index'
import { BuildModeSelector, WizardStepIndicator } from './index'

const theme = createTheme()

function renderWithTheme(node: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{node}</ThemeProvider>)
}

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
    expect(screen.getByText('Approach')).toBeTruthy()
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
        theme={theme}
      />,
    )

    const group = screen.getByLabelText('Build mode')
    expect(group.getAttribute('aria-orientation')).toBe('vertical')

    screen.getByRole('button', { name: 'Fix a bug' }).click()
    expect(onChange).toHaveBeenCalled()
  })

  it('uses horizontal orientation on desktop', () => {
    renderWithTheme(
      <BuildModeSelector
        value="feature"
        onChange={() => {}}
        isMobile={false}
        theme={theme}
      />,
    )

    const group = screen.getByLabelText('Build mode')
    expect(group.getAttribute('aria-orientation')).toBe('horizontal')
  })
})
