import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DownloadIcon from '@mui/icons-material/Download'
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch'
import LayersIcon from '@mui/icons-material/Layers'
import BugReportIcon from '@mui/icons-material/BugReport'
import AppsIcon from '@mui/icons-material/Apps'
import AddIcon from '@mui/icons-material/Add'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { generatePromptPipeline } from '../server/promptPipeline'
import type {
  GoalType,
  BuildApproach,
  PromptPipelineOutput,
} from '../server/promptPipeline'

const STORAGE_KEY = 'nlp-wizard-state-v2'

const LOADING_VERBS = [
  'Gaslighting the compiler',
  "Cooking (we're so back)",
  'Rizzing up the codebase',
  'Yeeting the bugs',
  'Serving code realness',
  'Main-character-ing',
  'Diamond-handing the solution',
  'NPC-walking through the code',
  'Eating and leaving no crumbs',
  'Ratio-ing the errors',
  'Going sicko mode',
  'Touching grass first',
  'Living rent-free in the codebase',
  'Choosing violence',
  'Understanding the assignment',
  'Catching strays',
  'Being today years old discovering this bug',
  'Sending it (no cap)',
  'Hitting different',
  'Passing the vibe check',
  'Staying unhinged',
  'Gatekeeping the solution',
  'Girlbossing the algorithm',
  'Quiet-quitting the old code',
  'Existing in the codebase (allegedly)',
  'Slay-ing the implementation',
  'Manifesting zero bugs',
  'Standing on business',
  'Throwing shade at legacy code',
  'Ghosting the old implementation',
  'Catching these bugs in 4K',
  'Taking the L gracefully',
  'Speedrunning any percent',
  'Malding over the edge case',
  'Going full goblin mode',
  'Vibing with the codebase',
  'Prompting the AI to do the work',
  'Accepting all suggestions blindly',
  'Telling the AI to fix it',
  'Copy-pasting from ChatGPT',
  'Manifesting clean code',
  'Shipping without reading it',
  'Trusting the autocomplete',
  'Asking Claude to figure it out',
  'Generating the entire app',
  'Deploying on vibes alone',
  'Approving all the diffs',
  'Letting the AI cook',
  'Prompt engineering intensely',
  'Waving hands at the architecture',
  'Telling Copilot to handle it',
  'Refusing to read the error message',
  'Running it until it works',
  "Asking 'can you just make it work'",
  'Describing the app to the AI',
  'Skipping the documentation',
  'Shipping the prototype as production',
  'Iterating via prompt',
  'Feeling the code (not reading it)',
  'Tab-completing to victory',
  'Generating tests (but not running them)',
  'Vibing past the type errors',
  'Building without a plan',
  'Trusting the process (the AI process)',
  'Merging without reviewing',
  'Living in the no-code era',
  'Asking for one more refactor pass',
  'Letting the LLM drive',
  'Checking if it compiles (good enough)',
  'Shipping on good vibes',
  'Declaring bankruptcy on the old code',
  "That's-what-she-coded-ing",
  "Promising what can't be delivered",
  "Making a World's Best Boss mug",
  'Calling an emergency meeting',
  'Doing the Scarn',
  'Preparing an impromptu presentation',
  'Grilling a foot on the George Foreman',
  "Trying to be everybody's friend",
  'Running through the parking lot',
  'Making a documentary about it',
  'Putting it in Jell-O',
  'Starting a paper company',
  'Hosting the Dundies',
  "saying 'that's what she said'",
  'Faxing from future Dwight',
  'Procrastinating productively',
  'Accidentally sending to the whole company',
  'throwing a pizza on the roof (wrong show)',
  "Promising a raise that's not happening",
  'Writing a screenplay (Threat Level Midnight)',
  'Performing magic (badly)',
  'Kissing the homies goodnight',
  'Having the worst best idea',
  'Organizing a fun run',
  'Burning a foot on a waffle iron',
  'Falling into the koi pond',
  'Reading from notecards (upside down)',
  "Making it everyone's problem",
  'Somehow managing',
  'Turning it into a meeting about nothing',
  "Googling 'how to be a good boss'",
  "Taking credit for Dwight's work",
  "Doing the Chris Rock impression (please don't)",
  'Winging it (as always)',
  'Mass refactoring',
  'Deploying to prod on Friday',
  'Blaming the intern',
  'Googling the error',
  'Rewriting in Rust',
  'Clearing the cache',
  'Mass reverting',
  'Rebasing onto main',
  'Mass copy-pasting from Stack Overflow',
  'Mass nuking node_modules',
  'Fixing the fix that fixed the fix',
  'Reading the docs for once',
  'Adding TODO comments',
  'Ignoring the linter warnings',
  'Rubber ducking',
  'Deleting dead code',
  'Over-engineering the solution',
  'Bikeshedding',
  'Yak shaving',
  'Pushing directly to main',
  'Rolling back the rollback',
  'Updating dependencies',
  'Writing tests after the fact',
  'Blaming DNS',
  'Turning it off and on again',
  'Debugging with print statements',
  'Closing all 47 browser tabs',
  'Resolving merge conflicts',
  'Pretending to understand the regex',
  'Hardcoding the fix',
  'Shipping it',
  'Deprecating everything',
  'Commenting out the problem',
  'Moving fast and breaking things',
  'Silencing the warnings',
]

