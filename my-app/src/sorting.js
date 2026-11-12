const apiUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')
const validationTimeout = 45000

export function validateSortingCode(code) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./workers/pythonSort.worker.js', import.meta.url), {
      type: 'module',
    })
    const timeout = setTimeout(() => {
      worker.terminate()
      reject(new Error('Проверка кода заняла слишком много времени'))
    }, validationTimeout)
    const finish = (callback, result) => {
      clearTimeout(timeout)
      worker.terminate()
      callback(result)
    }

    worker.onmessage = (event) => {
      if (event.data.type === 'validated') {
        finish(resolve, event.data.cases)
      } else if (event.data.type === 'error') {
        finish(reject, new Error(event.data.message))
      }
    }
    worker.onerror = () => {
      finish(reject, new Error('Не удалось запустить проверку Python-кода'))
    }

    const indexURL = new URL(`${apiUrl}/pyodide/`, window.location.href).toString()
    worker.postMessage({ mode: 'validate', code, indexURL })
  })
}
