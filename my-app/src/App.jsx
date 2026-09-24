import { useEffect, useState } from 'react'
import './App.css'

const storageKey = 'algorithm-visualizer-items'

const initialAlgorithms = [
  {
    id: 1,
    name: 'Бинарный поиск',
    type: 'Поиск',
    description: 'Быстрый поиск элемента в отсортированном массиве.',
  },
  {
    id: 2,
    name: 'Сортировка слиянием',
    type: 'Сортировка',
    description: 'Стабильная сортировка с асимптотикой O(n log n).',
  },
]

function App() {
  const [algorithms, setAlgorithms] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      return saved ? JSON.parse(saved) : initialAlgorithms
    } catch {
      return initialAlgorithms
    }
  })
  const [name, setName] = useState('')
  const [type, setType] = useState('Поиск')
  const [description, setDescription] = useState('')
  const [query, setQuery] = useState('')
  const [sortOrder, setSortOrder] = useState('name')
  const [editingId, setEditingId] = useState(null)
  const [selectedId, setSelectedId] = useState(1)
  const [saveState, setSaveState] = useState('Состояние загружено')

  useEffect(() => {
    document.title = `Визуализатор алгоритмов · ${algorithms.length}`
  }, [algorithms.length])

  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(storageKey, JSON.stringify(algorithms))
      setSaveState('Автосохранено')
    }, 500)

    return () => clearTimeout(timer)
  }, [algorithms])

  const visibleAlgorithms = algorithms
    .filter((algorithm) =>
      `${algorithm.name} ${algorithm.type} ${algorithm.description}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .sort((first, second) => {
      if (sortOrder === 'type') return first.type.localeCompare(second.type)
      return first.name.localeCompare(second.name)
    })

  const selectedAlgorithm =
    algorithms.find((algorithm) => algorithm.id === selectedId) || algorithms[0]

  const resetForm = () => {
    setName('')
    setType('Поиск')
    setDescription('')
    setEditingId(null)
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!name.trim() || !description.trim()) return

    if (editingId) {
      setAlgorithms((current) =>
        current.map((algorithm) =>
          algorithm.id === editingId
            ? { ...algorithm, name: name.trim(), type, description: description.trim() }
            : algorithm,
        ),
      )
    } else {
      const newAlgorithm = {
        id: Date.now(),
        name: name.trim(),
        type,
        description: description.trim(),
      }
      setAlgorithms((current) => [...current, newAlgorithm])
      setSelectedId(newAlgorithm.id)
    }

    setSaveState('Изменения ожидают сохранения')
    resetForm()
  }

  const editAlgorithm = (algorithm) => {
    setEditingId(algorithm.id)
    setName(algorithm.name)
    setType(algorithm.type)
    setDescription(algorithm.description)
  }

  const removeAlgorithm = (id) => {
    setAlgorithms((current) => current.filter((algorithm) => algorithm.id !== id))
    if (selectedId === id) {
      setSelectedId(algorithms.find((item) => item.id !== id)?.id)
    }
  }

  const bars = selectedAlgorithm
    ? Array.from({ length: 10 }, (_, index) => ((index * 17 + selectedAlgorithm.id) % 75) + 25)
    : []

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark">AV</div>
        <div>
          <h1>Визуализатор алгоритмов</h1>
        </div>
        <span className="save-status">● {saveState}</span>
      </header>

      <section className="workspace">
        <aside className="sidebar">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Библиотека</p>
              <h2>Алгоритмы</h2>
            </div>
            <span className="count-badge">{algorithms.length}</span>
          </div>

          <label className="search-field">
            <span>Поиск</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Название или тип" />
          </label>

          <label className="sort-field">
            <span>Сортировка</span>
            <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}>
              <option value="name">По названию</option>
              <option value="type">По типу</option>
            </select>
          </label>

          <div className="algorithm-list">
            {visibleAlgorithms.map((algorithm) => (
              <article
                className={`algorithm-item ${selectedId === algorithm.id ? 'active' : ''}`}
                key={algorithm.id}
                onClick={() => setSelectedId(algorithm.id)}
              >
                <div className="item-topline">
                  <strong>{algorithm.name}</strong>
                  <span>{algorithm.type}</span>
                </div>
                <p>{algorithm.description}</p>
                <div className="item-actions">
                  <button type="button" onClick={(event) => { event.stopPropagation(); editAlgorithm(algorithm) }}>Изменить</button>
                  <button type="button" className="danger" onClick={(event) => { event.stopPropagation(); removeAlgorithm(algorithm.id) }}>Удалить</button>
                </div>
              </article>
            ))}
            {!visibleAlgorithms.length && <p className="empty-state">Ничего не найдено</p>}
          </div>
        </aside>

        <section className="content-area">
          <div className="visualizer-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Демонстрация</p>
                <h2>{selectedAlgorithm?.name || 'Выберите алгоритм'}</h2>
              </div>
              <span className="type-label">{selectedAlgorithm?.type || 'Нет данных'}</span>
            </div>
            <p className="description">{selectedAlgorithm?.description || 'Добавьте первый алгоритм через форму ниже.'}</p>
            <div className="visualizer" aria-label="Визуализация массива">
              {bars.map((height, index) => <div className="bar" style={{ height: `${height}%` }} key={index}><span>{index + 1}</span></div>)}
            </div>
            <div className="visualizer-footer"><span>Массив данных</span><span>10 элементов · готово к запуску</span></div>
          </div>

          <form className="algorithm-form" onSubmit={handleSubmit}>
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Управление списком</p>
                <h2>{editingId ? 'Редактировать алгоритм' : 'Добавить алгоритм'}</h2>
              </div>
              {editingId && <button type="button" className="text-button" onClick={resetForm}>Отменить</button>}
            </div>
            <div className="form-grid">
              <label><span>Название</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Например, Быстрая сортировка" required /></label>
              <label><span>Тип</span><select value={type} onChange={(event) => setType(event.target.value)}><option>Поиск</option><option>Сортировка</option><option>Графы</option><option>Другое</option></select></label>
              <label className="wide"><span>Описание</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Коротко опишите принцип работы" rows="3" required /></label>
            </div>
            <button className="primary-button" type="submit">{editingId ? 'Сохранить изменения' : 'Добавить в библиотеку'}</button>
          </form>
        </section>
      </section>
    </main>
  )
}

export default App
