import { useEffect, useState } from 'react'
import { listGraphs } from '../api.js'
import GraphTraversalPanel from './GraphTraversalPanel.jsx'
import { graphSummary } from '../graphLabels.js'

function GraphStudio({ onOpenLibrary }) {
  const [graphs, setGraphs] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const selectedGraph = graphs.find((graph) => graph.id === selectedId) || null

  useEffect(() => {
    let active = true
    listGraphs().then((items) => {
      if (!active) return
      setGraphs(items)
      setSelectedId(items[0]?.id || '')
    }).catch((error) => {
      if (active) setLoadError(error.message)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [])

  return (
    <section className="graph-page">
      <header className="page-intro">
        <p className="eyebrow">Модуль 02 · Теория графов</p>
        <h2>Обход графа</h2>
        <p className="description">
          Выберите граф из каталога, задайте стартовую вершину и изучите обход в ширину или глубину.
        </p>
      </header>

      <div className="graph-layout">
        <aside className="graph-sidebar" aria-label="Графы из каталога алгоритмов">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Ваш каталог</p>
              <h2>Графы</h2>
            </div>
            <span className="count-badge">{graphs.length}</span>
          </div>
          <button type="button" className="primary-button graph-new-button" onClick={onOpenLibrary}>
            Создать в каталоге
          </button>
          {loading && <p className="empty-state" role="status">Загружаем графы...</p>}
          {loadError && <p className="error-message" role="alert">{loadError}</p>}
          <div className="graph-list">
            {graphs.map((graph) => (
              <button
                type="button"
                key={graph.id}
                className={`graph-card graph-card-select ${selectedId === graph.id ? 'active' : ''}`}
                onClick={() => setSelectedId(graph.id)}
                aria-pressed={selectedId === graph.id}
              >
                <strong>{graph.name}</strong>
                <span>{graphSummary(graph)}</span>
              </button>
            ))}
            {!loading && !loadError && graphs.length === 0 && (
              <p className="empty-state">Создайте карточку типа «Графы» в каталоге алгоритмов.</p>
            )}
          </div>
        </aside>

        <section className="graph-main">
          {selectedGraph ? (
            <>
              <section className="graph-selected-summary">
                <p className="eyebrow">Карточка графа</p>
                <h2>{selectedGraph.name}</h2>
                <p>{selectedGraph.description}</p>
              </section>
              <GraphTraversalPanel graph={selectedGraph} />
            </>
          ) : (
            <section className="graph-selected-summary">
              <p className="eyebrow">Сначала создайте граф</p>
              <h2>Нет графов для обхода</h2>
              <p>Откройте каталог алгоритмов, выберите тип «Графы» и соберите граф на поле.</p>
            </section>
          )}
        </section>
      </div>
    </section>
  )
}

export default GraphStudio
