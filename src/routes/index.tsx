import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  LinearProgress,
  Paper,
  Snackbar,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import AppsIcon from '@mui/icons-material/Apps'
import BugReportIcon from '@mui/icons-material/BugReport'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DownloadIcon from '@mui/icons-material/Download'
import ExtensionIcon from '@mui/icons-material/Extension'
import RefreshIcon from '@mui/icons-material/Refresh'
import RepeatIcon from '@mui/icons-material/Repeat'
import TimelineIcon from '@mui/icons-material/Timeline'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { composePrompt } from '../lib/promptEngine'
import type { PromptSections } from '../lib/promptEngine'
import { findSkillsFromText } from '../services/skills'
import {
  forceRefetchModel,
  getLastBackend,
  isModelCached,
  isWebGPUPreferred,
  prefetchModel,
} from '../lib/clientModel'

export const Route = createFileRoute('/')({ component: App })

type BuildMode = 'app' | 'feature' | 'change' | 'bug'
type BuildApproach = 'one-shot' | 'multi-phase'

const STEPS = ['Mode', 'Approach', 'Keywords', 'Goal']

const PLACEHOLDER_IDEAS = [
  'Draft a launch email for a new open-source CLI tool',
  'Plan a workshop on prompt engineering basics',
  'Design a retro terminal-style landing page',
  'Create a study plan for learning Rust in 30 days',
  'Outline a tutorial on deploying Next.js to Vercel',
  'Generate interview questions for a staff-level frontend role',
  'Write product copy for an AI meeting notes app',
  'Map a data pipeline from ingestion to dashboard',
  'Brainstorm quests for a text-based cyberpunk game',
  'Summarize a research paper on diffusion models',
]

type WizardState = {
  buildMode: BuildMode
  buildApproach: BuildApproach
  phaseCount: number
  milestones: string[]
  keywords: string[]
  seed: string
}

const DEFAULT_STATE: WizardState = {
  buildMode: 'feature',
  buildApproach: 'one-shot',
  phaseCount: 3,
  milestones: [],
  keywords: [],
  seed: '',
}

const STORAGE_KEY = 'nlp-wizard-state'

type ChipInputProps = {
  values: string[]
  onChange: (next: string[]) => void
  label: string
}

const toggleButtonBaseSx = (theme: ReturnType<typeof useTheme>) => ({
  textTransform: 'none',
  border: '1px solid',
  borderColor: alpha('#ffffff', 0.08),
  color: alpha('#ffffff', 0.9),
  backgroundColor: alpha('#ffffff', 0.08),
  '&.Mui-selected': {
    background: 'linear-gradient(120deg, #ff6b81, #ffb86c)',
    color: '#0c0d16',
    borderColor: alpha('#ffffff', 0.16),
    '&:hover': {
      background: 'linear-gradient(120deg, #ff7f92, #ffc07f)',
    },
  },
  '&:hover': {
    backgroundColor: alpha('#ffffff', 0.06),
  },
})

const stepperSx = {
  '& .MuiStepIcon-root': {
    color: alpha('#ffffff', 0.25),
  },
  '& .Mui-active .MuiStepIcon-root': {
    color: '#ff6b81',
  },
  '& .Mui-completed .MuiStepIcon-root': {
    color: '#ffb86c',
  },
  '& .MuiStepLabel-label': {
    color: alpha('#ffffff', 0.75),
  },
  '& .Mui-active .MuiStepLabel-label': {
    color: '#ffffff',
    fontWeight: 700,
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
        placeholder="Type and press Enter"
        fullWidth
      />
      <Stack direction="row" spacing={1} flexWrap="wrap">
        {values.map((k) => (
          <Chip
            key={k}
            label={k}
            onDelete={() => remove(k)}
            color="secondary"
            variant="outlined"
          />
        ))}
      </Stack>
    </Stack>
  )
}

