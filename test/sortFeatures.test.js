'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const express = require('express');
const { WebSocket } = require('ws');
const createAlgorithmRoutes = require('../routes/algorithms');
const createSortCompetition = require('../services/sortCompetition');

const publicId = '64b000000000000000000001';
const firstAlgorithmId = '64b000000000000000000002';
const secondAlgorithmId = '64b000000000000000000003';
const source = 'def sort_steps(values):\n    yield values.copy()';

const makeAlgorithm = (id, ownerId, overrides = {}) => ({
    _id: { toString: () => id },
    name: `Algorithm ${id.slice(-1)}`,
    type: 'Сортировка',
    description: 'Sorting algorithm',
    python_code: source,
    is_public: false,
    owner_id: ownerId,
    criteria: [],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides
});

const records = [
    makeAlgorithm(publicId, 3, { is_public: true }),
    makeAlgorithm(firstAlgorithmId, 1, { is_public: true }),
    makeAlgorithm(secondAlgorithmId, 2, { is_public: true })
];

const matchesFilter = (algorithm, filter) => {
    if (filter.type && algorithm.type !== filter.type) return false;
    if (filter.is_public !== undefined && algorithm.is_public !== filter.is_public) return false;
    if (filter.owner_id?.$in
        && !filter.owner_id.$in.includes(algorithm.owner_id ?? null)) return false;
    if (filter.python_code?.$ne !== undefined
        && algorithm.python_code === filter.python_code.$ne) return false;
    if (filter._id && algorithm._id.toString() !== String(filter._id)) return false;
    return true;
};

const makeAlgorithmModel = () => ({
    find(filter) {
        return {
            sort() { return this; },
            lean: async () => records.filter((algorithm) => matchesFilter(algorithm, filter))
        };
    },
    findOne(filter) {
        return { lean: async () => records.find((algorithm) => matchesFilter(algorithm, filter)) || null };
    },
    findById(id) {
        return { lean: async () => records.find((algorithm) => algorithm._id.toString() === id) || null };
    }
});

const nextMessage = (client, type) => new Promise((resolve, reject) => {
    const queuedIndex = client.messages.findIndex((message) => message.type === type);
    if (queuedIndex !== -1) {
        resolve(client.messages.splice(queuedIndex, 1)[0]);
        return;
    }
    const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${type}`)), 3000);
    client.waiters.push({
        type,
        resolve: (message) => {
            clearTimeout(timeout);
            resolve(message);
        }
    });
});

const createClient = async (url) => {
    const client = new WebSocket(url);
    client.messages = [];
    client.waiters = [];
    client.on('message', (rawMessage) => {
        const message = JSON.parse(rawMessage.toString());
        const waiterIndex = client.waiters.findIndex((waiter) => waiter.type === message.type);
        if (waiterIndex === -1) {
            client.messages.push(message);
            return;
        }
        client.waiters.splice(waiterIndex, 1)[0].resolve(message);
    });
    await new Promise((resolve, reject) => {
        client.once('open', resolve);
        client.once('error', reject);
    });
    return client;
};

test('public sorting endpoint exposes only published sorting code', async (t) => {
    let authenticationCalls = 0;
    const app = express();
    app.use(express.json());
    app.use('/algorithms', createAlgorithmRoutes(makeAlgorithmModel(), (req, res, next) => {
        authenticationCalls += 1;
        req.user = { userId: 1 };
        next();
    }));
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const url = `http://127.0.0.1:${server.address().port}/algorithms`;

    const publicResponse = await fetch(`${url}/public`);
    assert.equal(publicResponse.status, 200);
    const publicAlgorithms = await publicResponse.json();
    assert.equal(publicAlgorithms.length, 3);
    assert.equal(publicAlgorithms.find((item) => item.id === publicId).python_code, source);
    assert.equal(authenticationCalls, 0);

    const ownerResponse = await fetch(url);
    const ownerAlgorithms = await ownerResponse.json();
    assert.equal(ownerAlgorithms.find((item) => item.id === firstAlgorithmId).python_code, source);
    assert.equal(ownerAlgorithms.some((item) => item.id === secondAlgorithmId), false);
    assert.equal(authenticationCalls, 1);

    const invalidPublicResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: 'No code',
            type: 'Сортировка',
            description: 'Should not be published',
            is_public: true,
            python_code: ''
        })
    });
    assert.equal(invalidPublicResponse.status, 400);
});

