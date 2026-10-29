require('dotenv').config();

const path = require('path');
const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const algorithmModel = require('./models/algorithm');
const userModel = require('./models/user');
const createAlgorithmRepository = require('./models/algorithmRepository');
const createAuth = require('./auth');
const createFileLogger = require('./logger');

const app = express();
const port = process.env.PORT || 3000;
const requestLogPath = path.join(__dirname, 'logs', 'requests.log');
const algorithmLimits = { name: 80, type: 40, description: 500 };
let logFileUnavailable = false;


const logger = createFileLogger(requestLogPath, {
    maxFileSize: 5 * 1024 * 1024, 
    maxBackups: 3,
    onError: (message, error) => {
        logFileUnavailable = true;
        console.error(`[logger] ${message}${error ? `: ${error.code || error.message}` : ''}`);
    },
    onReady: () => {
        logFileUnavailable = false;
    }
});

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
let nextDemoItemId = demoItems.reduce((maxId, item) => Math.max(maxId, item.id), 0) + 1;
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
        const logEntry = `${new Date().toISOString()} ${req.method} ${req.path} `
            + `${res.statusCode} - ${Date.now() - startedAt} ms\n`;

        console.log(logEntry.trimEnd());
        logger.write(logEntry);
    });

    next();
});

app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: false, limit: '16kb', parameterLimit: 20 }));
app.use(express.static('public', { index: false }));

app.use((req, res, next) => {
    if (!logFileUnavailable) {
        return next();
    }

    const message = 'Сервис временно недоступен: возникла проблема с файлом журнала. Попробуйте позже.';

    if (req.path.startsWith('/algorithms') || req.path.startsWith('/auth')) {
        return res.status(503).json({ error: message });
    }

    return res.status(503).render('log-error', { title: 'Проблема с журналом' });
});

const demoAuth = (req, res, next) => {
    if (req.query.auth !== '1') {
        return res.redirect('/login');
    }

    req.user = { name: 'Студент' };
    return next();
};

const parseId = (value) => {
    const id = Number(value);

    if (!Number.isSafeInteger(id) || id < 1) {
        return null;
    }

    return id;
};

const validateAlgorithm = (data) => {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return 'Тело запроса должно быть объектом';
    }

    const fields = [
        { key: 'name', label: 'Название', min: 2, max: algorithmLimits.name },
        { key: 'type', label: 'Тип', min: 2, max: algorithmLimits.type },
        { key: 'description', label: 'Описание', min: 5, max: algorithmLimits.description, multiline: true }
    ];

    for (const field of fields) {
        const value = data[field.key];
        const forbiddenControls = field.multiline
            ? /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/
            : /[\u0000-\u001F\u007F]/;

        if (typeof value !== 'string') {
            return `Поле «${field.label}» должно быть строкой`;
        }

        const normalized = value.trim();

        if (normalized.length < field.min) {
            return `Поле «${field.label}» не может быть пустым; длина должна быть не меньше ${field.min}`;
        }

        if (normalized.length > field.max) {
            return `Поле «${field.label}» не должно превышать ${field.max} символов`;
        }

        if (forbiddenControls.test(value)) {
            return `Поле «${field.label}» содержит недопустимые управляющие символы`;
        }
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

app.get('/test-500', (req, res, next) => {
    next(new Error('Искусственно вызванная ошибка для проверки страницы 500'));
});

app.get('/', demoAuth, (req, res) => {
    res.render('index', {
        title: 'Алгоритмы',
        items: demoItems,
        user: req.user,
        added: req.query.added === '1'
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
    res.render('add', {
        title: 'Добавить алгоритм',
        user: req.user,
        error: null,
        values: { name: '', type: '', description: '' }
    });
});

app.post('/add', demoAuth, (req, res) => {
    const validationError = validateAlgorithm(req.body);

    if (validationError) {
        return res.status(400).render('add', {
            title: 'Добавить алгоритм',
            user: req.user,
            error: validationError,
            values: {
                name: typeof req.body?.name === 'string' ? req.body.name.slice(0, 80) : '',
                type: typeof req.body?.type === 'string' ? req.body.type.slice(0, 40) : '',
                description: typeof req.body?.description === 'string'
                    ? req.body.description.slice(0, 500)
                    : ''
            }
        });
    }

    const { name, type, description } = algorithmData(req.body);
    demoItems.push({
        id: nextDemoItemId++,
        name,
        type,
        description
    });

    return res.redirect('/?auth=1&added=1');
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
        return req.path.startsWith('/algorithms') || req.path.startsWith('/auth')
            ? res.status(400).json({ error: 'Некорректный JSON' })
            : res.status(400).send('Некорректный запрос');
    }

    if (error.status === 413 || error.type === 'entity.too.large') {
        return req.path.startsWith('/algorithms') || req.path.startsWith('/auth')
            ? res.status(413).json({ error: 'Размер запроса превышает допустимый лимит' })
            : res.status(413).send('Размер запроса превышает допустимый лимит');
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

const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

// Корректное завершение: дописать очередь лога и закрыть файл
let shuttingDown = false;

const shutdown = (reason, exitCode = 0) => {
    if (shuttingDown) {
        return;
    }

    shuttingDown = true;
    logger.write(`${new Date().toISOString()} [server] завершение: ${reason}`);
    server.close();
    logger.close().finally(() => process.exit(exitCode));
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (error) => {
    console.error(error);
    logger.write(`${new Date().toISOString()} [fatal] uncaughtException: ${error.stack}`);
    shutdown('uncaughtException', 1);
});
process.on('unhandledRejection', (reason) => {
    console.error(reason);
    logger.write(`${new Date().toISOString()} [fatal] unhandledRejection: ${(reason && reason.stack) || reason}`);
    shutdown('unhandledRejection', 1);
});