function loadState(): WizardState {
  if (typeof window === 'undefined') return DEFAULT_STATE
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_STATE
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_STATE, ...parsed }
  } catch {
    return DEFAULT_STATE
  }
}

function saveState(state: WizardState) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

function App() {
  const theme = useTheme()
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'))

  const [wizard, setWizard] = useState<WizardState>(() => loadState())
  const [activeStep, setActiveStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<PromptSections | null>(null)
  const [skillBadges, setSkillBadges] = useState<
    { skill: string; reason: string }[]
  >([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [toast, setToast] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'error'
  }>({ open: false, message: '', severity: 'success' })
  const [modelStatus, setModelStatus] = useState<
    'idle' | 'warming' | 'warming-cached' | 'ready' | 'error'
  >('idle')
  const [backend, setBackend] = useState<'webgpu' | 'wasm' | null>(null)
  const [webGpuPreferred, setWebGpuPreferred] = useState<boolean | null>(null)
  const [placeholderIndex, setPlaceholderIndex] = useState(() =>
    Math.floor(Math.random() * PLACEHOLDER_IDEAS.length),
  )
  const previewRef = useRef<HTMLDivElement | null>(null)
  const goalRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const cached = await isModelCached()
      if (cancelled) return
      setModelStatus(cached ? 'warming-cached' : 'warming')
      await prefetchModel()
      if (cancelled) return
      setModelStatus('ready')
      setBackend(getLastBackend())
      setWebGpuPreferred(isWebGPUPreferred())
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDER_IDEAS.length)
    }, 4000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    saveState(wizard)
  }, [wizard])

  useEffect(() => {
    if (activeStep === 3 && goalRef.current) {
      goalRef.current.focus()
    }
  }, [activeStep])

  const scrollToPreview = useCallback(() => {
    if (previewRef.current) {
      previewRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  const canProceed = useMemo(() => {
    if (activeStep < 3) return true
    return wizard.seed.trim().length > 3
  }, [activeStep, wizard.seed])

  const runCompose = useCallback(
    async (state: WizardState) => {
      if (!state.seed.trim()) return
      setLoading(true)
      setIsStreaming(true)
      setError(null)
      try {
        const result = await composePrompt({
          seed: state.seed,
          keywords: state.keywords,
          buildMode: state.buildMode,
          buildApproach: state.buildApproach,
          phaseCount: state.buildApproach === 'multi-phase' ? state.phaseCount : undefined,
          milestones: state.buildApproach === 'multi-phase' ? state.milestones : undefined,
          multiPhasePreference: 'ask',
        })
        setPreview(result)
        const skills = findSkillsFromText(
          `${state.seed} ${state.keywords.join(' ')} ${result.middle}`,
        )
        setSkillBadges(skills)
        setToast({
          open: true,
          message: 'Prompt streamed successfully',
          severity: 'success',
        })
        scrollToPreview()
      } catch (err: any) {
        setError(err?.message ?? 'Failed to generate prompt')
        setToast({
          open: true,
          message: err?.message ?? 'Prompt generation failed',
          severity: 'error',
        })
      } finally {
        setLoading(false)
        setIsStreaming(false)
      }
    },
    [isDesktop, scrollToPreview],
  )

  const regenerate = useCallback(() => {
    void runCompose(wizard)
  }, [runCompose, wizard])

  const handleNext = useCallback(() => {
    setActiveStep((s) => Math.min(s + 1, STEPS.length - 1))
  }, [])

  const handleBack = useCallback(() => {
    setActiveStep((s) => Math.max(s - 1, 0))
  }, [])

  const handleReset = useCallback(() => {
    setWizard(DEFAULT_STATE)
    setActiveStep(0)
    setPreview(null)
    setSkillBadges([])
  }, [])

  const handleBuildModeChange = useCallback(
    (_: React.MouseEvent<HTMLElement>, val: BuildMode | null) => {
      if (!val) return
      setWizard((w) => ({ ...w, buildMode: val }))
    },
    [],
  )

  const handleBuildApproachChange = useCallback(
    (_: React.MouseEvent<HTMLElement>, val: BuildApproach | null) => {
      if (!val) return
      setWizard((w) => ({ ...w, buildApproach: val }))
    },
    [],
  )

  const promptText = useMemo(
    () => preview?.fullPrompt ?? 'Your composed prompt will appear here.',
    [preview],
  )

  const markdownComponents = useMemo(
    () => ({
      pre: (props: any) => (
        <Box
          component="pre"
          sx={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            overflowWrap: 'anywhere',
            m: 0,
          }}
          {...props}
        />
      ),
      code: ({ inline, className, children, ...props }: any) => (
        <Box
          component="code"
          className={className}
          sx={{
            display: inline ? 'inline' : 'block',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            overflowWrap: 'anywhere',
          }}
          {...props}
        >
          {children}
        </Box>
      ),
    }),
    [],
  )

  const copyPrompt = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(promptText)
    } catch {
      setError('Clipboard blocked. Copy manually.')
    }
  }, [promptText])

  const downloadPrompt = useCallback(() => {
    const blob = new Blob([promptText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'next-level-prompt.txt'
    a.click()
    URL.revokeObjectURL(url)
  }, [promptText])

  const handleToastClose = useCallback((_: any, reason?: string) => {
    if (reason === 'clickaway') return
    setToast((prev) => ({ ...prev, open: false }))
  }, [])

  const stickyPreview = (
    <Paper
      ref={previewRef}
      sx={{
        p: 3,
        borderRadius: 3,
        minHeight: 480,
        position: isDesktop ? 'sticky' : 'relative',
        top: isDesktop ? theme.spacing(2) : 'auto',
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        mb={1}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h6">Preview</Typography>
          {isStreaming && (
            <Chip
              size="small"
              color="secondary"
              label="Streaming…"
              icon={<CircularProgress size={14} thickness={5} />}
            />
          )}
        </Stack>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Copy prompt">
            <span>
              <IconButton aria-label="Copy prompt" color="primary" onClick={copyPrompt}>
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Download .txt">
            <span>
              <IconButton aria-label="Download prompt" color="primary" onClick={downloadPrompt}>
                <DownloadIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>
      {loading && (
        <Stack direction="row" spacing={1} alignItems="center" mb={2}>
          <LinearProgress sx={{ flex: 1 }} />
          <Typography variant="caption" color="text.secondary">
            Streaming prompt…
          </Typography>
        </Stack>
      )}
      <Box
        sx={{
          backgroundColor: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 2,
          p: 2,
          fontFamily:
            '"DM Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 14,
          color: 'text.primary',
          minHeight: 320,
          overflow: 'auto',
        }}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {'```\n' + promptText + '\n```'}
        </ReactMarkdown>
      </Box>
      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle2" gutterBottom>
        Detected skills (auto-attached)
      </Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {skillBadges.length === 0 ? (
          <Chip label="grill-me" color="primary" variant="outlined" />
        ) : (
          skillBadges.map((s) => (
            <Chip
              key={s.skill}
              label={`${s.skill}`}
              variant="outlined"
              color={s.skill === 'grill-me' ? 'secondary' : 'default'}
            />
          ))
        )}
        {!skillBadges.some((s) => s.skill === 'grill-me') && (
          <Chip label="grill-me" color="secondary" variant="outlined" />
        )}
      </Stack>
    </Paper>
  )

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Stack spacing={2}>
            <Typography variant="subtitle1">What are you building?</Typography>
            <ToggleButtonGroup
              exclusive
              value={wizard.buildMode}
              onChange={handleBuildModeChange}
              fullWidth
              color="primary"
              sx={{ '& .MuiToggleButton-root': toggleButtonBaseSx(theme) }}
            >
              <ToggleButton value="app" aria-label="Full application">
                <AppsIcon fontSize="small" />&nbsp;Full app
              </ToggleButton>
              <ToggleButton value="feature" aria-label="Feature in app">
                <ExtensionIcon fontSize="small" />&nbsp;Feature
              </ToggleButton>
              <ToggleButton value="change" aria-label="Change existing feature">
                <RepeatIcon fontSize="small" />&nbsp;Change
              </ToggleButton>
              <ToggleButton value="bug" aria-label="Fix a bug">
                <BugReportIcon fontSize="small" />&nbsp;Bug fix
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        )
      case 1:
        return (
          <Stack spacing={2}>
            <Typography variant="subtitle1">Build approach</Typography>
            <ToggleButtonGroup
              exclusive
              value={wizard.buildApproach}
              onChange={handleBuildApproachChange}
              fullWidth
              color="primary"
              sx={{ '& .MuiToggleButton-root': toggleButtonBaseSx(theme) }}
            >
              <ToggleButton value="one-shot" aria-label="One shot">
                <RefreshIcon fontSize="small" />&nbsp;One shot
              </ToggleButton>
              <ToggleButton value="multi-phase" aria-label="Multi phase">
                <TimelineIcon fontSize="small" />&nbsp;Multi-phase
              </ToggleButton>
            </ToggleButtonGroup>
            {wizard.buildApproach === 'multi-phase' && (
              <Stack spacing={2}>
                <TextField
                  label="Desired phase count"
                  type="number"
                  inputProps={{ min: 1, max: 12 }}
                  value={wizard.phaseCount}
                  onChange={(e) =>
                    setWizard((w) => ({
                      ...w,
                      phaseCount: Number(e.target.value) || 1,
                    }))
                  }
                  autoComplete="off"
                  name="phase-count"
                />
                <ChipInput
                  values={wizard.milestones}
                  onChange={(next) => setWizard((w) => ({ ...w, milestones: next }))}
                  label="Add milestone"
                />
              </Stack>
            )}
          </Stack>
        )
      case 2:
        return (
          <Stack spacing={2}>
            <Typography variant="subtitle1">Keywords (chips)</Typography>
            <ChipInput
              values={wizard.keywords}
              onChange={(next) => setWizard((w) => ({ ...w, keywords: next }))}
              label="Keywords"
            />
          </Stack>
        )
      case 3:
      default:
        return (
          <Stack spacing={2}>
            <Typography variant="subtitle1">Goal / initial prompt</Typography>
            <TextField
              label="Your goal"
              multiline
              minRows={4}
              value={wizard.seed}
              onChange={(e) =>
                setWizard((w) => ({
                  ...w,
                  seed: e.target.value,
                }))
              }
              inputRef={goalRef}
              placeholder={PLACEHOLDER_IDEAS[placeholderIndex]}
              fullWidth
              name="goal"
              autoComplete="on"
            />
          </Stack>
        )
    }
  }

  return (
    <>
      {(modelStatus === 'warming' || modelStatus === 'warming-cached') && (
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000,
            bgcolor: 'rgba(12,13,22,0.92)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            textAlign: 'center',
            color: '#f5f7ff',
          }}
        >
          <CircularProgress color="inherit" size={56} thickness={4} />
          <Typography variant="h6" fontWeight={700}>
            Loading prompt generator
          </Typography>
        </Box>
      )}

      <Box
        sx={{
          minHeight: '100vh',
          background:
            'radial-gradient(circle at 20% 20%, rgba(255,107,129,0.16), transparent 30%), radial-gradient(circle at 80% 0%, rgba(255,184,108,0.14), transparent 26%), #0c0d16',
          pb: 6,
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
              opacity: 0.35,
              pointerEvents: 'none',
            }}
          />
          <Box
            sx={{
              position: 'relative',
              zIndex: 1,
              maxWidth: 1200,
              mx: 'auto',
              px: { xs: 2.5, md: 4 },
            }}
          >
            <Stack spacing={2} pt={{ xs: 4, md: 6 }} pb={2}>
              <Typography variant="overline" color="secondary">
                Prompt Builder
              </Typography>
              <Typography variant="h3" fontWeight={800}>
                Retro synthwave prompt composer for coding agents
              </Typography>
              <Typography variant="body1" color="text.secondary" maxWidth={780}>
                Feed a rough idea, move through a quick wizard, and get a structured agent-friendly prompt with starter, middle goals, closing questions, detected skills, and the grill-me safety net. Runs fully in your browser via Transformers.js.
              </Typography>
            </Stack>

            <Grid container spacing={3} pb={6}>
              <Grid item xs={12} md={12} lg={12}>
                <Paper sx={{ p: 3, borderRadius: 3 }}>
                  <Stack spacing={2}>
                    <Stepper activeStep={activeStep} alternativeLabel sx={stepperSx}>
                      {STEPS.map((label) => (
                        <Step key={label}>
                          <StepLabel>{label}</StepLabel>
                        </Step>
                      ))}
                    </Stepper>
                    {renderStepContent()}
                    {error ? (
                      <Typography color="error" variant="body2">
                        {error}
                      </Typography>
                    ) : null}
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      spacing={1}
                    >
                      <Button
                        variant="text"
                        onClick={handleReset}
                        color="secondary"
                      >
                        Reset
                      </Button>
                      <Stack direction="row" spacing={1}>
                        <Button
                          variant="outlined"
                          onClick={handleBack}
                          disabled={activeStep === 0}
                        >
                          Back
                        </Button>
                        <Button
                          variant="contained"
                          onClick={() => {
                            if (activeStep === STEPS.length - 1) {
                              regenerate()
                            } else {
                              handleNext()
                            }
                          }}
                          disabled={!canProceed || loading}
                        >
                          {activeStep === STEPS.length - 1 ? 'Generate' : 'Next'}
                        </Button>
                      </Stack>
                    </Stack>
                    {!isDesktop && preview && (
                      <Button variant="text" onClick={scrollToPreview}>
                        Scroll to preview
                      </Button>
                    )}
                  </Stack>
                </Paper>
                <Paper sx={{ p: 2, mt: 2, borderRadius: 3 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip size="small" label="Client WebGPU primary" color="secondary" />
                    <Chip
                      size="small"
                      label={
                        modelStatus === 'warming'
                          ? 'Model: downloading'
                          : modelStatus === 'warming-cached'
                            ? 'Model: loading cache'
                            : modelStatus === 'error'
                              ? 'Model: error'
                              : backend
                                ? `Model: ${backend}`
                                : 'Model: ready'
                      }
                      color={modelStatus === 'error' ? 'error' : 'default'}
                    />
                    <Chip
                      size="small"
                      label={
                        webGpuPreferred === null
                          ? 'Model pref: detecting'
                          : webGpuPreferred
                            ? 'WebGPU preferred'
                            : 'WASM fallback'
                      }
                    />
                  </Stack>
                  <Typography variant="body2" color="text.secondary" mt={1.5}>
                    Runs Transformers.js entirely in your browser (WebGPU with WASM fallback) to expand your idea. Keep this tab open while the model downloads.
                  </Typography>
                  {import.meta.env.DEV && (
                    <Stack direction="row" spacing={1} mt={1.5}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={async () => {
                          setModelStatus('warming')
                          try {
                            await forceRefetchModel()
                            setBackend(getLastBackend())
                            setModelStatus('ready')
                          } catch (err: any) {
                            setModelStatus('error')
                            setError(err?.message ?? 'Failed to refetch model')
                          }
                        }}
                        disabled={modelStatus === 'warming'}
                      >
                        Refetch model (dev)
                      </Button>
                    </Stack>
                  )}
                </Paper>
              </Grid>

              <Grid item xs={12} md={12} lg={12}>
                {stickyPreview}
              </Grid>
            </Grid>
          </Box>
        </Box>
      </Box>

      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={handleToastClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleToastClose}
          severity={toast.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </>
  )
}
