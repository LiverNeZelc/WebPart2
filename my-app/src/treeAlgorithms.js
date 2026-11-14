export const treeKinds = [
  { id: 'BST', name: 'Бинарное дерево поиска', group: 'Поиск по ключу', hint: 'Целые числа · сравнение и переход налево или направо' },
  { id: 'AVL', name: 'AVL-дерево', group: 'Самобалансировка', hint: 'Целые числа · поиск, высота и баланс-фактор' },
  { id: 'RED_BLACK', name: 'Красно-чёрное дерево', group: 'Самобалансировка', hint: 'Целые числа · поиск по сбалансированным уровням' },
  { id: 'B_TREE', name: 'B-дерево', group: 'Много ключей в узле', hint: 'Целые числа · поиск ключей внутри узлов' },
  { id: 'B_PLUS_TREE', name: 'B+‑дерево', group: 'Много ключей в узле', hint: 'Целые числа · переход по разделителям к листу' },
  { id: 'TRIE', name: 'Trie · префиксное дерево', group: 'Поиск слова', hint: 'Слова · поиск посимвольно по префиксу' },
  { id: 'SEGMENT', name: 'Дерево отрезков', group: 'Диапазонные запросы', hint: 'Массив чисел · сумма выбранного диапазона' },
  { id: 'FENWICK', name: 'Дерево Фенвика', group: 'Диапазонные запросы', hint: 'Массив чисел · префиксные суммы и диапазоны' },
  { id: 'HEAP', name: 'Двоичная min-куча', group: 'Приоритетная очередь', hint: 'Целые числа · поиск и просеивание к минимуму' },
]

export const getTreeKind = (id) => treeKinds.find((kind) => kind.id === id) || treeKinds[0]
export const usesWords = (kind) => kind === 'TRIE'
export const usesRange = (kind) => kind === 'SEGMENT' || kind === 'FENWICK'

const numericKinds = new Set(['BST', 'AVL', 'RED_BLACK', 'B_TREE', 'B_PLUS_TREE', 'SEGMENT', 'FENWICK', 'HEAP'])
const keyOf = (value, kind) => (kind === 'TRIE' ? String(value).toLocaleLowerCase('ru') : Number(value))

export function parseTreeItems(text, kind) {
  const tokens = text.split(/[\s,;]+/).map((token) => token.trim()).filter(Boolean)
  const values = tokens.map((token) => (numericKinds.has(kind) ? Number(token) : token))
  const seen = new Set()
  for (const value of values) {
    if (numericKinds.has(kind) && (!Number.isSafeInteger(value) || Math.abs(value) > 999999999)) {
      throw new Error('Используйте целые числа от -999999999 до 999999999.')
    }
    if (String(value).length > 24) throw new Error('Один элемент не может быть длиннее 24 символов.')
    if (kind === 'TRIE' && !/^[\p{L}\p{N}_-]+$/u.test(value)) throw new Error('В словах допустимы буквы, цифры, дефис и подчёркивание.')
    if (!['SEGMENT', 'FENWICK', 'HEAP'].includes(kind)) {
      const key = String(keyOf(value, kind))
      if (seen.has(key)) throw new Error(`Элемент «${value}» повторяется.`)
      seen.add(key)
    }
  }
  if (!values.length) throw new Error('Добавьте хотя бы один элемент.')
  if (values.length > (usesRange(kind) ? 32 : 40)) throw new Error(`Можно добавить не более ${usesRange(kind) ? 32 : 40} элементов.`)
  return values.map(String)
}

const binaryNode = (key, extra = {}) => ({ key, left: null, right: null, height: 1, ...extra })
const height = (node) => node?.height || 0
const updateHeight = (node) => { node.height = 1 + Math.max(height(node.left), height(node.right)) }
const rotateRight = (root) => {
  const pivot = root.left
  root.left = pivot.right
  pivot.right = root
  updateHeight(root)
  updateHeight(pivot)
  return pivot
}
const rotateLeft = (root) => {
  const pivot = root.right
  root.right = pivot.left
  pivot.left = root
  updateHeight(root)
  updateHeight(pivot)
  return pivot
}

function makeAvl(values) {
  let root = null
  const insert = (node, key) => {
    if (!node) return binaryNode(key)
    if (key < node.key) node.left = insert(node.left, key)
    else node.right = insert(node.right, key)
    updateHeight(node)
    const balance = height(node.left) - height(node.right)
    if (balance > 1 && key < node.left.key) return rotateRight(node)
    if (balance < -1 && key > node.right.key) return rotateLeft(node)
    if (balance > 1 && key > node.left.key) {
      node.left = rotateLeft(node.left)
      return rotateRight(node)
    }
    if (balance < -1 && key < node.right.key) {
      node.right = rotateRight(node.right)
      return rotateLeft(node)
    }
    return node
  }
  values.forEach((value) => { root = insert(root, Number(value)) })
  return root
}

