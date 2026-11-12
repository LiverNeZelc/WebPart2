function SortCatalog({ algorithms, loading, error, onRetry, onCompare, isAuthenticated }) {
  return (
    <main className="sort-catalog-page">
      <header className="page-intro">
        <p className="eyebrow">Публичная библиотека</p>
        <h2>Сортировки с открытым кодом</h2>
        <p className="description">
          Изучайте опубликованные алгоритмы на Python и запускайте парное сравнение
          через WebSocket.
        </p>
      </header>

      {loading && <p className="empty-state" role="status">Загружаем публичные сортировки...</p>}
      {error && (
        <div className="error-block" role="alert">
          <p>{error}</p>
          <button type="button" className="text-button" onClick={onRetry}>Повторить</button>
        </div>
      )}
      {!loading && !error && algorithms.length === 0 && (
        <p className="empty-state">Публичных алгоритмов пока нет. Опубликуйте свою сортировку.</p>
      )}

      <section className="sort-catalog-grid" aria-label="Публичные алгоритмы сортировки">
        {algorithms.map((algorithm) => (
          <article className="sort-public-card" key={algorithm.id}>
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Публичная сортировка</p>
                <h3>{algorithm.name}</h3>
              </div>
              <span className="type-label">{algorithm.type}</span>
            </div>
            <p className="description">{algorithm.description}</p>
            <pre className="python-code">{algorithm.python_code}</pre>
            <div className="sort-card-footer">
              <span>{algorithm.python_code.split('\n').length} строк кода</span>
              <button
                type="button"
                className="primary-button"
                onClick={() => onCompare(algorithm.id)}
              >
                {isAuthenticated ? 'Сравнить в соревновании' : 'Войти для соревнования'}
              </button>
            </div>
          </article>
        ))}
      </section>
    </main>
  )
}

export default SortCatalog
