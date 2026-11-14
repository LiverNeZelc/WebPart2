import { useCallback, useEffect, useMemo, useState } from 'react'
import { createTreeModel, createTreeTrace, getTreeKind, usesRange, usesWords } from '../treeAlgorithms.js'
import TreeCanvas from './TreeCanvas.jsx'

function TreeSearchPanel({ tree }) {
  const [query, setQuery] = useState('')
  const [stepIndex, setStepIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(800)
  const [workingItems, setWorkingItems] = useState(tree.items)
  const [operation, setOperation] = useState('search')
  const [operationError, setOperationError] = useState('')
  const [operationMessage, setOperationMessage] = useState('')

  const items = workingItems
  const kind = getTreeKind(tree.kind)
  const isRange = usesRange(tree.kind)
  const canMutate = ['AVL', 'RED_BLACK', 'HEAP'].includes(tree.kind)
  const model = useMemo(() => createTreeModel(tree.kind, items), [tree.kind, items])
  const queryValue = query.trim() || (isRange ? `0-${Math.min(items.length - 1, 2)}` : items[0] || '')
  const search = useMemo(
    () => createTreeTrace(tree.kind, items, queryValue),
    [tree.kind, items, queryValue],
  )
  const steps = search.steps
  const step = steps[Math.min(stepIndex, steps.length - 1)]
  const stepIndexSafe = Math.min(stepIndex, steps.length - 1)

  useEffect(() => {
    if (!playing) return undefined
    const timer = setTimeout(() => {
      if (stepIndexSafe >= steps.length - 1) setPlaying(false)
      else setStepIndex(stepIndexSafe + 1)
    }, speed)
    return () => clearTimeout(timer)
  }, [playing, speed, stepIndexSafe, steps.length])

  const runOperation = () => {
    setOperationError('')
    setOperationMessage('')
    const raw = query.trim()
    if (!raw) {
      setOperationError(isRange ? 'Введите диапазон, например 0-3.' : 'Введите значение.')
      return
    }
    if (operation === 'insert') {
      if (tree.kind !== 'TRIE' && !/^-?\d{1,9}$/.test(raw)) {
        setOperationError('Введите целое число.')
        return
      }
      if (tree.kind === 'TRIE' && !/^[\p{L}\p{N}_-]{1,24}$/u.test(raw)) {
        setOperationError('Введите слово из букв, цифр, дефиса или подчёркивания.')
        return
      }
      const value = usesWords(tree.kind) ? raw.toLocaleLowerCase('ru') : String(Number(raw))
      if (items.map((item) => String(item).toLocaleLowerCase('ru')).includes(value)) {
        setOperationError(`Элемент «${raw}» уже есть в структуре.`)
        return
      }
      if (items.length >= 40) {
        setOperationError('Достигнут предел в 40 элементов.')
        return
      }
      setWorkingItems([...items, value])
      setOperationMessage(tree.kind === 'HEAP'
        ? `Добавлен ключ ${value}. Sift up восстановил порядок от листа к корню.`
        : `${tree.kind === 'AVL' ? 'AVL-перестройка' : 'Красно-чёрная перестройка'} после вставки ключа ${value} завершена.`)
    } else if (operation === 'delete') {
      if (!/^-?\d{1,9}$/.test(raw)) {
        setOperationError('Введите целое число.')
        return
      }
      const value = String(Number(raw))
      const next = items.filter((item) => item !== value)
      if (next.length === items.length) {
        setOperationError(`Ключ ${raw} не найден.`)
        return
      }
      if (!next.length) {
        setOperationError('Нельзя удалить последний элемент структуры.')
        return
      }
      setWorkingItems(next)
      setOperationMessage(`Ключ ${raw} удалён. Сбалансированное дерево перестроено.`)
    } else if (operation === 'pop') {
      if (tree.kind !== 'HEAP') return
      const heap = model.nodes.map((node) => Number(node.label))
      if (heap.length <= 1) {
        setOperationError('В куче должен остаться хотя бы один элемент.')
        return
      }
      const minimum = heap[0]
      const last = heap.pop()
      heap[0] = last
      let index = 0
      while (true) {
        const left = index * 2 + 1
        const right = left + 1
        let smallest = index
        if (left < heap.length && heap[left] < heap[smallest]) smallest = left
        if (right < heap.length && heap[right] < heap[smallest]) smallest = right
        if (smallest === index) break
        ;[heap[index], heap[smallest]] = [heap[smallest], heap[index]]
        index = smallest
      }
      setWorkingItems(heap.map(String))
      setOperationMessage(`Минимум ${minimum} извлечён. Последний элемент просеян вниз (sift down).`)
    }
    setStepIndex(0)
    setPlaying(false)
  }

  const updateStep = useCallback((next) => {
    setStepIndex(Math.max(0, Math.min(steps.length - 1, next)))
    setPlaying(false)
  }, [steps.length])

  const visitCount = step?.visited?.length || 0

  return (
    <section className="tree-search-panel" aria-label="Поиск и визуализация дерева">
      <header className="tree-search-heading">
        <div>
          <p className="eyebrow">Интерактивная визуализация</p>
          <h2>{tree.name}</h2>
          <p>{tree.description}</p>
        </div>
        <span className="type-label">{kind.name}</span>
      </header>

      <div className="tree-search-controls">
        <label>
          <span>{isRange ? 'Диапазон индексов' : usesWords(tree.kind) ? 'Слово или префикс' : 'Ключ для поиска'}</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') { setStepIndex(0); setPlaying(false) } }}
            placeholder={isRange ? '0-3' : usesWords(tree.kind) ? 'алгоритм' : 'Например, 8'}
          />
        </label>
        {canMutate && (
          <label>
            <span>Операция</span>
            <select value={operation} onChange={(event) => { setOperation(event.target.value); setOperationError('') }}>
              <option value="search">Поиск ключа</option>
              <option value="insert">{tree.kind === 'HEAP' ? 'Вставить ключ · sift up' : 'Вставить ключ'}</option>
              {tree.kind !== 'HEAP' && <option value="delete">Удалить ключ</option>}
              {tree.kind === 'HEAP' && <option value="pop">Извлечь минимум · sift down</option>}
            </select>
          </label>
        )}
        {canMutate && operation !== 'search' ? (
          <button type="button" className="primary-button tree-run-button" onClick={runOperation}>
            {operation === 'pop' ? 'Извлечь минимум' : operation === 'insert' ? 'Вставить и перестроить' : 'Удалить и перестроить'}
          </button>
        ) : (
          <button type="button" className="primary-button tree-run-button" onClick={() => { setStepIndex(0); setPlaying(false) }}>
            Начать поиск
          </button>
        )}
        <label className="speed-control">
          <span>Скорость: {speed < 500 ? 'быстро' : speed > 1200 ? 'медленно' : 'обычно'}</span>
          <input type="range" min="250" max="1800" step="50" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} aria-label="Скорость визуализации дерева" />
        </label>
      </div>
      {operationError && <p className="field-error" role="alert">{operationError}</p>}
      {operationMessage && <p className="tree-operation-message" role="status">{operationMessage}</p>}

      <div className="tree-visual-layout">
        <div className="tree-visual-main">
          <TreeCanvas model={model} current={step?.current} visited={step?.visited || []} />
          <div className="tree-legend">
            <span><i className="tree-legend-current" />Текущий узел</span>
            <span><i className="tree-legend-visited" />Путь / посещённые</span>
            {tree.kind === 'AVL' && <span><i className="tree-legend-balance" />Баланс-фактор</span>}
            {tree.kind === 'RED_BLACK' && <span><i className="tree-legend-red" />Красно-чёрная окраска</span>}
          </div>
        </div>
        <aside className="tree-step-aside">
          <p className="eyebrow">Шаг {steps.length ? stepIndexSafe + 1 : 0} / {steps.length}</p>
          <h3>{isRange ? 'Сумма диапазона' : tree.kind === 'TRIE' ? 'Префикс' : tree.kind === 'HEAP' ? 'Позиция в куче' : 'Сравнение'}</h3>
          <strong className="tree-comparison">{step?.comparison || step?.prefix || (step?.result !== undefined ? step.result : step?.current ? model.nodes.find((node) => node.id === step.current)?.label : '—')}</strong>
          <p className="tree-step-log" role="status">{step?.log || 'Введите значение и запустите визуализацию.'}</p>
          <div className="traversal-stats"><span>Проверено узлов</span><strong>{visitCount}</strong></div>
          <div className="traversal-stats"><span>Найдено</span><strong>{steps.some((item) => item.found) ? 'Да' : 'Нет'}</strong></div>
          {tree.kind === 'HEAP' && (
            <p className="field-hint">Куча упорядочена частично: для поиска проверяются элементы, а извлечение минимума просеивает корень вниз.</p>
          )}
        </aside>
      </div>

      <div className="tree-timeline">
        <div className="traversal-actions">
          <button type="button" className="graph-tool-button" onClick={() => updateStep(0)} disabled={stepIndexSafe === 0}>В начало</button>
          <button type="button" className="graph-tool-button" onClick={() => updateStep(stepIndexSafe - 1)} disabled={stepIndexSafe === 0}>← Назад</button>
          <button type="button" className="primary-button" onClick={() => {
            if (playing) setPlaying(false)
            else { if (stepIndexSafe >= steps.length - 1) setStepIndex(0); setPlaying(true) }
          }} disabled={!steps.length}>{playing ? 'Пауза' : 'Воспроизвести'}</button>
          <button type="button" className="graph-tool-button" onClick={() => updateStep(stepIndexSafe + 1)} disabled={stepIndexSafe >= steps.length - 1}>Шаг вперёд →</button>
        </div>
        <label className="timeline-slider">
          <span>История шагов</span>
          <input type="range" min="0" max={Math.max(0, steps.length - 1)} value={stepIndexSafe} onChange={(event) => updateStep(Number(event.target.value))} disabled={!steps.length} aria-label="Перемотка шагов поиска в дереве" />
        </label>
      </div>
      <div className="tree-data-summary">
        <span>{isRange ? 'Исходный массив' : tree.kind === 'TRIE' ? 'Слова в Trie' : 'Ключи структуры'}</span>
        <strong>{items.join(' · ')}</strong>
      </div>
    </section>
  )
}

export default TreeSearchPanel
