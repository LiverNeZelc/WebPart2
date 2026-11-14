import { useMemo, useState } from 'react'
import { createTreeModel, getTreeKind, parseTreeItems, treeKinds } from '../treeAlgorithms.js'
import TreeCanvas from './TreeCanvas.jsx'

function TreeEditor({ tree, onChange, error }) {
  const [itemsError, setItemsError] = useState('')
  const kind = getTreeKind(tree.kind)
  const model = useMemo(() => {
    try { return createTreeModel(tree.kind, tree.items || []) } catch { return { nodes: [], edges: [] } }
  }, [tree.kind, tree.items])

  const changeKind = (nextKind) => {
    onChange({ ...tree, kind: nextKind, items: [], inputText: '' })
    setItemsError('')
  }

  const changeItems = (text) => {
    try {
      const items = parseTreeItems(text, tree.kind)
      onChange({ ...tree, items, inputText: text })
      setItemsError('')
    } catch (validationError) {
      onChange({ ...tree, items: [], inputText: text })
      setItemsError(validationError.message)
    }
  }

  return (
    <section className="tree-editor" aria-label="Конструктор дерева">
      <div className="tree-editor-heading">
        <div>
          <p className="eyebrow">Конструктор структуры</p>
          <h3>Соберите дерево</h3>
        </div>
        <span className="tree-editor-count">{tree.items.length} элементов</span>
      </div>
      <div className="tree-editor-grid">
        <div className="tree-editor-controls">
          <label>
            <span>Тип структуры</span>
            <select value={tree.kind} onChange={(event) => changeKind(event.target.value)}>
              {treeKinds.map((option) => (
                <option key={option.id} value={option.id}>{option.group} — {option.name}</option>
              ))}
            </select>
          </label>
          <p className="tree-kind-hint">{kind.hint}</p>
          <label>
            <span>{tree.kind === 'TRIE' ? 'Слова' : tree.kind === 'SEGMENT' || tree.kind === 'FENWICK' ? 'Числа массива' : 'Ключи'}</span>
            <textarea
              value={tree.inputText ?? (tree.items || []).join(', ')}
              onChange={(event) => changeItems(event.target.value)}
              placeholder={tree.kind === 'TRIE' ? 'алгоритм, аллея, граф' : '8, 3, 10, 1, 6, 14'}
              rows="4"
              aria-invalid={Boolean(itemsError || error)}
              aria-describedby="tree-items-help"
            />
            <span id="tree-items-help" className="field-hint">
              Разделяйте элементы запятыми, пробелами или переносами строк. До {tree.kind === 'SEGMENT' || tree.kind === 'FENWICK' ? 32 : 40} элементов.
            </span>
            {(itemsError || error) && <span className="field-error" role="alert">{error || itemsError}</span>}
          </label>
          <div className="tree-example-chips" aria-label="Пример ключей">
            <span>Пример:</span>
            <button type="button" className="text-button" onClick={() => changeItems(tree.kind === 'TRIE' ? 'алгоритм, аллея, граф, графы' : '8, 3, 10, 1, 6, 14, 4')}>Заполнить</button>
            <button type="button" className="text-button" onClick={() => { changeItems(''); setItemsError('') }}>Очистить</button>
          </div>
        </div>
        <div className="tree-preview">
          <div className="tree-preview-heading">
            <span>Предпросмотр</span>
            <strong>{kind.name}</strong>
          </div>
          <TreeCanvas model={model} compact />
        </div>
      </div>
    </section>
  )
}

export default TreeEditor
