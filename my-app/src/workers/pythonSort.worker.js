import { loadPyodide } from 'pyodide'

const delay = (duration) => new Promise((resolve) => setTimeout(resolve, duration))

const validateSnapshot = (snapshot, originalValues) => {
  if (!Array.isArray(snapshot) || snapshot.length !== originalValues.length
    || !snapshot.every((value) => Number.isInteger(value) && value >= 10 && value < 100)) {
    throw new Error('Каждый yield должен выдавать массив целых чисел той же длины')
  }

  const expectedCounts = new Map()
  const actualCounts = new Map()
  originalValues.forEach((value) => expectedCounts.set(value, (expectedCounts.get(value) || 0) + 1))
  snapshot.forEach((value) => actualCounts.set(value, (actualCounts.get(value) || 0) + 1))
  if (actualCounts.size !== expectedCounts.size
    || [...expectedCounts].some(([value, amount]) => actualCounts.get(value) !== amount)) {
    throw new Error('Шаг сортировки должен сохранять все исходные элементы')
  }
}

self.onmessage = async (event) => {
  const { code, values, indexURL, mode } = event.data
  const validationCases = [
    [31, 12, 88, 12],
    [98, 10, 54, 23, 76],
    [10, 10, 99, 10],
  ]
  const cases = mode === 'validate' ? validationCases : [values]
  let iterator
  let inputProxy

  try {
    const pyodide = await loadPyodide({ indexURL })
    pyodide.globals.set('user_source', code)
    await pyodide.runPythonAsync(`
import ast
import builtins

tree = ast.parse(user_source)
for node in ast.walk(tree):
    if isinstance(node, (ast.Import, ast.ImportFrom)):
        raise ValueError("Импорты в алгоритме не поддерживаются")
    if isinstance(node, ast.Attribute) and node.attr.startswith("_"):
        raise ValueError("Обращение к служебным атрибутам запрещено")
    if isinstance(node, ast.Name) and node.id.startswith("_"):
        raise ValueError("Служебные имена в алгоритме запрещены")
    if isinstance(node, ast.Constant) and isinstance(node.value, str) and "__" in node.value:
        raise ValueError("Строки со служебными именами запрещены")

safe_names = (
    "range", "len", "enumerate", "zip", "min", "max", "abs", "all", "any",
    "sum", "sorted", "reversed", "iter", "next", "list", "tuple", "set", "dict",
    "int", "float", "bool", "str", "ValueError", "TypeError", "Exception"
)
safe_builtins = {name: getattr(builtins, name) for name in safe_names}
namespace = {"__builtins__": safe_builtins}
exec(user_source, namespace, namespace)
sort_function = namespace.get("sort_steps")
if not callable(sort_function):
    raise ValueError("Добавьте функцию sort_steps(values)")
`)

    for (const originalValues of cases) {
      inputProxy = pyodide.toPy(originalValues)
      pyodide.globals.set('input_values', inputProxy)
      const startedAt = performance.now()
      await pyodide.runPythonAsync('step_iterator = iter(sort_function(list(input_values)))')
      iterator = pyodide.globals.get('step_iterator')
      let lastValues = null
      let count = 0
      let elapsed = performance.now() - startedAt

      while (count < 1000) {
        const stepStartedAt = performance.now()
        const step = await pyodide.runPythonAsync('next(step_iterator, None)')
        elapsed += performance.now() - stepStartedAt
        if (step === null || step === undefined) break

        const snapshot = step.toJs()
        step.destroy()
        validateSnapshot(snapshot, originalValues)
        lastValues = snapshot
        count += 1

        if (mode !== 'validate') {
          self.postMessage({ type: 'step', values: snapshot })
          await delay(35)
        }
      }

      if (count === 1000) {
        throw new Error('Превышен лимит шагов (1000)')
      }
      const sortedValues = lastValues || originalValues
      const expected = [...originalValues].sort((first, second) => first - second)
      if (sortedValues.some((value, index) => value !== expected[index])) {
        throw new Error('Алгоритм завершился без сортировки массива')
      }

      iterator.destroy()
      iterator = null
      inputProxy.destroy()
      inputProxy = null

      if (mode !== 'validate') {
        self.postMessage({ type: 'done', values: sortedValues, elapsed })
      }
    }

    if (mode === 'validate') {
      self.postMessage({ type: 'validated', cases: cases.length })
    }
  } catch (error) {
    self.postMessage({ type: 'error', message: error.message || 'Ошибка выполнения Python-кода' })
  } finally {
    if (iterator) iterator.destroy()
    if (inputProxy) inputProxy.destroy()
  }
}