test('WebSocket notifies the algorithm owner and starts the competition when accepted', async (t) => {
    const server = http.createServer();
    const users = new Map([
        [1, { id: 1, username: 'first' }],
        [2, { id: 2, username: 'second' }]
    ]);
    const User = { findByPk: async (id) => users.get(id) || null };
    const verifyToken = (token) => ({ userId: Number(token.split('-')[1]) });
    const websocketServer = createSortCompetition(server, makeAlgorithmModel(), User, verifyToken);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const clients = [];
    t.after(async () => {
        clients.forEach((client) => client.terminate());
        await new Promise((resolve) => websocketServer.close(resolve));
        await new Promise((resolve) => server.close(resolve));
    });
    const url = `ws://127.0.0.1:${server.address().port}/ws/sort`;
    const first = await createClient(url);
    const second = await createClient(url);
    clients.push(first, second);

    first.send(JSON.stringify({ type: 'authenticate', token: 'user-1' }));
    second.send(JSON.stringify({ type: 'authenticate', token: 'user-2' }));
    await Promise.all([nextMessage(first, 'authenticated'), nextMessage(second, 'authenticated')]);
    first.send(JSON.stringify({
        type: 'join',
        algorithmId: firstAlgorithmId,
        referenceAlgorithmId: secondAlgorithmId
    }));
    assert.equal((await nextMessage(first, 'waiting')).type, 'waiting');
    const invitation = await nextMessage(second, 'challenge');
    assert.equal(invitation.challengerName, 'first');
    assert.equal(invitation.algorithmId, firstAlgorithmId);
    assert.equal(invitation.targetAlgorithmId, secondAlgorithmId);
    assert.equal(JSON.stringify(invitation).includes(source), false);
    assert.equal(first.messages.some((message) => message.type === 'matched'), false);
    first.send(JSON.stringify({
        type: 'accept-challenge',
        challengeId: invitation.challengeId
    }));
    assert.equal((await nextMessage(first, 'error')).type, 'error');
    assert.equal(first.messages.some((message) => message.type === 'matched'), false);
    second.send(JSON.stringify({
        type: 'accept-challenge',
        challengeId: invitation.challengeId
    }));
    const [firstMatch, secondMatch] = await Promise.all([
        nextMessage(first, 'matched'),
        nextMessage(second, 'matched')
    ]);
    assert.deepEqual(firstMatch.values, secondMatch.values);
    assert.equal(firstMatch.participants.find((participant) => participant.userId === 1).algorithmId, firstAlgorithmId);
    assert.equal(firstMatch.participants.find((participant) => participant.userId === 2).algorithmId, secondAlgorithmId);
    assert.equal(JSON.stringify(firstMatch).includes(source), false);

    first.send(JSON.stringify({ type: 'chat', text: '  Привет!  ' }));
    const [firstChat, secondChat] = await Promise.all([
        nextMessage(first, 'chat'),
        nextMessage(second, 'chat')
    ]);
    assert.equal(firstChat.text, 'Привет!');
    assert.equal(firstChat.userId, 1);
    assert.equal(firstChat.username, 'first');
    assert.equal(secondChat.sentAt, firstChat.sentAt);

    second.send(JSON.stringify({ type: 'chat', text: 'x'.repeat(501) }));
    assert.equal((await nextMessage(second, 'error')).type, 'error');

    first.send(JSON.stringify({ type: 'ready' }));
    assert.equal((await nextMessage(first, 'ready-count')).count, 1);
    assert.equal(first.messages.some((message) => message.type === 'start'), false);

    second.send(JSON.stringify({ type: 'ready' }));
    await Promise.all([
        nextMessage(first, 'ready-count'),
        nextMessage(second, 'ready-count')
    ]);
    const [firstStart, secondStart] = await Promise.all([
        nextMessage(first, 'start'),
        nextMessage(second, 'start')
    ]);
    assert.deepEqual(firstStart.values, secondStart.values);

    const progress = Array.from({ length: 32 }, (_, index) => 10 + index);
    first.send(JSON.stringify({ type: 'progress', values: progress }));
    assert.deepEqual((await nextMessage(second, 'progress')).values, progress);
    first.send(JSON.stringify({ type: 'complete', elapsed: 12.5 }));
    assert.equal((await nextMessage(second, 'complete')).elapsed, 12.5);
});