type ChipInputProps = {
  values: string[]
  onChange: (next: string[]) => void
  label: string
}

const terminalFieldSx = {
  '& .MuiInputLabel-root': {
    color: 'rgba(214,242,255,0.75)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  '& .MuiInputLabel-root.Mui-focused': {
    color: '#fff36b',
  },
  '& .MuiOutlinedInput-root': {
    borderRadius: 0,
    color: '#fff7cc',
    background:
      'linear-gradient(180deg, rgba(7,3,19,0.96), rgba(18,10,35,0.92))',
    '& fieldset': {
      borderWidth: 2,
      borderColor: 'rgba(22,242,255,0.55)',
    },
    '&:hover fieldset': {
      borderColor: '#ff39d4',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#fff36b',
      boxShadow: '0 0 16px rgba(255,243,107,0.2)',
    },
  },
  '& .MuiInputBase-input::placeholder': {
    color: 'rgba(214,242,255,0.4)',
    opacity: 1,
  },
}

function ChipInput({ values, onChange, label }: ChipInputProps) {
  const [text, setText] = useState('')
  const add = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed || values.includes(trimmed)) return
    onChange([...values, trimmed])
    setText('')
  }, [onChange, text, values])

  const remove = useCallback(
    (value: string) => onChange(values.filter((v) => v !== value)),
    [onChange, values],
  )

  return (
    <Stack spacing={1}>
      <TextField
        label={label}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            add()
          }
        }}
        autoComplete="off"
        name={label.toLowerCase().replace(/\s+/g, '-')}
        id={`chip-input-${label.toLowerCase().replace(/\s+/g, '-')}`}
        placeholder="Type and press Enter"
        fullWidth
        sx={terminalFieldSx}
      />
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {values.length === 0 && (
          <Typography
            variant="caption"
            sx={{
              color: 'rgba(214,242,255,0.4)',
              fontStyle: 'italic',
              py: 0.5,
            }}
          >
            No {label.toLowerCase()} added yet
          </Typography>
        )}
        {values.map((k) => (
          <Chip
            key={k}
            label={k}
            onDelete={() => remove(k)}
            variant="outlined"
            sx={{
              color: '#fff7cc',
              borderColor: 'rgba(255,57,212,0.78)',
              backgroundColor: 'rgba(22,10,35,0.8)',
              borderRadius: 0,
              boxShadow: '0 0 14px rgba(255,57,212,0.12)',
              '& .MuiChip-deleteIcon': {
                color: '#16f2ff',
              },
            }}
          />
        ))}
      </Stack>
    </Stack>
  )
}

const STEPS = ['Goal', 'Base Prompt', 'Approach', 'Constraints & Validation']
const STEP_COUNT = STEPS.length

