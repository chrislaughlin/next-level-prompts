import { createServerFn } from '@tanstack/react-start'
import { composePrompt } from '../lib/promptEngine'
import type { PromptRequest } from '../lib/promptEngine'
import { findSkillsFromText } from '../services/skills'

type OpenRouterGenerationHints = {
  max_new_tokens?: number
  temperature?: number
  top_p?: number
}

type OpenRouterPolishRequest = {
  prompt: string
  overrides?: OpenRouterGenerationHints
}

export type PromptPipelineRequest = Pick<
  PromptRequest,
  | 'seed'
  | 'keywords'
  | 'buildMode'
  | 'buildApproach'
  | 'phaseCount'
  | 'milestones'
  | 'codebaseContext'
  | 'constraints'
  | 'verification'
  | 'nonGoals'
>

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
const OPENROUTER_MODEL = 'minimax/minimax-m2.5:free'
const OPENROUTER_TIMEOUT_MS = 8_000

type FetchLike = typeof fetch

function getOpenRouterApiKey() {
  return (
    process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY || ''
  )
}

function getRefererHeader() {
  const referer =
    process.env.OPENROUTER_SITE_URL || process.env.VITE_OPENROUTER_SITE_URL
  return referer ? { 'HTTP-Referer': referer } : {}
}

function normalizeInputList(values?: string[]) {
  return Array.from(
    new Set((values ?? []).map((value) => value.trim()).filter(Boolean)),
  )
}

function normalizeSkillName(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^\/+/, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
}

function appendSkillCalls(generatedPrompt: string, skillNames: string[]) {
  if (!skillNames.length) return generatedPrompt
  const suffix = skillNames.map((name) => `/${name}`).join(' ')
  return `${generatedPrompt}\n\n${suffix}`
}

function toPromptRequest(payload: PromptPipelineRequest): PromptRequest {
  return {
    seed: payload.seed,
    keywords: payload.keywords,
    buildMode: payload.buildMode,
    buildApproach: payload.buildApproach,
    phaseCount:
      payload.buildApproach === 'multi-phase' ? payload.phaseCount : undefined,
    milestones:
      payload.buildApproach === 'multi-phase' ? payload.milestones : undefined,
    codebaseContext: payload.codebaseContext,
    constraints: payload.constraints,
    verification: payload.verification,
    nonGoals: payload.nonGoals,
    multiPhasePreference: 'ask',
  }
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
  fetchFn: FetchLike = fetch,
) {
  const controller = new AbortController()
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort()
      reject(new Error(`Request timed out after ${timeoutMs}ms.`))
    }, timeoutMs)
  })

  try {
    return await Promise.race([
      fetchFn(input, { ...init, signal: controller.signal }),
      timeoutPromise,
    ])
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}

function buildPromptGenerationInput(data: PromptPipelineRequest) {
  const keywords = normalizeInputList(data.keywords)
  const milestones = normalizeInputList(data.milestones)
  const constraints = normalizeInputList(data.constraints)
  const verification = normalizeInputList(data.verification)
  const nonGoals = normalizeInputList(data.nonGoals)

  const lines = [
    `User goal: ${data.seed.trim()}`,
    data.buildMode ? `Build mode: ${data.buildMode}` : '',
    data.buildApproach ? `Build approach: ${data.buildApproach}` : '',
    data.phaseCount ? `Preferred phase count: ${data.phaseCount}` : '',
    keywords.length
      ? `Stack/files/context keywords: ${keywords.join(', ')}`
      : '',
    milestones.length ? `Milestones: ${milestones.join(', ')}` : '',
    data.codebaseContext?.trim()
      ? `Repo context: ${data.codebaseContext.trim()}`
      : '',
    constraints.length ? `Constraints: ${constraints.join('; ')}` : '',
    verification.length
      ? `Verification expectations: ${verification.join('; ')}`
      : '',
    nonGoals.length ? `Non-goals: ${nonGoals.join('; ')}` : '',
  ].filter(Boolean)

  return [
    'You write high-quality prompts for AI coding agents.',
    'Return only the final prompt text.',
    'Keep it practical, repository-first, and plan-before-code.',
    'Avoid hype and avoid hardcoded implementation details unless explicitly provided by the user.',
    ...lines,
  ].join('\n')
}

