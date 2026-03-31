export type PromptRequest = {
  seed: string
  keywords?: string[]
  buildMode?: 'app' | 'feature' | 'change' | 'bug'
  buildApproach?: 'one-shot' | 'multi-phase'
  phaseCount?: number
  milestones?: string[]
  multiPhasePreference?: 'ask' | 'force' | 'skip' // kept for backward compatibility
}

export type PromptSections = {
  starter: string
  middle: string
  questions: string[]
  skills: string[]
  grillMe: string
  fullPrompt: string
}

const GRILL_ME_TRAILING =
  'Switch to the grill-me skill and interrogate assumptions before implementation.'

type TaskDomain = 'code' | 'writing' | 'design' | 'research' | 'data' | 'general'

type TaskProfile = {
  domain: TaskDomain
  deliverableHint: string
  constraints: string[]
  formatHint: string
  questions: string[]
  checks: string[]
}

const SKILL_MAP: Record<string, string> = {
  react: 'react-best-practices',
  next: 'nextjs',
  nextjs: 'nextjs',
  supabase: 'supabase-postgres-best-practices',
  postgres: 'supabase-postgres-best-practices',
  stripe: 'stripe-best-practices',
  figma: 'figma',
  tailwind: 'shadcn',
  mui: 'mui',
  vercel: 'deploy-to-vercel',
  auth: 'auth',
  api: 'vercel-functions',
  ai: 'ai-sdk',
  llm: 'ai-sdk',
}

const HYPE_WORDS = ['awesome', 'amazing', 'incredible', 'revolutionary', 'synergy', 'epic', 'game-changing']

const BASE_CONSTRAINTS = [
  'Preserve the user intent; do not invent new features or data.',
  'Keep wording plain, direct, and concise (no hype or filler).',
  'Prefer bullet lists over long paragraphs; keep under ~180 words.',
]

const QUALITY_BAR = [
  'State the objective first, then constraints, then deliverable.',
  'Make acceptance checks concrete and verifiable.',
  'If information is missing, ask only 1-2 blocking questions at the end.',
]

const DOMAIN_RULES: { domain: TaskDomain; keywords: string[]; deliverableHint: string; constraints?: string[]; questions?: string[]; formatHint?: string; checks?: string[] }[] = [
  {
    domain: 'code',
    keywords: ['api', 'endpoint', 'bug', 'fix', 'typescript', 'ts', 'javascript', 'component', 'next', 'react', 'function', 'handler'],
    deliverableHint: 'Return a concise plan plus code-level guidance or patch outline.',
    constraints: [
      'Include code fences with language tags when showing code.',
      'Prioritise correctness, security, and testability over speed.',
    ],
    questions: [
      'Which environment, framework version, and data sources are in scope?',
      'Any acceptance tests or error cases that must be handled?',
    ],
    formatHint: 'Use sections: Objective, Context, Steps, Deliverable, Checks.',
  },
  {
    domain: 'writing',
    keywords: ['write', 'blog', 'article', 'post', 'copy', 'email', 'draft', 'summarize'],
    deliverableHint: 'Return an outline and tone guardrails plus the final writing task.',
    constraints: ['Match the requested voice; avoid clichés and marketing fluff.'],
    questions: ['Who is the audience and what action should they take?'],
    formatHint: 'Use sections: Objective, Audience, Key Points, Style, Deliverable.',
  },
  {
    domain: 'design',
    keywords: ['design', 'ui', 'ux', 'figma', 'layout', 'mock'],
    deliverableHint: 'Return UX goals, constraints, and acceptance for the design artifact.',
    constraints: ['Call out platform/device targets and accessibility requirements.'],
    questions: ['What screen sizes, brand tokens, and accessibility targets are required?'],
    formatHint: 'Use sections: Objective, Users, Requirements, Deliverable, Checks.',
  },
  {
    domain: 'research',
    keywords: ['research', 'investigate', 'compare', 'analyze', 'analysis'],
    deliverableHint: 'Return a plan for evidence gathering plus the synthesis format.',
    constraints: ['Cite sources; distinguish facts vs assumptions.'],
    questions: ['What time frame, regions, or datasets are in scope?'],
    formatHint: 'Use sections: Objective, Scope, Evidence Plan, Deliverable, Checks.',
  },
  {
    domain: 'data',
    keywords: ['sql', 'query', 'data', 'dataset', 'csv', 'metrics', 'analytics'],
    deliverableHint: 'Return the query/analysis task with schema assumptions and validation.',
    constraints: ['Be explicit about schema, filters, and edge cases; prefer deterministic steps.'],
    questions: ['Which tables/columns are available and how large is the dataset?'],
    formatHint: 'Use sections: Objective, Inputs, Steps, Output, Validation.',
  },
  {
    domain: 'vision',
    keywords: ['photo', 'camera', 'image', 'vision', 'fridge', 'mobile', 'ios', 'android'],
    deliverableHint: 'Return a concise product prompt covering capture → detect → suggest meals with privacy constraints.',
    constraints: [
      'Do not invent ingredients; base meal ideas only on detected items.',
      'Include allergen/avoidance notes if the user provides them.',
      'Prefer on-device processing unless server use is explicitly allowed.',
    ],
    questions: [
      'Which meal types (breakfast/lunch/dinner) and dietary restrictions should be honored?',
      'Is processing allowed server-side or must it stay on device?',
    ],
    formatHint: 'Use sections: Objective, Inputs (images), Flow, Deliverable, Checks.',
    checks: [
      'Photo captured, items detected, 3 meal ideas returned, no invented ingredients.',
      'Each meal idea references detected items and notes allergens/avoidances.',
    ],
  },
]

