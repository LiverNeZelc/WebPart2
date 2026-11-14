function TreeCanvas({ model, current = '', visited = [], compact = false }) {
  const visitedSet = new Set(visited)
  const nodes = new Map(model.nodes.map((node) => [node.id, node]))
  const height = Math.max(300, ...model.nodes.map((node) => node.y + 55))

  const fill = (node) => {
    if (node.id === current) return '#e28b54'
    if (visitedSet.has(node.id)) return '#82b89a'
    if (node.color === 'red') return '#bc6259'
    if (node.color === 'black') return '#344f4c'
    if (node.balance !== undefined) {
      if (Math.abs(node.balance) > 1) return '#d97961'
      if (Math.abs(node.balance) === 1) return '#e5c16e'
    }
    return node.terminal ? '#dcebe1' : '#f8faf5'
  }

  return (
    <div className={`tree-canvas ${compact ? 'tree-canvas-compact' : ''}`}>
      {model.nodes.length ? (
        <svg viewBox={`0 0 1000 ${height}`} role="img" aria-label="Визуализация структуры дерева">
          {model.edges.map((edge) => {
            const source = nodes.get(edge.source)
            const target = nodes.get(edge.target)
            if (!source || !target) return null
            const active = visitedSet.has(source.id) && visitedSet.has(target.id)
            return (
              <line
                key={`${edge.source}-${edge.target}`}
                x1={source.x}
                y1={source.y + 23}
                x2={target.x}
                y2={target.y - 23}
                className={active ? 'tree-edge tree-edge-active' : 'tree-edge'}
              />
            )
          })}
          {model.nodes.map((node) => {
            const nodeWidth = Math.min(190, Math.max(50, node.label.length * 8 + 22))
            const isWide = nodeWidth > 50
            return (
              <g key={node.id} className="tree-node" transform={`translate(${node.x} ${node.y})`}>
                <rect
                  x={-nodeWidth / 2}
                  y="-22"
                  width={nodeWidth}
                  height="46"
                  rx={isWide ? 14 : 23}
                  fill={fill(node)}
                  className={node.id === current ? 'tree-node-current' : ''}
                />
                <text x="0" y={node.detail ? -2 : 5} textAnchor="middle">{node.label}</text>
                {node.detail && <text x="0" y="14" textAnchor="middle" className="tree-node-detail">{node.detail}</text>}
              </g>
            )
          })}
        </svg>
      ) : <p className="empty-state">Добавьте элементы, чтобы увидеть дерево.</p>}
    </div>
  )
}

export default TreeCanvas
