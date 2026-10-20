function AlgorithmList({
  algorithms,
  selectedId,
  loading,
  error,
  onSelect,
  onEdit,
  onDelete,
  onRetry,
  disabled,
}) {
  return (
    <div className="algorithm-list" aria-live="polite">
      {loading && <p className="empty-state" role="status">Загружаем алгоритмы...</p>}
      {error && (
        <div className="error-block" role="alert">
          <p>{error}</p>
          <button type="button" className="text-button" onClick={onRetry}>Повторить</button>
        </div>
      )}
      {!loading && !error && algorithms.map((algorithm) => {
        const isOwned = algorithm.owner_id !== null && algorithm.owner_id !== undefined

        return (
          <article
            className={`algorithm-item ${selectedId === algorithm.id ? 'active' : ''}`}
            key={algorithm.id}
          >
            <button
              type="button"
              className="algorithm-select"
              aria-pressed={selectedId === algorithm.id}
              onClick={() => onSelect(algorithm.id)}
            >
              <span className="item-topline">
                <strong>{algorithm.name}</strong>
                <span>{algorithm.type}</span>
              </span>
              <span className="item-description">{algorithm.description}</span>
            </button>
            {isOwned ? (
              <div className="item-actions">
                <button type="button" disabled={disabled} onClick={() => onEdit(algorithm)}>Изменить</button>
                <button
                  type="button"
                  className="danger"
                  disabled={disabled}
                  onClick={() => onDelete(algorithm)}
                >
                  Удалить
                </button>
              </div>
            ) : (
              <p className="shared-label">Общий пример</p>
            )}
          </article>
        )
      })}
      {!loading && !error && algorithms.length === 0 && (
        <p className="empty-state">В каталоге пока нет алгоритмов. Добавьте первый через форму.</p>
      )}
    </div>
  )
}

export default AlgorithmList
