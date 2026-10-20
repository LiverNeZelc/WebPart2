import { useState } from 'react'

const emptyForm = { name: '', type: 'Поиск', description: '' }
const maxNameLength = 100
const maxDescriptionLength = 1000

function AlgorithmForm({ algorithm, onSubmit, onCancel, saving }) {
  const [values, setValues] = useState(() => algorithm
    ? { name: algorithm.name, type: algorithm.type, description: algorithm.description }
    : emptyForm)
  const [errors, setErrors] = useState({})

  const handleChange = (event) => {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: '' }))
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
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    const saved = await onSubmit({
      name: values.name.trim(),
      type: values.type,
      description: values.description.trim(),
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
          <button type="button" className="text-button" onClick={onCancel} disabled={saving}>
            Отменить
          </button>
        )}
      </div>
      <div className="form-grid">
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
      </div>
      <button className="primary-button" type="submit" disabled={saving}>
        {saving ? 'Сохраняем...' : algorithm ? 'Сохранить изменения' : 'Добавить в каталог'}
      </button>
    </form>
  )
}

export default AlgorithmForm
