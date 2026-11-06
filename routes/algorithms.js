'use strict';

const express = require('express');

const maxCriteria = 50;
const maxSearchLength = 100;
const objectIdPattern = /^[a-f\d]{24}$/i;

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toPublicAlgorithm = (algorithm) => ({
    id: algorithm._id.toString(),
    name: algorithm.name,
    type: algorithm.type,
    description: algorithm.description,
    criteria: algorithm.criteria || [],
    owner_id: algorithm.owner_id ?? null,
    createdAt: algorithm.createdAt,
    updatedAt: algorithm.updatedAt
});

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

    if (data.criteria !== undefined && !Array.isArray(data.criteria)) {
        return 'Критерии должны быть списком';
    }
    if ((data.criteria || []).length > maxCriteria) {
        return `Можно добавить не более ${maxCriteria} критериев`;
    }

    for (const [index, criterion] of (data.criteria || []).entries()) {
        if (!criterion || typeof criterion !== 'object' || Array.isArray(criterion)) {
            return `Критерий ${index + 1} должен быть объектом`;
        }
        if (typeof criterion.name !== 'string' || criterion.name.trim() === '') {
            return `Укажите название критерия ${index + 1}`;
        }
        if (criterion.name.trim().length > 100) {
            return `Название критерия ${index + 1} не должно превышать 100 символов`;
        }
        if (criterion.description !== undefined && typeof criterion.description !== 'string') {
            return `Описание критерия ${index + 1} должно быть текстом`;
        }
        if ((criterion.description || '').trim().length > 2000) {
            return `Описание критерия ${index + 1} не должно превышать 2000 символов`;
        }
    }

    return null;
};

const algorithmData = (data) => ({
    name: data.name.trim(),
    type: data.type.trim(),
    description: data.description.trim(),
    criteria: (data.criteria || []).map((criterion) => ({
        name: criterion.name.trim(),
        description: (criterion.description || '').trim()
    }))
});

module.exports = (Algorithm, authenticate) => {
    const router = express.Router();
    router.use(authenticate);

    const listAlgorithms = async (req, res) => {
        const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
        if (search.length > maxSearchLength) {
            return res.status(400).json({
                error: `Поисковый запрос не должен превышать ${maxSearchLength} символов`
            });
        }

        const filter = {
            owner_id: { $in: [req.user.userId, null] }
        };
        if (search) {
            const searchPattern = new RegExp(escapeRegex(search), 'i');
            filter.$or = [
                { name: searchPattern },
                { type: searchPattern },
                { description: searchPattern },
                { 'criteria.name': searchPattern },
                { 'criteria.description': searchPattern }
            ];
        }

        const algorithms = await Algorithm.find(filter).sort({ _id: 1 }).lean();
        return res.json(algorithms.map(toPublicAlgorithm));
    };

    router.get('/', listAlgorithms);
    router.get('/:ownerId', async (req, res) => {
        const ownerId = Number(req.params.ownerId);
        if (!Number.isInteger(ownerId) || ownerId < 1) {
            return res.status(400).json({ error: 'Некорректный ID владельца алгоритмов' });
        }
        if (ownerId !== req.user.userId) {
            return res.status(403).json({ error: 'Просматривать можно только свой каталог' });
        }
        return listAlgorithms(req, res);
    });

    router.post('/', async (req, res) => {
        const validationError = validateAlgorithm(req.body);
        if (validationError) {
            return res.status(400).json({ error: validationError });
        }

        const algorithm = await Algorithm.create({
            ...algorithmData(req.body),
            owner_id: req.user.userId
        });
        return res.status(201).json(toPublicAlgorithm(algorithm));
    });

    router.put('/:id', async (req, res) => {
        if (!objectIdPattern.test(req.params.id)) {
            return res.status(400).json({ error: 'Некорректный ID алгоритма' });
        }

        const validationError = validateAlgorithm(req.body);
        if (validationError) {
            return res.status(400).json({ error: validationError });
        }

        const algorithm = await Algorithm.findById(req.params.id);
        if (!algorithm) {
            return res.status(404).json({ error: 'Алгоритм не найден' });
        }
        if (algorithm.owner_id !== req.user.userId) {
            return res.status(403).json({ error: 'Изменять алгоритм может только его создатель' });
        }

        Object.assign(algorithm, algorithmData(req.body));
        await algorithm.save();
        return res.json(toPublicAlgorithm(algorithm));
    });

    router.delete('/:id', async (req, res) => {
        if (!objectIdPattern.test(req.params.id)) {
            return res.status(400).json({ error: 'Некорректный ID алгоритма' });
        }

        const algorithm = await Algorithm.findById(req.params.id);
        if (!algorithm) {
            return res.status(404).json({ error: 'Алгоритм не найден' });
        }
        if (algorithm.owner_id !== req.user.userId) {
            return res.status(403).json({ error: 'Удалять алгоритм может только его создатель' });
        }

        await algorithm.deleteOne();
        return res.status(204).send();
    });

    return router;
};
