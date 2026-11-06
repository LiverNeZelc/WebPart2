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
