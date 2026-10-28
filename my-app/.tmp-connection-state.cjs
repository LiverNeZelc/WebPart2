const fs = require('fs')
const read = (path) => fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n')

const apiPath = 'src/api.js'
let api = read(apiPath)
const parseCatch = `    } catch {\n      throw new Error('Сервер вернул ответ в неожиданном формате.')\n    }`
const parseCatchReplacement = `    } catch {\n      if (!response.ok && [502, 503, 504].includes(response.status)) {\n        throw new ApiError(\n          \`Сервер API недоступен (HTTP \${response.status}). Проверьте, запущен ли сервер.\`,\n          response.status,\n        )\n      }\n      if (!response.ok) {\n        throw new ApiError(\`Ошибка запроса (\${response.status})\`, response.status)\n      }\n      throw new Error('Сервер вернул ответ в неожиданном формате.')\n    }`
if (!api.includes(parseCatch)) throw new Error('Could not locate response parse error block')
api = api.replace(parseCatch, parseCatchReplacement)
api = api.replace("throw new Error('Не удалось связаться с сервером. Проверьте, запущен ли API.')", "throw new ApiError('Сервер API недоступен. Проверьте, запущен ли сервер.', 0)")
fs.writeFileSync(apiPath, api)

const appPath = 'src/App.jsx'
let app = read(appPath)
const stateAnchor = "  const [saving, setSaving] = useState(false)"
if (!app.includes(stateAnchor)) throw new Error('Could not locate saving state')
app = app.replace(stateAnchor, `${stateAnchor}\n  const [connectionState, setConnectionState] = useState('idle')`)
app = app.replace("  const handleSave = async (values) => {\n    setSaving(true)\n    setNotice('')", "  const handleSave = async (values) => {\n    setSaving(true)\n    setConnectionState('checking')\n    setNotice('')")
app = app.replace("        setNotice('Изменения сохранены')\n        setNoticeIsError(false)", "        setNotice('Изменения сохранены')\n        setNoticeIsError(false)\n        setConnectionState('connected')")
app = app.replace("        setNotice(error.message)\n        setNoticeIsError(true)\n        return false", "        const unavailable = error.status === 0 || [502, 503, 504].includes(error.status)\n        setNotice(unavailable\n          ? 'Сервер недоступен. Изменения отменены, исходные данные восстановлены.'\n          : error.message)\n        setNoticeIsError(true)\n        setConnectionState(unavailable ? 'unavailable' : 'error')\n        return false", 1)
app = app.replace("      setNotice('Алгоритм добавлен')\n      setNoticeIsError(false)", "      setNotice('Алгоритм добавлен')\n      setNoticeIsError(false)\n      setConnectionState('connected')")
app = app.replace("      setNotice(error.message)\n      setNoticeIsError(true)\n      return false", "      const unavailable = error.status === 0 || [502, 503, 504].includes(error.status)\n      setNotice(unavailable\n        ? 'Сервер недоступен. Добавление отменено.'\n        : error.message)\n      setNoticeIsError(true)\n      setConnectionState(unavailable ? 'unavailable' : 'error')\n      return false", 1)
app = app.replace("    } finally {\n      setSaving(false)\n      setReloadCount((count) => count + 1)\n    }\n  }\n\n  const handleDelete", "    } finally {\n      setSaving(false)\n    }\n  }\n\n  const handleDelete")
app = app.replace("  const handleDelete = async (algorithm) => {\n    const index", "  const handleDelete = async (algorithm) => {\n    setSaving(true)\n    setConnectionState('checking')\n    const index")
app = app.replace("      setNotice('Алгоритм удалён')\n      setNoticeIsError(false)", "      setNotice('Алгоритм удалён')\n      setNoticeIsError(false)\n      setConnectionState('connected')")
app = app.replace("      setNotice(error.message)\n      setNoticeIsError(true)\n    }\n  }\n\n  const handleAuthExpired", "      const unavailable = error.status === 0 || [502, 503, 504].includes(error.status)\n      setNotice(unavailable\n        ? 'Сервер недоступен. Удаление отменено, карточка восстановлена.'\n        : error.message)\n      setNoticeIsError(true)\n      setConnectionState(unavailable ? 'unavailable' : 'error')\n    } finally {\n      setSaving(false)\n    }\n  }\n\n  const handleAuthExpired")
const headerAnchor = `        {session && (\n          <div className="account-actions">`
const headerReplacement = `        {session && connectionState !== 'idle' && (\n          <span\n            className={\`connection-status connection-\${connectionState}\`}\n            role={connectionState === 'unavailable' || connectionState === 'error' ? 'alert' : 'status'}\n          >\n            {connectionState === 'checking' && 'Отправляем запрос серверу...'}\n            {connectionState === 'connected' && 'Сервер ответил'}\n            {connectionState === 'unavailable' && 'Сервер недоступен'}\n            {connectionState === 'error' && 'Ошибка ответа сервера'}\n          </span>\n        )}\n        {session && (\n          <div className="account-actions">`
if (!app.includes(headerAnchor)) throw new Error('Could not locate header account actions')
app = app.replace(headerAnchor, headerReplacement)
fs.writeFileSync(appPath, app)

const cssPath = 'src/App.css'
let css = read(cssPath)
css = css.replace(/\.notice \{[^}]*\}/, '.notice { position: fixed; right: 24px; bottom: 24px; z-index: 20; width: min(440px, calc(100vw - 32px)); padding: 14px 18px; border: 1px solid #b8d1bd; border-left: 4px solid #5d8b69; border-radius: 6px; color: #315746; background: #f5fff4; box-shadow: 0 10px 32px rgba(32, 48, 46, .2); font-size: 14px; }')
css = css.replace('.notice-error { border-left-color: #a35446; color: #a35446; background: #fff8f5; }', '.notice-error { border-color: #e2b9ae; border-left-color: #a35446; color: #8d4035; background: #fff8f5; }\n.connection-status { margin-left: auto; padding: 7px 10px; border-radius: 99px; font: 700 11px Arial, sans-serif; }\n.connection-checking { color: #745a1c; background: #fff2cc; }\n.connection-connected { color: #315746; background: #e2efe0; }\n.connection-unavailable, .connection-error { color: #8d4035; background: #fbe4df; }\n@media (max-width: 560px) { .connection-status { margin-left: auto; text-align: right; } .notice { right: 16px; bottom: 16px; } }')
fs.writeFileSync(cssPath, css)