function normalizeSeed(seed: string) {
  return seed.replace(/\s+/g, ' ').trim()
}

function stripHype(text: string) {
  if (!text) return text
  const hypeRegex = new RegExp(`\\b(${HYPE_WORDS.join('|')})\\b`, 'gi')
  return text.replace(hypeRegex, '').replace(/[!]{2,}/g, '!').replace(/\s{2,}/g, ' ').trim()
}

function classifyTask(seed: string, keywords?: string): TaskProfile {
  const haystack = `${seed} ${keywords ?? ''}`.toLowerCase()
  const match = DOMAIN_RULES.find((rule) => rule.keywords.some((kw) => haystack.includes(kw)))

  if (!match) {
    return {
      domain: 'general',
      deliverableHint: 'Return a concise task prompt with constraints and acceptance checks.',
      constraints: [],
      formatHint: 'Use sections: Objective, Context, Deliverable, Constraints, Checks.',
      questions: [],
      checks: ['Output is concise, testable, and free of invented details.'],
    }
  }

  return {
    domain: match.domain,
    deliverableHint: match.deliverableHint,
    constraints: match.constraints ?? [],
    formatHint: match.formatHint ?? 'Use sections: Objective, Context, Deliverable, Constraints, Checks.',
    questions: match.questions ?? [],
    checks: match.checks ?? ['Output is concise, testable, and free of invented details.'],
  }
}

function buildStarter(objective: string) {
  return `Objective: ${objective}`
}

function buildQuestions(
  seed: string,
  multiPhasePreference: PromptRequest['multiPhasePreference'],
  buildApproach: PromptRequest['buildApproach'],
  profile: TaskProfile,
) {
  const base = [
    `Smallest useful milestone for "${seed}"?`,
    'Critical risks/unknowns to de-risk first?',
    'Acceptance checks that prove it is done?',
    ...profile.questions,
  ]

  if (multiPhasePreference === 'force') {
    base.unshift('Enable multi-phase plan mode and present phase 1 with scope guardrails.')
  } else if (multiPhasePreference === 'ask') {
    base.unshift('Ask once whether multi-phase is desired; default to yes if no answer.')
  }

  if (buildApproach === 'multi-phase') {
    base.unshift('Propose a phased plan with milestones and clear exit criteria for each phase.')
  }
  return Array.from(new Set(base.filter(Boolean)))
}

function keywordCandidates(text: string) {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .match(/[a-z][a-z0-9+#.-]{1,}/g)
        ?.slice(0, 50) ?? [],
    ),
  )
}

function detectSkills(text: string) {
  const matches = keywordCandidates(text)
  const skills = new Set<string>()
  matches.forEach((word) => {
    const found = SKILL_MAP[word]
    if (found) skills.add(found)
  })
  return Array.from(skills)
}

async function generateMiddleWithTransformers(seed: string): Promise<string | null> {
  // Avoid heavy downloads during tests or when explicitly disabled.
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
    return null
  }
  if (import.meta.env.SSR) return null
  // @ts-expect-error vite env guard
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_DISABLE_TRANSFORMERS === 'true') {
    return null
  }
  // Only run on the client; server/SSR should fall back.
  if (typeof window === 'undefined') return null
  try {
    const { generateClientText } = await import('./clientModel')
    const prompt = `You rewrite rough ideas into crisp task prompts. Keep it short, structured, and hype-free.\nFormat strictly:\nObjective: <one sentence>\nKey Points: - <3 bullets max>\nDeliverable: <one sentence>\nIdea: "${seed}"\nRewrite:`

    const text = await generateClientText(prompt, {
      max_new_tokens: 120,
      temperature: 0.35,
      top_p: 0.85,
      top_k: 50,
      repetition_penalty: 1.08,
    })
    const cleaned = text.split('Rewrite:').pop()?.trim() ?? text.trim()
    return cleaned.length > 0 ? cleaned : null
  } catch (err) {
    console.warn('Transformers generation failed, falling back.', err)
    return null
  }
}

function fallbackMiddle(seed: string, profile: TaskProfile) {
  return `Objective: ${seed}. Key points: stay within scope, avoid invention, deliver a concrete, testable outcome. ${profile.deliverableHint}`
}

