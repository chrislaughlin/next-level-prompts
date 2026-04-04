import { keywordCandidates } from './skills.util.ts'

export type SkillMatch = {
  skill: string
  reason: string
}

const CATALOG: { keywords: string[]; skill: string; reason: string }[] = [
  {
    keywords: ['next', 'nextjs', 'react-router', 'app-router'],
    skill: 'nextjs',
    reason: 'Routing, rendering, and framework conventions',
  },
  {
    keywords: ['react', 'tsx', 'component', 'hook'],
    skill: 'react-best-practices',
    reason: 'React component structure and performance patterns',
  },
  {
    keywords: ['stripe', 'payment', 'billing', 'checkout', 'subscription'],
    skill: 'stripe-best-practices',
    reason: 'Payments, billing flows, and webhook discipline',
  },
  {
    keywords: ['supabase', 'postgres', 'sql', 'migration', 'query'],
    skill: 'supabase-postgres-best-practices',
    reason: 'Database schema, queries, and performance checks',
  },
  {
    keywords: ['tailwind', 'shadcn', 'ui'],
    skill: 'shadcn',
    reason: 'Component styling and UI composition conventions',
  },
  {
    keywords: ['auth', 'jwt', 'oauth', 'session', 'login'],
    skill: 'auth',
    reason: 'Authentication flows and session handling',
  },
  {
    keywords: ['test', 'tests', 'vitest', 'jest', 'playwright', 'cypress', 'e2e', 'regression'],
    skill: 'verification',
    reason: 'Regression coverage, end-to-end checks, and done criteria',
  },
  {
    keywords: ['api', 'lambda', 'edge', 'serverless', 'endpoint', 'webhook'],
    skill: 'vercel-functions',
    reason: 'API handlers, serverless behavior, and edge/runtime constraints',
  },
  {
    keywords: ['vercel', 'deploy', 'preview', 'production'],
    skill: 'deploy-to-vercel',
    reason: 'Deployment, environment configuration, and preview validation',
  },
  {
    keywords: ['ai', 'llm', 'openai', 'anthropic', 'rag', 'embedding', 'tool-calling', 'chatbot'],
    skill: 'ai-sdk',
    reason: 'AI workflow integration and agent-oriented patterns',
  },
]

export function findSkillsFromText(text: string): SkillMatch[] {
  const tokens = keywordCandidates(text)
  const matches: SkillMatch[] = []
  CATALOG.forEach((entry) => {
    if (entry.keywords.some((kw) => tokens.includes(kw))) {
      matches.push({ skill: entry.skill, reason: entry.reason })
    }
  })
  return matches
}
