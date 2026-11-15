import { useMemo } from 'react'

function layoutTree(model, compact) {
  const nodes = new Map(model.nodes.map((node) => [node.id, { ...node }]))
  const children = new Map(model.nodes.map((node) => [node.id, []]))
  const childIds = new Set()
  model.edges.forEach((edge) => {
    children.get(edge.source)?.push(edge.target)
    childIds.add(edge.target)
  })

  const gap = compact ? 20 : 34
  const nodeWidth = (node) => Math.min(180, Math.max(50, node.label.length * (compact ? 8 : 9) + 28))
  const widths = new Map()
  const measure = (id) => {
    const node = nodes.get(id)
    const descendants = children.get(id) || []
    const ownWidth = nodeWidth(node)
    const childrenWidth = descendants.reduce((total, childId) => total + measure(childId), 0)
      + Math.max(0, descendants.length - 1) * gap
    const width = Math.max(ownWidth, childrenWidth)
    widths.set(id, width)
    return width
  }

  const roots = model.nodes.filter((node) => !childIds.has(node.id)).map((node) => node.id)
  const rootGap = compact ? 32 : 56
  roots.forEach(measure)
  const contentWidth = roots.reduce((total, id) => total + widths.get(id), 0)
    + Math.max(0, roots.length - 1) * rootGap
  const viewWidth = Math.max(compact ? 420 : 900, contentWidth + 80)
  const maxDepth = Math.max(0, ...model.nodes.map((node) => node.depth || 0))
  const rowHeight = compact ? 72 : 88
  const viewHeight = Math.max(compact ? 170 : 280, 100 + maxDepth * rowHeight)

  const place = (id, left, depth = 0) => {
    const node = nodes.get(id)
    const descendants = children.get(id) || []
    const subtreeWidth = widths.get(id)
    const childrenWidth = descendants.reduce((total, childId) => total + widths.get(childId), 0)
      + Math.max(0, descendants.length - 1) * gap
    let childLeft = left + (subtreeWidth - childrenWidth) / 2

    node.x = left + subtreeWidth / 2
    node.y = 48 + depth * rowHeight
    node.width = nodeWidth(node)
    node.height = node.detail ? 54 : 46

    descendants.forEach((childId) => {
      place(childId, childLeft, depth + 1)
      childLeft += widths.get(childId) + gap
    })
  }

  let rootLeft = (viewWidth - contentWidth) / 2
  roots.forEach((id) => {
    place(id, rootLeft)
    rootLeft += widths.get(id) + rootGap
  })
  return { nodes, viewWidth, viewHeight }
}

function TreeCanvas({ model, current = '', visited = [], compact = false }) {
  const layout = useMemo(() => layoutTree(model, compact), [model, compact])
  const visitedSet = new Set(visited)

  const nodeFill = (node) => {
    if (node.id === current) return '#e8a36e'
    if (visitedSet.has(node.id)) return '#a9d2bb'
    if (node.color === 'red') return '#b85f59'
    if (node.color === 'black') return '#38524e'
    if (node.balance !== undefined) {
      if (Math.abs(node.balance) > 1) return '#dc8a76'
      if (Math.abs(node.balance) === 1) return '#edd18a'
    }
    return node.terminal
      ? 'var(--tree-node-terminal, #e5f1e8)'
      : 'var(--tree-node-default, #ffffff)'
  }

  return (
    <div className={`tree-canvas ${compact ? 'tree-canvas-compact' : ''}`}>
      {model.nodes.length ? (
        <svg
          width={layout.viewWidth}
          height={layout.viewHeight}
          viewBox={`0 0 ${layout.viewWidth} ${layout.viewHeight}`}
          role="img"
          aria-label="Визуализация структуры дерева"
        >
          {model.edges.map((edge) => {
            const source = layout.nodes.get(edge.source)
            const target = layout.nodes.get(edge.target)
            if (!source || !target) return null
            const active = visitedSet.has(source.id) && visitedSet.has(target.id)
            const sourceY = source.y + source.height / 2 - 2
            const targetY = target.y - target.height / 2 + 2
            const curveY = sourceY + (targetY - sourceY) * 0.55
            return (
              <path
                key={`${edge.source}-${edge.target}`}
                d={`M ${source.x} ${sourceY} C ${source.x} ${curveY}, ${target.x} ${curveY}, ${target.x} ${targetY}`}
                className={active ? 'tree-edge tree-edge-active' : 'tree-edge'}
              />
            )
          })}
          {model.nodes.map((originalNode) => {
            const node = layout.nodes.get(originalNode.id)
            const isWide = node.width > 58
            const classes = [
              'tree-node',
              node.id === current ? 'tree-node-current' : '',
              visitedSet.has(node.id) ? 'tree-node-visited' : '',
              node.color === 'red' ? 'tree-node-red' : '',
              node.color === 'black' ? 'tree-node-black' : '',
            ].filter(Boolean).join(' ')
            return (
              <g
                key={node.id}
                className={classes}
                transform={`translate(${node.x} ${node.y})`}
              >
                <title>{node.detail ? `${node.label}, ${node.detail}` : node.label}</title>
                <rect
                  x={-node.width / 2}
                  y={-node.height / 2}
                  width={node.width}
                  height={node.height}
                  rx={isWide ? 13 : 23}
                  fill={nodeFill(node)}
                />
                <text x="0" y={node.detail ? -3 : 5} textAnchor="middle">{node.label}</text>
                {node.detail && (
                  <text x="0" y="15" textAnchor="middle" className="tree-node-detail">
                    {node.detail}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      ) : (
        <p className="empty-state">Добавьте элементы, чтобы увидеть дерево.</p>
      )}
    </div>
  )
}

export default TreeCanvas