function makeRedBlack(values) {
  const nil = { color: 'black' }
  let root = nil
  const leftRotate = (x) => {
    const y = x.right
    x.right = y.left
    if (y.left !== nil) y.left.parent = x
    y.parent = x.parent
    if (x.parent === nil) root = y
    else if (x === x.parent.left) x.parent.left = y
    else x.parent.right = y
    y.left = x
    x.parent = y
  }
  const rightRotate = (y) => {
    const x = y.left
    y.left = x.right
    if (x.right !== nil) x.right.parent = y
    x.parent = y.parent
    if (y.parent === nil) root = x
    else if (y === y.parent.right) y.parent.right = x
    else y.parent.left = x
    x.right = y
    y.parent = x
  }
  values.forEach((raw) => {
    const key = Number(raw)
    let node = { key, color: 'red', left: nil, right: nil, parent: nil }
    let parent = nil
    let cursor = root
    while (cursor !== nil) {
      parent = cursor
      cursor = key < cursor.key ? cursor.left : cursor.right
    }
    node.parent = parent
    if (parent === nil) root = node
    else if (key < parent.key) parent.left = node
    else parent.right = node
    while (node.parent.color === 'red') {
      if (node.parent === node.parent.parent.left) {
        const uncle = node.parent.parent.right
        if (uncle.color === 'red') {
          node.parent.color = 'black'
          uncle.color = 'black'
          node.parent.parent.color = 'red'
          node = node.parent.parent
        } else {
          if (node === node.parent.right) { node = node.parent; leftRotate(node) }
          node.parent.color = 'black'
          node.parent.parent.color = 'red'
          rightRotate(node.parent.parent)
        }
      } else {
        const uncle = node.parent.parent.left
        if (uncle.color === 'red') {
          node.parent.color = 'black'
          uncle.color = 'black'
          node.parent.parent.color = 'red'
          node = node.parent.parent
        } else {
          if (node === node.parent.left) { node = node.parent; rightRotate(node) }
          node.parent.color = 'black'
          node.parent.parent.color = 'red'
          leftRotate(node.parent.parent)
        }
      }
    }
    root.color = 'black'
    root.parent = nil
  })
  return root === nil ? null : root
}

function makeBTree(values) {
  const degree = 2
  let root = { keys: [], children: [], leaf: true }
  const splitChild = (parent, index) => {
    const full = parent.children[index]
    const sibling = { keys: full.keys.splice(degree), children: full.leaf ? [] : full.children.splice(degree), leaf: full.leaf }
    const median = full.keys.pop()
    parent.keys.splice(index, 0, median)
    parent.children.splice(index + 1, 0, sibling)
  }
  const insertNonFull = (node, key) => {
    let index = node.keys.length - 1
    if (node.leaf) {
      while (index >= 0 && key < node.keys[index]) index--
      node.keys.splice(index + 1, 0, key)
      return
    }
    while (index >= 0 && key < node.keys[index]) index--
    index++
    if (node.children[index].keys.length === 2 * degree - 1) {
      splitChild(node, index)
      if (key > node.keys[index]) index++
    }
    insertNonFull(node.children[index], key)
  }
  values.forEach((raw) => {
    const key = Number(raw)
    if (root.keys.length === 2 * degree - 1) {
      const newRoot = { keys: [], children: [root], leaf: false }
      splitChild(newRoot, 0)
      root = newRoot
    }
    insertNonFull(root, key)
  })
  return root
}

function makeBPlus(values) {
  const sorted = values.map(Number).sort((a, b) => a - b)
  let level = []
  for (let i = 0; i < sorted.length; i += 3) level.push({ keys: sorted.slice(i, i + 3), children: [], leaf: true })
  while (level.length > 1) {
    const next = []
    for (let i = 0; i < level.length; i += 4) {
      const children = level.slice(i, i + 4)
      next.push({ keys: children.slice(1).map((child) => child.keys[0]), children, leaf: false })
    }
    level = next
  }
  return level[0]
}

function makeTrie(values) {
  const root = { char: '⌂', children: new Map(), terminal: false }
  values.forEach((word) => {
    let node = root
    for (const char of String(word).toLocaleLowerCase('ru')) {
      if (!node.children.has(char)) node.children.set(char, { char, children: new Map(), terminal: false })
      node = node.children.get(char)
    }
    node.terminal = true
  })
  return root
}

