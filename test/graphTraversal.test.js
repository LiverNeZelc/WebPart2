'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

test('BFS visits vertices level by level and records the waiting queue', async () => {
    const { createTraversal } = await import('../my-app/src/graphTraversal.js');
    const graph = {
        directed: false,
        vertices: ['A', 'B', 'C', 'D'].map((label) => ({ id: label, label })),
        edges: [
            { source: 'A', target: 'B' },
            { source: 'A', target: 'C' },
            { source: 'B', target: 'D' },
            { source: 'C', target: 'D' }
        ]
    };
    const steps = createTraversal(graph, 'BFS', 'A');

    assert.deepEqual(steps.at(-1).order, ['A', 'B', 'C', 'D']);
    assert.deepEqual(steps[1].frontier, ['B', 'C']);
    assert.deepEqual(steps.at(-1).levels, { A: 0, B: 1, C: 1, D: 2 });
    assert.match(steps.at(-1).log, /Обход завершён/);
});

test('DFS uses a LIFO stack and directed edges are followed only forward', async () => {
    const { createTraversal } = await import('../my-app/src/graphTraversal.js');
    const graph = {
        directed: true,
        vertices: ['A', 'B', 'C', 'D'].map((label) => ({ id: label, label })),
        edges: [
            { source: 'A', target: 'B' },
            { source: 'A', target: 'C' },
            { source: 'B', target: 'D' }
        ]
    };
    const steps = createTraversal(graph, 'DFS', 'A');

    assert.deepEqual(steps.at(-1).order, ['A', 'B', 'D', 'C']);
    assert.deepEqual(steps[1].frontier, ['C', 'B']);
    assert.deepEqual(createTraversal(graph, 'BFS', 'D').at(-1).order, ['D']);
});
