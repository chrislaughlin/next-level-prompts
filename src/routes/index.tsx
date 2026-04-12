import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  LinearProgress,
  Paper,
  Snackbar,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DownloadIcon from '@mui/icons-material/Download'
import RefreshIcon from '@mui/icons-material/Refresh'
import TimelineIcon from '@mui/icons-material/Timeline'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  BuildModeSelector,
  STEPS,
  WizardStepIndicator,
  buildToggleButtonSx,
} from '../components/PromptWizardControls'
import type { BuildMode } from '../components/PromptWizardControls'
import { composePrompt } from '../lib/promptEngine'
import type { PromptSections } from '../lib/promptEngine'
import {
  DEFAULT_WIZARD_STATE,
  getPersistedWizardState,
  hydrateWizardState,
} from '../lib/wizardState'
import type { BuildApproach, WizardState } from '../lib/wizardState'
import type { SkillMatch } from '../services/skills'
import { generatePromptWithSkillsServer } from '../server/openrouter'

export const Route = createFileRoute('/')({ component: App })

const PLACEHOLDER_IDEAS = [
  'Build a small todo app and ask the coding agent for an MVP plan before any edits',
  'Fix a flaky OAuth callback bug in our Next.js app and require guard tests',
  'Plan a phased rollout for adding dark mode to an existing React dashboard',
  'Add a Stripe webhook handler and make the coding agent inspect current API patterns first',
  'Refactor a messy data-fetching component while preserving behavior and existing conventions',
  'Create a user profile endpoint and require tests, lint, build, and manual verification',
  'Plan a safe Supabase schema migration with explicit rollback and deployment checks',
  'Investigate a production-only Vercel failure and return a repo-grounded plan first',
  'Integrate a background queue worker and call out env vars, failure modes, and risks',
  'Add search to an existing app without over-scoping the first implementation',
]

const STORAGE_KEY = 'nlp-wizard-state'

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
        placeholder="Type and press Enter"
        fullWidth
        sx={terminalFieldSx}
      />
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
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

function loadState(): WizardState {
  if (typeof window === 'undefined') return DEFAULT_WIZARD_STATE
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_WIZARD_STATE
    const parsed = JSON.parse(raw)
    return hydrateWizardState(parsed)
  } catch {
    return DEFAULT_WIZARD_STATE
  }
}

function saveState(state: WizardState) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(getPersistedWizardState(state)),
    )
  } catch {
    /* ignore */
  }
}

