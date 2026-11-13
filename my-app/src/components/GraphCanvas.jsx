import { useRef } from 'react'

function getSvgPoint(svg, event) {
  const point = svg.createSVGPoint()
  point.x = event.clientX
  point.y = event.clientY
  return point.matrixTransform(svg.getScreenCTM().inverse())
}

function GraphCanvas({
  graph,
  mode,
  current = null,
  visited = [],
  frontier = [],
  activeEdge = null,
  selectedVertex,
  selectedEdge,
  connectFrom,
  onCanvasClick,
  onVertexClick,
  onVertexMove,
  onEdgeClick,
}) {
  const svgRef = useRef(null)
  const draggedVertex = useRef(null)

  const handlePointerMove = (event) => {
    if (!draggedVertex.current || !svgRef.current) return
    const point = getSvgPoint(svgRef.current, event)
    onVertexMove(draggedVertex.current, {
      x: Math.max(24, Math.min(776, point.x)),
      y: Math.max(24, Math.min(416, point.y)),
    })
  }

  return (
    <svg
      ref={svgRef}
      className={`graph-canvas ${mode === 'add' ? 'graph-canvas-add' : ''}`}
      viewBox="0 0 800 440"
      role="img"
      aria-label="Поле графа. Вершины можно перемещать мышью."
      onClick={(event) => {
        if (event.target !== event.currentTarget || mode !== 'add') return
        const point = getSvgPoint(event.currentTarget, event)
        onCanvasClick({ x: Math.max(24, Math.min(776, point.x)), y: Math.max(24, Math.min(416, point.y)) })
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={() => { draggedVertex.current = null }}
      onPointerCancel={() => { draggedVertex.current = null }}
    >
      <defs>
        <marker id="graph-arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" className="graph-arrowhead" />
        </marker>
      </defs>
      {graph.edges.map((edge, index) => {
        const source = graph.vertices.find((vertex) => vertex.id === edge.source)
        const target = graph.vertices.find((vertex) => vertex.id === edge.target)
        if (!source || !target) return null
        const active = activeEdge === index
        return (
          <g key={`${edge.source}-${edge.target}-${index}`}>
            <line
              className={`graph-edge ${active ? 'graph-edge-active' : ''} ${selectedEdge === index ? 'graph-edge-selected' : ''}`}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              markerEnd={graph.directed ? 'url(#graph-arrow)' : undefined}
              onClick={(event) => {
                if (mode !== 'edit') return
                event.stopPropagation()
                onEdgeClick(index)
              }}
            />
          </g>
        )
      })}
      {graph.vertices.map((vertex) => {
        const status = vertex.id === current
          ? 'current'
          : visited.includes(vertex.id)
            ? 'visited'
            : frontier.includes(vertex.id)
              ? 'frontier'
              : 'default'
        return (
          <g
            key={vertex.id}
            className={`graph-vertex graph-vertex-${status} ${selectedVertex === vertex.id ? 'graph-vertex-selected' : ''} ${connectFrom === vertex.id ? 'graph-vertex-connect' : ''}`}
            transform={`translate(${vertex.x} ${vertex.y})`}
            onPointerDown={(event) => {
              if (mode !== 'edit' || event.button !== 0) return
              event.stopPropagation()
              draggedVertex.current = vertex.id
              event.currentTarget.setPointerCapture(event.pointerId)
            }}
            onClick={(event) => {
              event.stopPropagation()
              onVertexClick(vertex.id)
            }}
          >
            <circle r="23" />
            <text textAnchor="middle" dominantBaseline="central">{vertex.label}</text>
          </g>
        )
      })}
      {graph.vertices.length === 0 && (
        <text className="graph-canvas-hint" x="400" y="220" textAnchor="middle" dominantBaseline="central">
          Включите режим добавления и нажмите на поле
        </text>
      )}
    </svg>
  )
}

export default GraphCanvas
