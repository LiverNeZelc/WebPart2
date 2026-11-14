'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');
const createTreeRoutes = require('../routes/trees');

const treeId = '64b000000000000000000020';
const validTree = {
    name: 'Поиск в AVL',
    description: 'Сбалансированное дерево поиска',
    kind: 'AVL',
    items: ['8', '3', '10', '1', '6']
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
            const tree = format(data, treeId, data.owner_id);
            records.set(treeId, tree);
            return tree;
        }
    };
};

const startApp = async (t, model) => {
    const app = express();
    app.use(express.json());
    app.use('/trees', createTreeRoutes(model, (req, res, next) => {
        req.user = { userId: req.headers.authorization === 'Bearer 2' ? 2 : 1 };
        next();
    }));
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));
    return `http://127.0.0.1:${server.address().port}/trees`;
};

test('tree API stores trees and limits listing and mutation to their owner', async (t) => {
    const url = await startApp(t, createModel());
    const createdResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validTree)
    });
    assert.equal(createdResponse.status, 201);
    const created = await createdResponse.json();
    assert.equal(created.kind, 'AVL');
    assert.equal(created.items.length, 5);
    assert.equal(created.owner_id, 1);

    const ownerList = await fetch(url);
    assert.equal((await ownerList.json()).length, 1);
    const otherOwnerList = await fetch(url, { headers: { Authorization: 'Bearer 2' } });
    assert.equal((await otherOwnerList.json()).length, 0);

    const forbiddenUpdate = await fetch(`${url}/${treeId}`, {
        method: 'PUT',
        headers: { Authorization: 'Bearer 2', 'Content-Type': 'application/json' },
        body: JSON.stringify(validTree)
    });
    assert.equal(forbiddenUpdate.status, 403);
    const forbiddenDelete = await fetch(`${url}/${treeId}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer 2' }
    });
    assert.equal(forbiddenDelete.status, 403);
});

test('tree API validates structure-specific input and allows repeated range values', async (t) => {
    const url = await startApp(t, createModel());
    const invalid = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validTree, items: ['4', '4'] })
    });
    assert.equal(invalid.status, 400);

    const rangeTree = {
        ...validTree,
        kind: 'SEGMENT',
        items: ['4', '4', '-2']
    };
    const rangeResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rangeTree)
    });
    assert.equal(rangeResponse.status, 201);
    assert.deepEqual((await rangeResponse.json()).items, rangeTree.items);

    const invalidWord = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validTree, kind: 'TRIE', items: ['valid', 'invalid!'] })
    });
    assert.equal(invalidWord.status, 400);
});