function App() {
  const theme = useTheme()
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'))
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const [wizard, setWizard] = useState<WizardState>(() => loadState())
  const [activeStep, setActiveStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<PromptSections | null>(null)
  const [skillBadges, setSkillBadges] = useState<SkillMatch[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [toast, setToast] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'error'
  }>({ open: false, message: '', severity: 'success' })
  const [placeholderIndex, setPlaceholderIndex] = useState(() =>
    Math.floor(Math.random() * PLACEHOLDER_IDEAS.length),
  )
  const previewRef = useRef<HTMLDivElement | null>(null)
  const goalRef = useRef<HTMLTextAreaElement | null>(null)

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

  const runCompose = useCallback(async (state: WizardState) => {
    if (!state.seed.trim()) return
    setLoading(true)
    setIsStreaming(true)
    setError(null)
    try {
      const refined = await generatePromptWithSkillsServer({
        data: {
          seed: state.seed,
          keywords: state.keywords,
          buildMode: state.buildMode,
          buildApproach: state.buildApproach,
          phaseCount:
            state.buildApproach === 'multi-phase'
              ? state.phaseCount
              : undefined,
          milestones:
            state.buildApproach === 'multi-phase'
              ? state.milestones
              : undefined,
          codebaseContext: state.codebaseContext,
          constraints: state.constraints,
          verification: state.verification,
          nonGoals: state.nonGoals,
        },
      })

      if (!refined?.prompt?.trim()) {
        throw new Error('Prompt generation service returned an empty prompt.')
      }

      const result = await composePrompt({
        seed: state.seed,
        keywords: state.keywords,
        buildMode: state.buildMode,
        buildApproach: state.buildApproach,
        phaseCount:
          state.buildApproach === 'multi-phase' ? state.phaseCount : undefined,
        milestones:
          state.buildApproach === 'multi-phase' ? state.milestones : undefined,
        codebaseContext: state.codebaseContext,
        constraints: state.constraints,
        verification: state.verification,
        nonGoals: state.nonGoals,
        multiPhasePreference: 'ask',
      })

      const mergedSkills: SkillMatch[] = Array.from(
        new Map(
          [
            ...result.skills,
            ...(refined.skillNames ?? []).map((skill) => ({
              skill,
              reason: 'Matched from skills API using extracted keywords',
            })),
          ]
            .filter((skill) => skill.skill.trim())
            .map((skill) => [skill.skill, skill]),
        ).values(),
      )

      result.copyPrompt = refined.prompt
      result.fullPrompt = refined.prompt
      result.skills = mergedSkills

      setPreview(result)
      setSkillBadges(result.skills)
      setToast({
        open: true,
        message: 'Kickoff prompt ready',
        severity: 'success',
      })
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
  }, [])

  const regenerate = useCallback(() => {
    scrollToPreview()
    void runCompose(wizard)
  }, [runCompose, scrollToPreview, wizard])

  const handleNext = useCallback(() => {
    setActiveStep((s) => Math.min(s + 1, STEPS.length - 1))
  }, [])

  const handleBack = useCallback(() => {
    setActiveStep((s) => Math.max(s - 1, 0))
  }, [])

  const handleReset = useCallback(() => {
    setWizard(DEFAULT_WIZARD_STATE)
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
    () =>
      preview?.copyPrompt ??
      'Your coding-agent kickoff prompt will appear here.',
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
    a.download = 'coding-agent-kickoff-prompt.txt'
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
      id="preview"
      sx={{
        p: { xs: 2, sm: 3 },
        borderRadius: 0,
        minHeight: 480,
        position: isDesktop ? 'sticky' : 'relative',
        top: isDesktop ? theme.spacing(2) : 'auto',
        width: '100%',
        overflow: 'hidden',
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
            Output Deck
          </Typography>
          {isStreaming && (
            <Chip
              size="small"
              label="Streaming…"
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
      {loading && (
        <Stack direction="row" spacing={1} alignItems="center" mb={2}>
          <LinearProgress
            sx={{
              flex: 1,
              height: 8,
              borderRadius: 0,
              bgcolor: 'rgba(255,255,255,0.08)',
              '& .MuiLinearProgress-bar': {
                background: 'linear-gradient(90deg, #16f2ff, #ff39d4, #fff36b)',
              },
            }}
          />
          <Typography variant="caption" color="text.secondary">
            Streaming prompt…
          </Typography>
        </Stack>
      )}
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
          minHeight: 320,
          overflow: 'auto',
          boxShadow: 'inset 0 0 0 1px rgba(255,243,107,0.15)',
        }}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={markdownComponents}
        >
          {'```\n' + promptText + '\n```'}
        </ReactMarkdown>
      </Box>
      <Divider sx={{ my: 2, borderColor: 'rgba(255,57,212,0.32)' }} />
      <Stack spacing={2} mb={2}>
        <Box>
          <Typography
            variant="subtitle2"
            gutterBottom
            sx={{ color: '#16f2ff' }}
          >
            Missing context
          </Typography>
          {preview?.missingContext?.length ? (
            <Stack spacing={0.75}>
              {preview.missingContext.map((item) => (
                <Typography key={item} variant="body2" color="text.secondary">
                  - {item}
                </Typography>
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No obvious gaps detected from the current brief.
            </Typography>
          )}
        </Box>

        <Box>
          <Typography
            variant="subtitle2"
            gutterBottom
            sx={{ color: '#fff36b' }}
          >
            Assumptions baked in
          </Typography>
          {preview?.assumptions?.length ? (
            <Stack spacing={0.75}>
              {preview.assumptions.map((item) => (
                <Typography key={item} variant="body2" color="text.secondary">
                  - {item}
                </Typography>
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No extra assumptions were needed.
            </Typography>
          )}
        </Box>
      </Stack>
      <Divider sx={{ my: 2, borderColor: 'rgba(22,242,255,0.25)' }} />
      <Typography variant="subtitle2" gutterBottom sx={{ color: '#16f2ff' }}>
        Suggested skills / patterns
      </Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {skillBadges.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No framework-specific skills detected yet
          </Typography>
        ) : (
          skillBadges.map((s) => (
            <Chip
              key={`${s.skill}-${s.reason}`}
              label={`${s.skill} · ${s.reason}`}
              variant="outlined"
              sx={{
                color: '#fff7cc',
                borderColor: 'rgba(255,243,107,0.72)',
                borderRadius: 0,
              }}
            />
          ))
        )}
      </Stack>
    </Paper>
  )

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Stack spacing={2}>
            <Typography variant="subtitle1">
              Choose the coding task shape
            </Typography>
            <BuildModeSelector
              value={wizard.buildMode}
              onChange={handleBuildModeChange}
              isMobile={isMobile}
            />
          </Stack>
        )
      case 1:
        return (
          <Stack spacing={2}>
            <Typography variant="subtitle1">
              Select the planning depth
            </Typography>
            <ToggleButtonGroup
              exclusive
              value={wizard.buildApproach}
              onChange={handleBuildApproachChange}
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
                aria-label="One shot"
                selected={wizard.buildApproach === 'one-shot'}
                sx={buildToggleButtonSx(wizard.buildApproach === 'one-shot')}
              >
                <RefreshIcon fontSize="small" />
                &nbsp;One shot
              </ToggleButton>
              <ToggleButton
                value="multi-phase"
                aria-label="Multi phase"
                selected={wizard.buildApproach === 'multi-phase'}
                sx={buildToggleButtonSx(wizard.buildApproach === 'multi-phase')}
              >
                <TimelineIcon fontSize="small" />
                &nbsp;Multi-phase
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
                  sx={terminalFieldSx}
                />
                <ChipInput
                  values={wizard.milestones}
                  onChange={(next) =>
                    setWizard((w) => ({ ...w, milestones: next }))
                  }
                  label="Add phase checkpoint"
                />
              </Stack>
            )}
          </Stack>
        )
      case 2:
        return (
          <Stack spacing={2}>
            <Typography variant="subtitle1">
              Load stack, tools, and file hints
            </Typography>
            <ChipInput
              values={wizard.keywords}
              onChange={(next) => setWizard((w) => ({ ...w, keywords: next }))}
              label="Stack / tools / files"
            />
          </Stack>
        )
      case 3:
      default:
        return (
          <Stack spacing={2}>
            <Typography variant="subtitle1">
              Write the task brief and repo context
            </Typography>
            <TextField
              label="Task brief"
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
              sx={terminalFieldSx}
            />
            <TextField
              label="Repository context (optional)"
              multiline
              minRows={3}
              value={wizard.codebaseContext}
              onChange={(e) =>
                setWizard((w) => ({
                  ...w,
                  codebaseContext: e.target.value,
                }))
              }
              placeholder="Relevant folders, files, architecture notes, existing examples, or areas the coding agent should inspect first."
              fullWidth
              name="codebase-context"
              autoComplete="off"
              sx={terminalFieldSx}
            />
            <ChipInput
              values={wizard.constraints}
              onChange={(next) =>
                setWizard((w) => ({ ...w, constraints: next }))
              }
              label="Constraints"
            />
            <ChipInput
              values={wizard.verification}
              onChange={(next) =>
                setWizard((w) => ({ ...w, verification: next }))
              }
              label="Verification commands / done criteria"
            />
            <ChipInput
              values={wizard.nonGoals}
              onChange={(next) => setWizard((w) => ({ ...w, nonGoals: next }))}
              label="Non-goals"
            />
          </Stack>
        )
    }
  }

  return (
    <>
      <Box
        sx={{
          minHeight: '100vh',
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
              <Box
                sx={{
                  border: '2px solid #fff36b',
                  boxShadow:
                    '0 0 0 2px rgba(22,242,255,0.45), 0 0 22px rgba(255,57,212,0.32)',
                  background: 'rgba(6,3,18,0.88)',
                  overflow: 'hidden',
                  px: 2,
                  py: 1.5,
                }}
              >
                <Box
                  className="marquee-text"
                  sx={{
                    display: 'inline-flex',
                    gap: 6,
                    pr: 6,
                    color: '#fff36b',
                    fontSize: { xs: '0.62rem', sm: '0.72rem' },
                  }}
                >
                  <span>Welcome to the neon prompt arcade</span>
                  <span>Welcome to the neon prompt arcade</span>
                  <span>Welcome to the neon prompt arcade</span>
                </Box>
              </Box>

              <Stack spacing={2} alignItems="flex-start">
                <Typography
                  variant="overline"
                  sx={{ color: '#16f2ff', letterSpacing: '0.22em' }}
                >
                  Coding-Agent Prompt Builder
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
                  Feed in a rough software task, add a little repo context, and
                  leave with a copy-ready kickoff prompt for a coding agent. The
                  output is plan-first, verification-aware, and tuned to push
                  the agent toward repo exploration before any code changes.
                </Typography>
              </Stack>

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip
                  label="Model OpenRouter"
                  sx={{
                    color: '#fff7cc',
                    borderColor: 'rgba(255,243,107,0.72)',
                    borderRadius: 0,
                  }}
                  variant="outlined"
                />
                <Chip
                  label="Backend server function"
                  sx={{
                    color: '#d6f2ff',
                    borderColor: 'rgba(22,242,255,0.72)',
                    borderRadius: 0,
                  }}
                  variant="outlined"
                />
                <Chip
                  label="No local model fallback"
                  sx={{
                    color: '#ffb5ef',
                    borderColor: 'rgba(255,57,212,0.72)',
                    borderRadius: 0,
                  }}
                  variant="outlined"
                />
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
                  <WizardStepIndicator
                    activeStep={activeStep}
                    isMobile={isMobile}
                  />
                  {renderStepContent()}
                  {error ? (
                    <Typography color="error" variant="body2">
                      {error}
                    </Typography>
                  ) : null}
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
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={1}
                      width={{ xs: '100%', sm: 'auto' }}
                    >
                      <Button
                        variant="outlined"
                        onClick={handleBack}
                        disabled={activeStep === 0}
                        fullWidth={isMobile}
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
                        fullWidth={isMobile}
                      >
                        {activeStep === STEPS.length - 1 ? 'Generate' : 'Next'}
                      </Button>
                    </Stack>
                  </Stack>
                  {!isDesktop && preview && (
                    <Button variant="text" onClick={scrollToPreview}>
                      Jump to output
                    </Button>
                  )}
                </Stack>
              </Paper>

              <Box width="min(960px, 100%)">{stickyPreview}</Box>
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
