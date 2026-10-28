import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { authenticate, clearSession, createAlgorithm, deleteAlgorithm, getSession, listAlgorithms, updateAlgorithm } from './api.js'
import AlgorithmForm from './components/AlgorithmForm.jsx'
import AlgorithmList from './components/AlgorithmList.jsx'
import AuthForm from './components/AuthForm.jsx'
import AlgorithmDetails from './components/AlgorithmDetails.jsx'
import './App.css'

const mutationFeedbackDuration = 1000

async function waitForMutationResponse(request) {
  const [result] = await Promise.allSettled([
    request,
    new Promise((resolve) => setTimeout(resolve, mutationFeedbackDuration)),
  ])
  if (result.status === 'rejected') throw result.reason
  return result.value
}

function App() {
  const [session, setSession] = useState(null)
  const [restoringSession, setRestoringSession] = useState(true)
  const [algorithms, setAlgorithms] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [sortOrder, setSortOrder] = useState('name')
  const [loading, setLoading] = useState(false)
  const [reloadCount, setReloadCount] = useState(0)
  const [loadError, setLoadError] = useState('')
  const [notice, setNotice] = useState('')
  const [noticeIsError, setNoticeIsError] = useState(false)
  const [authError, setAuthError] = useState('')
  const [saving, setSaving] = useState(false)
  const [connectionState, setConnectionState] = useState('idle')
  const [editingAlgorithm, setEditingAlgorithm] = useState(null)
  const mutationVersion = useRef(0)
  const pendingMutations = useRef(0)
  const refreshAfterMutation = useRef(false)

  useEffect(() => {
    let active = true

    const restore = async () => {
      try {
        const savedSession = getSession()
        if (savedSession && active) setSession(savedSession)
      } catch (error) {
        if (active) setAuthError(error.message)
      } finally {
        if (active) setRestoringSession(false)
      }
    }

    restore()
    return () => { active = false }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 350)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    let active = true

    const load = async () => {
      if (!session) {
        setAlgorithms([])
        setSelectedId(null)
        return
      }

      const requestMutationVersion = mutationVersion.current
      setLoading(true)
      setLoadError('')
      try {
        const items = await listAlgorithms(session.user.id, debouncedQuery)
        if (!active) return
        if (pendingMutations.current > 0 || requestMutationVersion !== mutationVersion.current) {
          refreshAfterMutation.current = true
          if (pendingMutations.current === 0) {
            refreshAfterMutation.current = false
            setReloadCount((count) => count + 1)
          }
          return
        }
        setAlgorithms(items)
        setSelectedId((currentId) =>
          items.some((item) => item.id === currentId) ? currentId : (items[0]?.id ?? null),
        )
      } catch (error) {
        if (active) setLoadError(error.message)
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => { active = false }
  }, [session, debouncedQuery, reloadCount])

  useEffect(() => {
    document.title = `Библиотека алгоритмов · ${algorithms.length}`
  }, [algorithms.length])

  const visibleAlgorithms = useMemo(() => [...algorithms].sort((first, second) => (
    sortOrder === 'type'
      ? first.type.localeCompare(second.type, 'ru')
      : first.name.localeCompare(second.name, 'ru')
  )), [algorithms, sortOrder])

  const selectedAlgorithm = algorithms.find((item) => item.id === selectedId) ?? null

  const handleAuthentication = async (credentials, mode) => {
    setAuthError('')
    try {
      const nextSession = await authenticate(credentials, mode)
      setSession(nextSession)
      setQuery('')
      setDebouncedQuery('')
      setNotice(`Вы вошли как ${nextSession.user.username}`)
      setNoticeIsError(false)
    } catch (error) {
      setAuthError(error.message)
    }
  }

  const handleLogout = () => {
    clearSession()
    setSession(null)
    setAlgorithms([])
    setSelectedId(null)
    setEditingAlgorithm(null)
    setNotice('Вы вышли из аккаунта')
    setNoticeIsError(false)
  }

  const beginMutation = () => {
    mutationVersion.current += 1
    pendingMutations.current += 1
    setSaving(true)
    setConnectionState('checking')
    setNotice('')
  }

  const finishMutation = () => {
    pendingMutations.current -= 1
    setSaving(pendingMutations.current > 0)
    if (pendingMutations.current === 0 && refreshAfterMutation.current) {
      refreshAfterMutation.current = false
      setReloadCount((count) => count + 1)
    }
  }

  const handleSave = async (values) => {
    beginMutation()

    if (editingAlgorithm) {
      const original = editingAlgorithm
      const optimistic = { ...original, ...values }
      setAlgorithms((items) => items.map((item) => item.id === original.id ? optimistic : item))

      try {
        const updated = await waitForMutationResponse(updateAlgorithm(original.id, values))
        setAlgorithms((items) => items.map((item) => item.id === original.id ? updated : item))
        setEditingAlgorithm(null)
        setNotice('Изменения сохранены')
        setNoticeIsError(false)
        setConnectionState('connected')
        return true
      } catch (error) {
        setAlgorithms((items) => items.map((item) => item.id === original.id ? original : item))
        const unavailable = error.status === 0 || error.status >= 500
        setNotice(unavailable
          ? 'Сервер недоступен. Изменения отменены, исходные данные восстановлены.'
          : error.message)
        setNoticeIsError(true)
        setConnectionState(unavailable ? 'unavailable' : 'error')
        return false
      } finally {
        finishMutation()
      }
    }

    const temporaryId = -Date.now()
    const temporaryItem = { id: temporaryId, owner_id: session.user.id, ...values }
    const previousSelectedId = selectedId
    setAlgorithms((items) => [...items, temporaryItem])
    setSelectedId(temporaryId)

    try {
      const created = await waitForMutationResponse(createAlgorithm(values))
      setAlgorithms((items) => items.map((item) => item.id === temporaryId ? created : item))
      setSelectedId(created.id)
      setNotice('Алгоритм добавлен')
      setNoticeIsError(false)
      setConnectionState('connected')
      return true
    } catch (error) {
      setAlgorithms((items) => items.filter((item) => item.id !== temporaryId))
      setSelectedId((currentId) => currentId === temporaryId ? previousSelectedId : currentId)
      const unavailable = error.status === 0 || error.status >= 500
      setNotice(unavailable
        ? 'Сервер недоступен. Добавление отменено.'
        : error.message)
      setNoticeIsError(true)
      setConnectionState(unavailable ? 'unavailable' : 'error')
      return false
    } finally {
      finishMutation()
    }
  }

  const handleDelete = async (algorithm) => {
    beginMutation()
    const index = algorithms.findIndex((item) => item.id === algorithm.id)
    const nextSelection = algorithms[index + 1] ?? algorithms[index - 1] ?? null
    setAlgorithms((items) => items.filter((item) => item.id !== algorithm.id))
    if (selectedId === algorithm.id) setSelectedId(nextSelection?.id ?? null)
    setNotice('')

    try {
      await waitForMutationResponse(deleteAlgorithm(algorithm.id))
      setNotice('Алгоритм удалён')
      setNoticeIsError(false)
      setConnectionState('connected')
    } catch (error) {
      setAlgorithms((items) => {
        const restored = [...items]
        restored.splice(Math.min(index, restored.length), 0, algorithm)
        return restored
      })
      if (selectedId === algorithm.id) {
        const fallbackId = nextSelection?.id ?? null
        setSelectedId((currentId) => currentId === fallbackId ? algorithm.id : currentId)
      }
      const unavailable = error.status === 0 || error.status >= 500
      setNotice(unavailable
        ? 'Сервер недоступен. Удаление отменено, карточка восстановлена.'
        : error.message)
      setNoticeIsError(true)
      setConnectionState(unavailable ? 'unavailable' : 'error')
    } finally {
      finishMutation()
    }
  }

  const handleAuthExpired = useCallback(() => {
    setSession(null)
    setAlgorithms([])
    setSelectedId(null)
    setAuthError('Срок действия сеанса истёк. Войдите снова.')
  }, [])

  useEffect(() => {
    window.addEventListener('auth:expired', handleAuthExpired)
    return () => window.removeEventListener('auth:expired', handleAuthExpired)
  }, [handleAuthExpired])

  if (restoringSession) {
    return <main className="app-shell"><p className="page-message" role="status">Проверяем сеанс...</p></main>
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true">AL</div>
        <div>
          <p className="eyebrow">Лабораторная работа 5</p>
          <h1>Библиотека алгоритмов</h1>
        </div>
        {session && connectionState !== 'idle' && (
          <span
            className={`connection-status connection-${connectionState}`}
            role={connectionState === 'unavailable' || connectionState === 'error' ? 'alert' : 'status'}
          >
            {connectionState === 'checking' && 'Отправляем запрос серверу...'}
            {connectionState === 'connected' && 'Сервер ответил'}
            {connectionState === 'unavailable' && 'Сервер недоступен'}
            {connectionState === 'error' && 'Ошибка ответа сервера'}
          </span>
        )}
        {session && (
          <div className="account-actions">
            <span>{session.user.username}</span>
            <button type="button" className="text-button" onClick={handleLogout}>Выйти</button>
          </div>
        )}
      </header>

      {!session ? (
        <AuthForm onSubmit={handleAuthentication} error={authError} />
      ) : (
        <>
        {connectionState === 'checking' && (
          <p className="request-status" role="status" aria-live="polite">
            <span className="request-spinner" aria-hidden="true" />
            Запрос отправляется на сервер. Изменение уже показано на клиенте.
          </p>
        )}
        <section className="workspace">
          <aside className="sidebar">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Ваш каталог</p>
                <h2>Алгоритмы</h2>
              </div>
              <span className="count-badge">{algorithms.length}</span>
            </div>

            <label className="search-field">
              <span>Поиск по каталогу</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value.slice(0, 100))}
                maxLength={100}
                placeholder="Название, тип или описание"
              />
            </label>

            <label className="sort-field">
              <span>Сортировка результатов</span>
              <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}>
                <option value="name">По названию</option>
                <option value="type">По типу</option>
              </select>
            </label>

            <AlgorithmList
              algorithms={visibleAlgorithms}
              selectedId={selectedId}
              loading={loading}
              error={loadError}
              onSelect={setSelectedId}
              onEdit={setEditingAlgorithm}
              onDelete={handleDelete}
              onRetry={() => setReloadCount((count) => count + 1)}
              disabled={saving}
            />
          </aside>

          <section className="content-area">
            {notice && (
              <p
                className={noticeIsError ? 'notice notice-error' : 'notice'}
                role={noticeIsError ? 'alert' : 'status'}
              >
                {notice}
              </p>
            )}
            <AlgorithmDetails algorithm={selectedAlgorithm} />
            <AlgorithmForm
              key={editingAlgorithm?.id ?? 'new'}
              algorithm={editingAlgorithm}
              onSubmit={handleSave}
              onCancel={() => setEditingAlgorithm(null)}
              saving={saving}
            />
          </section>
        </section>
        </>
      )}
    </main>
  )
}

export default App
