import { findSkillsFromText } from '../services/skills.ts'
import type { SkillMatch } from '../services/skills.ts'

export type PromptRequest = {
  seed: string
  keywords?: string[]
  buildMode?: 'app' | 'feature' | 'change' | 'bug'
  buildApproach?: 'one-shot' | 'multi-phase'
  phaseCount?: number
  milestones?: string[]
  multiPhasePreference?: 'ask' | 'force' | 'skip'
  codebaseContext?: string
  constraints?: string[]
  verification?: string[]
  nonGoals?: string[]
}

export type TaskArchetype =
  | 'greenfield'
  | 'feature'
  | 'bugfix'
  | 'refactor'
  | 'integration'

export type PromptSections = {
  archetype: TaskArchetype
  copyPrompt: string
  fullPrompt: string
  missingContext: string[]
  assumptions: string[]
  skills: SkillMatch[]
}

type TaskProfile = {
  archetype: TaskArchetype
  missionTemplate: (seed: string) => string
  workingRules: string[]
  expectedOutput: string[]
  verification: string[]
  missingContext: string[]
}

const HYPE_WORDS = [
  'awesome',
  'amazing',
  'incredible',
  'revolutionary',
  'synergy',
  'epic',
  'game-changing',
]

const BASE_WORKING_RULES = [
  'Explore the repository before proposing changes.',
  'Inspect existing patterns, architecture, and conventions before suggesting a solution.',
  'Proceed with reasonable assumptions when details are missing, and call those assumptions out explicitly.',
  'Prefer minimal, convention-preserving changes over broad rewrites.',
  'Return a plan before editing files, and stop for approval before implementation.',
]

const BASE_EXPECTED_OUTPUT = [
  'A short understanding of the task in repository terms.',
  'The files, directories, or subsystems that likely need inspection.',
  'A concrete implementation plan that another engineer or agent could execute.',
  'Key risks, dependencies, and assumptions.',
]

const BASE_VERIFICATION = [
  'Describe the checks you would run before claiming the work is complete.',
  'Include relevant tests, linting, build checks, and manual validation.',
  'If any verification step is blocked, say exactly what information or command is missing.',
]

const BASE_SKILL_PATTERNS = [
  'Explore first, then plan, then code.',
  'Use a verification loop before claiming completion.',
  'Prefer existing patterns over introducing new abstractions.',
]