function stripLabel(text: string) {
  // Remove leading labels like "Objective:", "Deliverable:", etc.
  return text.replace(/^(objective|deliverable|output|goal|aim)\s*:\s*/i, '')
}

function cleanSegment(text: string) {
  const noLabel = stripLabel(text)
  return stripHype(noLabel.replace(/^[^A-Za-z0-9]+/, '').trim())
}

function ensureMeaningful(text: string, fallback: string) {
  const cleaned = text.trim()
  if (cleaned.length < 8) return fallback
  if (/(sentence|rewrite|placeholder|<|>)/i.test(cleaned)) return fallback
  return cleaned
}

function extractStructuredRewrite(raw: string | null, seed: string, profile: TaskProfile) {
  if (!raw) {
    return fallbackMiddle(seed, profile)
  }

  const lines = raw.split(/\n+/).map((l) => l.trim()).filter(Boolean)
  const objectiveLine = lines.find((l) => l.toLowerCase().startsWith('objective'))
  const deliverableLine = lines.find((l) => l.toLowerCase().startsWith('deliverable'))
  const keyPoints = lines.filter((l) => l.toLowerCase().startsWith('-'))

  const objectiveCandidate = cleanSegment(objectiveLine ?? lines[0] ?? seed)
  const deliverableCandidate = cleanSegment(deliverableLine ?? profile.deliverableHint)

  const objective = ensureMeaningful(objectiveCandidate, seed)
  const deliverable = ensureMeaningful(deliverableCandidate, profile.deliverableHint)
  const merged = [objective, ...(keyPoints.length ? keyPoints : []), deliverable]
  return merged.join('\n')
}

export async function composePrompt(request: PromptRequest): Promise<PromptSections> {
  const seed = normalizeSeed(request.seed || 'a small feature')
  const keywordText = normalizeSeed((request.keywords ?? []).join(' '))
  const profile = classifyTask(seed, keywordText)

  const middleRaw = await generateMiddleWithTransformers(seed)
  const middle = extractStructuredRewrite(middleRaw, seed, profile)
  const objectiveLine = cleanSegment(middle.split('\n')[0] ?? seed)
  const starter = buildStarter(objectiveLine)

  const questions = buildQuestions(seed, request.multiPhasePreference, request.buildApproach, profile)
  const skills = detectSkills(`${seed} ${keywordText} ${middle}`)
  const grillMe = GRILL_ME_TRAILING

  const constraints = Array.from(new Set([...BASE_CONSTRAINTS, ...profile.constraints]))
  const checks = Array.from(new Set(profile.checks.length ? profile.checks : ['Output is concise, testable, and free of invented details.']))

  const blocks = [
    'Objective:',
    objectiveLine,
    '',
    'Context & Inputs:',
    `- User idea: ${seed}`,
  ]

  if ((request.keywords ?? []).length > 0) {
    blocks.push(`- Keywords: ${stripHype(keywordText)}`)
  }

  if (request.buildMode) {
    blocks.push(`- Build mode: ${request.buildMode}`)
  }

  if (request.buildApproach) {
    blocks.push(`- Build approach: ${request.buildApproach}`)
  }

  if (request.buildApproach === 'multi-phase') {
    if (request.phaseCount) {
      blocks.push(`- Target phase count: ${request.phaseCount}`)
    }
    if ((request.milestones ?? []).length > 0) {
      blocks.push(`- Milestones: ${(request.milestones ?? []).join('; ')}`)
    }
  }

  blocks.push('', 'Deliverable:', `- ${profile.deliverableHint}`)

  blocks.push('', 'Constraints:', ...constraints.map((c) => `- ${c}`))

  if (request.buildMode === 'change') {
    blocks.push('- Keep regression risk minimal and note rollback criteria.')
  } else if (request.buildMode === 'bug') {
    blocks.push('- Include repro steps, expected vs actual, and guard tests.')
  }

  if (request.buildApproach === 'multi-phase') {
    blocks.push('- Provide phase-by-phase deliverables with exit criteria.')
  }

  blocks.push('', 'Format:', `- ${profile.formatHint}`)

  blocks.push('', 'Quality Bar:', ...QUALITY_BAR.map((c) => `- ${c}`))

  blocks.push('', 'Checks:', ...checks.map((c) => `- ${c}`))

  blocks.push('', 'Questions (ask only if blocking):', ...questions.map((q, i) => `${i + 1}. ${q}`))

  if (skills.length > 0) {
    blocks.push('', 'Skills to install/use:', ...skills.map((s) => `- ${s}`), '- grill-me')
  } else {
    blocks.push('', 'Skills to install/use:', '- grill-me')
  }

  blocks.push('', grillMe)

  return {
    starter,
    middle,
    questions,
    skills,
    grillMe,
    fullPrompt: blocks.join('\n'),
  }
}
