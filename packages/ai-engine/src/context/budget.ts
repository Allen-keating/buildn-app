export function estimateTokens(text: string): number {
  const cjkCount = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length
  const otherCount = text.length - cjkCount
  return Math.ceil(cjkCount / 2 + otherCount / 4)
}

export function trimToTokenBudget(
  items: { key: string; content: string; priority: number }[],
  budget: number,
): Map<string, string> {
  const sorted = [...items].sort((a, b) => b.priority - a.priority)
  const result = new Map<string, string>()
  let used = 0

  for (const item of sorted) {
    const tokens = estimateTokens(item.content)
    if (used + tokens > budget) continue
    result.set(item.key, item.content)
    used += tokens
  }

  return result
}
