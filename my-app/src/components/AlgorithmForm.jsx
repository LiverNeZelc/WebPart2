import { useState } from 'react'
import { validateSortingCode } from '../sorting.js'

const emptyForm = {
  name: '',
  type: 'Поиск',
  description: '',
  criteria: [],
  python_code: '',
  is_public: false,
}
const maxNameLength = 100
const maxDescriptionLength = 1000
const maxPythonCodeLength = 12000
const maxCriteria = 50
const maxCriterionNameLength = 100
const maxCriterionDescriptionLength = 2000

function AlgorithmForm({ algorithm, onSubmit, onCancel, saving }) {
  const [values, setValues] = useState(() => algorithm
    ? {
      name: algorithm.name,
      type: algorithm.type,
      description: algorithm.description,
      python_code: algorithm.python_code || '',
      is_public: Boolean(algorithm.is_public),
      criteria: (algorithm.criteria || []).map((criterion) => ({
        name: criterion.name,
        description: criterion.description || '',
      })),
    }
    : emptyForm)
  const [errors, setErrors] = useState({})
  const [validatingCode, setValidatingCode] = useState(false)

  const handleChange = (event) => {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: '' }))
  }

  const updateCriterion = (index, field, value) => {
    setValues((current) => ({
      ...current,
      criteria: current.criteria.map((criterion, criterionIndex) => (
        criterionIndex === index ? { ...criterion, [field]: value } : criterion
      )),
    }))
    setErrors((current) => ({ ...current, [`criterion-${index}-${field}`]: '' }))
  }

  const addCriterion = () => {
    setValues((current) => ({
      ...current,
      criteria: [...current.criteria, { name: '', description: '' }],
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const nextErrors = {}
    if (!values.name.trim()) nextErrors.name = 'Введите название, содержащее не только пробелы.'
    if (!values.description.trim()) nextErrors.description = 'Введите непустое описание.'
    if (values.name.trim().length > maxNameLength) {
      nextErrors.name = `Название должно быть не длиннее ${maxNameLength} символов.`
    }
    if (values.description.trim().length > maxDescriptionLength) {
      nextErrors.description = `Описание должно быть не длиннее ${maxDescriptionLength} символов.`
    }
    if (values.python_code.length > maxPythonCodeLength) {
      nextErrors.python_code = `Код должен быть не длиннее ${maxPythonCodeLength} символов.`
    }
    if (values.is_public && !values.python_code.trim()) {
      nextErrors.python_code = 'Для публикации добавьте код Python.'
    }
    values.criteria.forEach((criterion, index) => {
      if (!criterion.name.trim()) {
        nextErrors[`criterion-${index}-name`] = 'Введите название критерия.'
      } else if (criterion.name.trim().length > maxCriterionNameLength) {
        nextErrors[`criterion-${index}-name`] = `Название критерия должно быть не длиннее ${maxCriterionNameLength} символов.`
      }
      if (criterion.description.trim().length > maxCriterionDescriptionLength) {
        nextErrors[`criterion-${index}-description`] = `Описание критерия должно быть не длиннее ${maxCriterionDescriptionLength} символов.`
      }
    })
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    if (values.type === 'Сортировка' && values.python_code.trim()) {
      setValidatingCode(true)
      try {
        await validateSortingCode(values.python_code)
      } catch (error) {
        setErrors({ ...nextErrors, python_code: error.message })
        setValidatingCode(false)
        return
      }
      setValidatingCode(false)
    }

    const saved = await onSubmit({
      name: values.name.trim(),
      type: values.type,
      description: values.description.trim(),
      python_code: values.type === 'Сортировка' ? values.python_code : '',
      is_public: values.type === 'Сортировка' && values.is_public,
      criteria: values.criteria.map((criterion) => ({
        name: criterion.name.trim(),
        description: criterion.description.trim(),
      })),
    })
    if (saved !== false && !algorithm) {
      setValues(emptyForm)
      setErrors({})
    }
  }

  return (
    <form className="algorithm-form" onSubmit={handleSubmit}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Управление каталогом</p>
          <h2>{algorithm ? 'Редактировать алгоритм' : 'Добавить алгоритм'}</h2>
        </div>
        {algorithm && (
          <button type="button" className="text-button" onClick={onCancel} disabled={saving || validatingCode}>
            Отменить
          </button>
        )}
      </div>
      {validatingCode && (
        <p className="validation-status" role="status">
          Компилируем код и проверяем сортировку на тестовых массивах...
        </p>
      )}
      <fieldset className="form-grid algorithm-fields" disabled={saving || validatingCode}>
        <label>
          <span>Название</span>
          <input
            name="name"
            value={values.name}
            onChange={handleChange}
            placeholder="Например, Быстрая сортировка"
            maxLength={maxNameLength}
            aria-invalid={Boolean(errors.name)}
            aria-describedby="algorithm-name-hint algorithm-name-error"
            required
          />
          <span id="algorithm-name-hint" className="field-hint">{values.name.length}/{maxNameLength}</span>
          {errors.name && <span id="algorithm-name-error" className="field-error" role="alert">{errors.name}</span>}
        </label>
        <label>
          <span>Тип</span>
          <select name="type" value={values.type} onChange={handleChange}>
            <option>Поиск</option>
            <option>Сортировка</option>
            <option>Графы</option>
            <option>Другое</option>
          </select>
        </label>
        {values.type === 'Сортировка' && (
          <>
            <label className="wide">
              <span>Код сортировки на Python (необязательно)</span>
              <textarea
                name="python_code"
                value={values.python_code}
                onChange={handleChange}
                placeholder={'def sort_steps(values):\n    for i in range(len(values) - 1):\n        for j in range(len(values) - i - 1):\n            if values[j] > values[j + 1]:\n                values[j], values[j + 1] = values[j + 1], values[j]\n                yield values.copy()\n    yield values.copy()'}
                maxLength={maxPythonCodeLength}
                rows="8"
                spellCheck="false"
                aria-invalid={Boolean(errors.python_code)}
                aria-describedby="algorithm-code-hint algorithm-code-error"
              />
              <span id="algorithm-code-hint" className="field-hint">
                Перед сохранением код будет проверен на синтаксис и сортировку нескольких массивов. Генератор <code>sort_steps(values)</code> должен выдавать снимки через <code>yield</code>. {values.python_code.length}/{maxPythonCodeLength}
              </span>
              {errors.python_code && (
                <span id="algorithm-code-error" className="field-error" role="alert">
                  {errors.python_code}
                </span>
              )}
            </label>
            <label className="visibility-toggle wide">
              <input
                type="checkbox"
                checked={values.is_public}
                onChange={(event) => {
                  setValues((current) => ({ ...current, is_public: event.target.checked }))
                  setErrors((current) => ({ ...current, python_code: '' }))
                }}
              />
              <span>Опубликовать алгоритм и его код во вкладке «Сортировки»</span>
            </label>
          </>
        )}
        <label className="wide">
          <span>Описание</span>
          <textarea
            name="description"
            value={values.description}
            onChange={handleChange}
            placeholder="Кратко опишите задачу и принцип работы алгоритма"
            maxLength={maxDescriptionLength}
            aria-invalid={Boolean(errors.description)}
            aria-describedby="algorithm-description-hint algorithm-description-error"
            rows="3"
            required
          />
          <span id="algorithm-description-hint" className="field-hint">
            {values.description.length}/{maxDescriptionLength}
          </span>
          {errors.description && (
            <span id="algorithm-description-error" className="field-error" role="alert">
              {errors.description}
            </span>
          )}
        </label>
        <fieldset className="criteria-fieldset wide">
          <legend>Критерии алгоритма</legend>
          <p className="field-hint">
            Можно добавить до {maxCriteria} критериев с собственными описаниями.
          </p>
          {values.criteria.map((criterion, index) => (
            <div className="criterion-card" key={index}>
              <div className="criterion-heading">
                <strong>Критерий {index + 1}</strong>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setValues((current) => ({
                    ...current,
                    criteria: current.criteria.filter((_, criterionIndex) => criterionIndex !== index),
                  }))}
                  disabled={saving}
                  aria-label={`Удалить критерий ${index + 1}`}
                >
                  Удалить
                </button>
              </div>
              <label>
                <span>Название критерия</span>
                <input
                  value={criterion.name}
                  onChange={(event) => updateCriterion(index, 'name', event.target.value)}
                  maxLength={maxCriterionNameLength}
                  aria-invalid={Boolean(errors[`criterion-${index}-name`])}
                  required
                />
                <span className="field-hint">
                  {criterion.name.length}/{maxCriterionNameLength}
                </span>
                {errors[`criterion-${index}-name`] && (
                  <span className="field-error" role="alert">{errors[`criterion-${index}-name`]}</span>
                )}
              </label>
              <label>
                <span>Описание критерия</span>
                <textarea
                  value={criterion.description}
                  onChange={(event) => updateCriterion(index, 'description', event.target.value)}
                  maxLength={maxCriterionDescriptionLength}
                  rows="2"
                />
                <span className="field-hint">
                  {criterion.description.length}/{maxCriterionDescriptionLength}
                </span>
                {errors[`criterion-${index}-description`] && (
                  <span className="field-error" role="alert">
                    {errors[`criterion-${index}-description`]}
                  </span>
                )}
              </label>
            </div>
          ))}
          <button
            type="button"
            className="text-button add-criterion-button"
            onClick={addCriterion}
            disabled={saving || values.criteria.length >= maxCriteria}
          >
            {values.criteria.length >= maxCriteria ? 'Достигнут лимит критериев' : 'Добавить критерий'}
          </button>
        </fieldset>
      </fieldset>
      <button className="primary-button" type="submit" disabled={saving || validatingCode}>
        {validatingCode
          ? 'Проверяем сортировку...'
          : saving ? 'Сохраняем...' : algorithm ? 'Сохранить изменения' : 'Добавить в каталог'}
      </button>
    </form>
  )
}

export default AlgorithmForm
