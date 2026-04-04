import AppsIcon from '@mui/icons-material/Apps'
import BugReportIcon from '@mui/icons-material/BugReport'
import ExtensionIcon from '@mui/icons-material/Extension'
import RepeatIcon from '@mui/icons-material/Repeat'
import { Box, Stack, Step, StepLabel, Stepper, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'

export type BuildMode = 'app' | 'feature' | 'change' | 'bug'

export const STEPS = ['Mode', 'Approach', 'Context', 'Brief'] as const

const BUILD_MODE_OPTIONS: Array<{
  value: BuildMode
  label: string
  ariaLabel: string
  icon: JSX.Element
}> = [
  {
    value: 'app',
    label: 'New app',
    ariaLabel: 'New app',
    icon: <AppsIcon fontSize="small" />,
  },
  {
    value: 'feature',
    label: 'Feature',
    ariaLabel: 'Feature',
    icon: <ExtensionIcon fontSize="small" />,
  },
  {
    value: 'change',
    label: 'Existing change',
    ariaLabel: 'Existing change',
    icon: <RepeatIcon fontSize="small" />,
  },
  {
    value: 'bug',
    label: 'Bug fix',
    ariaLabel: 'Bug fix',
    icon: <BugReportIcon fontSize="small" />,
  },
]

const stepperSx = {
  '& .MuiStepIcon-root': {
    color: alpha('#16f2ff', 0.25),
  },
  '& .Mui-active .MuiStepIcon-root': {
    color: '#ff39d4',
  },
  '& .Mui-completed .MuiStepIcon-root': {
    color: '#fff36b',
  },
  '& .MuiStepLabel-label': {
    color: alpha('#d6f2ff', 0.75),
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  '& .Mui-active .MuiStepLabel-label': {
    color: '#fff7cc',
    fontWeight: 700,
  },
}

export const buildToggleButtonSx = (selected: boolean) => ({
  textTransform: 'uppercase',
  border: '2px solid',
  borderColor: selected ? '#fff36b' : alpha('#16f2ff', 0.68),
  color: selected ? '#090312' : '#d6f2ff',
  background: selected
    ? 'linear-gradient(180deg, #fff36b 0%, #ffd91f 100%)'
    : 'linear-gradient(180deg, rgba(8,6,20,0.98), rgba(21,12,39,0.9))',
  boxShadow: selected
    ? '0 0 18px rgba(255,243,107,0.4)'
    : 'inset 0 0 0 1px rgba(255,243,107,0.16), 0 0 16px rgba(22,242,255,0.12)',
  borderRadius: 0,
  '&:hover': {
    background: selected
      ? 'linear-gradient(180deg, #fff79b 0%, #ffe448 100%)'
      : alpha('#16081f', 0.96),
    borderColor: selected ? '#fff36b' : alpha('#ff39d4', 0.82),
  },
})

export function WizardStepIndicator({
  activeStep,
  isMobile,
}: {
  activeStep: number
  isMobile: boolean
}) {
  if (isMobile) {
    return (
      <Stack spacing={1.25}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="overline" color="secondary">
            Step {activeStep + 1} of {STEPS.length}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {STEPS[activeStep]}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} aria-label="Wizard steps">
          {STEPS.map((label, index) => {
            const isActive = index === activeStep
            const isCompleted = index < activeStep

            return (
              <Box
                key={label}
                sx={{
                  flex: 1,
                  height: 8,
                  borderRadius: 999,
                  background: isActive
                    ? 'linear-gradient(120deg, #ff39d4, #fff36b)'
                    : isCompleted
                      ? alpha('#16f2ff', 0.9)
                      : alpha('#ffffff', 0.16),
                  transition: 'background 180ms ease',
                }}
              />
            )
          })}
        </Stack>
      </Stack>
    )
  }

  return (
    <Stepper activeStep={activeStep} alternativeLabel sx={stepperSx}>
      {STEPS.map((label) => (
        <Step key={label}>
          <StepLabel>{label}</StepLabel>
        </Step>
      ))}
    </Stepper>
  )
}

export function BuildModeSelector({
  value,
  onChange,
  isMobile,
}: {
  value: BuildMode
  onChange: (_: React.MouseEvent<HTMLElement>, val: BuildMode | null) => void
  isMobile: boolean
}) {
  return (
    <ToggleButtonGroup
      exclusive
      value={value}
      onChange={onChange}
      fullWidth
      color="primary"
      aria-label="Build mode"
      orientation={isMobile ? 'vertical' : 'horizontal'}
      sx={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
        gap: 1,
        backgroundColor: 'transparent',
        border: 0,
        '& .MuiToggleButtonGroup-grouped': {
          margin: 0,
          border: 0,
          borderRadius: 3,
          minHeight: isMobile ? 72 : 48,
          paddingInline: isMobile ? 1.5 : 2,
          paddingBlock: isMobile ? 1.25 : 1,
          justifyContent: 'center',
          gap: 1,
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: 'center',
          textAlign: 'center',
          lineHeight: 1.2,
          whiteSpace: 'normal',
        },
      }}
    >
      {BUILD_MODE_OPTIONS.map((option) => (
        <ToggleButton
          key={option.value}
          value={option.value}
          aria-label={option.ariaLabel}
          selected={value === option.value}
          sx={buildToggleButtonSx(value === option.value)}
        >
          {option.icon}
          <Box component="span">{option.label}</Box>
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  )
}
