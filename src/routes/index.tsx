import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  Grid,
  Alert,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Snackbar,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
  CircularProgress,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DownloadIcon from '@mui/icons-material/Download'
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

type Preference = 'ask' | 'force' | 'skip'

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

function App() {
  const [seed, setSeed] = useState('')
  const [keywords, setKeywords] = useState('')
  const [multiPhasePreference, setMultiPhasePreference] =
    useState<Preference>('ask')
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
  const seedInputRef = useRef<HTMLTextAreaElement | null>(null)
  const previewRef = useRef<HTMLDivElement | null>(null)

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

  const scrollToPreview = useCallback(() => {
    if (previewRef.current) {
      previewRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  const regenerate = useCallback(async () => {
    if (!seed.trim()) return
    setLoading(true)
    setIsStreaming(true)
    setError(null)
    try {
      const result = await composePrompt({
        seed,
        keywords,
        multiPhasePreference,
      })
      setPreview(result)
      const skills = findSkillsFromText(`${seed} ${keywords} ${result.middle}`)
      setSkillBadges(skills)
      setToast({
        open: true,
        message: 'Prompt streamed successfully',
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
  }, [seed, keywords, multiPhasePreference])

  const handleGenerate = useCallback(() => {
    scrollToPreview()
    void regenerate()
  }, [regenerate, scrollToPreview])

  useEffect(() => {
    const id = setTimeout(() => {
      regenerate()
    }, 250)
    return () => clearTimeout(id)
  }, [regenerate])

  const handleRefetchModel = useCallback(async () => {
    setModelStatus('warming')
    try {
      await forceRefetchModel()
      setBackend(getLastBackend())
      setModelStatus('ready')
    } catch (err: any) {
      setModelStatus('error')
      setError(err?.message ?? 'Failed to refetch model')
    }
  }, [])

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

  useEffect(() => {
    const id = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDER_IDEAS.length)
    }, 4000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    seedInputRef.current?.focus()
  }, [])

  const handleToastClose = useCallback((_: any, reason?: string) => {
    if (reason === 'clickaway') return
    setToast((prev) => ({ ...prev, open: false }))
  }, [])

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
              maxWidth: '100%',
              mx: 'auto',
              px: { xs: 2, md: 4 },
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
                Feed a rough idea, get a structured agent-friendly prompt with
                starter, middle goals, closing questions, detected skills, and
                the grill-me safety net. Local persistence only; the model runs
                fully in your browser via Transformers.js.
              </Typography>
            </Stack>

            <Grid container spacing={3} pb={6}>
              <Grid item xs={12} md={5}>
                <Paper sx={{ p: 3, borderRadius: 3 }}>
                  <Stack spacing={2}>
                    <TextField
                      label="Your rough idea"
                      multiline
                      minRows={4}
                      value={seed}
                      onChange={(e) => setSeed(e.target.value)}
                      inputRef={seedInputRef}
                      placeholder={PLACEHOLDER_IDEAS[placeholderIndex]}
                      fullWidth
                    />
                    <TextField
                      label="Keywords (optional)"
                      value={keywords}
                      onChange={(e) => setKeywords(e.target.value)}
                      placeholder="react, flags, vercel, postgres"
                      fullWidth
                    />
                    <FormControl fullWidth>
                      <InputLabel id="plan-mode-label">
                        Multi-phase planning
                      </InputLabel>
                      <Select
                        labelId="plan-mode-label"
                        value={multiPhasePreference}
                        label="Multi-phase planning"
                        onChange={(e) =>
                          setMultiPhasePreference(e.target.value as Preference)
                        }
                      >
                        <MenuItem value="ask">
                          Ask every time (default)
                        </MenuItem>
                        <MenuItem value="force">
                          Always include multi-phase
                        </MenuItem>
                        <MenuItem value="skip">
                          Skip unless I request it
                        </MenuItem>
                      </Select>
                    </FormControl>
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="flex-end"
                    >
                      <Tooltip title="Generate prompt">
                        <span>
                          <Button
                            onClick={handleGenerate}
                            startIcon={<RefreshIcon />}
                            disabled={loading || !seed.trim()}
                            variant="contained"
                          >
                            Generate
                          </Button>
                        </span>
                      </Tooltip>
                    </Stack>
                    {error ? (
                      <Typography color="error" variant="body2">
                        {error}
                      </Typography>
                    ) : null}
                  </Stack>
                </Paper>
                <Paper sx={{ p: 2, mt: 2, borderRadius: 3 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip
                      size="small"
                      label="Client WebGPU primary"
                      color="secondary"
                    />
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
                    Runs Transformers.js entirely in your browser (WebGPU with
                    WASM fallback) to expand your idea. Keep this tab open while
                    the model downloads.
                  </Typography>
                  {import.meta.env.DEV && (
                    <Stack direction="row" spacing={1} mt={1.5}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={handleRefetchModel}
                        disabled={modelStatus === 'warming'}
                      >
                        Refetch model (dev)
                      </Button>
                    </Stack>
                  )}
                </Paper>
              </Grid>

              <Grid item xs={12} md={12}>
                <Paper
                  ref={previewRef}
                  sx={{
                    p: 3,
                    borderRadius: 3,
                    position: 'relative',
                    minHeight: 480,
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
                          <IconButton color="primary" onClick={copyPrompt}>
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Download .txt">
                        <span>
                          <IconButton color="primary" onClick={downloadPrompt}>
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
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={markdownComponents}
                    >
                      {'```\n' + promptText + '\n```'}
                    </ReactMarkdown>
                  </Box>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" gutterBottom>
                    Detected skills (auto-attached)
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {skillBadges.length === 0 ? (
                      <Chip
                        label="grill-me"
                        color="primary"
                        variant="outlined"
                      />
                    ) : (
                      skillBadges.map((s) => (
                        <Chip
                          key={s.skill}
                          label={`${s.skill}`}
                          variant="outlined"
                          color={
                            s.skill === 'grill-me' ? 'secondary' : 'default'
                          }
                        />
                      ))
                    )}
                    {!skillBadges.some((s) => s.skill === 'grill-me') && (
                      <Chip
                        label="grill-me"
                        color="secondary"
                        variant="outlined"
                      />
                    )}
                  </Stack>
                </Paper>
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
