export type OpenRouterOptions = {
  apiKey?: string
  siteUrl?: string
  siteName?: string
  fetchImpl?: typeof fetch
}

const OPENROUTER_MODEL = 'minimax/minimax-m2.5:free'
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const SKILLS_SEARCH_URL = 'https://skills.sh/api/search?q='

function uniq(values: string[]) {
  return Array.from(new Set(values))
}

function normalizeSkillName(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/^\/+/, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

function parseOpenRouterContent(payload: any): string {
  return payload?.choices?.[0]?.message?.content ?? ''
}

function parseKeywordArray(raw: string): string[] {
  if (!raw.trim()) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed.map((value) => String(value).toLowerCase().trim()).filter(Boolean)
    }
  } catch {
    const match = raw.match(/\[[\s\S]*\]/)
    if (match) {
      try {
        const parsed = JSON.parse(match[0])
        if (Array.isArray(parsed)) {
          return parsed.map((value) => String(value).toLowerCase().trim()).filter(Boolean)
        }
      } catch {
        return []
      }
    }
  }
  return []
}

function extractSkillNames(data: unknown): string[] {
  if (!data) return []

  if (Array.isArray(data)) {
    return data
      .flatMap((item) => extractSkillNames(item))
      .map(normalizeSkillName)
      .filter(Boolean)
  }

  if (typeof data === 'string') {
    const normalized = normalizeSkillName(data)
    return normalized ? [normalized] : []
  }

  if (typeof data !== 'object') return []

  const record = data as Record<string, unknown>

  const directNames = [record.slug, record.name, record.skill, record.id]
    .map((value) => (typeof value === 'string' ? normalizeSkillName(value) : ''))
    .filter(Boolean)

  const nested = [record.skills, record.results, record.data, record.items]
    .flatMap((value) => extractSkillNames(value))
    .filter(Boolean)

  return [...directNames, ...nested]
}

export async function extractKeywordsViaOpenRouter(
  userPrompt: string,
  generatedPrompt: string,
  options: OpenRouterOptions = {},
): Promise<string[]> {
  const apiKey = options.apiKey ?? process.env.OPENROUTER_API_KEY
  if (!apiKey) return []

  const fetchImpl = options.fetchImpl ?? fetch
  const model = OPENROUTER_MODEL

  const response = await fetchImpl(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(options.siteUrl ? { 'HTTP-Referer': options.siteUrl } : {}),
      ...(options.siteName ? { 'X-Title': options.siteName } : {}),
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Extract key words from the user prompt and generated prompt. Return strictly JSON as {"keywords": ["..." ]} with 6-12 lowercase items.',
        },
        {
          role: 'user',
          content: `User prompt:\n${userPrompt}\n\nGenerated prompt:\n${generatedPrompt}`,
        },
      ],
    }),
  })

  if (!response.ok) return []

  const payload = await response.json()
  const content = parseOpenRouterContent(payload)
  if (!content) return []

  try {
    const parsed = JSON.parse(content)
    const keywords = Array.isArray(parsed?.keywords) ? parsed.keywords : []
    return uniq(
      keywords
        .map((value) => String(value).toLowerCase().trim())
        .filter((value) => value.length > 1)
        .slice(0, 12),
    )
  } catch {
    return uniq(parseKeywordArray(content).slice(0, 12))
  }
}

export async function findSkillsForKeywords(
  keywords: string[],
  fetchImpl: typeof fetch = fetch,
): Promise<string[]> {
  const skillBuckets = await Promise.all(
    uniq(keywords)
      .slice(0, 8)
      .map(async (keyword) => {
        try {
          const response = await fetchImpl(`${SKILLS_SEARCH_URL}${encodeURIComponent(keyword)}`)
          if (!response.ok) return []
          const payload = await response.json()
          return extractSkillNames(payload)
        } catch {
          return []
        }
      }),
  )

  return uniq(skillBuckets.flat().map(normalizeSkillName).filter(Boolean)).slice(0, 6)
}

export function appendSkillCalls(prompt: string, skills: string[]) {
  if (!skills.length) return prompt
  const calls = skills.map((skill) => `/${normalizeSkillName(skill)}`).join(' ')
  return `${prompt}\n\n${calls}`
}

export async function appendOpenRouterSkillCalls(
  userPrompt: string,
  generatedPrompt: string,
  options: OpenRouterOptions = {},
): Promise<string> {
  const keywords = await extractKeywordsViaOpenRouter(userPrompt, generatedPrompt, options)
  if (!keywords.length) return generatedPrompt

  const fetchImpl = options.fetchImpl ?? fetch
  const skills = await findSkillsForKeywords(keywords, fetchImpl)
  return appendSkillCalls(generatedPrompt, skills)
}
