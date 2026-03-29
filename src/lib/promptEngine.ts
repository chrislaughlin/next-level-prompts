export type PromptRequest = {
  seed: string
  keywords?: string
  multiPhasePreference?: 'ask' | 'force' | 'skip'
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
  "Now switch to the grill-me skill and interrogate me on every assumption before implementation."

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

function normalizeSeed(seed: string) {
  return seed.replace(/\s+/g, ' ').trim()
}

function buildStarter(seed: string) {
  return `We are doing ${seed}. You are my paired coding agent; start by planning before you code.`
}

function buildQuestions(seed: string, multiPhasePreference: PromptRequest['multiPhasePreference']) {
  const base = [
    `What is the smallest coherent milestone for "${seed}"?`,
    'Which risks or unknowns should we spike first?',
    'What tests or acceptance checks will prove the milestone works?',
  ]

  if (multiPhasePreference === 'force') {
    base.unshift('Enable multi-phase plan mode and present phase 1.')
  } else if (multiPhasePreference === 'ask') {
    base.unshift('Ask me if I want a multi-phase plan; default to yes if I say nothing.')
  }
  return base
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
  // @ts-expect-error vite env guard
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_DISABLE_TRANSFORMERS === 'true') {
    return null
  }
  // Only run on the client; server/SSR should fall back.
  if (typeof window === 'undefined') return null
  try {
    const { generateClientText } = await import('./clientModel')
    const text = await generateClientText(
      `Expand this software goal into one concise paragraph with objectives and constraints:\n"${seed}"\nParagraph:`,
    )
    const cleaned = text.split('Paragraph:').pop()?.trim() ?? text.trim()
    return cleaned.length > 0 ? cleaned : null
  } catch (err) {
    console.warn('Transformers generation failed, falling back.', err)
    return null
  }
}

function fallbackMiddle(seed: string) {
  return `Goal: deliver ${seed}. Outline the user journey, the core feature set, and the definition of done. Capture risks, scope limits, and critical assumptions in one paragraph.`
}

export async function composePrompt(request: PromptRequest): Promise<PromptSections> {
  const seed = normalizeSeed(request.seed || 'a small feature')
  const starter = buildStarter(seed)

  const middle =
    (await generateMiddleWithTransformers(seed)) ??
    fallbackMiddle(seed)

  const questions = buildQuestions(seed, request.multiPhasePreference)
  const skills = detectSkills(`${seed} ${request.keywords ?? ''} ${middle}`)
  const grillMe = GRILL_ME_TRAILING

  const blocks = [
    'Starter:',
    starter,
    '',
    'Middle (goal focus):',
    middle,
    '',
    'Questions for planning:',
    ...questions.map((q, i) => `${i + 1}. ${q}`),
  ]

  if (skills.length > 0) {
    blocks.push(
      '',
      'Skills to install/use:',
      ...skills.map((s) => `- ${s}`),
      '- grill-me',
      '(If a skill is missing, install it before proceeding.)',
    )
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
