export function createTraversal(graph, algorithm, startId) {
  const adjacency = new Map(graph.vertices.map((vertex) => [vertex.id, []]))
  graph.edges.forEach((edge, edgeIndex) => {
    adjacency.get(edge.source)?.push({ id: edge.target, edgeIndex })
    if (!graph.directed) adjacency.get(edge.target)?.push({ id: edge.source, edgeIndex })
  })

  const pending = [startId]
  const discovered = new Set([startId])
  const visited = []
  const parents = new Map()
  const levels = new Map([[startId, 0]])
  const steps = [{
    current: null,
    activeEdge: null,
    visited: [],
    frontier: [...pending],
    order: [],
    levels: { [startId]: 0 },
    log: `Старт обхода из вершины ${graph.vertices.find((vertex) => vertex.id === startId)?.label ?? startId}.`,
  }]

  while (pending.length) {
    const current = algorithm === 'BFS' ? pending.shift() : pending.pop()
    visited.push(current)
    const neighbors = adjacency.get(current) || []
    const newlyDiscovered = []

    const candidates = algorithm === 'DFS' ? [...neighbors].reverse() : neighbors
    candidates.forEach(({ id, edgeIndex }) => {
      if (discovered.has(id)) return
      discovered.add(id)
      newlyDiscovered.push(id)
      parents.set(id, { id: current, edgeIndex })
      if (algorithm === 'BFS') levels.set(id, levels.get(current) + 1)
      else levels.set(id, (levels.get(current) || 0) + 1)
      pending.push(id)
    })

    const label = (id) => graph.vertices.find((vertex) => vertex.id === id)?.label ?? id
    const activeEdge = parents.get(current)?.edgeIndex ?? null
    const pendingLabel = algorithm === 'BFS' ? 'очередь' : 'стек'
    const additions = newlyDiscovered.length
      ? ` Добавляем в ${pendingLabel}: ${newlyDiscovered.map(label).join(', ')}.`
      : ''
    const disconnectedCount = graph.vertices.length - discovered.size
    const completion = pending.length === 0
      ? ` Обход завершён${disconnectedCount ? `; вне компоненты осталось вершин: ${disconnectedCount}` : ''}.`
      : ''

    steps.push({
      current,
      activeEdge,
      visited: [...visited],
      frontier: [...pending],
      order: [...visited],
      levels: Object.fromEntries(levels),
      log: `Шаг ${visited.length}: посещаем ${label(current)}.${additions}${completion}`,
    })
  }

  return steps
}
