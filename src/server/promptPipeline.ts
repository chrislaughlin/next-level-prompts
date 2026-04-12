import { createServerFn } from '@tanstack/react-start'
import { searchSkillsAPI } from '../services/skillsApi'

export type GoalType = 'build-app' | 'add-feature' | 'fix-bug'
export type BuildApproach = 'one-shot' | 'multi-phase'

export type PromptPipelineInput = {
  goalType: GoalType
  basePrompt: string
  buildApproach: BuildApproach
  phaseCount?: number
  constraints: string[]
  validation: string[]
}

export type PromptPipelineOutput = {
  prompt: string
  skills: Array<{ name: string; slug: string }>
  error?: string
}

const MODEL = 'mistralai/mistral-nemo'
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
const TIMEOUT_MS = 45000

function getOpenRouterApiKey() {
  return process.env.OPENROUTER_API_KEY || ''
}

function getRefererHeader() {
  const referer = process.env.OPENROUTER_SITE_URL
  return referer ? { 'HTTP-Referer': referer } : {}
}

function buildPromptGenerationSystem() {
  return `You are an expert prompt engineer for AI coding agents (Claude, Codex, OpenCode).

Your task is to generate a production-grade, agent-optimised prompt that drives high-quality, repo-aware, implementation-ready outcomes.

Core Principles (non-negotiable)
Plan-first execution: The agent must explore → understand → plan → verify before any code changes.
Planning-only mode: The first response must be a plan. No code edits or implementations are allowed in this pass.
Repo-grounded reasoning: All decisions must be based on actual files, patterns, and architecture found in the repository.
No assumptions about structure: The agent must discover file paths, entry points, and architecture rather than rely on guessed filenames.
Evidence-based output: The agent must cite specific files, directories, or patterns from the repo to justify decisions.
Minimal, convention-aligned changes: Prefer extending existing patterns over introducing new abstractions.
MVP focus: Scope must be tightly controlled to a minimal, shippable version.
Explicit assumptions: Any unknowns must be clearly stated.
Failure-aware thinking: The agent must consider at least one realistic failure mode.
Required Prompt Structure

The generated prompt MUST include the following sections:

1. Mission
Clearly define the task in practical, implementation terms.
Avoid vague product language; anchor it in codebase context.
2. Constraints
This pass is planning only. Do not modify or write code.
Explore the repository before proposing changes.
Do not assume file names, frameworks, or structure — discover them.
Ground all recommendations in actual repo evidence.
Prefer minimal, convention-preserving changes.
If the repo does not support required capabilities, state this and propose the smallest viable path forward.
Keep scope strictly to MVP.
Do not introduce unrelated improvements or refactors.
3. Exploration Expectations
Identify:
Application entry points
Relevant UI/screens/components
Data flow and state management approach
API layer / services / backend integration
Existing patterns relevant to the feature
Highlight gaps between current capabilities and required feature.
4. Output Requirements (Plan Only)

The agent must return a single, coherent plan including:

Task understanding in repo terms
Relevant files, directories, and subsystems
Key patterns and conventions to reuse
MVP user flow (step-by-step)
Concrete implementation plan:
Files to create
Files to modify
Integration points
Assumptions, risks, and dependencies
Explicit non-goals (what is NOT included)
Recommended implementation sequence
Verification strategy:
Tests (unit/integration)
Linting
Build checks
Manual validation steps
Repo evidence:
Specific file paths or patterns that informed decisions
5. Verification Requirements
Cover the happy path and at least one failure scenario.
Infer standard project commands (test, lint, build) if not provided.
If verification is blocked, explicitly state what is missing.
6. Done Criteria
The feature is clearly scoped, implementable, and aligned with repo conventions.
The plan is actionable by another engineer or agent without additional clarification.
Verification steps are complete and realistic.
7. Safety and Risk Controls
Avoid large or risky refactors.
Propose rollback strategy only if changes are high-risk.
Highlight any architectural risks or unknowns early.
Output Rules
Output ONLY the final prompt.
Do NOT include explanations, commentary, or meta text.
The prompt must be concise, structured, and implementation-ready.
Avoid fluff, generic advice, or human-oriented instructions.
Optimise for agent execution, not readability for humans.`
}