const ARCHETYPE_PROFILES: Record<TaskArchetype, TaskProfile> = {
  greenfield: {
    archetype: 'greenfield',
    missionTemplate: (seed) =>
      `Explore the repository and prepare a minimal, shippable implementation plan for ${seed}.`,
    workingRules: [
      'Keep the first version focused on an MVP and protect scope boundaries.',
      'Treat unrelated enhancements as future work unless they are required to ship the core flow.',
    ],
    expectedOutput: [
      'An MVP scope with the primary user flow and explicit non-goals.',
      'A recommended implementation sequence for the first release.',
    ],
    verification: [
      'Cover the core happy path and at least one likely failure mode.',
    ],
    missingContext: [
      'Target user flow or primary use case for version 1.',
      'Scope boundaries or non-goals to avoid overbuilding.',
    ],
  },
  feature: {
    archetype: 'feature',
    missionTemplate: (seed) =>
      `Explore the repository and prepare a plan to implement ${seed} with minimal, convention-preserving changes.`,
    workingRules: [
      'Preserve current behavior outside the requested scope.',
      'Call out regression risks for adjacent flows.',
    ],
    expectedOutput: [
      'The likely touch points and the safest order for making the change.',
      'Regression risks and compatibility notes.',
    ],
    verification: [
      'List the specific behavior that should work before and after the change.',
    ],
    missingContext: [
      'Relevant files, directories, or existing examples to inspect first.',
      'Acceptance criteria that define when the feature is done.',
    ],
  },
  bugfix: {
    archetype: 'bugfix',
    missionTemplate: (seed) =>
      `Explore the repository and prepare a safe bugfix plan for ${seed}, including regression protection.`,
    workingRules: [
      'Find the most likely reproduction path and the smallest safe fix.',
      'Preserve intended behavior while eliminating the defect.',
    ],
    expectedOutput: [
      'Likely repro steps, expected vs actual behavior, and probable root-cause areas.',
      'Guard tests or checks that reduce the chance of the bug returning.',
    ],
    verification: [
      'Verify the bug can be reproduced before the fix and is covered after the fix.',
    ],
    missingContext: [
      'Repro steps, logs, or expected-vs-actual behavior.',
      'Any failing tests, screenshots, or error messages tied to the bug.',
    ],
  },
  refactor: {
    archetype: 'refactor',
    missionTemplate: (seed) =>
      `Explore the repository and prepare a safe refactor plan for ${seed} without changing intended behavior.`,
    workingRules: [
      'Preserve runtime behavior and external contracts unless the task says otherwise.',
      'Be explicit about invariants that must hold during and after the refactor.',
    ],
    expectedOutput: [
      'The current pain points, the invariants to preserve, and the safest migration sequence.',
      'A rollback or containment strategy if the refactor touches high-risk areas.',
    ],
    verification: [
      'Show how behavior parity will be checked after the refactor.',
    ],
    missingContext: [
      'Current pain points or the reason the refactor is needed.',
      'Behavioral invariants that must not change.',
    ],
  },
  integration: {
    archetype: 'integration',
    missionTemplate: (seed) =>
      `Explore the repository and prepare an integration plan for ${seed} that respects existing contracts and operational constraints.`,
    workingRules: [
      'Inspect interfaces, auth boundaries, env vars, and deployment/runtime constraints before suggesting changes.',
      'Call out failure modes, rollback concerns, and external dependencies.',
    ],
    expectedOutput: [
      'The relevant interfaces, contracts, env vars, and dependency touch points.',
      'Integration risks, failure modes, and operational considerations.',
    ],
    verification: [
      'Include contract validation, integration checks, and deployment/runtime verification where relevant.',
    ],
    missingContext: [
      'External services, API contracts, auth requirements, or env vars involved.',
      'Commands or environments needed to validate the integration.',
    ],
  },
}

function normalizeSeed(seed: string) {
  return seed.replace(/\s+/g, ' ').trim()
}

function normalizeList(values?: string[]) {
  return Array.from(
    new Set((values ?? []).map((value) => value.trim()).filter(Boolean)),
  )
}

