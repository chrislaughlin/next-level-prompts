export interface SearchSkill {
  name: string
  slug: string
  source: string
  installs: number
}

const SKILLS_API_BASE = process.env.SKILLS_API_URL || 'https://skills.sh'

export async function searchSkillsAPI(
  query: string,
  limit = 10,
): Promise<SearchSkill[]> {
  try {
    const url = `${SKILLS_API_BASE}/api/search?q=${encodeURIComponent(query)}&limit=${limit}`
    const res = await fetch(url)

    if (!res.ok) return []

    const data = (await res.json()) as {
      skills: Array<{
        id: string
        name: string
        installs: number
        source: string
      }>
    }

    return data.skills
      .map((skill) => ({
        name: skill.name,
        slug: skill.id,
        source: skill.source || '',
        installs: skill.installs,
      }))
      .sort((a, b) => (b.installs || 0) - (a.installs || 0))
  } catch {
    return []
  }
}
