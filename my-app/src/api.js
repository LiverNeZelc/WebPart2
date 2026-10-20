const apiUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')
const sessionKey = 'algorithm-library-session'

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function getSession() {
  const stored = localStorage.getItem(sessionKey)
  if (!stored) return null

  let session
  try {
    session = JSON.parse(stored)
  } catch {
    clearSession()
    throw new Error('Сохранённый сеанс повреждён. Войдите снова.')
  }

  if (!session?.accessToken || !session?.refreshToken || !session?.user?.id) {
    clearSession()
    throw new Error('Сохранённый сеанс недействителен. Войдите снова.')
  }

  return session
}

export function clearSession() {
  localStorage.removeItem(sessionKey)
}

function saveSession(session) {
  localStorage.setItem(sessionKey, JSON.stringify(session))
}

async function readResponse(response) {
  const text = await response.text()
  let payload = null

  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      throw new Error('Сервер вернул ответ в неожиданном формате.')
    }
  }

  if (!response.ok) {
    throw new ApiError(payload?.error || `Ошибка запроса (${response.status})`, response.status)
  }

  return payload
}

async function request(path, options = {}, authenticated = true, canRefresh = true) {
  const session = authenticated ? getSession() : null
  const headers = { ...options.headers }
  let body = options.body

  if (body !== undefined && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(body)
  }
  if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`

  let response
  try {
    response = await fetch(`${apiUrl}${path}`, { ...options, headers, body })
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Не удалось связаться с сервером. Проверьте, запущен ли API.')
    }
    throw error
  }

  if (response.status === 401 && authenticated && canRefresh && session?.refreshToken) {
    try {
      const tokens = await request(
        '/auth/refresh',
        { method: 'POST', body: { refreshToken: session.refreshToken } },
        false,
        false,
      )
      saveSession({ ...session, ...tokens })
      return request(path, options, true, false)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearSession()
        window.dispatchEvent(new Event('auth:expired'))
      }
      throw error
    }
  }

  return readResponse(response)
}

export async function authenticate(credentials, mode) {
  const session = await request(`/auth/${mode}`, {
    method: 'POST',
    body: credentials,
  }, false)
  saveSession(session)
  return session
}

export async function listAlgorithms(ownerId, search) {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  const suffix = params.size ? `?${params}` : ''
  return request(`/algorithms/${ownerId}${suffix}`)
}

export async function createAlgorithm(algorithm) {
  return request('/algorithms', { method: 'POST', body: algorithm })
}

export async function updateAlgorithm(id, algorithm) {
  return request(`/algorithms/${id}`, { method: 'PUT', body: algorithm })
}

export async function deleteAlgorithm(id) {
  return request(`/algorithms/${id}`, { method: 'DELETE' })
}
