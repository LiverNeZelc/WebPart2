'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');
const { createHash } = require('node:crypto');
const jwt = require('jsonwebtoken');
const createAuth = require('../auth');

test('authentication refuses missing or weak JWT signing secrets', () => {
    const originalSecret = process.env.JWT_SECRET;
    try {
        delete process.env.JWT_SECRET;
        assert.throws(() => createAuth({}), /JWT_SECRET must be configured/);

        process.env.JWT_SECRET = 'short-secret';
        assert.throws(() => createAuth({}), /at least 32 bytes/);

        process.env.JWT_SECRET = 'secure-test-secret-with-at-least-32-bytes';
        assert.doesNotThrow(() => createAuth({}));
    } finally {
        if (originalSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = originalSecret;
    }
});

const createUserModel = () => {
    const records = [];
    return {
        records,
        findOne: async ({ where }) => records.find((user) => (
            Object.entries(where).every(([key, value]) => user[key] === value)
        )) || null,
        findByPk: async (id) => records.find((user) => user.id === id) || null,
        create: async (data) => {
            const user = {
                ...data,
                id: records.length + 1,
                refreshToken: null,
                update: async function update(values) { Object.assign(this, values); }
            };
            records.push(user);
            return user;
        },
        update: async (values, { where }) => {
            const user = records.find((record) => (
                Object.entries(where).every(([key, value]) => record[key] === value)
            ));
            if (!user) return [0];
            Object.assign(user, values);
            return [1];
        }
    };
};

test('JWT sessions use typed HS256 tokens, HttpOnly rotating refresh cookies and revocation', async (t) => {
    const originalSecret = process.env.JWT_SECRET;
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.JWT_SECRET = 'test-secret-with-more-than-thirty-two-random-looking-bytes';
    process.env.NODE_ENV = 'production';
    t.after(() => {
        if (originalSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = originalSecret;
        if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = originalNodeEnv;
    });

    const users = createUserModel();
    const actionRecords = [];
    const UserActionLog = {
        create: async (record) => { actionRecords.push(record); }
    };
    const { router, verifyAccessToken } = createAuth(users, UserActionLog);
    const app = express();
    app.use(express.json());
    app.use('/auth', router);
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const baseUrl = `http://127.0.0.1:${server.address().port}/auth`;

    const registerResponse = await fetch(`${baseUrl}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'test-user', password: 'strong-password' })
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(registerResponse.status, 201);
    const registerBody = await registerResponse.json();
    assert.equal('refreshToken' in registerBody, false);
    assert.equal(users.records[0].refreshToken.length, 64);
    assert.notEqual(users.records[0].refreshToken, registerBody.accessToken);

    const initialCookie = registerResponse.headers.get('set-cookie');
    assert.match(initialCookie, /HttpOnly/);
    assert.match(initialCookie, /Secure/);
    assert.match(initialCookie, /SameSite=Strict/);
    assert.match(initialCookie, /Path=\/api\/auth/);
    const firstRefreshCookie = initialCookie.split(';')[0];
    const decodedAccess = jwt.decode(registerBody.accessToken, { complete: true });
    assert.equal(decodedAccess.header.alg, 'HS256');
    assert.equal(decodedAccess.payload.type, 'access');
    assert.equal(decodedAccess.payload.iss, 'webpart2');
    assert.equal(decodedAccess.payload.aud, 'webpart2-client');
    assert.ok(decodedAccess.payload.exp - decodedAccess.payload.iat <= 15 * 60);
    assert.deepEqual(verifyAccessToken(registerBody.accessToken), { userId: 1 });

    const refreshResponse = await fetch(`${baseUrl}/refresh`, {
        method: 'POST',
        headers: { Cookie: firstRefreshCookie }
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(refreshResponse.status, 200);
    const refreshBody = await refreshResponse.json();
    assert.equal('refreshToken' in refreshBody, false);
    const rotatedCookie = refreshResponse.headers.get('set-cookie').split(';')[0];
    assert.notEqual(rotatedCookie, firstRefreshCookie);
    assert.equal(users.records[0].refreshToken, createHash('sha256')
        .update(decodeURIComponent(rotatedCookie.slice('refreshToken='.length)))
        .digest('hex'));

    const replayResponse = await fetch(`${baseUrl}/refresh`, {
        method: 'POST',
        headers: { Cookie: firstRefreshCookie }
    });
    assert.equal(replayResponse.status, 401);

    const logoutResponse = await fetch(`${baseUrl}/logout`, {
        method: 'POST',
        headers: { Cookie: rotatedCookie }
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(logoutResponse.status, 204);
    assert.equal(users.records[0].refreshToken, null);
    assert.match(logoutResponse.headers.get('set-cookie'), /Max-Age=0/);

    const revokedResponse = await fetch(`${baseUrl}/refresh`, {
        method: 'POST',
        headers: { Cookie: rotatedCookie }
    });
    assert.equal(revokedResponse.status, 401);
    assert.ok(actionRecords.some((record) => (
        record.action === 'auth.register' && record.user_id === 1
    )));
    assert.ok(actionRecords.some((record) => (
        record.action === 'auth.refresh' && record.user_id === 1
    )));
    assert.ok(actionRecords.some((record) => (
        record.action === 'auth.logout' && record.user_id === 1
    )));
});