function makeSegment(values) {
  const nums = values.map(Number)
  const build = (left, right) => {
    if (left === right) return { left, right, sum: nums[left], children: [] }
    const middle = Math.floor((left + right) / 2)
    const children = [build(left, middle), build(middle + 1, right)]
    return { left, right, sum: children[0].sum + children[1].sum, children }
  }
  return build(0, nums.length - 1)
}

function makeFenwick(values) {
  const nums = values.map(Number)
  const nodes = nums.map((_, index) => ({ index: index + 1, sum: 0, children: [] }))
  const tree = Array(nums.length + 1).fill(0)
  nums.forEach((value, index) => {
    let cursor = index + 1
    while (cursor < tree.length) { tree[cursor] += value; cursor += cursor & -cursor }
  })
  nodes.forEach((node) => {
    node.sum = tree[node.index]
    const parent = node.index + (node.index & -node.index)
    if (parent <= nodes.length) nodes[parent - 1].children.push(node)
  })
  return { nodes }
}

const makeHeap = (values) => {
  const heap = []
  values.map(Number).forEach((value) => {
    heap.push(value)
    let index = heap.length - 1
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2)
      if (heap[parent] <= heap[index]) break
      ;[heap[parent], heap[index]] = [heap[index], heap[parent]]
      index = parent
    }
  })
  return heap
}

function flattenTree(kind, root) {
  const nodes = []
  const edges = []
  const positions = new Map()
  let inorderIndex = 0
  if (['BST', 'AVL', 'RED_BLACK'].includes(kind)) {
    const assign = (node, depth = 0) => {
      if (!node) return
      assign(node.left, depth + 1)
      positions.set(String(node.key), { xIndex: inorderIndex++, depth })
      assign(node.right, depth + 1)
    }
    assign(root)
    const walk = (node) => {
      if (!node) return
      const id = String(node.key)
      const pos = positions.get(id)
      const balance = height(node.left) - height(node.right)
      nodes.push({ id, label: id, detail: kind === 'AVL' ? `bf ${balance}` : '', color: node.color, balance, ...pos })
      if (node.left) edges.push({ source: id, target: String(node.left.key) })
      if (node.right) edges.push({ source: id, target: String(node.right.key) })
      walk(node.left)
      walk(node.right)
    }
    walk(root)
    const maxDepth = Math.max(0, ...nodes.map((node) => node.depth))
    nodes.forEach((node) => { node.x = 45 + node.xIndex * (910 / Math.max(1, nodes.length - 1)); node.y = 42 + node.depth * Math.min(92, 420 / Math.max(1, maxDepth)) })
  } else if (kind === 'B_TREE' || kind === 'B_PLUS_TREE') {
    const levels = []
    const walk = (node, depth = 0, parent = null) => {
      levels[depth] ||= []
      const id = `n${nodes.length}`
      const label = node.leaf ? node.keys.join(' · ') : `${node.keys.join(' · ')}`
      nodes.push({ id, label, detail: node.leaf && kind === 'B_PLUS_TREE' ? 'лист' : '', depth, xIndex: levels[depth].length })
      levels[depth].push(id)
      if (parent) edges.push({ source: parent, target: id })
      node.children.forEach((child) => walk(child, depth + 1, id))
    }
    walk(root)
    nodes.forEach((node) => { node.x = 45 + node.xIndex * (910 / Math.max(1, (levels[node.depth]?.length || 1) - 1)); node.y = 48 + node.depth * 100 })
  } else if (kind === 'TRIE') {
    const levels = []
    const walk = (node, depth = 0, parent = null) => {
      levels[depth] ||= []
      const id = `t${nodes.length}`
      nodes.push({ id, label: node.char, detail: node.terminal ? 'слово' : '', depth, xIndex: levels[depth].length, terminal: node.terminal })
      levels[depth].push(id)
      if (parent) edges.push({ source: parent, target: id })
      for (const child of node.children.values()) walk(child, depth + 1, id)
    }
    walk(root)
    nodes.forEach((node) => { node.x = 45 + node.xIndex * (910 / Math.max(1, (levels[node.depth]?.length || 1) - 1)); node.y = 42 + node.depth * 72 })
  } else if (kind === 'SEGMENT') {
    const walk = (node, depth = 0, parent = null) => {
      const id = `s${nodes.length}`
      nodes.push({ id, label: String(node.sum), detail: `[${node.left}..${node.right}]`, depth, xIndex: node.left + (node.right - node.left) / 2, interval: [node.left, node.right] })
      if (parent) edges.push({ source: parent, target: id })
      node.children.forEach((child) => walk(child, depth + 1, id))
    }
    walk(root)
    nodes.forEach((node) => { node.x = 45 + node.xIndex * (910 / Math.max(1, (nodes.reduce((max, item) => Math.max(max, item.interval?.[1] || 0), 0)))); node.y = 42 + node.depth * 86 })
  } else if (kind === 'FENWICK') {
    root.nodes.forEach((node) => {
      const id = String(node.index)
      nodes.push({ id, label: `i=${node.index}`, detail: `Σ ${node.sum}`, depth: Math.floor(Math.log2(node.index)), xIndex: nodes.length, fenwickIndex: node.index })
      node.children.forEach((child) => edges.push({ source: id, target: String(child.index) }))
    })
    nodes.forEach((node, index) => { node.x = 45 + index * (910 / Math.max(1, nodes.length - 1)); node.y = 45 + node.depth * 75 })
  } else if (kind === 'HEAP') {
    root.forEach((value, index) => {
      const id = String(index)
      const depth = Math.floor(Math.log2(index + 1))
      nodes.push({ id, label: String(value), detail: `#${index + 1}`, depth, xIndex: index })
      if (index > 0) edges.push({ source: String(Math.floor((index - 1) / 2)), target: id })
    })
    const levels = new Map()
    nodes.forEach((node) => { levels.set(node.depth, (levels.get(node.depth) || 0) + 1) })
    const seenAtDepth = new Map()
    nodes.forEach((node) => {
      const row = seenAtDepth.get(node.depth) || 0
      seenAtDepth.set(node.depth, row + 1)
      const total = levels.get(node.depth)
      node.x = 45 + (row + 1) * (910 / (total + 1))
      node.y = 42 + node.depth * 92
    })
  }
  return { nodes, edges }
}

