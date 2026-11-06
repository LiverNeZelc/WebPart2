require('dotenv').config();
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, 'atlas-credentials.env') });

const express = require('express');
const mongoose = require('mongoose');
const { Sequelize, DataTypes } = require('sequelize');
const userModel = require('./models/user');
const Algorithm = require('./models/algorithm');
const createAuth = require('./auth');
const createAlgorithmRoutes = require('./routes/algorithms');

const app = express();
const port = process.env.PORT || 3000;
const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: process.env.DB_DIALECT || 'postgres'
});
const User = userModel(sequelize, DataTypes);
const { router: authRouter, authenticate } = createAuth(User);

app.use(express.json({ limit: '256kb' }));

app.use('/auth', authRouter);
app.use('/algorithms', createAlgorithmRoutes(Algorithm, authenticate));

app.use((req, res) => {
    res.status(404).json({ error: 'Маршрут не найден' });
});

app.use((error, req, res, next) => {
    if (error instanceof SyntaxError && error.status === 400 && error.body) {
        return res.status(400).json({ error: 'Некорректный JSON' });
    }

    if (error.type === 'entity.too.large') {
        return res.status(413).json({ error: 'Размер запроса превышает допустимый предел 256 КБ' });
    }

    next(error);
});

app.use((error, req, res, next) => {
    if (error.name === 'ValidationError' || error.name === 'CastError') {
        return res.status(400).json({ error: 'Некорректные данные алгоритма' });
    }

    console.error(error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

const start = async () => {
    if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI is not configured. Set it in .env or atlas-credentials.env.');
    }

    try {
        await sequelize.authenticate();
        await mongoose.connect(process.env.MONGODB_URI);
    } catch (error) {
        await Promise.allSettled([sequelize.close(), mongoose.disconnect()]);
        throw error;
    }

    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
};

start().catch((error) => {
    console.error('Failed to start server:', error);
    process.exitCode = 1;
});
