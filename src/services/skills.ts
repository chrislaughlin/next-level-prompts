import { keywordCandidates } from './skills.util'

type SkillMatch = {
  skill: string
  reason: string
}

const CATALOG: { keywords: string[]; skill: string; reason: string }[] = [
  { keywords: ['next', 'nextjs', 'react-router'], skill: 'nextjs', reason: 'Web app routing and rendering' },
  { keywords: ['react', 'tsx'], skill: 'react-best-practices', reason: 'UI patterns and performance' },
  { keywords: ['stripe', 'payment'], skill: 'stripe-best-practices', reason: 'Payments and billing' },
  { keywords: ['supabase', 'postgres', 'sql'], skill: 'supabase-postgres-best-practices', reason: 'Database and queries' },
  { keywords: ['figma', 'design'], skill: 'figma', reason: 'Implementing designs' },
  { keywords: ['tailwind', 'shadcn'], skill: 'shadcn', reason: 'Component styling' },
  { keywords: ['auth', 'jwt'], skill: 'auth', reason: 'Authentication flows' },
  { keywords: ['api', 'lambda', 'edge', 'serverless'], skill: 'vercel-functions', reason: 'Serverless functions' },
  { keywords: ['ai', 'llm', 'prompt'], skill: 'ai-sdk', reason: 'Vercel AI SDK patterns' },
]

export function findSkillsFromText(text: string): SkillMatch[] {
  const tokens = keywordCandidates(text)
  const matches: SkillMatch[] = []
  CATALOG.forEach((entry) => {
    if (entry.keywords.some((kw) => tokens.includes(kw))) {
      matches.push({ skill: entry.skill, reason: entry.reason })
    }
  })
  // Always ensure grill-me last
  matches.push({ skill: 'grill-me', reason: 'Interrogate assumptions before building' })
  return matches
}
