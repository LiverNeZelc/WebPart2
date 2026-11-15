import GraphCanvas from './GraphCanvas.jsx'
import { graphSummary } from '../graphLabels.js'
import TreeCanvas from './TreeCanvas.jsx'
import { createTreeModel, getTreeKind } from '../treeAlgorithms.js'

function AlgorithmDetails({ algorithm }) {
  return (
    <section className="details-panel" aria-live="polite">
      <p className="eyebrow">Карточка алгоритма</p>
      {algorithm ? (
        <>
          <div className="panel-heading">
            <h2>{algorithm.name}</h2>
            <span className="type-label">{algorithm.type}</span>
          </div>
          <p className="description">{algorithm.description}</p>
          {algorithm.type === 'Сортировка' && algorithm.python_code && (
            <section className="criteria-details" aria-label="Код сортировки на Python">
              <h3>Код Python {algorithm.is_public && <span className="public-code-label">Публичный</span>}</h3>
              <pre className="python-code">{algorithm.python_code}</pre>
            </section>
          )}
          {algorithm.type === 'Графы' && algorithm.graph && (
            <section className="criteria-details" aria-label="Граф">
              <h3>Структура графа</h3>
              <p className="field-hint">
                {algorithm.graph.directed ? 'Ориентированный' : 'Неориентированный'} граф · {graphSummary(algorithm.graph)}
              </p>
              <GraphCanvas graph={algorithm.graph} mode="view" onVertexClick={() => {}} />
            </section>
          )}
          {algorithm.type === 'Деревья' && algorithm.tree && (
            <section className="criteria-details tree-card-section" aria-label="Структура дерева">
              <div className="tree-card-preview-heading">
                <div>
                  <h3>Структура дерева</h3>
                  <p>{getTreeKind(algorithm.tree.kind).name}</p>
                </div>
                <span>{algorithm.tree.items.length} элементов</span>
              </div>
              <TreeCanvas model={createTreeModel(algorithm.tree.kind, algorithm.tree.items)} compact />
              <p className="tree-card-values">{algorithm.tree.items.join(' · ')}</p>
            </section>
          )}
          {algorithm.criteria?.length > 0 && (
            <section className="criteria-details" aria-label="Критерии алгоритма">
              <h3>Критерии</h3>
              <ul>
                {algorithm.criteria.map((criterion, index) => (
                  <li key={`${criterion.name}-${index}`}>
                    <strong>{criterion.name}</strong>
                    {criterion.description && <p>{criterion.description}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <p className="details-footnote">
            {algorithm.owner_id === null
              ? 'Общий пример из серверного каталога.'
              : 'Карточка хранится в серверном каталоге вашего аккаунта.'}
          </p>
        </>
      ) : (
        <>
          <h2>Выберите алгоритм</h2>
          <p className="description">
            Выберите элемент из списка или добавьте новый, чтобы открыть его описание.
          </p>
        </>
      )}
    </section>
  )
}

export default AlgorithmDetails
