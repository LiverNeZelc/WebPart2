import { useState } from 'react'

function AuthForm({ onSubmit, error }) {
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [validationError, setValidationError] = useState('')
  const registering = mode === 'register'
  const passwordByteLength = new TextEncoder().encode(password).length

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!username.trim()) {
      setValidationError('Имя пользователя не может быть пустым или состоять из пробелов.')
      return
    }
    if (registering && username.trim().length < 3) {
      setValidationError('Имя пользователя должно содержать не менее 3 символов.')
      return
    }
    if (!password.trim()) {
      setValidationError('Пароль не может состоять только из пробелов.')
      return
    }
    if (registering && password.length < 6) {
      setValidationError('Пароль должен содержать не менее 6 символов.')
      return
    }
    if (passwordByteLength > 72) {
      setValidationError('Пароль не должен превышать 72 байта в кодировке UTF-8.')
      return
    }

    setValidationError('')
    setSubmitting(true)
    try {
      await onSubmit({ username: username.trim(), password }, mode)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="auth-panel">
      <p className="eyebrow">Личный каталог</p>
      <h2>{registering ? 'Создать аккаунт' : 'Войти в аккаунт'}</h2>
      <p className="description">Алгоритмы сохраняются на сервере и доступны после входа.</p>
      <form className="algorithm-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className="wide">
            <span>Имя пользователя {registering && '(3–32 символа)'}</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              minLength={registering ? 3 : undefined}
              maxLength={32}
              required
            />
            <span className="field-hint">{username.length}/32</span>
          </label>
          <label className="wide">
            <span>Пароль {registering ? '(6–72 байта UTF-8)' : '(до 72 байт UTF-8)'}</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={registering ? 'new-password' : 'current-password'}
              minLength={registering ? 6 : undefined}
              maxLength={72}
              required
            />
            <span className="field-hint">{passwordByteLength}/72 байт</span>
          </label>
        </div>
        {(validationError || error) && (
          <p className="error-message" role="alert">{validationError || error}</p>
        )}
        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting ? 'Подождите...' : registering ? 'Зарегистрироваться' : 'Войти'}
        </button>
      </form>
      <button
        type="button"
        className="text-button auth-toggle"
        onClick={() => {
          setMode(registering ? 'login' : 'register')
          setValidationError('')
        }}
      >
        {registering ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
      </button>
    </section>
  )
}

export default AuthForm
