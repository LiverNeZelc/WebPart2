import { useCallback, useEffect, useMemo, useState } from 'react'
import GraphCanvas from './GraphCanvas.jsx'
import { createTraversal } from '../graphTraversal.js'

const emptySteps = []

function GraphTraversalPanel({ graph }) {
  const [algorithm, setAlgorithm] = useState('BFS')
  const [selectedStart, setSelectedStart] = useState('')
  const [playback, setPlayback] = useState({ signature: '', stepIndex: 0, playing: false })
  const [speed, setSpeed] = useState(900)
  const startId = graph.vertices.some((vertex) => vertex.id === selectedStart)
    ? selectedStart
    : graph.vertices[0]?.id || ''
  const signature = JSON.stringify([graph.directed, graph.vertices, graph.edges, algorithm, startId])
  const playbackMatches = playback.signature === signature
  const stepIndex = playbackMatches ? playback.stepIndex : 0
  const playing = playbackMatches && playback.playing
  const steps = useMemo(() => (
    graph.vertices.length && startId
      ? createTraversal(graph, algorithm, startId)
      : emptySteps
  ), [graph, algorithm, startId])
  const step = steps[stepIndex] || null
  const displayFrontier = algorithm === 'DFS' ? [...(step?.frontier || [])].reverse() : step?.frontier || []

  const updatePlayback = useCallback((updates) => {
    setPlayback((current) => ({
      signature,
      stepIndex: current.signature === signature ? current.stepIndex : 0,
      playing: current.signature === signature ? current.playing : false,
      ...updates,
    }))
  }, [signature])

  useEffect(() => {
    if (!playing) return undefined
    const timer = setTimeout(() => {
      if (stepIndex >= steps.length - 1) {
        updatePlayback({ playing: false })
      } else {
        updatePlayback({ stepIndex: stepIndex + 1 })
      }
    }, speed)
    return () => clearTimeout(timer)
  }, [playing, speed, stepIndex, steps.length, updatePlayback])

  const vertexName = (id) => graph.vertices.find((vertex) => vertex.id === id)?.label || id

  return (
    <section className="traversal-panel" aria-label="Пошаговый обход графа">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Визуализация</p>
          <h2>Обход графа</h2>
        </div>
        <span className="type-label">{algorithm === 'BFS' ? 'По уровням' : 'В глубину'}</span>
      </div>
      <div className="traversal-controls">
        <label>
          <span>Алгоритм</span>
          <select value={algorithm} onChange={(event) => setAlgorithm(event.target.value)}>
            <option value="BFS">BFS · поиск в ширину</option>
            <option value="DFS">DFS · поиск в глубину</option>
          </select>
        </label>
        <label>
          <span>Стартовая вершина</span>
          <select value={startId} onChange={(event) => setSelectedStart(event.target.value)} disabled={!graph.vertices.length}>
            {graph.vertices.map((vertex) => <option key={vertex.id} value={vertex.id}>{vertex.label}</option>)}
          </select>
        </label>
        <label className="speed-control">
          <span>Скорость: {speed < 500 ? 'быстро' : speed > 1200 ? 'медленно' : 'обычно'}</span>
          <input
            type="range"
            min="250"
            max="1800"
            step="50"
            value={speed}
            onChange={(event) => setSpeed(Number(event.target.value))}
            aria-label="Скорость анимации"
          />
        </label>
      </div>

      <div className="traversal-visual">
        <div className="traversal-graph">
          <GraphCanvas
            graph={graph}
            mode="view"
            current={step?.current}
            visited={step?.visited || []}
            frontier={step?.frontier || []}
            activeEdge={step?.activeEdge}
            onVertexClick={setSelectedStart}
          />
          <div className="graph-legend">
            <span><i className="legend-current" />Текущая</span>
            <span><i className="legend-visited" />Посещена</span>
            <span><i className="legend-frontier" />В очереди / стеке</span>
          </div>
        </div>
        <aside className="frontier-panel">
          <h3>{algorithm === 'BFS' ? 'Очередь FIFO' : 'Стек LIFO'}</h3>
          <p className="field-hint">{algorithm === 'DFS' ? 'Вершина сверху будет следующей' : 'Первой выйдет вершина сверху'}</p>
          <ol className="frontier-list">
            {displayFrontier.map((id) => <li key={id}>{vertexName(id)}</li>)}
            {displayFrontier.length === 0 && <li className="frontier-empty">Пусто</li>}
          </ol>
          <div className="traversal-stats">
            <span>Посещено</span><strong>{step?.visited.length || 0} / {graph.vertices.length}</strong>
          </div>
          <div className="traversal-stats">
            <span>Текущая вершина</span><strong>{step?.current ? vertexName(step.current) : '—'}</strong>
          </div>
        </aside>
      </div>

      <div className="traversal-timeline">
        <div className="traversal-actions">
          <button type="button" className="graph-tool-button" onClick={() => updatePlayback({ stepIndex: 0, playing: false })} disabled={!steps.length || stepIndex === 0}>В начало</button>
          <button
            type="button"
            className="graph-tool-button"
            onClick={() => updatePlayback({ stepIndex: Math.max(0, stepIndex - 1), playing: false })}
            disabled={!steps.length || stepIndex === 0}
          >
            ← Назад
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => updatePlayback({
              stepIndex: stepIndex >= steps.length - 1 ? 0 : stepIndex,
              playing: !playing,
            })}
            disabled={!steps.length}
          >
            {playing ? 'Пауза' : stepIndex >= steps.length - 1 && steps.length > 1 ? 'Повторить' : 'Воспроизвести'}
          </button>
          <button
            type="button"
            className="graph-tool-button"
            onClick={() => updatePlayback({ stepIndex: Math.min(steps.length - 1, stepIndex + 1), playing: false })}
            disabled={!steps.length || stepIndex >= steps.length - 1}
          >
            Шаг вперёд →
          </button>
        </div>
        <label className="timeline-slider">
          <span>Шаг {steps.length ? stepIndex + 1 : 0} из {steps.length}</span>
          <input
            type="range"
            min="0"
            max={Math.max(0, steps.length - 1)}
            value={stepIndex}
            onChange={(event) => updatePlayback({ stepIndex: Number(event.target.value), playing: false })}
            disabled={!steps.length}
            aria-label="Перемотка обхода"
          />
        </label>
        <p className="traversal-log" role="status">
          {step?.log || 'Добавьте вершины, чтобы запустить обход.'}
        </p>
      </div>

      {algorithm === 'BFS' && step && (
        <section className="bfs-levels" aria-label="Волны обхода в ширину">
          <h3>Волны BFS</h3>
          <div className="bfs-level-list">
            {[...new Set(Object.values(step.levels))].sort((a, b) => a - b).map((level) => (
              <div className="bfs-level" key={level}>
                <strong>Уровень {level}</strong>
                <span>
                  {graph.vertices
                    .filter((vertex) => step.levels[vertex.id] === level)
                    .map((vertex) => vertex.label)
                    .join(', ')}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="visit-order">
        <span>Порядок посещения:</span>
        <strong>{step?.order.map(vertexName).join(' → ') || '—'}</strong>
      </div>
    </section>
  )
}

export default GraphTraversalPanel
