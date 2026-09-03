require('dotenv').config();

const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
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
    findAll,
    findByOwnerId,
    create,
    update,
    remove
} = createAlgorithmRepository(Algorithm);
const { router: authRouter, authenticate } = createAuth(User);

app.use(express.json());

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
        return 'Поле name обязательно и должно быть непустой строкой';
    }

    if (typeof data.type !== 'string' || data.type.trim() === '') {
        return 'Поле type обязательно и должно быть непустой строкой';
    }

    if (typeof data.description !== 'string' || data.description.trim() === '') {
        return 'Поле description обязательно и должно быть непустой строкой';
    }

    return null;
};

const algorithmData = (data) => ({
    name: data.name.trim(),
    type: data.type.trim(),
    description: data.description.trim()
});

app.use('/auth', authRouter);

app.get('/algorithms', async (req, res) => {
    res.json(await findAll());
});

app.get('/algorithms/:ownerId', authenticate, async (req, res) => {
    const ownerId = parseId(req.params.ownerId);

    if (ownerId === null) {
        return res.status(400).json({ error: 'Некорректный ID владельца алгоритмов' });
    }

    res.json(await findByOwnerId(ownerId));
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

    next(error);
});

app.use((error, req, res, next) => {
    console.error(error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
