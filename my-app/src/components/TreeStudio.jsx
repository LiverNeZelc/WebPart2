import { useEffect, useState } from 'react'
import { listTrees } from '../api.js'
import TreeSearchPanel from './TreeSearchPanel.jsx'
import { getTreeKind } from '../treeAlgorithms.js'

function TreeStudio({ onOpenLibrary, reloadCount }) {
  const [trees, setTrees] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const activeId = trees.some((tree) => tree.id === selectedId) ? selectedId : trees[0]?.id || ''
  const selectedTree = trees.find((tree) => tree.id === activeId) || null

  useEffect(() => {
    let active = true
    listTrees().then((items) => {
      if (!active) return
      setTrees(items)
      setLoadError('')
    }).catch((error) => {
      if (active) setLoadError(error.message)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [reloadCount])

  return (
    <section className="tree-page">
      <header className="page-intro">
        <p className="eyebrow">Модуль 03 · Структуры данных</p>
        <h2>Поиск в дереве</h2>
        <p className="description">
          Исследуйте путь поиска, сравнения и диапазонные запросы. Для AVL, красно-чёрного дерева и кучи доступны операции изменения.
        </p>
      </header>
      <div className="tree-page-layout">
        <aside className="tree-sidebar" aria-label="Деревья из каталога">
          <div className="section-heading">
            <div><p className="eyebrow">Ваш каталог</p><h2>Деревья</h2></div>
            <span className="count-badge">{trees.length}</span>
          </div>
          <button type="button" className="primary-button tree-new-button" onClick={onOpenLibrary}>Создать в каталоге</button>
          {loading && <p className="empty-state" role="status">Загружаем деревья...</p>}
          {loadError && <p className="error-message" role="alert">{loadError}</p>}
          <div className="tree-list">
            {trees.map((tree) => (
              <button
                type="button"
                key={tree.id}
                className={`tree-card-select ${activeId === tree.id ? 'active' : ''}`}
                onClick={() => setSelectedId(tree.id)}
                aria-pressed={activeId === tree.id}
              >
                <strong>{tree.name}</strong>
                <span>{getTreeKind(tree.kind).name} · {tree.items.length} элементов</span>
              </button>
            ))}
            {!loading && !loadError && trees.length === 0 && (
              <p className="empty-state">Создайте карточку типа «Деревья» в каталоге алгоритмов.</p>
            )}
          </div>
        </aside>
        <section className="tree-main">
          {selectedTree ? <TreeSearchPanel key={selectedTree.id} tree={selectedTree} /> : (
            <section className="tree-empty-summary">
              <p className="eyebrow">Сначала создайте дерево</p>
              <h2>Нет деревьев для поиска</h2>
              <p>Откройте каталог, выберите тип «Деревья» и задайте элементы в конструкторе.</p>
            </section>
          )}
        </section>
      </div>
    </section>
  )
}

export default TreeStudio
