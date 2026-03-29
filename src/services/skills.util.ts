export function keywordCandidates(text: string) {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .match(/[a-z][a-z0-9+#.-]{1,}/g)
        ?.slice(0, 100) ?? [],
    ),
  )
}
