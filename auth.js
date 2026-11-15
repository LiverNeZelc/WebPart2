'use strict';

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { createHash, createHmac, randomUUID } = require('node:crypto');

module.exports = (User) => {
    const router = express.Router();
    const jwtSecret = process.env.JWT_SECRET;
    if (typeof jwtSecret !== 'string' || Buffer.byteLength(jwtSecret, 'utf8') < 32) {
        throw new Error('JWT_SECRET must be configured with at least 32 bytes of cryptographically random data.');
    }
    const issuer = 'webpart2';
    const audience = 'webpart2-client';
    const cookieName = 'refreshToken';
    const refreshCookiePath = process.env.REFRESH_COOKIE_PATH || '/api/auth';
    if (!/^\/[A-Za-z0-9/_-]*$/.test(refreshCookiePath)) {
        throw new Error('REFRESH_COOKIE_PATH must be a valid absolute URL path.');
    }
    const accessTokenSecret = createHmac('sha256', jwtSecret).update('webpart2:access:v1').digest();
    const refreshTokenSecret = createHmac('sha256', jwtSecret).update('webpart2:refresh:v1').digest();
    const tokenOptions = {
        algorithm: 'HS256',
        issuer,
        audience
    };
    const verifyOptions = {
        algorithms: ['HS256'],
        issuer,
        audience
    };
    const secureCookie = process.env.NODE_ENV === 'production' ? '; Secure' : '';

    router.use((req, res, next) => {
        res.set('Cache-Control', 'no-store');
        next();
    });

    const hashToken = (token) => createHash('sha256').update(token).digest('hex');
    const getRefreshToken = (req) => {
        const cookie = (req.get('Cookie') || '').split(';')
            .map((part) => part.trim())
            .find((part) => part.startsWith(`${cookieName}=`));
        if (!cookie) return null;
        try {
            return decodeURIComponent(cookie.slice(cookieName.length + 1));
        } catch {
            return null;
        }
    };
    const setRefreshCookie = (res, token) => {
        const payload = jwt.decode(token);
        const maxAge = Math.max(0, payload.exp - Math.floor(Date.now() / 1000));
        res.append('Set-Cookie', `${cookieName}=${encodeURIComponent(token)}; Path=${refreshCookiePath}; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secureCookie}`);
    };
    const clearRefreshCookie = (res) => {
        res.append('Set-Cookie', `${cookieName}=; Path=${refreshCookiePath}; HttpOnly; SameSite=Strict; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secureCookie}`);
    };

    const verifyAccessToken = (token) => {
        const payload = jwt.verify(token, accessTokenSecret, verifyOptions);
        const userId = Number(payload.sub);
        if (payload.type !== 'access' || !Number.isSafeInteger(userId) || userId < 1 || !payload.jti) {
            throw new Error('Недействительный access-токен');
        }
        return { userId };
    };

    const createTokens = (userId) => {
        const subject = String(userId);
        return {
            accessToken: jwt.sign({ type: 'access' }, accessTokenSecret, {
                ...tokenOptions,
                subject,
                jwtid: randomUUID(),
                expiresIn: '15m'
            }),
            refreshToken: jwt.sign({ type: 'refresh' }, refreshTokenSecret, {
                ...tokenOptions,
                subject,
                jwtid: randomUUID(),
                expiresIn: '7d'
            })
        };
    };

    const publicUser = (user) => ({ id: user.id, username: user.username });

    const authenticate = (req, res, next) => {
        const header = req.get('Authorization');
        const token = header && header.startsWith('Bearer ') ? header.slice(7) : null;

        if (!token) {
            return res.status(401).json({ error: 'Требуется токен авторизации' });
        }

        try {
            req.user = verifyAccessToken(token);
            return next();
        } catch (error) {
            return res.status(401).json({ error: 'Недействительный или истёкший токен' });
        }
    };

    router.post('/register', async (req, res) => {
        const { username, password } = req.body || {};

        if (typeof username !== 'string' || username.trim() === ''
            || username.trim().length < 3 || username.trim().length > 32
            || typeof password !== 'string' || password.trim() === ''
            || password.length < 6 || Buffer.byteLength(password, 'utf8') > 72) {
            return res.status(400).json({
                error: 'Имя пользователя должно содержать 3–32 символа, пароль — минимум 6 символов и не более 72 байт'
            });
        }

        const existingUser = await User.findOne({ where: { username: username.trim() } });

        if (existingUser) {
            return res.status(409).json({ error: 'Пользователь уже существует' });
        }

        const user = await User.create({
            username: username.trim(),
            password: await bcrypt.hash(password, 10)
        });
        const tokens = createTokens(user.id);
        await user.update({ refreshToken: hashToken(tokens.refreshToken) });
        setRefreshCookie(res, tokens.refreshToken);
        return res.status(201).json({ user: publicUser(user), accessToken: tokens.accessToken });
    });

    router.post('/login', async (req, res) => {
        const { username, password } = req.body || {};
        if (typeof username !== 'string' || username.trim() === '' || username.trim().length > 32
            || typeof password !== 'string' || password.trim() === ''
            || Buffer.byteLength(password, 'utf8') > 72) {
            return res.status(400).json({ error: 'Укажите корректные имя пользователя и пароль' });
        }

        const user = typeof username === 'string'
            ? await User.findOne({ where: { username: username.trim() } })
            : null;

        if (!user || typeof password !== 'string' || !await bcrypt.compare(password, user.password)) {
            return res.status(401).json({ error: 'Неверное имя пользователя или пароль' });
        }

        const tokens = createTokens(user.id);
        await user.update({ refreshToken: hashToken(tokens.refreshToken) });
        setRefreshCookie(res, tokens.refreshToken);
        return res.json({ user: publicUser(user), accessToken: tokens.accessToken });
    });

    router.post('/refresh', async (req, res) => {
        const refreshToken = getRefreshToken(req);

        if (!refreshToken) {
            return res.status(401).json({ error: 'Требуется refresh-cookie' });
        }

        let payload;

        try {
            payload = jwt.verify(refreshToken, refreshTokenSecret, verifyOptions);
        } catch (error) {
            clearRefreshCookie(res);
            return res.status(401).json({ error: 'Недействительный или истёкший refresh-токен' });
        }

        const userId = Number(payload.sub);
        if (payload.type !== 'refresh' || !Number.isSafeInteger(userId) || userId < 1 || !payload.jti) {
            clearRefreshCookie(res);
            return res.status(401).json({ error: 'Недействительный refresh-токен' });
        }

        const oldTokenHash = hashToken(refreshToken);
        const user = await User.findOne({ where: { id: userId, refreshToken: oldTokenHash } });

        if (!user) {
            clearRefreshCookie(res);
            return res.status(401).json({ error: 'Недействительный refresh-токен' });
        }

        const tokens = createTokens(user.id);
        const [updatedCount] = await User.update(
            { refreshToken: hashToken(tokens.refreshToken) },
            { where: { id: user.id, refreshToken: oldTokenHash } }
        );
        if (updatedCount !== 1) {
            clearRefreshCookie(res);
            return res.status(401).json({ error: 'Refresh-токен уже использован' });
        }
        setRefreshCookie(res, tokens.refreshToken);
        return res.json({ accessToken: tokens.accessToken });
    });

    router.post('/logout', async (req, res) => {
        const refreshToken = getRefreshToken(req);
        clearRefreshCookie(res);
        if (refreshToken) {
            let payload;
            try {
                payload = jwt.verify(refreshToken, refreshTokenSecret, verifyOptions);
            } catch {
                return res.status(204).send();
            }
            const userId = Number(payload.sub);
            if (payload.type === 'refresh' && Number.isSafeInteger(userId) && userId > 0 && payload.jti) {
                await User.update(
                    { refreshToken: null },
                    { where: { id: userId, refreshToken: hashToken(refreshToken) } }
                );
            }
        }
        return res.status(204).send();
    });

    router.get('/me', authenticate, async (req, res) => {
        const user = await User.findByPk(req.user.userId);

        if (!user) {
            return res.status(401).json({ error: 'Пользователь не найден' });
        }

        return res.json(publicUser(user));
    });

    return { router, authenticate, verifyAccessToken };
};
