'use strict';

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

module.exports = (User) => {
    const router = express.Router();
    const jwtSecret = process.env.JWT_SECRET || 'development-secret';
    const accessTokenExpiresIn = process.env.ACCESS_TOKEN_EXPIRES_IN || '15m';
    const refreshTokenExpiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

    const createTokens = (userId) => ({
        accessToken: jwt.sign({ userId }, jwtSecret, { expiresIn: accessTokenExpiresIn }),
        refreshToken: jwt.sign({ userId, type: 'refresh' }, jwtSecret, {
            expiresIn: refreshTokenExpiresIn
        })
    });

    const publicUser = (user) => ({ id: user.id, username: user.username });

    const authenticate = (req, res, next) => {
        const header = req.get('Authorization');
        const token = header && header.startsWith('Bearer ') ? header.slice(7) : null;

        if (!token) {
            return res.status(401).json({ error: 'Требуется токен авторизации' });
        }

        try {
            req.user = jwt.verify(token, jwtSecret);
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
        await user.update({ refreshToken: tokens.refreshToken });

        return res.status(201).json({ user: publicUser(user), ...tokens });
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
        await user.update({ refreshToken: tokens.refreshToken });
        return res.json({ user: publicUser(user), ...tokens });
    });

    router.post('/refresh', async (req, res) => {
        const { refreshToken } = req.body || {};

        if (typeof refreshToken !== 'string') {
            return res.status(400).json({ error: 'Поле refreshToken обязательно' });
        }

        let payload;

        try {
            payload = jwt.verify(refreshToken, jwtSecret);
        } catch (error) {
            return res.status(401).json({ error: 'Недействительный или истёкший refresh-токен' });
        }

        if (payload.type !== 'refresh') {
            return res.status(401).json({ error: 'Недействительный refresh-токен' });
        }

        const user = await User.findOne({ where: { id: payload.userId, refreshToken } });

        if (!user) {
            return res.status(401).json({ error: 'Недействительный refresh-токен' });
        }

        const tokens = createTokens(user.id);
        await user.update({ refreshToken: tokens.refreshToken });
        return res.json(tokens);
    });

    router.get('/me', authenticate, async (req, res) => {
        const user = await User.findByPk(req.user.userId);

        if (!user) {
            return res.status(401).json({ error: 'Пользователь не найден' });
        }

        return res.json(publicUser(user));
    });

    return { router, authenticate };
};