export function createTreeModel(kind, items) {
  const values = items.map(String)
  if (!values.length) return { nodes: [], edges: [] }
  let root
  if (kind === 'BST') {
    root = null
    values.forEach((raw) => {
      const key = Number(raw)
      if (!root) { root = binaryNode(key); return }
      let node = root
      while (true) {
        const side = key < node.key ? 'left' : 'right'
        if (!node[side]) { node[side] = binaryNode(key); break }
        node = node[side]
      }
    })
  } else if (kind === 'AVL') root = makeAvl(values)
  else if (kind === 'RED_BLACK') root = makeRedBlack(values)
  else if (kind === 'B_TREE') root = makeBTree(values)
  else if (kind === 'B_PLUS_TREE') root = makeBPlus(values)
  else if (kind === 'TRIE') root = makeTrie(values)
  else if (kind === 'SEGMENT') root = makeSegment(values)
  else if (kind === 'FENWICK') root = makeFenwick(values)
  else root = makeHeap(values)
  return flattenTree(kind, root)
}

export function createTreeTrace(kind, items, query) {
  const model = createTreeModel(kind, items)
  const nodeById = new Map(model.nodes.map((node) => [node.id, node]))
  const steps = []
  const push = (id, log, found = false, extra = {}) => steps.push({
    current: id,
    visited: [...new Set(steps.map((step) => step.current).filter(Boolean)), ...(id ? [id] : [])],
    log,
    found,
    ...extra,
  })
  const target = usesWords(kind) ? String(query).toLocaleLowerCase('ru') : Number(query)
  if (!usesWords(kind) && !usesRange(kind)
    && (!Number.isSafeInteger(target) || Math.abs(target) > 999999999)) {
    return {
      model,
      steps: [{ current: '', visited: [], log: 'Введите целое число от -999999999 до 999999999.' }],
    }
  }

  if (['BST', 'AVL', 'RED_BLACK'].includes(kind)) {
    let id = model.nodes.find((node) => node.depth === 0)?.id
    while (id) {
      const node = nodeById.get(id)
      const value = Number(node.label)
      const found = value === target
      push(id, found ? `Ключ ${target} найден.` : `${target} ${target < value ? '<' : '>'} ${value} → ${target < value ? 'переходим налево' : 'переходим направо'}.`, found, { comparison: `${target} ${target < value ? '<' : target > value ? '>' : '='} ${value}` })
      if (found) break
      const candidate = model.edges.filter((item) => item.source === id).map((item) => item.target)
      id = candidate.find((childId) => target < value ? Number(childId) < value : Number(childId) > value) || ''
    }
    if (!steps.length || !steps[steps.length - 1].found) push('', `Ключ ${query} не найден.`)
  } else if (kind === 'B_TREE' || kind === 'B_PLUS_TREE') {
    let current = model.nodes.find((node) => node.depth === 0)
    while (current) {
      const keys = current.label.split(' · ').map(Number)
      let next = null
      let found = false
      for (const key of keys) {
        found = key === target
        const foundInNode = found && (kind !== 'B_PLUS_TREE' || current.detail === 'лист')
        push(current.id, foundInNode ? `В узле ${current.label} найден ключ ${target}.` : `Сравниваем ${target} с ключом ${key}.`, foundInNode, { checkedKey: key })
        if (foundInNode) break
        if (kind === 'B_PLUS_TREE' && current.detail === 'лист' && found) {
          steps[steps.length - 1] = { ...steps[steps.length - 1], found: true, log: `В листе найден ключ ${target}.` }
          break
        }
        if (key > target) break
      }
      if (steps.at(-1)?.found) break
      next = model.edges.filter((edge) => edge.source === current.id).map((edge) => nodeById.get(edge.target))
        .find((child, index, children) => {
          const separator = keys[index]
          return target < separator || index === children.length - 1
        })
      if (!next) break
      current = next
    }
    if (!steps.some((step) => step.found)) push('', `Ключ ${query} не найден.`)
  } else if (kind === 'TRIE') {
    let id = model.nodes.find((node) => node.label === '⌂')?.id
    for (const char of target) {
      const child = model.edges.filter((edge) => edge.source === id).map((edge) => nodeById.get(edge.target)).find((node) => node.label === char)
      if (!child) { push(id, `Символ «${char}» отсутствует: префикс не найден.`); id = ''; break }
      id = child.id
      push(id, `Переходим по символу «${char}».`, false, { prefix: [...(steps.at(-1)?.prefix || []), char].join('') })
    }
    if (id && steps.length) {
      const found = Boolean(nodeById.get(id)?.detail)
      steps[steps.length - 1] = { ...steps[steps.length - 1], found, log: found ? `Слово «${query}» найдено.` : `Префикс «${query}» есть, но такого слова нет.` }
    } else if (!steps.length) push('', 'Введите слово для поиска.')
  } else if (usesRange(kind)) {
    const match = String(query).match(/^\s*(\d+)\s*[-–:]\s*(\d+)\s*$/)
    if (!match) return { model, steps: [{ current: '', visited: [], log: 'Введите диапазон в формате 0-3.' }] }
    const left = Number(match[1])
    const right = Number(match[2])
    const values = items.map(Number)
    if (left > right || right >= values.length) return { model, steps: [{ current: '', visited: [], log: `Диапазон должен быть внутри массива: 0-${values.length - 1}.` }] }
    if (kind === 'SEGMENT') {
      const visit = (node) => {
        const id = model.nodes.find((item) => item.detail === `[${node.left}..${node.right}]` && Number(item.label) === node.sum)?.id
        const covered = left <= node.left && node.right <= right
        const overlap = node.left <= right && left <= node.right
        push(id, covered ? `Отрезок [${node.left}..${node.right}] целиком внутри запроса: добавляем сумму ${node.sum}.` : overlap ? `Отрезок [${node.left}..${node.right}] пересекает запрос — проверяем детей.` : `Отрезок [${node.left}..${node.right}] вне запроса — пропускаем.`, false, { included: covered })
        if (overlap) node.children.forEach(visit)
      }
      const segRoot = makeSegment(items)
      visit(segRoot)
      const sum = values.slice(left, right + 1).reduce((total, value) => total + value, 0)
      push('', `Сумма на диапазоне [${left}..${right}] = ${sum}.`, true, { result: sum })
    } else {
      const prefix = (end) => {
        let sum = 0
        for (let index = end; index > 0; index -= index & -index) {
          sum += values.slice(index - (index & -index), index).reduce((total, value) => total + value, 0)
          push(String(index), `Префикс: читаем tree[${index}] = ${model.nodes[index - 1]?.detail.replace('Σ ', '') || 0}; следующий индекс ${index - (index & -index)}.`)
        }
        return sum
      }
      const sum = prefix(right + 1) - prefix(left)
      push('', `Сумма на диапазоне [${left}..${right}] = ${sum}.`, true, { result: sum })
    }
  } else {
    model.nodes.forEach((node, index) => {
      const found = Number(node.label) === target
      push(node.id, found ? `Значение ${target} найдено в позиции ${index + 1} кучи.` : `Проверяем позицию ${index + 1}: ${node.label}.`, found, { index })
      if (found) return
    })
    const foundIndex = steps.findIndex((step) => step.found)
    if (foundIndex >= 0) steps.splice(foundIndex + 1)
    else push('', `Значение ${query} не найдено в куче.`)
  }
  return { model, steps }
}
