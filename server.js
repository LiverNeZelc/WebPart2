const express = require('express');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

let algorithms = [
    {
        id: 1,
        name: 'BFS',
        type: 'graph',
        description: 'Обход графа в ширину'
    },
    {
        id: 2,
        name: 'Quick Sort',
        type: 'sorting',
        description: 'Быстрая сортировка массива'
    }
];

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

app.get('/algorithms', (req, res) => {
    res.json(algorithms);
});

app.get('/algorithms/:id', (req, res) => {
    const id = parseId(req.params.id);

    if (id === null) {
        return res.status(400).json({ error: 'Некорректный ID алгоритма' });
    }

    const algorithm = algorithms.find((item) => item.id === id);

    if (!algorithm) {
        return res.status(404).json({ error: 'Алгоритм не найден' });
    }

    res.json(algorithm);
});

app.post('/algorithms', (req, res) => {
    const validationError = validateAlgorithm(req.body);

    if (validationError) {
        return res.status(400).json({ error: validationError });
    }

    const algorithm = {
        id: algorithms.length ? Math.max(...algorithms.map((item) => item.id)) + 1 : 1,
        name: req.body.name.trim(),
        type: req.body.type.trim(),
        description: req.body.description.trim()
    };

    algorithms.push(algorithm);
    res.status(201).json(algorithm);
});

app.put('/algorithms/:id', (req, res) => {
    const id = parseId(req.params.id);

    if (id === null) {
        return res.status(400).json({ error: 'Некорректный ID алгоритма' });
    }

    const validationError = validateAlgorithm(req.body);

    if (validationError) {
        return res.status(400).json({ error: validationError });
    }

    const algorithmIndex = algorithms.findIndex((item) => item.id === id);

    if (algorithmIndex === -1) {
        return res.status(404).json({ error: 'Алгоритм не найден' });
    }

    algorithms[algorithmIndex] = {
        id,
        name: req.body.name.trim(),
        type: req.body.type.trim(),
        description: req.body.description.trim()
    };

    res.json(algorithms[algorithmIndex]);
});

app.delete('/algorithms/:id', (req, res) => {
    const id = parseId(req.params.id);

    if (id === null) {
        return res.status(400).json({ error: 'Некорректный ID алгоритма' });
    }

    const algorithmIndex = algorithms.findIndex((item) => item.id === id);

    if (algorithmIndex === -1) {
        return res.status(404).json({ error: 'Алгоритм не найден' });
    }

    algorithms.splice(algorithmIndex, 1);
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
