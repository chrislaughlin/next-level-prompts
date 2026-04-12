import { createServerFn } from '@tanstack/react-start'

type OpenRouterGenerationHints = {
  max_new_tokens?: number
  temperature?: number
  top_p?: number
}

type OpenRouterPolishRequest = {
  prompt: string
  overrides?: OpenRouterGenerationHints
}

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
const OPENROUTER_MODEL = 'minimax/minimax-m2.5:free'
const SKILLS_SEARCH_API_URL = 'https://skills.sh/api/search?q='

function getOpenRouterApiKey() {
  return process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY || ''
}

function getRefererHeader() {
  const referer = process.env.OPENROUTER_SITE_URL || process.env.VITE_OPENROUTER_SITE_URL
  return referer ? { 'HTTP-Referer': referer } : {}
}

function normalizeKeywordList(raw: string) {
  return Array.from(
    new Set(
      raw
        .split(/[\n,]/g)
        .map((token) => token.trim().toLowerCase())
        .map((token) => token.replace(/^[^a-z0-9]+|[^a-z0-9- ]+$/g, '').trim())
        .filter(Boolean)
        .slice(0, 12),
    ),
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

function extractSkillNames(payload: unknown) {
  const records = (() => {
    if (Array.isArray(payload)) return payload
    if (!payload || typeof payload !== 'object') return []
    const obj = payload as Record<string, unknown>
    if (Array.isArray(obj.skills)) return obj.skills
    if (Array.isArray(obj.results)) return obj.results
    if (Array.isArray(obj.data)) return obj.data
    return []
  })()

  const names = records
    .map((record) => {
      if (typeof record === 'string') return record
      if (!record || typeof record !== 'object') return ''
      const obj = record as Record<string, unknown>
      return (
        (typeof obj.name === 'string' && obj.name) ||
        (typeof obj.slug === 'string' && obj.slug) ||
        (typeof obj.id === 'string' && obj.id) ||
        ''
      )
    })
    .map(normalizeSkillName)
    .filter(Boolean)

  return Array.from(new Set(names)).slice(0, 5)
}

function appendSkillCalls(generatedPrompt: string, skillNames: string[]) {
  if (!skillNames.length) return generatedPrompt
  const suffix = skillNames.map((name) => `/${name}`).join(' ')
  return `${generatedPrompt}\n\n${suffix}`
}

async function runOpenRouterPrompt(
  apiKey: string,
  prompt: string,
  overrides?: OpenRouterGenerationHints,
) {
  const response = await fetch(OPENROUTER_API_URL, {
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
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenRouter request failed (${response.status}): ${errorText}`)
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

async function getSkillCalls(apiKey: string, userPrompt: string, generatedPrompt: string) {
  const keywordExtractionPrompt = [
    'Extract keywords for matching coding-assistant skills.',
    'Return a comma-separated list with up to 8 concise keywords.',
    'No explanations and no markdown.',
    `User prompt: ${userPrompt}`,
    `Generated prompt: ${generatedPrompt}`,
    'Keywords:',
  ].join('\n')

  const keywordText = await runOpenRouterPrompt(apiKey, keywordExtractionPrompt, {
    max_new_tokens: 64,
    temperature: 0,
    top_p: 1,
  })

  const keywords = normalizeKeywordList(keywordText)
  if (!keywords.length) return []

  const searchQuery = encodeURIComponent(keywords.join(' '))
  const skillSearchResponse = await fetch(`${SKILLS_SEARCH_API_URL}${searchQuery}`)
  if (!skillSearchResponse.ok) return []
  const skillPayload = (await skillSearchResponse.json()) as unknown
  return extractSkillNames(skillPayload)
}

export const polishMissionLineServer = createServerFn({ method: 'POST' })
  .validator((data: OpenRouterPolishRequest) => data)
  .handler(async ({ data }) => {
    const apiKey = getOpenRouterApiKey()
    if (!apiKey) {
      throw new Error('Missing OPENROUTER_API_KEY on the server.')
    }

    const generatedPrompt = await runOpenRouterPrompt(apiKey, data.prompt, data.overrides)

    try {
      const skillNames = await getSkillCalls(apiKey, data.prompt, generatedPrompt)
      return appendSkillCalls(generatedPrompt, skillNames)
    } catch {
      return generatedPrompt
    }
  })