function buildPromptGenerationUser(input: PromptPipelineInput) {
  const goalDescriptions: Record<GoalType, string> = {
    'build-app': 'Build a full application',
    'add-feature': 'Add a feature to an existing application',
    'fix-bug': 'Fix a bug in an existing application',
  }

  const lines = [
    `Goal: ${goalDescriptions[input.goalType]}`,
    `Base prompt: ${input.basePrompt}`,
    input.buildApproach === 'multi-phase'
      ? `Approach: Multi-phase (${input.phaseCount || 3} phases)`
      : 'Approach: One-shot (single planning pass)',
  ]

  if (input.constraints.length > 0) {
    lines.push(`Constraints: ${input.constraints.join('; ')}`)
  }

  if (input.validation.length > 0) {
    lines.push(`Validation requirements: ${input.validation.join('; ')}`)
  }

  return lines.join('\n')
}

function buildKeywordExtractionSystem() {
  return `Extract 3-5 specific keywords from the following prompt that would be useful for searching a skills library (like skills.sh).

Look for:
- Framework names (React, Next.js, Vue, etc.)
- Languages (TypeScript, Python, Go, etc.)
- Services/APIs (Stripe, Supabase, AWS, etc.)
- Tools (Playwright, Vitest, Docker, etc.)
- Libraries (Redux, TanStack Query, etc.)

Output ONLY a comma-separated list of keywords, nothing else.`
}

function buildKeywordExtractionUser(generatedPrompt: string) {
  return `Extract keywords from this prompt:\n\n${generatedPrompt}`
}

async function callOpenRouter(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...getRefererHeader(),
        'X-Title': 'Next Level Prompts',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 800,
      }),
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `OpenRouter request failed (${response.status}): ${errorText}`,
      )
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }

    const content = json.choices?.[0]?.message?.content
    if (!content) {
      throw new Error('OpenRouter returned an empty response')
    }

    return content.trim()
  } catch (err) {
    clearTimeout(timeoutId)
    throw err
  }
}

export const generatePromptPipeline = createServerFn({
  method: 'POST',
}).handler(
  async ({
    data,
  }: {
    data: PromptPipelineInput
  }): Promise<PromptPipelineOutput> => {
    const apiKey = getOpenRouterApiKey()

    if (!apiKey) {
      return {
        prompt: '',
        skills: [],
        error: 'OPENROUTER_API_KEY is not configured',
      }
    }

    try {
      const generatedPrompt = await callOpenRouter(
        apiKey,
        buildPromptGenerationSystem(),
        buildPromptGenerationUser(data),
      )

      const keywordsText = await callOpenRouter(
        apiKey,
        buildKeywordExtractionSystem(),
        buildKeywordExtractionUser(generatedPrompt),
      )

      const keywords = keywordsText
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean)
        .slice(0, 5)

      const skillResults = await Promise.all(
        keywords.map((kw) => searchSkillsAPI(kw, 5)),
      )

      const uniqueSkills = new Map<string, { name: string; slug: string }>()
      for (const results of skillResults) {
        for (const skill of results) {
          if (!uniqueSkills.has(skill.slug)) {
            uniqueSkills.set(skill.slug, { name: skill.name, slug: skill.name })
          }
        }
      }

      const skills = Array.from(uniqueSkills.values()).slice(0, 5)
      const skillSuffix =
        skills.length > 0
          ? '\n\n' + skills.map((s) => `/${s.slug}`).join(' ')
          : ''

      return {
        prompt: generatedPrompt + skillSuffix,
        skills,
      }
    } catch (err) {
      return {
        prompt: '',
        skills: [],
        error: err instanceof Error ? err.message : 'Unknown error occurred',
      }
    }
  },
)
