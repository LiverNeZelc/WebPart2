'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');
const { createUserActionLogger } = require('../services/userActionLog');

test('authenticated API actions are logged without recording request bodies', async (t) => {
    const records = [];
    const UserActionLog = {
        create: async (record) => { records.push(record); }
    };
    const app = express();
    app.use(express.json());
    app.use('/graphs', (req, res, next) => {
        req.user = { userId: 7 };
        next();
    }, createUserActionLogger(UserActionLog, 'graph'), (req, res) => {
        res.status(201).json({ ok: true });
    });
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));

    const response = await fetch(`http://127.0.0.1:${server.address().port}/graphs`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'audit-test'
        },
        body: JSON.stringify({ name: 'Private graph name', secret: 'must not be logged' })
    });
    assert.equal(response.status, 201);
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(records.length, 1);
    assert.equal(records[0].user_id, 7);
    assert.equal(records[0].action, 'graph.create');
    assert.equal(records[0].resource_type, 'graph');
    assert.equal(records[0].status_code, 201);
    assert.equal(records[0].success, true);
    assert.deepEqual(records[0].details, {});
    assert.equal('secret' in records[0], false);
    assert.equal('user_agent' in records[0], false);
});