function GoalTypeSelector({
  value,
  onChange,
}: {
  value: GoalType
  onChange: (v: GoalType) => void
}) {
  const goalOptions: {
    value: GoalType
    label: string
    icon: React.ReactNode
    desc: string
  }[] = [
    {
      value: 'build-app',
      label: 'Build full app',
      icon: <AppsIcon />,
      desc: 'Create a new application from scratch',
    },
    {
      value: 'add-feature',
      label: 'Add feature',
      icon: <AddIcon />,
      desc: 'Extend an existing application',
    },
    {
      value: 'fix-bug',
      label: 'Fix bug',
      icon: <BugReportIcon />,
      desc: 'Debug and fix an existing issue',
    },
  ]

  return (
    <Stack spacing={2}>
      {goalOptions.map((opt) => (
        <Paper
          key={opt.value}
          onClick={() => onChange(opt.value)}
          sx={{
            p: 2,
            cursor: 'pointer',
            border: '2px solid',
            borderColor:
              value === opt.value ? '#fff36b' : 'rgba(22,242,255,0.3)',
            backgroundColor:
              value === opt.value ? 'rgba(255,243,107,0.08)' : 'transparent',
            transition: 'all 0.2s ease',
            '&:hover': {
              borderColor: '#ff39d4',
              backgroundColor: 'rgba(255,57,212,0.05)',
            },
          }}
        >
          <Stack direction="row" spacing={2} alignItems="center">
            <Box sx={{ color: value === opt.value ? '#fff36b' : '#16f2ff' }}>
              {opt.icon}
            </Box>
            <Box>
              <Typography sx={{ color: '#fff7cc', fontWeight: 600 }}>
                {opt.label}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {opt.desc}
              </Typography>
            </Box>
          </Stack>
        </Paper>
      ))}
    </Stack>
  )
}

