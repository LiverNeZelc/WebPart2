import { useRef, useState } from 'react'
import GraphCanvas from './GraphCanvas.jsx'

const maxVertices = 40
const maxEdges = 120

function makeVertexId() {
  return globalThis.crypto?.randomUUID?.() || `vertex-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function findPosition(vertices) {
  if (vertices.length === 0) return { x: 400, y: 220 }

  const candidates = Array.from({ length: 40 }, (_, index) => ({
    x: 58 + (index % 8) * 98,
    y: 60 + Math.floor(index / 8) * 80,
  }))
  return candidates.find((candidate) => vertices.every((vertex) => (
    Math.hypot(vertex.x - candidate.x, vertex.y - candidate.y) >= 58
  ))) || { x: 400, y: 220 }
}

function GraphEditor({ graph, onChange }) {
  const dialogRef = useRef(null)
  const labelInputRef = useRef(null)
  const [connectMode, setConnectMode] = useState(false)
  const [deleteMode, setDeleteMode] = useState(false)
  const [selectedVertex, setSelectedVertex] = useState('')
  const [selectedEdge, setSelectedEdge] = useState(-1)
  const [connectFrom, setConnectFrom] = useState('')
  const [error, setError] = useState('')

  const updateGraph = (update) => {
    onChange({ ...graph, ...update })
    setError('')
  }

  const openVertexDialog = () => {
    if (graph.vertices.length >= maxVertices) return
    labelInputRef.current.value = ''
    dialogRef.current.showModal()
    labelInputRef.current.focus()
  }

  const addVertex = (event) => {
    event.preventDefault()
    if (!labelInputRef.current.checkValidity()) {
      labelInputRef.current.reportValidity()
      return
    }
    const label = labelInputRef.current.value.trim().toUpperCase()
    if (graph.vertices.some((vertex) => vertex.label.toLocaleLowerCase('ru') === label.toLocaleLowerCase('ru'))) {
      labelInputRef.current.setCustomValidity('Такая метка уже используется.')
      labelInputRef.current.reportValidity()
      return
    }

    const vertex = { id: makeVertexId(), label, ...findPosition(graph.vertices) }
    updateGraph({ vertices: [...graph.vertices, vertex] })
    setSelectedVertex(vertex.id)
    setSelectedEdge(-1)
    setError('')
    dialogRef.current.close()
  }

  const deleteVertex = (vertexId) => {
    const vertex = graph.vertices.find((item) => item.id === vertexId)
    updateGraph({
      vertices: graph.vertices.filter((item) => item.id !== vertexId),
      edges: graph.edges.filter((edge) => edge.source !== vertexId && edge.target !== vertexId),
    })
    setSelectedVertex('')
    setConnectFrom('')
    setError(`Вершина ${vertex?.label || ''} и связанные рёбра удалены.`)
  }

  const handleVertexClick = (vertexId) => {
    if (deleteMode) {
      deleteVertex(vertexId)
      return
    }
    if (!connectMode) {
      setSelectedVertex(vertexId)
      setSelectedEdge(-1)
      return
    }
    if (!connectFrom) {
      setConnectFrom(vertexId)
      setError(`Выбрана ${graph.vertices.find((vertex) => vertex.id === vertexId)?.label}. Теперь выберите соседнюю вершину.`)
      return
    }
    if (connectFrom === vertexId) {
      setConnectFrom('')
      setError('')
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
      setError('Ребро добавлено.')
    }
    setConnectFrom('')
  }

  const removeSelected = () => {
    if (selectedVertex) {
      deleteVertex(selectedVertex)
    } else if (selectedEdge !== -1) {
      updateGraph({ edges: graph.edges.filter((_, index) => index !== selectedEdge) })
      setSelectedEdge(-1)
      setError('Ребро удалено.')
    }
  }

  const activateMode = (mode) => {
    setConnectMode(mode === 'connect' ? (value) => !value : false)
    setDeleteMode(mode === 'delete' ? (value) => !value : false)
    setConnectFrom('')
    setError('')
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

      <div className="graph-builder-card">
        <div className="graph-builder-toolbar">
          <div className="graph-builder-heading">
            <span className="graph-live-dot" />
            <div>
              <strong>Рабочая область</strong>
              <span>Создайте граф на поле</span>
            </div>
          </div>
          <div className="graph-tools" aria-label="Инструменты графа">
            <button
              type="button"
              className="graph-tool-button"
              onClick={openVertexDialog}
              disabled={graph.vertices.length >= maxVertices}
            >
              <b aria-hidden="true">＋</b> Вершина
            </button>
            <button
              type="button"
              className={`graph-tool-button ${connectMode ? 'selected' : ''}`}
              onClick={() => activateMode('connect')}
              disabled={graph.vertices.length < 2 || graph.edges.length >= maxEdges}
              aria-pressed={connectMode}
            >
              <b aria-hidden="true">⌁</b> Ребро
            </button>
            <button
              type="button"
              className={`graph-tool-button ${deleteMode ? 'selected graph-delete-active' : ''}`}
              onClick={() => activateMode('delete')}
              disabled={graph.vertices.length === 0}
              aria-pressed={deleteMode}
            >
              <b aria-hidden="true">−</b> Удалить
            </button>
            {(selectedVertex || selectedEdge !== -1) && (
              <button type="button" className="graph-tool-button" onClick={removeSelected}>
                Удалить выбранное
              </button>
            )}
          </div>
        </div>

        <div className="graph-builder-canvas-wrap">
          <GraphCanvas
            graph={graph}
            mode={deleteMode ? 'delete' : 'edit'}
            selectedVertex={selectedVertex}
            selectedEdge={selectedEdge}
            connectFrom={connectFrom}
            onVertexClick={handleVertexClick}
            onVertexMove={(id, point) => updateGraph({
              vertices: graph.vertices.map((vertex) => vertex.id === id ? { ...vertex, ...point } : vertex),
            })}
            onEdgeClick={(index) => {
              setSelectedEdge(index)
              setSelectedVertex('')
            }}
          />
          <div className="graph-legend">
            <span><i className="legend-node" />Вершина</span>
            <span><i className="legend-frontier" />Выбрана</span>
            <span><i className="legend-done" />Соединение</span>
          </div>
          <span className="graph-canvas-coordinates">ПЕРЕТАСКИВАЙТЕ ДЛЯ ПЕРЕМЕЩЕНИЯ <i>·</i> НАЖМИТЕ ДЛЯ ВЫБОРА</span>
        </div>

        <div className="graph-builder-footer">
          <p className="graph-canvas-instruction" role={error ? 'status' : undefined}>
            {error || (connectMode
              ? connectFrom
                ? 'Выберите вторую вершину для создания ребра.'
                : 'Выберите две вершины по очереди, чтобы создать ребро.'
              : deleteMode
                ? 'Выберите вершину, чтобы удалить её вместе со связанными рёбрами.'
                : 'Добавляйте вершины, соединяйте их и перетаскивайте мышью для удобного размещения.')}
          </p>
          <span className="graph-editor-count">
            {graph.vertices.length}/{maxVertices} вершин · {graph.edges.length}/{maxEdges} рёбер
          </span>
        </div>
      </div>

      <dialog ref={dialogRef} className="graph-vertex-dialog">
        <div>
          <p className="eyebrow">Новая вершина</p>
          <h3>Дадим ей имя.</h3>
          <label htmlFor="graph-vertex-label">Метка вершины</label>
          <input
            ref={labelInputRef}
            id="graph-vertex-label"
            maxLength={3}
            pattern="[A-Z][A-Z0-9]{0,2}"
            placeholder="A"
            autoComplete="off"
            required
            onChange={(event) => {
              event.target.value = event.target.value.toUpperCase()
              event.target.setCustomValidity('')
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') addVertex(event)
            }}
          />
          <p className="dialog-hint">Заглавная латинская буква или короткая метка, например A или A1.</p>
          <div className="dialog-actions">
            <button type="button" className="graph-tool-button" onClick={() => dialogRef.current.close()}>
              Отмена
            </button>
            <button type="button" className="primary-button" onClick={addVertex}>
              Добавить <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </dialog>
    </section>
  )
}

export default GraphEditor
