function russianCount(count, forms) {
  const lastTwoDigits = count % 100
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return `${count} ${forms[2]}`
  const lastDigit = count % 10
  if (lastDigit === 1) return `${count} ${forms[0]}`
  if (lastDigit >= 2 && lastDigit <= 4) return `${count} ${forms[1]}`
  return `${count} ${forms[2]}`
}

export function graphSummary(graph) {
  return `${russianCount(graph.vertices.length, ['вершина', 'вершины', 'вершин'])} · ${russianCount(graph.edges.length, ['ребро', 'ребра', 'рёбер'])}`
}
