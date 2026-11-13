import { useState } from 'react'
import GraphCanvas from './GraphCanvas.jsx'

const maxVertices = 40
const maxEdges = 120

function makeVertexId() {
  return globalThis.crypto?.randomUUID?.() || `vertex-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function GraphEditor({ graph, onChange }) {
  const [addMode, setAddMode] = useState(false)
  const [connectMode, setConnectMode] = useState(false)
  const [vertexLabel, setVertexLabel] = useState('')
  const [selectedVertex, setSelectedVertex] = useState('')
  const [selectedEdge, setSelectedEdge] = useState(-1)
  const [connectFrom, setConnectFrom] = useState('')
  const [error, setError] = useState('')

  const updateGraph = (update) => {
    onChange({ ...graph, ...update })
    setError('')
  }

  const addVertex = (position) => {
    const label = vertexLabel.trim()
    if (!label) {
      setError('Введите название вершины перед добавлением на поле.')
      return
    }
    if (graph.vertices.some((vertex) => vertex.label.toLocaleLowerCase('ru') === label.toLocaleLowerCase('ru'))) {
      setError('Название вершины уже используется.')
      return
    }
    if (graph.vertices.length >= maxVertices) {
      setError(`Можно добавить не более ${maxVertices} вершин.`)
      return
    }
    const vertex = { id: makeVertexId(), label, ...position }
    updateGraph({ vertices: [...graph.vertices, vertex] })
    setVertexLabel('')
    setSelectedVertex(vertex.id)
    setAddMode(false)
  }

  const handleVertexClick = (vertexId) => {
    if (!connectMode) {
      setSelectedVertex(vertexId)
      setSelectedEdge(-1)
      return
    }
    if (!connectFrom) {
      setConnectFrom(vertexId)
      return
    }
    if (connectFrom === vertexId) {
      setConnectFrom('')
      return
    }
    const source = graph.directed ? connectFrom : [connectFrom, vertexId].sort()[0]
    const target = graph.directed ? vertexId : [connectFrom, vertexId].sort()[1]
    const exists = graph.edges.some((edge) => edge.source === source && edge.target === target)
    if (exists || graph.edges.length >= maxEdges) {
      setError(exists ? 'Такое ребро уже существует.' : `Можно добавить не более ${maxEdges} рёбер.`)
    } else {
      updateGraph({ edges: [...graph.edges, { source, target }] })
      setSelectedEdge(-1)
    }
    setConnectFrom('')
  }

  const removeSelected = () => {
    if (selectedVertex) {
      updateGraph({
        vertices: graph.vertices.filter((vertex) => vertex.id !== selectedVertex),
        edges: graph.edges.filter((edge) => edge.source !== selectedVertex && edge.target !== selectedVertex),
      })
      setSelectedVertex('')
    } else if (selectedEdge !== -1) {
      updateGraph({ edges: graph.edges.filter((_, index) => index !== selectedEdge) })
      setSelectedEdge(-1)
    }
  }

  return (
    <section className="graph-builder" aria-label="Конструктор графа">
      <label className="visibility-toggle graph-directed-toggle">
        <input
          type="checkbox"
          checked={graph.directed}
          onChange={(event) => updateGraph({ directed: event.target.checked })}
        />
        <span>Ориентированный граф (рёбра имеют направление)</span>
      </label>

      <div className="graph-tools">
        <label className="graph-vertex-label">
          <span>Название новой вершины</span>
          <input
            value={vertexLabel}
            onChange={(event) => setVertexLabel(event.target.value.slice(0, 20))}
            maxLength={20}
            placeholder="A"
          />
        </label>
        <button
          type="button"
          className={`graph-tool-button ${addMode ? 'selected' : ''}`}
          onClick={() => {
            setAddMode((value) => !value)
            setConnectMode(false)
            setConnectFrom('')
          }}
          disabled={graph.vertices.length >= maxVertices}
        >
          {addMode ? 'Нажмите на поле...' : 'Добавить вершину'}
        </button>
        <button
          type="button"
          className={`graph-tool-button ${connectMode ? 'selected' : ''}`}
          onClick={() => {
            setConnectMode((value) => !value)
            setAddMode(false)
            setConnectFrom('')
          }}
          disabled={graph.vertices.length < 2 || graph.edges.length >= maxEdges}
        >
          {connectMode ? 'Выберите две вершины' : 'Соединить вершины'}
        </button>
        <button
          type="button"
          className="graph-tool-button graph-remove-button"
          onClick={removeSelected}
          disabled={!selectedVertex && selectedEdge === -1}
        >
          Удалить выбранное
        </button>
      </div>
      <p className="graph-canvas-instruction">
        {addMode
          ? 'Укажите позицию новой вершины щелчком по свободному месту.'
          : connectMode
            ? `Выберите первую и вторую вершины${graph.directed ? ' по направлению ребра' : ''}.`
            : 'Перетаскивайте вершины мышью. Выберите вершину или ребро, чтобы удалить его.'}
      </p>
      {error && <p className="field-error graph-form-error" role="alert">{error}</p>}
      <GraphCanvas
        graph={graph}
        mode={addMode ? 'add' : 'edit'}
        selectedVertex={selectedVertex}
        selectedEdge={selectedEdge}
        connectFrom={connectFrom}
        onCanvasClick={addVertex}
        onVertexClick={handleVertexClick}
        onVertexMove={(id, point) => updateGraph({
          vertices: graph.vertices.map((vertex) => vertex.id === id ? { ...vertex, ...point } : vertex),
        })}
        onEdgeClick={(index) => {
          setSelectedEdge(index)
          setSelectedVertex('')
        }}
      />
      <p className="graph-editor-footer">
        <span>{graph.vertices.length}/{maxVertices} вершин · {graph.edges.length}/{maxEdges} рёбер</span>
      </p>
    </section>
  )
}

export default GraphEditor
