'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

test('ordered binary trees search by comparison path', async () => {
    const { createTreeTrace } = await import('../my-app/src/treeAlgorithms.js');
    const items = ['8', '3', '10', '1', '6', '14', '4', '7', '13'];

    for (const kind of ['BST', 'AVL', 'RED_BLACK']) {
        const trace = createTreeTrace(kind, items, '7');
        assert.equal(trace.steps.at(-1).found, true, `${kind} finds an inserted key`);
        assert.match(trace.steps.map((step) => step.log).join(' '), /переходим/);
        assert.equal(createTreeTrace(kind, items, '99').steps.at(-1).found, false);
    }
    assert.match(createTreeTrace('BST', items, 'not-a-number').steps[0].log, /Введите целое число/);
});

test('B-tree and B+ tree route through internal nodes to matching keys', async () => {
    const { createTreeTrace } = await import('../my-app/src/treeAlgorithms.js');
    const items = Array.from({ length: 20 }, (_, index) => String(index * 3 + 1));

    for (const kind of ['B_TREE', 'B_PLUS_TREE']) {
        const trace = createTreeTrace(kind, items, '31');
        assert.equal(trace.steps.at(-1).found, true, `${kind} finds a key in a lower level`);
        assert.equal(createTreeTrace(kind, items, '32').steps.at(-1).found, false);
    }

    const plusTrace = createTreeTrace('B_PLUS_TREE', items, '7');
    assert.ok(plusTrace.steps.some((step) => step.log.includes('Сравниваем')));
    assert.equal(plusTrace.steps.at(-1).found, true);
});

test('Trie search traces each character and rejects a missing word', async () => {
    const { createTreeTrace } = await import('../my-app/src/treeAlgorithms.js');
    const found = createTreeTrace('TRIE', ['граф', 'графы', 'гром'], 'графы');
    assert.equal(found.steps.at(-1).found, true);
    assert.equal(found.steps.at(-1).prefix, 'графы');
    assert.equal(createTreeTrace('TRIE', ['граф', 'гром'], 'груша').steps.at(-1).found, false);
});

test('segment and Fenwick trees calculate inclusive range sums', async () => {
    const { createTreeTrace } = await import('../my-app/src/treeAlgorithms.js');

    for (const kind of ['SEGMENT', 'FENWICK']) {
        const trace = createTreeTrace(kind, ['2', '-1', '5', '4', '3'], '1-3');
        assert.equal(trace.steps.at(-1).result, 8);
        assert.equal(trace.steps.at(-1).found, true);
    }
    assert.match(createTreeTrace('SEGMENT', ['1', '2'], '1-3').steps[0].log, /должен быть внутри массива/);
});

test('binary min-heap model preserves heap ordering and search visits nodes', async () => {
    const { createTreeModel, createTreeTrace } = await import('../my-app/src/treeAlgorithms.js');
    const model = createTreeModel('HEAP', ['9', '4', '7', '1', '3']);

    assert.equal(model.nodes.find((node) => node.depth === 0).label, '1');
    for (const edge of model.edges) {
        assert.ok(Number(model.nodes.find((node) => node.id === edge.source).label)
          <= Number(model.nodes.find((node) => node.id === edge.target).label));
    }
    assert.equal(createTreeTrace('HEAP', ['9', '4', '7', '1', '3'], '7').steps.at(-1).found, true);
});

test('AVL and red-black construction preserve their balancing invariants', async () => {
    const { createTreeModel } = await import('../my-app/src/treeAlgorithms.js');
    const items = Array.from({ length: 40 }, (_, index) => String(index + 1));
    const avl = createTreeModel('AVL', items);
    assert.ok(avl.nodes.every((node) => Math.abs(Number(node.detail.slice(3))) <= 1));

    const redBlack = createTreeModel('RED_BLACK', items);
    const nodes = new Map(redBlack.nodes.map((node) => [node.id, node]));
    const children = new Map(redBlack.nodes.map((node) => [node.id, []]));
    redBlack.edges.forEach((edge) => children.get(edge.source).push(edge.target));
    const root = redBlack.nodes.find((node) => !redBlack.edges.some((edge) => edge.target === node.id));
    assert.equal(root.color, 'black');

    const blackHeight = (id) => {
        if (!id) return 1;
        const node = nodes.get(id);
        const nextChildren = children.get(id);
        if (node.color === 'red') {
            assert.ok(nextChildren.every((childId) => nodes.get(childId).color === 'black'));
        }
        const leftHeight = blackHeight(nextChildren[0] || null);
        const rightHeight = blackHeight(nextChildren[1] || null);
        assert.equal(leftHeight, rightHeight);
        return leftHeight + (node.color === 'black' ? 1 : 0);
    };
    blackHeight(root.id);
});
