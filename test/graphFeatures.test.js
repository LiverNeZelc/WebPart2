'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');
const createGraphRoutes = require('../routes/graphs');

const graphId = '64b000000000000000000010';
const validGraph = {
    name: 'Маршрут',
    description: 'Пример графа',
    directed: false,
    vertices: [
        { id: 'a', label: 'A', x: 100, y: 120 },
        { id: 'b', label: 'B', x: 250, y: 120 }
    ],
    edges: [{ source: 'a', target: 'b' }]
};

const createModel = () => {
    const records = new Map();
    const format = (data, id, ownerId) => ({
        ...data,
        owner_id: ownerId,
        _id: { toString: () => id },
        save: async function save() { records.set(id, this); },
        deleteOne: async function deleteOne() { records.delete(id); }
    });
    return {
        records,
        find(filter) {
            return {
                sort() { return this; },
                lean: async () => [...records.values()].filter((item) => item.owner_id === filter.owner_id)
            };
        },
        findById: async (id) => records.get(id) || null,
        create: async (data) => {
            const graph = format(data, graphId, data.owner_id);
            records.set(graphId, graph);
            return graph;
        }
    };
};

const startApp = async (t, model) => {
    const app = express();
    app.use(express.json());
    app.use('/graphs', createGraphRoutes(model, (req, res, next) => {
        req.user = { userId: req.headers.authorization === 'Bearer 2' ? 2 : 1 };
        next();
    }));
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));
    return `http://127.0.0.1:${server.address().port}/graphs`;
};

test('graph API persists validated graphs and scopes list and mutations to the owner', async (t) => {
    const model = createModel();
    const url = await startApp(t, model);
    const createdResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validGraph)
    });
    assert.equal(createdResponse.status, 201);
    const created = await createdResponse.json();
    assert.equal(created.vertices.length, 2);
    assert.equal(created.edges[0].target, 'b');
    assert.equal(created.owner_id, 1);

    const ownerList = await fetch(url);
    assert.equal((await ownerList.json()).length, 1);
    const otherOwnerList = await fetch(url, { headers: { Authorization: 'Bearer 2' } });
    assert.equal((await otherOwnerList.json()).length, 0);

    const forbiddenUpdate = await fetch(`${url}/${graphId}`, {
        method: 'PUT',
        headers: { Authorization: 'Bearer 2', 'Content-Type': 'application/json' },
        body: JSON.stringify(validGraph)
    });
    assert.equal(forbiddenUpdate.status, 403);
    const forbiddenDelete = await fetch(`${url}/${graphId}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer 2' }
    });
    assert.equal(forbiddenDelete.status, 403);
});

test('graph API rejects duplicate vertices and edges that point outside the graph', async (t) => {
    const url = await startApp(t, createModel());
    const duplicateLabels = {
        ...validGraph,
        vertices: [
            validGraph.vertices[0],
            { ...validGraph.vertices[1], label: 'a' }
        ]
    };
    const duplicateResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(duplicateLabels)
    });
    assert.equal(duplicateResponse.status, 400);

    const missingVertex = {
        ...validGraph,
        edges: [{ source: 'a', target: 'missing' }]
    };
    const missingResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(missingVertex)
    });
    assert.equal(missingResponse.status, 400);
});
