require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const algorithmModel = require('./models/algorithm');
const userModel = require('./models/user');
const createAlgorithmRepository = require('./models/algorithmRepository');
const createAuth = require('./auth');

const app = express();
const port = process.env.PORT || 3000;
const logsDirectory = path.join(__dirname, 'logs');
const requestLogPath = path.join(logsDirectory, 'requests.log');

fs.mkdirSync(logsDirectory, { recursive: true });
const demoItems = [
    {
        id: 1,
        name: 'Быстрая сортировка',
        type: 'Сортировка',
        description: 'Рекурсивный алгоритм сортировки массива методом разбиения.'
    },
    {
        id: 2,
        name: 'Бинарный поиск',
        type: 'Поиск',
        description: 'Поиск элемента в отсортированном массиве за логарифмическое время.'
    }
];
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

app.set('view engine', 'ejs');
app.set('views', './views');

app.use((req, res, next) => {
    const startedAt = Date.now();

    res.on('finish', () => {
        const logEntry = `${new Date().toISOString()} ${req.method} ${req.originalUrl} `
            + `${res.statusCode} - ${Date.now() - startedAt} ms\n`;

        fs.appendFile(requestLogPath, logEntry, (error) => {
            if (error) {
                console.error('Не удалось записать лог запроса:', error);
            }
        });
    });

    next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public', { index: false }));

const demoAuth = (req, res, next) => {
    if (req.query.auth !== '1') {
        return res.redirect('/login');
    }

    req.user = { name: 'Студент' };
    return next();
};

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

app.get('/login', (req, res) => {
    res.render('login', { title: 'Авторизация' });
});

app.get('/', demoAuth, (req, res) => {
    res.render('index', {
        title: 'Алгоритмы',
        items: demoItems,
        user: req.user
    });
});

app.get('/item/:id', demoAuth, (req, res, next) => {
    const item = demoItems.find((currentItem) => currentItem.id === Number(req.params.id));

    if (!item) {
        return next();
    }

    return res.render('item', { title: item.name, item, user: req.user });
});

app.get('/add', demoAuth, (req, res) => {
    res.render('add', { title: 'Добавить алгоритм', user: req.user });
});

app.post('/add', demoAuth, (req, res, next) => {
    const { name, type, description } = req.body;

    if ([name, type, description].some((value) => typeof value !== 'string' || value.trim() === '')) {
        return next(new Error('Все поля формы обязательны'));
    }

    demoItems.push({
        id: demoItems.length ? Math.max(...demoItems.map((item) => item.id)) + 1 : 1,
        name: name.trim(),
        type: type.trim(),
        description: description.trim()
    });

    return res.redirect('/?auth=1');
});

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
    if (!req.path.startsWith('/algorithms') && !req.path.startsWith('/auth')) {
        return res.status(404).render('404', { title: 'Страница не найдена' });
    }

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

    if (!req.path.startsWith('/algorithms') && !req.path.startsWith('/auth')) {
        return res.status(500).render('500', {
            title: 'Ошибка сервера',
            error: process.env.NODE_ENV === 'production' ? null : error
        });
    }

    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