function tokenSet(text: string) {
  return new Set(
    (text.toLowerCase().match(/[a-z][a-z0-9+#.-]*/g) ?? []).filter(Boolean),
  )
}

function hasAny(tokens: Set<string>, values: string[]) {
  return values.some((value) => tokens.has(value))
}

function stripHype(text: string) {
  if (!text) return text
  const hypeRegex = new RegExp(`\\b(${HYPE_WORDS.join('|')})\\b`, 'gi')
  return text
    .replace(hypeRegex, '')
    .replace(/[!]{2,}/g, '!')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function cleanModelLine(text: string) {
  return stripHype(
    text
      .replace(/^(mission|sentence|rewrite)\s*:\s*/i, '')
      .replace(/^["'`]+/, '')
      .replace(/["'`]+$/, '')
      .replace(/\s+/g, ' ')
      .trim(),
  )
}

function classifyCodingTask(request: PromptRequest): TaskProfile {
  const seed = normalizeSeed(request.seed)
  const haystack = [
    seed,
    ...(request.keywords ?? []),
    request.codebaseContext ?? '',
    ...(request.constraints ?? []),
    ...(request.verification ?? []),
    ...(request.nonGoals ?? []),
  ]
    .join(' ')
    .toLowerCase()
  const tokens = tokenSet(haystack)
  const greenfieldIntent =
    request.buildMode === 'app' ||
    /\b(build|create|plan|scaffold|start|launch|ship)\b[\w\s-]{0,40}\b(app|mvp|prototype|starter|project|tool|site)\b/.test(
      haystack,
    )

  if (
    request.buildMode === 'bug' ||
    hasAny(tokens, ['bug', 'fix', 'broken', 'crash', 'failure', 'regression', 'issue'])
  ) {
    return ARCHETYPE_PROFILES.bugfix
  }

  if (
    hasAny(tokens, [
      'refactor',
      'cleanup',
      'rename',
      'restructure',
      'simplify',
      'debt',
      'modernize',
      'extract',
      'consolidate',
    ])
  ) {
    return ARCHETYPE_PROFILES.refactor
  }

  if (
    hasAny(tokens, [
      'api',
      'endpoint',
      'oauth',
      'auth',
      'webhook',
      'integration',
      'deploy',
      'vercel',
      'ci',
      'infra',
      'migration',
      'database',
      'schema',
      'stripe',
      'supabase',
      'worker',
      'queue',
      'serverless',
    ])
  ) {
    return ARCHETYPE_PROFILES.integration
  }

  if (
    greenfieldIntent ||
    hasAny(tokens, [
      'mvp',
      'prototype',
      'starter',
      'greenfield',
      'scaffold',
      'launch',
      'ship',
      'planner',
    ])
  ) {
    return ARCHETYPE_PROFILES.greenfield
  }

  return ARCHETYPE_PROFILES.feature
}

function buildMissingContext(
  request: PromptRequest,
  profile: TaskProfile,
  keywords: string[],
  verification: string[],
  nonGoals: string[],
) {
  const items: string[] = []

  if (!keywords.length) {
    items.push('Framework, stack, tools, or file paths that should guide the repo exploration.')
  }

  if (!request.codebaseContext?.trim()) {
    items.push('Relevant repository areas, entry points, or existing examples to inspect first.')
  }

  if (!verification.length) {
    items.push('Concrete verification commands, done criteria, or manual checks.')
  }

  if (!nonGoals.length) {
    items.push('Explicit non-goals or boundaries that should stay out of scope.')
  }

  for (const item of profile.missingContext) {
    if (!items.includes(item)) items.push(item)
  }

  return items.slice(0, 4)
}

function buildAssumptions(
  request: PromptRequest,
  keywords: string[],
  constraints: string[],
  verification: string[],
  nonGoals: string[],
) {
  const assumptions: string[] = []

  if (!keywords.length) {
    assumptions.push(
      'No stack or file hints were provided, so the downstream agent should detect the framework and relevant entry points from the repo.',
    )
  }

  if (!request.codebaseContext?.trim()) {
    assumptions.push(
      'No repository context was provided, so the downstream agent should locate the most relevant subsystem and follow existing conventions there.',
    )
  }

  if (!constraints.length) {
    assumptions.push(
      'No extra constraints were provided, so the downstream agent should prefer the smallest convention-preserving solution.',
    )
  }

  if (!verification.length) {
    assumptions.push(
      'No verification commands were supplied, so the downstream agent should infer the project-standard tests, linting, build, and manual checks.',
    )
  }

  if (!nonGoals.length) {
    assumptions.push(
      'No non-goals were listed, so unrelated refactors and extra features should be treated as out of scope.',
    )
  }

  if (
    request.buildApproach === 'multi-phase' &&
    normalizeList(request.milestones).length === 0
  ) {
    assumptions.push(
      'No explicit milestones were provided, so the downstream agent should derive sensible phases from repo boundaries and risk.',
    )
  }

  return assumptions.slice(0, 5)
}

async function polishMissionLine(
  request: PromptRequest,
  archetype: TaskArchetype,
  draft: string,
) {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
    return draft
  }

  // @ts-expect-error vite env is injected in browser/Vite contexts only
  const viteEnv = typeof import.meta !== 'undefined' ? import.meta.env : undefined
  if (viteEnv?.SSR) return draft
  if (typeof window === 'undefined') return draft

  try {
    const { generateClientTextWithTimeout } = await import('./clientModel')
    const prompt = [
      'Rewrite the following software-task mission for a coding agent.',
      'Requirements:',
      '- Return one sentence only.',
      '- Keep it agent-neutral.',
      '- Keep the wording plan-first.',
      '- No markdown, no quotes, no bullet points.',
      '- No hype, no filler, no new features.',
      `Task type: ${archetype}`,
      `Original user idea: ${request.seed}`,
      `Draft: ${draft}`,
      'Sentence:',
    ].join('\n')

    const raw = await generateClientTextWithTimeout(
      prompt,
      {
        max_new_tokens: 48,
        temperature: 0.2,
        top_p: 0.85,
        top_k: 40,
        repetition_penalty: 1.08,
      },
      6000,
    )
    const candidate = cleanModelLine(raw.split('Sentence:').pop() ?? raw)

    if (
      candidate.length < 20 ||
      candidate.length > 220 ||
      /<(?:mission|sentence|rewrite)>/i.test(candidate)
    ) {
      return draft
    }

    return candidate
  } catch {
    return draft
  }
}

function formatListBlock(title: string, items: string[]) {
  return [title, ...items.map((item) => `- ${item}`), '']
}

export async function composePrompt(request: PromptRequest): Promise<PromptSections> {
  const seed = normalizeSeed(request.seed || 'the requested coding task')
  const keywords = normalizeList(request.keywords)
  const constraints = normalizeList(request.constraints)
  const verification = normalizeList(request.verification)
  const milestones = normalizeList(request.milestones)
  const nonGoals = normalizeList(request.nonGoals)
  const profile = classifyCodingTask({ ...request, seed, keywords })

  const missingContext = buildMissingContext(
    request,
    profile,
    keywords,
    verification,
    nonGoals,
  )
  const assumptions = buildAssumptions(
    request,
    keywords,
    constraints,
    verification,
    nonGoals,
  )
  const skills = findSkillsFromText(
    [seed, request.codebaseContext ?? '', ...keywords, ...constraints, ...verification].join(' '),
  )

  const missionDraft = profile.missionTemplate(seed)
  const mission = await polishMissionLine(request, profile.archetype, missionDraft)

  const contextItems = [`User request: ${seed}`]

  if (keywords.length > 0) {
    contextItems.push(`Stack / tools / files: ${keywords.join(', ')}`)
  } else {
    contextItems.push('Stack / tools / files: infer from the repository during exploration.')
  }

  if (request.codebaseContext?.trim()) {
    contextItems.push(`Repository context: ${stripHype(request.codebaseContext.trim())}`)
  } else {
    contextItems.push('Repository context: not provided; locate the relevant area in the repo first.')
  }

  if (request.buildApproach === 'multi-phase') {
    contextItems.push(
      `Delivery shape: phased plan with ${request.phaseCount ?? 3} phases${milestones.length ? ` and checkpoints: ${milestones.join(', ')}` : ''}.`,
    )
  } else {
    contextItems.push('Delivery shape: one planning pass before any code changes.')
  }

  if (constraints.length > 0) {
    contextItems.push(`Constraints: ${constraints.join('; ')}`)
  }

  if (nonGoals.length > 0) {
    contextItems.push(`Non-goals: ${nonGoals.join('; ')}`)
  }

  const workingRules = Array.from(
    new Set([
      ...BASE_WORKING_RULES,
      ...profile.workingRules,
      'Keep the response concise, repo-grounded, and implementation-ready.',
    ]),
  )

  const expectedOutput = Array.from(
    new Set([
      ...BASE_EXPECTED_OUTPUT,
      ...profile.expectedOutput,
      request.buildApproach === 'multi-phase'
        ? `Phase the plan into ${request.phaseCount ?? 3} implementation phases.`
        : 'Return a single coherent plan rather than multiple competing options.',
      'Do not start implementation until the plan is approved.',
    ]),
  )

  const verificationItems = Array.from(
    new Set([
      ...BASE_VERIFICATION,
      ...profile.verification,
      verification.length > 0
        ? `Include these user-specified checks when relevant: ${verification.join('; ')}`
        : 'Infer the project-standard tests, linting, build, and manual checks if commands are not supplied.',
    ]),
  )

  const suggestedPatterns = Array.from(
    new Set([
      ...BASE_SKILL_PATTERNS,
      ...skills.map((skill) => `${skill.skill}: ${skill.reason}`),
    ]),
  )

  const promptBlocks = [
    ...formatListBlock('Mission', [mission]),
    ...formatListBlock('Context you should use', contextItems),
    ...formatListBlock('Working rules', workingRules),
    ...formatListBlock('Expected output', expectedOutput),
    ...formatListBlock('Verification', verificationItems),
    ...formatListBlock('Suggested skills/patterns', suggestedPatterns),
  ]

  const copyPrompt = promptBlocks.join('\n').trim()

  return {
    archetype: profile.archetype,
    copyPrompt,
    fullPrompt: copyPrompt,
    missingContext,
    assumptions,
    skills,
  }
}
