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
