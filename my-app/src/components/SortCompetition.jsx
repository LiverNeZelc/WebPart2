import { useEffect, useMemo, useRef, useState } from 'react'

const apiUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')
const maxChatMessageLength = 500
const emptyTrack = (values = []) => ({ values, steps: 0, elapsed: null, error: '' })

function SortBars({ values, label }) {
  return (
    <div className="sort-bars" role="img" aria-label={label}>
      {values.map((value, index) => (
        <span key={index} style={{ height: `${value}%` }} title={String(value)} />
      ))}
    </div>
  )
}

function SortCompetition({
  session,
  algorithms,
  publicAlgorithms,
  initialReferenceId,
  socket,
}) {
  const eligibleAlgorithms = useMemo(() => algorithms.filter((algorithm) => (
    algorithm.type === 'Сортировка'
    && algorithm.python_code?.trim()
    && algorithm.is_public
    && String(algorithm.owner_id) === String(session.user.id)
  )), [algorithms, session.user.id])
  const challengeableAlgorithms = useMemo(() => publicAlgorithms.filter((algorithm) => (
    algorithm.owner_id !== null
    && algorithm.owner_id !== undefined
    && String(algorithm.owner_id) !== String(session.user.id)
  )), [publicAlgorithms, session.user.id])
  const [algorithmId, setAlgorithmId] = useState('')
  const [referenceId, setReferenceId] = useState(initialReferenceId || '')
  const [phase, setPhase] = useState('idle')
  const [error, setError] = useState('')
  const [match, setMatch] = useState(null)
  const [readyCount, setReadyCount] = useState(0)
  const [tracks, setTracks] = useState({})
  const [chatMessages, setChatMessages] = useState([])
  const [chatDraft, setChatDraft] = useState('')
  const socketRef = useRef(null)
  const messageHandlerRef = useRef(() => {})
  const challengeIdRef = useRef(null)
  const workersRef = useRef(new Set())
  const workerTimeoutsRef = useRef(new Map())
  const matchRef = useRef(null)
  const tracksRef = useRef({})

  const updateTracks = (update) => {
    const nextTracks = typeof update === 'function' ? update(tracksRef.current) : update
    tracksRef.current = nextTracks
    setTracks(nextTracks)
  }

  const stopWorkers = () => {
    for (const [worker, timeout] of workerTimeoutsRef.current) {
      clearTimeout(timeout)
      worker.terminate()
    }
    workerTimeoutsRef.current.clear()
    workersRef.current.clear()
  }

  useEffect(() => () => stopWorkers(), [])

  const selectedAlgorithmId = algorithmId || eligibleAlgorithms[0]?.id || ''
  const selectedReferenceId = referenceId || initialReferenceId || ''
  const selectedReference = challengeableAlgorithms.find((item) => item.id === selectedReferenceId)
  const selectedAlgorithm = eligibleAlgorithms.find((item) => item.id === selectedAlgorithmId)
  const reset = () => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      if (matchRef.current) {
        socketRef.current.send(JSON.stringify({ type: 'leave' }))
      } else if (challengeIdRef.current) {
        socketRef.current.send(JSON.stringify({
          type: 'cancel-challenge',
          challengeId: challengeIdRef.current,
        }))
      }
    }
    challengeIdRef.current = null
    stopWorkers()
    setPhase('idle')
    setMatch(null)
    matchRef.current = null
    updateTracks({})
    setChatMessages([])
    setChatDraft('')
    setReadyCount(0)
    setError('')
  }

  const startWorker = (participantId, code, initialValues, broadcast) => {
    const worker = new Worker(new URL('../workers/pythonSort.worker.js', import.meta.url), {
      type: 'module',
    })
    workersRef.current.add(worker)
    const socket = socketRef.current
    const updateTrack = (track) => updateTracks((current) => ({ ...current, [participantId]: track }))
    const timeout = setTimeout(() => {
      worker.terminate()
      workersRef.current.delete(worker)
      workerTimeoutsRef.current.delete(worker)
      updateTrack({ ...emptyTrack(initialValues), error: 'Истекло время выполнения алгоритма' })
      if (broadcast && socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'failed' }))
    }, 45000)
    workerTimeoutsRef.current.set(worker, timeout)

    worker.onmessage = (event) => {
      const message = event.data
      if (message.type === 'step') {
        updateTracks((current) => {
          const previous = current[participantId] || emptyTrack(initialValues)
          return {
            ...current,
            [participantId]: { ...previous, values: message.values, steps: previous.steps + 1 },
          }
        })
        if (broadcast && socket?.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'progress', values: message.values }))
        }
      } else if (message.type === 'done') {
        clearTimeout(timeout)
        workersRef.current.delete(worker)
        workerTimeoutsRef.current.delete(worker)
        updateTrack({
          values: message.values,
          steps: tracksRef.current[participantId]?.steps || 0,
          elapsed: message.elapsed,
          error: '',
        })
        if (broadcast && socket?.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'complete', elapsed: message.elapsed }))
        }
        worker.terminate()
      } else if (message.type === 'error') {
        clearTimeout(timeout)
        workersRef.current.delete(worker)
        workerTimeoutsRef.current.delete(worker)
        updateTrack({ ...emptyTrack(initialValues), error: message.message })
        if (broadcast && socket?.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'failed' }))
        }
        worker.terminate()
      }
    }
    worker.onerror = () => {
      clearTimeout(timeout)
      workersRef.current.delete(worker)
      workerTimeoutsRef.current.delete(worker)
      updateTrack({ ...emptyTrack(initialValues), error: 'Не удалось запустить Python-песочницу' })
      if (broadcast && socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'failed' }))
      }
      worker.terminate()
    }

    const pyodideUrl = new URL(`${apiUrl}/pyodide/`, window.location.href).toString()
    worker.postMessage({ code, values: initialValues, indexURL: pyodideUrl })
  }

  const handleSocketMessage = (event) => {
    let message
    try {
      message = JSON.parse(event.data)
    } catch {
      setError('Сервер прислал некорректное сообщение')
      setPhase('error')
      return
    }

    if (message.type === 'waiting') {
      challengeIdRef.current = message.challengeId
      setPhase('waiting')
    } else if (message.type === 'matched') {
      challengeIdRef.current = null
      matchRef.current = message
      const ownParticipant = message.participants.find(
        (participant) => String(participant.userId) === String(session.user.id),
      )
      const opponentParticipant = message.participants.find(
        (participant) => String(participant.userId) !== String(session.user.id),
      )
      if (ownParticipant) setAlgorithmId(ownParticipant.algorithmId)
      if (opponentParticipant) setReferenceId(opponentParticipant.algorithmId)
      setMatch(message)
      setChatMessages([])
      setChatDraft('')
      updateTracks(Object.fromEntries(message.participants.map((participant) => [
        String(participant.userId),
        emptyTrack(message.values),
      ])))
      setReadyCount(0)
      setPhase('matched')
      setError('')
    } else if (message.type === 'ready-count') {
      setReadyCount(message.count)
    } else if (message.type === 'start') {
      setPhase('running')
      const ownParticipant = matchRef.current?.participants.find(
        (participant) => String(participant.userId) === String(session.user.id),
      )
      const ownAlgorithm = algorithms.find((algorithm) => (
        algorithm.id === ownParticipant?.algorithmId
      ))
      if (!ownParticipant || !ownAlgorithm?.python_code) {
        setError('Не удалось определить ваш алгоритм соревнования')
        setPhase('error')
        return
      }
      startWorker(
        String(ownParticipant.userId),
        ownAlgorithm.python_code,
        message.values,
        true,
      )
    } else if (message.type === 'progress') {
      updateTracks((current) => {
        const key = String(message.senderId)
        const previous = current[key] || emptyTrack(matchRef.current?.values || [])
        return {
          ...current,
          [key]: { ...previous, values: message.values, steps: previous.steps + 1 },
        }
      })
    } else if (message.type === 'complete') {
      updateTracks((current) => {
        const key = String(message.senderId)
        const previous = current[key] || emptyTrack(matchRef.current?.values || [])
        return { ...current, [key]: { ...previous, elapsed: message.elapsed } }
      })
      if (matchRef.current?.participants.every((participant) => (
        String(participant.userId) === String(message.senderId)
          || tracksRef.current[String(participant.userId)]?.elapsed !== null
      ))) {
        setPhase('complete')
      }
    } else if (message.type === 'chat') {
      setChatMessages((messages) => [...messages.slice(-99), message])
    } else if (message.type === 'failed') {
      stopWorkers()
      setError('Алгоритм одного из участников не завершился. Проверьте функцию sort_steps(values).')
      setPhase('error')
    } else if (message.type === 'opponent-disconnected') {
      stopWorkers()
      setError('Соперник отключился от соревнования')
      setPhase('error')
    } else if (message.type === 'error') {
      setError(message.message)
      setPhase('error')
    } else if (message.type === 'challenge-declined') {
      challengeIdRef.current = null
      setError(`${message.username} отклонил приглашение`)
      setPhase('error')
    } else if (message.type === 'challenge-expired' || message.type === 'challenge-cancelled') {
      challengeIdRef.current = null
      setError('Приглашение отменено или истекло')
      setPhase('error')
    }
  }
  useEffect(() => {
    messageHandlerRef.current = handleSocketMessage
  })

  useEffect(() => {
    if (!socket) return undefined
    socketRef.current = socket
    const handleMessage = (event) => messageHandlerRef.current(event)
    socket.addEventListener('message', handleMessage)
    return () => socket.removeEventListener('message', handleMessage)
  }, [socket])

  const joinCompetition = () => {
    if (!selectedAlgorithm || !selectedReference
      || selectedAlgorithm.id === selectedReference.id) {
      setError('Выберите свою сортировку и алгоритм другого пользователя')
      return
    }
    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      setError('Подключение к серверу уведомлений ещё не готово')
      return
    }

    reset()
    setPhase('connecting')
    socketRef.current.send(JSON.stringify({
      type: 'join',
      algorithmId: selectedAlgorithm.id,
      referenceAlgorithmId: selectedReference.id,
    }))
  }

  const markReady = () => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'ready' }))
      setPhase('ready')
    }
  }

  const sendChatMessage = (event) => {
    event.preventDefault()
    const text = chatDraft.trim()
    if (!text || text.length > maxChatMessageLength
      || socketRef.current?.readyState !== WebSocket.OPEN) return
    socketRef.current.send(JSON.stringify({ type: 'chat', text }))
    setChatDraft('')
  }

  const ownParticipantId = String(session.user.id)
  const participants = match?.participants || []
  const opponent = participants.find((participant) => String(participant.userId) !== ownParticipantId)
  const ownParticipant = participants.find((participant) => String(participant.userId) === ownParticipantId)
  const statusText = {
    connecting: 'Подключаемся к WebSocket...',
    authenticating: 'Проверяем токен...',
    waiting: `Приглашение отправлено владельцу «${selectedReference?.name}». Ждём ответа...`,
    matched: 'Соперник найден. Подтвердите готовность.',
    ready: `Готовы ${readyCount} из 2. Ждём второго участника...`,
    running: 'Оба участника готовы — сортировки запущены.',
    complete: 'Сравнение завершено.',
  }[phase]

  return (
    <main className="competition-page">
      <header className="page-intro">
        <p className="eyebrow">WebSocket-соревнование</p>
        <h2>Сравнение алгоритмов</h2>
        <p className="description">
          Выберите свою публичную сортировку и алгоритм другого пользователя.
          Владелец получит приглашение; после принятия и готовности обоих
          начнётся соревнование на общем случайном массиве.
        </p>
      </header>

      {challengeableAlgorithms.length === 0 && (
        <p className="empty-state">Пока нет публичных сортировок других пользователей для приглашения.</p>
      )}
      {eligibleAlgorithms.length === 0 && (
        <p className="empty-state">
          Добавьте и опубликуйте свою сортировку с кодом <code>sort_steps(values)</code>.
        </p>
      )}
      {phase === 'idle' || phase === 'error' ? (
        <section className="competition-setup">
          <label>
            <span>Ваша публичная сортировка</span>
            <select value={selectedAlgorithmId} onChange={(event) => setAlgorithmId(event.target.value)}>
              <option value="">Выберите алгоритм</option>
              {eligibleAlgorithms.map((algorithm) => (
                <option key={algorithm.id} value={algorithm.id}>{algorithm.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Сортировка соперника</span>
            <select value={selectedReferenceId} onChange={(event) => setReferenceId(event.target.value)}>
              <option value="">Выберите публичную сортировку</option>
              {challengeableAlgorithms.filter((algorithm) => algorithm.id !== selectedAlgorithmId).map((algorithm) => (
                <option key={algorithm.id} value={algorithm.id}>{algorithm.name}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="primary-button"
            onClick={joinCompetition}
            disabled={!selectedAlgorithm || !selectedReference || selectedAlgorithm.id === selectedReference.id}
          >
            Отправить приглашение
          </button>
        </section>
      ) : (
        <section className="competition-session">
          {statusText && <p className="competition-status" role="status">{statusText}</p>}
          {error && <p className="error-message" role="alert">{error}</p>}
          {phase === 'matched' && (
            <button type="button" className="primary-button" onClick={markReady}>
              Я готов
            </button>
          )}
          {match && (
            <>
              <p className="shared-array-label">
                Общий массив: {match.values.join(', ')}
              </p>
              <section className="competition-tracks" aria-label="Ход соревнования">
                {ownParticipant && (
                  <article className="competition-track">
                    <p className="eyebrow">Ваш алгоритм</p>
                    <h3>{ownParticipant.algorithmName}</h3>
                    <SortBars values={tracks[ownParticipantId]?.values || match.values} label="Ваша сортировка" />
                    <p className="track-meta">
                      Шагов: {tracks[ownParticipantId]?.steps || 0}
                      {tracks[ownParticipantId]?.elapsed !== null
                        && ` · ${Math.round(tracks[ownParticipantId].elapsed)} мс`}
                    </p>
                    {tracks[ownParticipantId]?.error && (
                      <p className="error-message" role="alert">{tracks[ownParticipantId].error}</p>
                    )}
                  </article>
                )}
                {opponent && (
                  <article className="competition-track">
                    <p className="eyebrow">Соперник · {opponent.username}</p>
                    <h3>{opponent.algorithmName}</h3>
                    <SortBars values={tracks[String(opponent.userId)]?.values || match.values} label="Сортировка соперника" />
                    <p className="track-meta">
                      Шагов: {tracks[String(opponent.userId)]?.steps || 0}
                      {tracks[String(opponent.userId)]?.elapsed !== null
                        && ` · ${Math.round(tracks[String(opponent.userId)].elapsed)} мс`}
                    </p>
                    {tracks[String(opponent.userId)]?.error && (
                      <p className="error-message" role="alert">{tracks[String(opponent.userId)].error}</p>
                    )}
                  </article>
                )}
              </section>
              <section className="competition-chat" aria-label="Чат соревнования">
                <h3>Чат соревнования</h3>
                <ol className="chat-messages" role="log" aria-live="polite">
                  {chatMessages.map((message, index) => (
                    <li key={`${message.sentAt}-${message.userId}-${index}`}>
                      <strong>{message.username}</strong>
                      <span>{message.text}</span>
                      <time dateTime={message.sentAt}>
                        {new Date(message.sentAt).toLocaleTimeString('ru', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </time>
                    </li>
                  ))}
                  {chatMessages.length === 0 && (
                    <li className="chat-empty">Пока сообщений нет — напишите сопернику.</li>
                  )}
                </ol>
                <form className="chat-form" onSubmit={sendChatMessage}>
                  <div className="chat-input-group">
                    <input
                      value={chatDraft}
                      onChange={(event) => setChatDraft(
                        event.target.value.slice(0, maxChatMessageLength),
                      )}
                      maxLength={maxChatMessageLength}
                      aria-label="Сообщение сопернику"
                      aria-describedby="chat-character-count"
                      placeholder="Сообщение сопернику..."
                    />
                    <span id="chat-character-count" className="chat-character-count">
                      {chatDraft.length}/{maxChatMessageLength} символов
                    </span>
                  </div>
                  <button
                    type="submit"
                    className="primary-button"
                    disabled={!chatDraft.trim() || socket?.readyState !== WebSocket.OPEN}
                  >
                    Отправить
                  </button>
                </form>
              </section>
            </>
          )}
          <button type="button" className="text-button" onClick={reset}>Выйти из соревнования</button>
        </section>
      )}
      {(phase === 'idle' || phase === 'error') && error && (
        <p className="error-message" role="alert">{error}</p>
      )}
    </main>
  )
}

export default SortCompetition