async function runOpenRouterPrompt(
  apiKey: string,
  prompt: string,
  overrides?: OpenRouterGenerationHints,
  fetchFn: FetchLike = fetch,
  timeoutMs: number = OPENROUTER_TIMEOUT_MS,
) {
  const response = await fetchWithTimeout(
    OPENROUTER_API_URL,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...getRefererHeader(),
        'X-Title': 'Next Level Prompts',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: overrides?.temperature ?? 0.4,
        top_p: overrides?.top_p ?? 0.85,
        max_tokens: overrides?.max_new_tokens ?? 120,
      }),
    },
    timeoutMs,
    fetchFn,
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `OpenRouter request failed (${response.status}): ${errorText}`,
    )
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }

  const text = json.choices?.[0]?.message?.content?.trim() ?? ''
  if (!text) {
    throw new Error('OpenRouter returned an empty response.')
  }

  return text
}

function buildSkillNamesFromTexts(...texts: Array<string | undefined>) {
  const joined = texts
    .map((text) => text?.trim())
    .filter(Boolean)
    .join(' ')
  return Array.from(
    new Set(
      findSkillsFromText(joined)
        .map((match) => normalizeSkillName(match.skill))
        .filter(Boolean),
    ),
  ).slice(0, 5)
}

async function buildLocalPromptResult(payload: PromptPipelineRequest) {
  const localPrompt = await composePrompt(toPromptRequest(payload))
  const skillNames = Array.from(
    new Set(
      [
        ...localPrompt.skills.map((skill) => normalizeSkillName(skill.skill)),
        ...buildSkillNamesFromTexts(
          payload.seed,
          payload.codebaseContext,
          ...(payload.keywords ?? []),
          ...(payload.constraints ?? []),
          ...(payload.verification ?? []),
          ...(payload.nonGoals ?? []),
          localPrompt.fullPrompt,
        ),
      ].filter(Boolean),
    ),
  ).slice(0, 5)

  return {
    prompt: appendSkillCalls(localPrompt.fullPrompt, skillNames),
    skillNames,
  }
}

export async function generatePromptWithSkills(
  payload: PromptPipelineRequest,
  options: {
    apiKey?: string
    fetchFn?: FetchLike
    timeoutMs?: number
  } = {},
) {
  const fallbackResult = await buildLocalPromptResult(payload)
  const apiKey = options.apiKey ?? getOpenRouterApiKey()

  if (!apiKey) {
    return fallbackResult
  }

  try {
    const generatedPrompt = await runOpenRouterPrompt(
      apiKey,
      buildPromptGenerationInput(payload),
      {
        max_new_tokens: 350,
        temperature: 0.25,
        top_p: 0.9,
      },
      options.fetchFn,
      options.timeoutMs,
    )

    const skillNames = Array.from(
      new Set(
        [
          ...fallbackResult.skillNames,
          ...buildSkillNamesFromTexts(
            payload.seed,
            payload.codebaseContext,
            ...(payload.keywords ?? []),
            ...(payload.constraints ?? []),
            ...(payload.verification ?? []),
            ...(payload.nonGoals ?? []),
            generatedPrompt,
          ),
        ].filter(Boolean),
      ),
    ).slice(0, 5)

    return {
      prompt: appendSkillCalls(generatedPrompt, skillNames),
      skillNames,
    }
  } catch {
    return fallbackResult
  }
}

export const polishMissionLineServer = createServerFn({
  method: 'POST',
}).handler(async ({ data }) => {
  const payload = data as OpenRouterPolishRequest
  const apiKey = getOpenRouterApiKey()
  if (!apiKey) {
    return payload.prompt
  }

  try {
    const generatedPrompt = await runOpenRouterPrompt(
      apiKey,
      payload.prompt,
      payload.overrides,
    )
    const skillNames = buildSkillNamesFromTexts(payload.prompt, generatedPrompt)
    return appendSkillCalls(generatedPrompt, skillNames)
  } catch {
    return payload.prompt
  }
})

export const generatePromptWithSkillsServer = createServerFn({
  method: 'POST',
}).handler(async ({ data }) => {
  const payload = data as PromptPipelineRequest
  return generatePromptWithSkills(payload)
})