export function PromptBuilderApp() {
  const [activeStep, setActiveStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState(LOADING_VERBS[0])
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PromptPipelineOutput | null>(null)
  const [toast, setToast] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'error'
  }>({ open: false, message: '', severity: 'success' })

  const [goalType, setGoalType] = useState<GoalType>('add-feature')
  const [basePrompt, setBasePrompt] = useState('')
  const [buildApproach, setBuildApproach] = useState<BuildApproach>('one-shot')
  const [phaseCount, setPhaseCount] = useState(3)
  const [constraints, setConstraints] = useState<string[]>([])
  const [validation, setValidation] = useState<string[]>([])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const saved = JSON.parse(raw)
        setGoalType(saved.goalType || 'add-feature')
        setBasePrompt(saved.basePrompt || '')
        setBuildApproach(saved.buildApproach || 'one-shot')
        setPhaseCount(saved.phaseCount || 3)
        setConstraints(saved.constraints || [])
        setValidation(saved.validation || [])
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          goalType,
          basePrompt,
          buildApproach,
          phaseCount,
          constraints,
          validation,
        }),
      )
    } catch {
      // ignore
    }
  }, [goalType, basePrompt, buildApproach, phaseCount, constraints, validation])

  const canProceed = useMemo(() => {
    switch (activeStep) {
      case 0:
        return true
      case 1:
        return basePrompt.trim().length > 3
      case 2:
        return true
      case 3:
        return true
      default:
        return true
    }
  }, [activeStep, basePrompt])

  useEffect(() => {
    if (!loading) return
    const interval = setInterval(() => {
      setLoadingMessage(
        LOADING_VERBS[Math.floor(Math.random() * LOADING_VERBS.length)],
      )
    }, 2000)
    return () => clearInterval(interval)
  }, [loading])

  const handleGenerate = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await generatePromptPipeline({
        data: {
          goalType,
          basePrompt,
          buildApproach,
          phaseCount: buildApproach === 'multi-phase' ? phaseCount : undefined,
          constraints,
          validation,
        },
      })

      if (response.error) {
        setError(response.error)
        setToast({
          open: true,
          message: response.error,
          severity: 'error',
        })
      } else {
        setResult(response)
        setToast({
          open: true,
          message: 'Prompt generated successfully!',
          severity: 'success',
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Generation failed'
      setError(message)
      setToast({
        open: true,
        message,
        severity: 'error',
      })
    } finally {
      setLoading(false)
    }
  }, [goalType, basePrompt, buildApproach, phaseCount, constraints, validation])

  const handleReset = useCallback(() => {
    setGoalType('add-feature')
    setBasePrompt('')
    setBuildApproach('one-shot')
    setPhaseCount(3)
    setConstraints([])
    setValidation([])
    setActiveStep(0)
    setResult(null)
    setError(null)
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  const handleToastClose = useCallback((_: any, reason?: string) => {
    if (reason === 'clickaway') return
    setToast((prev) => ({ ...prev, open: false }))
  }, [])

  const copyPrompt = useCallback(async () => {
    if (!result?.prompt) return
    try {
      if (!navigator.clipboard) {
        setToast({
          open: true,
          message: 'Copy not available in this context',
          severity: 'error',
        })
        return
      }
      await navigator.clipboard.writeText(result.prompt)
      setToast({
        open: true,
        message: 'Copied to clipboard!',
        severity: 'success',
      })
    } catch {
      setToast({
        open: true,
        message: 'Copy failed - try selecting text manually',
        severity: 'error',
      })
    }
  }, [result?.prompt])

  const downloadPrompt = useCallback(() => {
    if (!result?.prompt) return
    const blob = new Blob([result.prompt], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'ai-coding-prompt.txt'
    a.click()
    URL.revokeObjectURL(url)
  }, [result?.prompt])

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Stack spacing={2}>
            <Typography variant="subtitle1">
              What are you trying to achieve?
            </Typography>
            <GoalTypeSelector value={goalType} onChange={setGoalType} />
          </Stack>
        )
      case 1:
        return (
          <Stack spacing={2}>
            <Typography variant="subtitle1">
              What is the base prompt?
            </Typography>
            <TextField
              label="Base Prompt"
              multiline
              minRows={6}
              value={basePrompt}
              onChange={(e) => setBasePrompt(e.target.value)}
              placeholder="Describe what you want to build, add, or fix. Be as detailed as possible about the requirements, expected behavior, and any specific files or areas of the codebase that are relevant."
              fullWidth
              name="base-prompt"
              autoComplete="off"
              sx={terminalFieldSx}
            />
          </Stack>
        )
      case 2:
        return (
          <Stack spacing={2}>
            <Typography variant="subtitle1">
              One shot or multi phase?
            </Typography>
            <ToggleButtonGroup
              exclusive
              value={buildApproach}
              onChange={(_, v) => v && setBuildApproach(v)}
              fullWidth
              color="primary"
              sx={{
                '& .MuiToggleButton-root': {
                  borderRadius: 0,
                },
              }}
            >
              <ToggleButton
                value="one-shot"
                sx={{
                  py: 2,
                  borderColor: 'rgba(22,242,255,0.5)',
                  color: buildApproach === 'one-shot' ? '#fff36b' : '#d6f2ff',
                  backgroundColor:
                    buildApproach === 'one-shot'
                      ? 'rgba(255,243,107,0.1)'
                      : 'transparent',
                  '&.Mui-selected': {
                    borderColor: '#fff36b',
                    boxShadow: '0 0 12px rgba(255,243,107,0.3)',
                  },
                }}
              >
                <RocketLaunchIcon fontSize="small" />
                &nbsp;One Shot
                <Typography
                  variant="caption"
                  display="block"
                  color="text.secondary"
                >
                  Single planning pass
                </Typography>
              </ToggleButton>
              <ToggleButton
                value="multi-phase"
                sx={{
                  py: 2,
                  borderColor: 'rgba(22,242,255,0.5)',
                  color:
                    buildApproach === 'multi-phase' ? '#fff36b' : '#d6f2ff',
                  backgroundColor:
                    buildApproach === 'multi-phase'
                      ? 'rgba(255,243,107,0.1)'
                      : 'transparent',
                  '&.Mui-selected': {
                    borderColor: '#fff36b',
                    boxShadow: '0 0 12px rgba(255,243,107,0.3)',
                  },
                }}
              >
                <LayersIcon fontSize="small" />
                &nbsp;Multi-Phase
                <Typography
                  variant="caption"
                  display="block"
                  color="text.secondary"
                >
                  Phased implementation
                </Typography>
              </ToggleButton>
            </ToggleButtonGroup>
            {buildApproach === 'multi-phase' && (
              <TextField
                label="Phase count"
                type="number"
                inputProps={{ min: 1, max: 12 }}
                value={phaseCount}
                onChange={(e) => setPhaseCount(Number(e.target.value) || 3)}
                fullWidth
                sx={terminalFieldSx}
              />
            )}
          </Stack>
        )
      case 3:
      default:
        return (
          <Stack spacing={3}>
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Any constraints?
              </Typography>
              <ChipInput
                values={constraints}
                onChange={setConstraints}
                label="Constraints"
              />
              <Typography variant="caption" color="text.secondary">
                E.g., "preserve existing API contracts", "no new dependencies",
                "maintain backward compatibility"
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                What validation should be carried out?
              </Typography>
              <ChipInput
                values={validation}
                onChange={setValidation}
                label="Validation / Done Criteria"
              />
              <Typography variant="caption" color="text.secondary">
                E.g., "run existing test suite", "verify build passes", "check
                linting", "manual smoke test"
              </Typography>
            </Box>
          </Stack>
        )
    }
  }

  return (
    <>
      {loading && (
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background:
              'radial-gradient(circle at 50% 50%, rgba(255,57,212,0.15), rgba(9,3,18,0.98))',
          }}
        >
          <CircularProgress
            size={48}
            sx={{
              color: '#16f2ff',
              mb: 3,
            }}
          />
          <Typography
            sx={{
              fontSize: { xs: 14, sm: 18 },
              color: '#fff7cc',
              fontFamily: '"IBM Plex Mono", monospace',
              fontWeight: 500,
              textAlign: 'center',
              px: 4,
              animation: 'pulse 2s ease-in-out infinite',
              '@keyframes pulse': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.7 },
              },
            }}
          >
            {loadingMessage}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              mt: 4,
              color: 'rgba(22,242,255,0.6)',
              letterSpacing: '0.1em',
            }}
          >
            Generating a 10/10 prompt...
          </Typography>
        </Box>
      )}
      <Box
        tabIndex={-1}
        sx={{
          minHeight: '100vh',
          outline: 'none',
          background:
            'radial-gradient(circle at 20% 20%, rgba(255,57,212,0.16), transparent 30%), radial-gradient(circle at 80% 0%, rgba(22,242,255,0.14), transparent 26%), #090312',
          pb: 8,
        }}
      >
        <Box
          sx={{
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(circle at 50% -20%, rgba(255,255,255,0.08), transparent 40%), repeating-linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.04) 1px, transparent 1px, transparent 18px)',
              opacity: 0.25,
              pointerEvents: 'none',
            }}
          />
          <Box
            sx={{
              position: 'relative',
              zIndex: 1,
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              px: { xs: 2.5, md: 4 },
            }}
          >
            <Stack
              spacing={3}
              pt={{ xs: 4, md: 6 }}
              pb={3}
              width="min(1080px, 100%)"
            >
              <Stack spacing={2} alignItems="flex-start">
                <Typography
                  variant="overline"
                  sx={{ color: '#16f2ff', letterSpacing: '0.22em' }}
                >
                  AI Coding Agent Prompt Generator
                </Typography>
                <Typography
                  variant="h3"
                  fontWeight={800}
                  sx={{
                    maxWidth: 980,
                    lineHeight: { xs: 1.5, md: 1.35 },
                    color: '#ff39d4',
                    textShadow:
                      '0 0 10px rgba(255,57,212,0.85), 0 0 28px rgba(255,57,212,0.48)',
                  }}
                >
                  Next Level Prompts
                </Typography>
                <Typography
                  variant="body1"
                  sx={{
                    maxWidth: 760,
                    color: 'text.secondary',
                  }}
                >
                  Build the perfect prompt for your AI coding agent. Get a 10/10
                  prompt optimized for Claude, Codex, or OpenCode.
                </Typography>
              </Stack>
            </Stack>

            <Stack spacing={3} pb={6} alignItems="center" width="100%">
              <Paper
                sx={{
                  p: { xs: 2.25, sm: 3 },
                  borderRadius: 0,
                  width: 'min(960px, 100%)',
                }}
              >
                <Stack spacing={2}>
                  <Box>
                    <Stack
                      direction="row"
                      spacing={1}
                      justifyContent="center"
                      mb={2}
                    >
                      {STEPS.map((label, index) => (
                        <Box
                          key={label}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                          }}
                        >
                          <Box
                            component="button"
                            type="button"
                            aria-label={`Step ${index + 1}: ${label}${index < activeStep ? ' (completed)' : index === activeStep ? ' (current)' : ''}`}
                            tabIndex={0}
                            sx={{
                              minWidth: 44,
                              minHeight: 44,
                              width: 44,
                              height: 44,
                              borderRadius: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor:
                                index === activeStep
                                  ? '#fff36b'
                                  : index < activeStep
                                    ? '#16f2ff'
                                    : 'rgba(255,255,255,0.1)',
                              color:
                                index <= activeStep
                                  ? '#090312'
                                  : 'rgba(255,255,255,0.4)',
                              fontWeight: 700,
                              fontSize: 14,
                              border:
                                index === activeStep
                                  ? '2px solid #fff36b'
                                  : index < activeStep
                                    ? '2px solid #16f2ff'
                                    : '2px solid rgba(255,255,255,0.2)',
                              outlineOffset: 2,
                              '&:focus-visible': {
                                outline: '2px solid #fff36b',
                                outlineOffset: 2,
                              },
                            }}
                          >
                            {index < activeStep ? '✓' : index + 1}
                          </Box>
                          {index < STEPS.length - 1 && (
                            <Box
                              sx={{
                                width: 40,
                                height: 2,
                                backgroundColor:
                                  index < activeStep
                                    ? '#16f2ff'
                                    : 'rgba(255,255,255,0.2)',
                              }}
                            />
                          )}
                        </Box>
                      ))}
                    </Stack>
                    <Typography
                      variant="h6"
                      align="center"
                      sx={{ color: '#fff7cc', mb: 2 }}
                    >
                      {STEPS[activeStep]}
                    </Typography>
                  </Box>

                  {renderStepContent()}

                  {error && (
                    <Typography color="error" variant="body2">
                      {error}
                    </Typography>
                  )}

                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    alignItems={{ xs: 'stretch', sm: 'center' }}
                    justifyContent="space-between"
                    spacing={1.25}
                  >
                    <Button
                      variant="text"
                      onClick={handleReset}
                      color="secondary"
                    >
                      Reset
                    </Button>
                    <Stack
                      direction={{ xs: 'row', sm: 'row' }}
                      spacing={1}
                      width={{ xs: '100%', sm: 'auto' }}
                    >
                      <Button
                        variant="outlined"
                        onClick={() => setActiveStep((s) => Math.max(s - 1, 0))}
                        disabled={activeStep === 0}
                        sx={{ minWidth: 100 }}
                      >
                        Back
                      </Button>
                      {activeStep < STEP_COUNT - 1 ? (
                        <Button
                          variant="contained"
                          onClick={() =>
                            setActiveStep((s) =>
                              Math.min(s + 1, STEP_COUNT - 1),
                            )
                          }
                          disabled={!canProceed}
                          sx={{ minWidth: 100 }}
                        >
                          Next
                        </Button>
                      ) : (
                        <Button
                          variant="contained"
                          onClick={handleGenerate}
                          disabled={!canProceed || loading}
                          sx={{ minWidth: 140 }}
                          startIcon={
                            loading ? <CircularProgress size={18} /> : null
                          }
                        >
                          {loading ? 'Generating...' : 'Generate Prompt'}
                        </Button>
                      )}
                    </Stack>
                  </Stack>
                </Stack>
              </Paper>

              {result && (
                <Paper
                  sx={{
                    p: { xs: 2, sm: 3 },
                    borderRadius: 0,
                    width: 'min(960px, 100%)',
                  }}
                >
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    mb={1.5}
                  >
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="h6" sx={{ color: '#fff36b' }}>
                        Generated Prompt
                      </Typography>
                      {loading && (
                        <Chip
                          size="small"
                          label="Generating..."
                          icon={<CircularProgress size={14} thickness={5} />}
                          sx={{
                            color: '#090312',
                            backgroundColor: '#16f2ff',
                            borderRadius: 0,
                          }}
                        />
                      )}
                    </Stack>
                    <Stack direction="row" spacing={1}>
                      <Tooltip title="Copy prompt">
                        <span>
                          <IconButton
                            aria-label="Copy prompt"
                            color="primary"
                            onClick={copyPrompt}
                            sx={{
                              border: '2px solid rgba(22,242,255,0.72)',
                              borderRadius: 0,
                              color: '#16f2ff',
                            }}
                          >
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Download .txt">
                        <span>
                          <IconButton
                            aria-label="Download prompt"
                            color="primary"
                            onClick={downloadPrompt}
                            sx={{
                              border: '2px solid rgba(255,57,212,0.72)',
                              borderRadius: 0,
                              color: '#ff39d4',
                            }}
                          >
                            <DownloadIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>
                  </Stack>

                  <Box
                    sx={{
                      background:
                        'linear-gradient(180deg, rgba(4,2,12,0.98), rgba(11,6,23,0.95))',
                      border: '2px solid rgba(22,242,255,0.62)',
                      borderRadius: 0,
                      p: 2,
                      fontFamily:
                        '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                      fontSize: 14,
                      color: '#fff7cc',
                      minHeight: 200,
                      overflow: 'auto',
                      boxShadow: 'inset 0 0 0 1px rgba(255,243,107,0.15)',
                      '& h1, & h2, & h3, & h4': {
                        mt: 3,
                        mb: 1.5,
                        color: '#16f2ff',
                        fontWeight: 700,
                      },
                      '& h1:first-child, & h2:first-child, & h3:first-child, & h4:first-child':
                        {
                          mt: 0,
                        },
                      '& p': {
                        mb: 1.5,
                        lineHeight: 1.7,
                      },
                      '& ul, & ol': {
                        mb: 1.5,
                        pl: 3,
                      },
                      '& li': {
                        mb: 0.5,
                      },
                      '& code': {
                        bgcolor: 'rgba(255,57,212,0.15)',
                        px: 0.75,
                        py: 0.25,
                        borderRadius: 1,
                        fontSize: '0.9em',
                      },
                      '& pre': {
                        bgcolor: 'rgba(0,0,0,0.3)',
                        p: 2,
                        borderRadius: 1,
                        overflow: 'auto',
                        my: 2,
                      },
                      '& hr': {
                        borderColor: 'rgba(22,242,255,0.3)',
                        my: 2,
                      },
                      '& blockquote': {
                        borderLeft: '3px solid #ff39d4',
                        pl: 2,
                        ml: 0,
                        color: 'rgba(214,242,255,0.8)',
                        fontStyle: 'italic',
                      },
                    }}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {result.prompt}
                    </ReactMarkdown>
                  </Box>

                  {result.skills.length > 0 && (
                    <>
                      <Divider
                        sx={{ my: 2, borderColor: 'rgba(22,242,255,0.25)' }}
                      />
                      <Typography
                        variant="subtitle2"
                        gutterBottom
                        sx={{ color: '#16f2ff' }}
                      >
                        Recommended Skills
                      </Typography>
                      <Stack
                        direction="row"
                        spacing={1}
                        flexWrap="wrap"
                        useFlexGap
                      >
                        {result.skills.map((skill) => (
                          <Chip
                            key={skill.slug}
                            label={`/${skill.name}`}
                            variant="outlined"
                            sx={{
                              color: '#fff7cc',
                              borderColor: 'rgba(255,243,107,0.72)',
                              borderRadius: 0,
                            }}
                          />
                        ))}
                      </Stack>
                    </>
                  )}
                </Paper>
              )}
            </Stack>
          </Box>
        </Box>
      </Box>

      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={handleToastClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <AlertMessage
          onClose={handleToastClose}
          severity={toast.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {toast.message}
        </AlertMessage>
      </Snackbar>
    </>
  )
}

function AlertMessage(props: any) {
  return <Typography variant="body2" {...props} />
}
