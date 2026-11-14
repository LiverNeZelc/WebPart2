import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { authenticate, clearSession, createAlgorithm, createGraph, createTree, deleteAlgorithm, deleteGraph, deleteTree, getSession, listAlgorithms, listGraphs, listPublicAlgorithms, listTrees, updateAlgorithm, updateGraph, updateTree } from './api.js'
import AlgorithmForm from './components/AlgorithmForm.jsx'
import AlgorithmList from './components/AlgorithmList.jsx'
import AuthForm from './components/AuthForm.jsx'
import AlgorithmDetails from './components/AlgorithmDetails.jsx'
import SortCatalog from './components/SortCatalog.jsx'
import SortCompetition from './components/SortCompetition.jsx'
import GraphStudio from './components/GraphStudio.jsx'
import TreeStudio from './components/TreeStudio.jsx'
import './App.css'

const mutationFeedbackDuration = 1000
const apiUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

const toGraphCard = (graph) => ({
  ...graph,
  id: `graph:${graph.id}`,
  graphId: graph.id,
  type: 'Графы',
  graph: {
    directed: graph.directed,
    vertices: graph.vertices || [],
    edges: graph.edges || [],
  },
  python_code: '',
  is_public: false,
  criteria: [],
})

const toTreeCard = (tree) => ({
  ...tree,
  id: `tree:${tree.id}`,
  treeId: tree.id,
  type: 'Деревья',
  tree: { kind: tree.kind, items: tree.items || [] },
  python_code: '',
  is_public: false,
  criteria: [],
})

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
  const [publicAlgorithms, setPublicAlgorithms] = useState([])
  const [publicLoading, setPublicLoading] = useState(true)
  const [publicError, setPublicError] = useState('')
  const [publicReloadCount, setPublicReloadCount] = useState(0)
  const [activeTab, setActiveTab] = useState('library')
  const [selectedReferenceId, setSelectedReferenceId] = useState('')
  const [sortSocket, setSortSocket] = useState(null)
  const [socketError, setSocketError] = useState('')
  const [challenges, setChallenges] = useState([])
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
  const sortSocketRef = useRef(null)
  const accessToken = session?.accessToken

  useEffect(() => {
    let active = true
    const loadPublicAlgorithms = async () => {
      setPublicLoading(true)
      setPublicError('')
      try {
        const items = await listPublicAlgorithms()
        if (active) setPublicAlgorithms(items)
      } catch (error) {
        if (active) setPublicError(error.message)
      } finally {
        if (active) setPublicLoading(false)
      }
    }

    loadPublicAlgorithms()
    return () => { active = false }
  }, [publicReloadCount, activeTab])

  useEffect(() => {
    if (!accessToken) {
      sortSocketRef.current?.close()
      sortSocketRef.current = null
      return undefined
    }

    let active = true
    const apiRoot = new URL(apiUrl, window.location.href)
    const websocketUrl = new URL('/ws/sort', apiRoot)
    websocketUrl.protocol = websocketUrl.protocol === 'https:' ? 'wss:' : 'ws:'
    const socket = new WebSocket(websocketUrl)
    sortSocketRef.current = socket

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'authenticate', token: accessToken }))
    }
    socket.onmessage = (event) => {
      let message
      try {
        message = JSON.parse(event.data)
      } catch {
        if (active) setSocketError('Получено некорректное сообщение WebSocket')
        return
      }

      if (message.type === 'authenticated') {
        if (active) {
          setSortSocket(socket)
          setSocketError('')
        }
      } else if (message.type === 'challenge') {
        if (active) {
          setChallenges((items) => [
            ...items.filter((item) => item.challengeId !== message.challengeId),
            { ...message, accepting: false },
          ])
        }
      } else if (['challenge-removed', 'challenge-expired', 'challenge-cancelled'].includes(message.type)) {
        if (active) {
          setChallenges((items) => items.filter((item) => item.challengeId !== message.challengeId))
          if (message.type === 'challenge-expired') {
            setSocketError('Время ожидания приглашения истекло')
          }
        }
      } else if (message.type === 'matched') {
        if (active) {
          setActiveTab('competition')
          setChallenges([])
        }
      } else if (message.type === 'challenge-declined') {
        if (active) {
          setSocketError(`${message.username} отклонил приглашение`)
          setActiveTab('competition')
        }
      } else if (message.type === 'error') {
        if (active) {
          setSocketError(message.message)
          setChallenges((items) => items.map((item) => ({ ...item, accepting: false })))
        }
      }
    }
    socket.onerror = () => {
      if (active) setSocketError('Соединение WebSocket недоступно')
    }
    socket.onclose = () => {
      if (active) {
        setSortSocket(null)
        setSocketError('Соединение с уведомлениями WebSocket закрыто')
      }
    }

    return () => {
      active = false
      socket.close()
      if (sortSocketRef.current === socket) sortSocketRef.current = null
    }
  }, [accessToken])

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
        const [items, graphItems, treeItems] = await Promise.all([
          listAlgorithms(debouncedQuery),
          listGraphs(),
          listTrees(),
        ])
        if (!active) return
        if (pendingMutations.current > 0 || requestMutationVersion !== mutationVersion.current) {
          refreshAfterMutation.current = true
          if (pendingMutations.current === 0) {
            refreshAfterMutation.current = false
            setReloadCount((count) => count + 1)
          }
          return
        }
        const searchTerm = debouncedQuery.toLocaleLowerCase('ru')
        const matchingGraphs = graphItems
          .filter((graph) => !searchTerm
            || `${graph.name} ${graph.description} Графы`.toLocaleLowerCase('ru').includes(searchTerm))
          .map(toGraphCard)
        const matchingTrees = treeItems
          .filter((tree) => !searchTerm
            || `${tree.name} ${tree.description} Деревья`.toLocaleLowerCase('ru').includes(searchTerm))
          .map(toTreeCard)
        const catalogItems = [...items, ...matchingGraphs, ...matchingTrees]
        setAlgorithms(catalogItems)
        setSelectedId((currentId) =>
          catalogItems.some((item) => item.id === currentId)
            ? currentId
            : (catalogItems[0]?.id ?? null),
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
      setActiveTab('library')
      setQuery('')
      setDebouncedQuery('')
      setNotice(`Вы вошли как ${nextSession.user.username}`)
      setNoticeIsError(false)
    } catch (error) {
      setAuthError(error.message)
    }
  }

  const handleLogout = () => {
    sortSocketRef.current?.close()
    setSortSocket(null)
    clearSession()
    setSession(null)
    setActiveTab('library')
    setAlgorithms([])
    setSelectedId(null)
    setEditingAlgorithm(null)
    setChallenges([])
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

  const handleSaveGraph = async (values) => {
    beginMutation()
    const original = editingAlgorithm
    const graph = {
      name: values.name,
      description: values.description,
      directed: values.graph.directed,
      vertices: values.graph.vertices,
      edges: values.graph.edges,
    }

    try {
      const saved = await waitForMutationResponse(original?.graphId
        ? updateGraph(original.graphId, graph)
        : createGraph(graph))
      const graphCard = toGraphCard(saved)
      let cleanupWarning = ''
      if (original?.type === 'Графы' && !original.graphId) {
        try {
          await waitForMutationResponse(deleteAlgorithm(original.id))
        } catch (error) {
          cleanupWarning = `Граф создан, но старую пустую карточку удалить не удалось: ${error.message}`
        }
      }

      setAlgorithms((items) => original
        ? items.map((item) => item.id === original.id ? graphCard : item)
        : [...items, graphCard])
      setSelectedId(graphCard.id)
      setEditingAlgorithm(null)
      setNotice(cleanupWarning || (original ? 'Изменения графа сохранены' : 'Граф добавлен в каталог'))
      setNoticeIsError(Boolean(cleanupWarning))
      setConnectionState('connected')
      return true
    } catch (error) {
      const unavailable = error.status === 0 || error.status >= 500
      setNotice(unavailable ? 'Сервер недоступен. Изменения графа не сохранены.' : error.message)
      setNoticeIsError(true)
      setConnectionState(unavailable ? 'unavailable' : 'error')
      return false
    } finally {
      finishMutation()
    }
  }

  const handleSaveTree = async (values) => {
    beginMutation()
    const original = editingAlgorithm
    const tree = {
      name: values.name,
      description: values.description,
      kind: values.tree.kind,
      items: values.tree.items,
    }

    try {
      const saved = await waitForMutationResponse(original?.treeId
        ? updateTree(original.treeId, tree)
        : createTree(tree))
      const treeCard = toTreeCard(saved)
      setAlgorithms((items) => original?.treeId
        ? items.map((item) => item.id === original.id ? treeCard : item)
        : [...items, treeCard])
      setSelectedId(treeCard.id)
      setEditingAlgorithm(null)
      setNotice(original?.treeId ? 'Изменения дерева сохранены' : 'Дерево добавлено в каталог')
      setNoticeIsError(false)
      setConnectionState('connected')
      return true
    } catch (error) {
      const unavailable = error.status === 0 || error.status >= 500
      setNotice(unavailable ? 'Сервер недоступен. Изменения дерева не сохранены.' : error.message)
      setNoticeIsError(true)
      setConnectionState(unavailable ? 'unavailable' : 'error')
      return false
    } finally {
      finishMutation()
    }
  }

  const handleSave = async (values) => {
    if (values.type === 'Графы') return handleSaveGraph(values)
    if (values.type === 'Деревья') return handleSaveTree(values)
    beginMutation()

    if (editingAlgorithm) {
      const original = editingAlgorithm
      const optimistic = { ...original, ...values }
      setAlgorithms((items) => items.map((item) => item.id === original.id ? optimistic : item))

      try {
        const updated = await waitForMutationResponse(updateAlgorithm(original.id, values))
        setAlgorithms((items) => items.map((item) => item.id === original.id ? updated : item))
        setPublicReloadCount((count) => count + 1)
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
      setPublicReloadCount((count) => count + 1)
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
      await waitForMutationResponse(algorithm.graphId
        ? deleteGraph(algorithm.graphId)
        : algorithm.treeId
          ? deleteTree(algorithm.treeId)
          : deleteAlgorithm(algorithm.id))
      if (algorithm.is_public) setPublicReloadCount((count) => count + 1)
      setNotice(algorithm.treeId ? 'Дерево удалено' : algorithm.graphId ? 'Граф удалён' : 'Алгоритм удалён')
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
    sortSocketRef.current?.close()
    setSortSocket(null)
    setSession(null)
    setAlgorithms([])
    setSelectedId(null)
    setChallenges([])
    setAuthError('Срок действия сеанса истёк. Войдите снова.')
  }, [])

  const respondToChallenge = (challenge, accept) => {
    if (sortSocket?.readyState !== WebSocket.OPEN) {
      setSocketError('Нет соединения с сервером уведомлений')
      return
    }
    if (accept) {
      setChallenges((items) => items.map((item) => (
        item.challengeId === challenge.challengeId ? { ...item, accepting: true } : item
      )))
      setActiveTab('competition')
    } else {
      setChallenges((items) => items.filter((item) => item.challengeId !== challenge.challengeId))
    }
    sortSocket.send(JSON.stringify({
      type: accept ? 'accept-challenge' : 'decline-challenge',
      challengeId: challenge.challengeId,
    }))
  }

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

      <nav className="main-tabs" aria-label="Разделы сайта">
        <button
          type="button"
          className={activeTab === 'library' ? 'active' : ''}
          aria-current={activeTab === 'library' ? 'page' : undefined}
          onClick={() => setActiveTab('library')}
        >
          Каталог алгоритмов
        </button>
        <button
          type="button"
          className={activeTab === 'sorts' ? 'active' : ''}
          aria-current={activeTab === 'sorts' ? 'page' : undefined}
          onClick={() => setActiveTab('sorts')}
        >
          Сортировки <span>{publicAlgorithms.length}</span>
        </button>
        <button
          type="button"
          className={activeTab === 'graphs' ? 'active' : ''}
          aria-current={activeTab === 'graphs' ? 'page' : undefined}
          onClick={() => setActiveTab('graphs')}
        >
          Обход графа
        </button>
        <button
          type="button"
          className={activeTab === 'trees' ? 'active' : ''}
          aria-current={activeTab === 'trees' ? 'page' : undefined}
          onClick={() => setActiveTab('trees')}
        >
          Поиск в дереве
        </button>
        <button
          type="button"
          className={activeTab === 'competition' ? 'active' : ''}
          aria-current={activeTab === 'competition' ? 'page' : undefined}
          onClick={() => setActiveTab('competition')}
        >
          Соревнование
        </button>
      </nav>

      {challenges.length > 0 && (
        <section className="challenge-inbox" aria-label="Приглашения на соревнование">
          <div className="challenge-inbox-heading">
            <div>
              <p className="eyebrow">Входящие</p>
              <h2>Приглашения на соревнование</h2>
            </div>
            <span className="count-badge">{challenges.length}</span>
          </div>
          {challenges.map((challenge) => (
            <article className="challenge-card" key={challenge.challengeId}>
              <div>
                <strong>{challenge.challengerName}</strong>
                <p>
                  Вызывает на соревнование: <b>{challenge.targetAlgorithmName}</b>
                  {' '}против <b>{challenge.algorithmName}</b>
                </p>
              </div>
              <div className="challenge-actions">
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => respondToChallenge(challenge, true)}
                  disabled={challenge.accepting}
                >
                  {challenge.accepting ? 'Подключаем...' : 'Принять и начать'}
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => respondToChallenge(challenge, false)}
                  disabled={challenge.accepting}
                >
                  Отклонить
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
      {socketError && (
        <p className="competition-status" role="status">
          {socketError}
          <button type="button" className="text-button" onClick={() => setSocketError('')}>Закрыть</button>
        </p>
      )}

      {activeTab === 'sorts' && (
        <SortCatalog
          algorithms={publicAlgorithms}
          loading={publicLoading}
          error={publicError}
          onRetry={() => setPublicReloadCount((count) => count + 1)}
          isAuthenticated={Boolean(session)}
          onCompare={(referenceId) => {
            setSelectedReferenceId(referenceId)
            setActiveTab(session ? 'competition' : 'library')
          }}
        />
      )}

      {activeTab === 'competition' && !session && (
        <AuthForm onSubmit={handleAuthentication} error={authError} />
      )}
      {activeTab === 'graphs' && !session && (
        <AuthForm onSubmit={handleAuthentication} error={authError} />
      )}
      {activeTab === 'trees' && !session && (
        <AuthForm onSubmit={handleAuthentication} error={authError} />
      )}
      {activeTab === 'graphs' && session && <GraphStudio onOpenLibrary={() => setActiveTab('library')} />}
      {activeTab === 'trees' && session && <TreeStudio onOpenLibrary={() => setActiveTab('library')} reloadCount={reloadCount} />}
      {session && (
        <div hidden={activeTab !== 'competition'}>
          <SortCompetition
            session={session}
            algorithms={algorithms}
            publicAlgorithms={publicAlgorithms}
            initialReferenceId={selectedReferenceId}
            socket={sortSocket}
          />
        </div>
      )}

      {activeTab === 'library' && (!session ? (
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
                placeholder="Название, тип, описание или критерий"
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
      ))}
    </main>
  )
}

export default App
