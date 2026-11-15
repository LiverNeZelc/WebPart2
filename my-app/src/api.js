import axios from 'axios'

const apiUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')
const sessionKey = 'algorithm-library-session'
const apiClient = axios.create({ baseURL: apiUrl, withCredentials: true })
let currentAccessToken = null
let refreshPromise = null

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

  if (!session?.user?.id || !session?.user?.username) {
    clearSession()
    throw new Error('Сохранённый сеанс недействителен. Войдите снова.')
  }

  if (session.accessToken || session.refreshToken) {
    localStorage.setItem(sessionKey, JSON.stringify({ user: session.user }))
  }

  return { user: session.user }
}

export function clearSession() {
  currentAccessToken = null
  localStorage.removeItem(sessionKey)
}

export function getAccessToken() {
  return currentAccessToken
}

function saveSession(session) {
  currentAccessToken = session.accessToken
  localStorage.setItem(sessionKey, JSON.stringify({ user: session.user }))
}

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = request('/auth/refresh', { method: 'POST' }, false, false)
      .then(({ accessToken }) => {
        currentAccessToken = accessToken
        return accessToken
      })
      .finally(() => { refreshPromise = null })
  }
  return refreshPromise
}

export async function restoreSession() {
  const session = getSession()
  if (!session) return null
  try {
    await refreshAccessToken()
    return session
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      clearSession()
      return null
    }
    throw error
  }
}

export async function logout() {
  try {
    await request('/auth/logout', { method: 'POST' }, false, false)
  } finally {
    clearSession()
  }
}

async function request(path, options = {}, authenticated = true, canRefresh = true) {
  const headers = { ...options.headers }
  let body = options.body

  if (body !== undefined && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(body)
  }
  if (authenticated && currentAccessToken) headers.Authorization = `Bearer ${currentAccessToken}`

  let response
  try {
    response = await apiClient.request({
      ...options,
      url: path,
      headers,
      data: body,
    })
  } catch (error) {
    if (!axios.isAxiosError(error)) throw error

    const status = error.response?.status ?? 0
    if (status === 401 && authenticated && canRefresh) {
      try {
        await refreshAccessToken()
        return request(path, options, true, false)
      } catch (refreshError) {
        if (refreshError instanceof ApiError && refreshError.status === 401) {
          clearSession()
          window.dispatchEvent(new Event('auth:expired'))
        }
        throw refreshError
      }
    }

    if (status >= 500) {
      throw new ApiError(
        `Сервер API недоступен (HTTP ${status}). Проверьте, запущен ли сервер.`,
        status,
      )
    }

    if (status === 0) {
      throw new ApiError('Сервер API недоступен. Проверьте, запущен ли сервер.', 0)
    }

    throw new ApiError(error.response?.data?.error || `Ошибка запроса (${status})`, status)
  }

  return response.data
}

export async function authenticate(credentials, mode) {
  const session = await request(`/auth/${mode}`, {
    method: 'POST',
    body: credentials,
  }, false)
  saveSession(session)
  return { user: session.user }
}

export async function listAlgorithms(search) {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  const suffix = params.size ? `?${params}` : ''
  return request(`/algorithms${suffix}`)
}

export async function listPublicAlgorithms() {
  return request('/algorithms/public', {}, false)
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

export async function listGraphs() {
  return request('/graphs')
}

export async function createGraph(graph) {
  return request('/graphs', { method: 'POST', body: graph })
}

export async function updateGraph(id, graph) {
  return request(`/graphs/${id}`, { method: 'PUT', body: graph })
}

export async function deleteGraph(id) {
  return request(`/graphs/${id}`, { method: 'DELETE' })
}

export async function listTrees() {
  return request('/trees')
}

export async function createTree(tree) {
  return request('/trees', { method: 'POST', body: tree })
}

export async function updateTree(id, tree) {
  return request(`/trees/${id}`, { method: 'PUT', body: tree })
}

export async function deleteTree(id) {
  return request(`/trees/${id}`, { method: 'DELETE' })
}
