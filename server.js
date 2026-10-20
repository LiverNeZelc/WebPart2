require('dotenv').config();

const express = require('express');
const { Sequelize, DataTypes, Op } = require('sequelize');
const algorithmModel = require('./models/algorithm');
const userModel = require('./models/user');
const createAlgorithmRepository = require('./models/algorithmRepository');
const createAuth = require('./auth');

const app = express();
const port = process.env.PORT || 3000;
const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: process.env.DB_DIALECT || 'postgres'
});
const Algorithm = algorithmModel(sequelize, DataTypes);
const User = userModel(sequelize, DataTypes);
const {
    findByOwnerId,
    create,
    update,
    remove
} = createAlgorithmRepository(Algorithm, Op);
const { router: authRouter, authenticate } = createAuth(User);

app.use(express.json({ limit: '16kb' }));

const parseId = (value) => {
    const id = Number(value);

    if (!Number.isInteger(id) || id < 1) {
        return null;
    }

    return id;
};

const validateAlgorithm = (data) => {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return 'Тело запроса должно быть объектом';
    }

    if (typeof data.name !== 'string' || data.name.trim() === '') {
        return 'Название обязательно и не может состоять только из пробелов';
    }

    if (data.name.trim().length > 100) {
        return 'Название не должно превышать 100 символов';
    }

    if (typeof data.type !== 'string' || data.type.trim() === '') {
        return 'Тип обязателен и не может состоять только из пробелов';
    }

    if (data.type.trim().length > 50) {
        return 'Тип не должен превышать 50 символов';
    }

    if (typeof data.description !== 'string' || data.description.trim() === '') {
        return 'Описание обязательно и не может состоять только из пробелов';
    }

    if (data.description.trim().length > 1000) {
        return 'Описание не должно превышать 1000 символов';
    }

    return null;
};

const algorithmData = (data) => ({
    name: data.name.trim(),
    type: data.type.trim(),
    description: data.description.trim()
});

app.use('/auth', authRouter);

app.get('/algorithms', authenticate, async (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    if (search.length > 100) {
        return res.status(400).json({ error: 'Поисковый запрос не должен превышать 100 символов' });
    }
    res.json(await findByOwnerId(req.user.userId, search));
});

app.get('/algorithms/:ownerId', authenticate, async (req, res) => {
    const ownerId = parseId(req.params.ownerId);

    if (ownerId === null) {
        return res.status(400).json({ error: 'Некорректный ID владельца алгоритмов' });
    }

    if (ownerId !== req.user.userId) {
        return res.status(403).json({ error: 'Просматривать можно только свой каталог' });
    }

    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    if (search.length > 100) {
        return res.status(400).json({ error: 'Поисковый запрос не должен превышать 100 символов' });
    }
    res.json(await findByOwnerId(ownerId, search));
});

app.post('/algorithms', authenticate, async (req, res) => {
    const validationError = validateAlgorithm(req.body);

    if (validationError) {
        return res.status(400).json({ error: validationError });
    }

    res.status(201).json(await create({ ...algorithmData(req.body), owner_id: req.user.userId }));
});

app.put('/algorithms/:id', authenticate, async (req, res) => {
    const id = parseId(req.params.id);

    if (id === null) {
        return res.status(400).json({ error: 'Некорректный ID алгоритма' });
    }

    const validationError = validateAlgorithm(req.body);

    if (validationError) {
        return res.status(400).json({ error: validationError });
    }

    const existingAlgorithm = await Algorithm.findByPk(id);

    if (!existingAlgorithm) {
        return res.status(404).json({ error: 'Алгоритм не найден' });
    }

    if (existingAlgorithm.owner_id !== req.user.userId) {
        return res.status(403).json({ error: 'Изменять алгоритм может только его создатель' });
    }

    const algorithm = await update(id, algorithmData(req.body));

    if (!algorithm) {
        return res.status(404).json({ error: 'Алгоритм не найден' });
    }

    res.json(algorithm);
});

app.delete('/algorithms/:id', authenticate, async (req, res) => {
    const id = parseId(req.params.id);

    if (id === null) {
        return res.status(400).json({ error: 'Некорректный ID алгоритма' });
    }

    const algorithm = await Algorithm.findByPk(id);

    if (!algorithm) {
        return res.status(404).json({ error: 'Алгоритм не найден' });
    }

    if (algorithm.owner_id !== req.user.userId) {
        return res.status(403).json({ error: 'Удалять алгоритм может только его создатель' });
    }

    if (!await remove(id)) {
        return res.status(404).json({ error: 'Алгоритм не найден' });
    }

    res.status(204).send();
});

app.use((req, res) => {
    res.status(404).json({ error: 'Маршрут не найден' });
});

app.use((error, req, res, next) => {
    if (error instanceof SyntaxError && error.status === 400 && error.body) {
        return res.status(400).json({ error: 'Некорректный JSON' });
    }

    if (error.type === 'entity.too.large') {
        return res.status(413).json({ error: 'Размер запроса превышает допустимый предел 16 КБ' });
    }

    next(error);
});

app.use((error, req, res, next) => {
    console.error(error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
