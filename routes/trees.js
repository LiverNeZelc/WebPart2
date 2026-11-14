'use strict';

const express = require('express');

const treeIdPattern = /^[a-f\d]{24}$/i;
const kinds = new Set(['BST', 'AVL', 'RED_BLACK', 'B_TREE', 'B_PLUS_TREE', 'TRIE', 'SEGMENT', 'FENWICK', 'HEAP']);
const wordPattern = /^[\p{L}\p{N}_-]{1,24}$/u;

const validateTree = (data) => {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return 'Тело запроса должно быть объектом';
    if (typeof data.name !== 'string' || !data.name.trim()) return 'Название обязательно';
    if (data.name.trim().length > 100) return 'Название не должно превышать 100 символов';
    if (typeof data.description !== 'string' || !data.description.trim()) return 'Описание обязательно';
    if (data.description.trim().length > 1000) return 'Описание не должно превышать 1000 символов';
    if (!kinds.has(data.kind)) return 'Выберите поддерживаемый тип дерева';
    if (!Array.isArray(data.items) || data.items.length === 0 || data.items.length > 40) {
        return 'Добавьте от 1 до 40 элементов';
    }

    const seen = new Set();
    for (const [index, rawItem] of data.items.entries()) {
        if (typeof rawItem !== 'string' || !rawItem.trim() || rawItem.trim().length > 24) {
            return `Элемент ${index + 1} должен содержать от 1 до 24 символов`;
        }
        const item = rawItem.trim();
        if (data.kind === 'TRIE') {
            if (!wordPattern.test(item)) return `Слово ${index + 1} содержит недопустимые символы`;
        } else if (data.kind === 'SEGMENT' || data.kind === 'FENWICK' || data.kind === 'HEAP'
            || ['BST', 'AVL', 'RED_BLACK', 'B_TREE', 'B_PLUS_TREE'].includes(data.kind)) {
            if (!/^-?\d{1,9}$/.test(item)) return `Элемент ${index + 1} должен быть целым числом`;
        }
        if (!['SEGMENT', 'FENWICK', 'HEAP'].includes(data.kind)) {
            const key = data.kind === 'TRIE' ? item.toLocaleLowerCase('ru') : String(Number(item));
            if (seen.has(key)) return `Элемент «${item}» повторяется`;
            seen.add(key);
        }
    }
    if ((data.kind === 'SEGMENT' || data.kind === 'FENWICK') && data.items.length > 32) {
        return 'Для деревьев диапазонов можно добавить не более 32 чисел';
    }
    return null;
};

const treeData = (data) => ({
    name: data.name.trim(),
    description: data.description.trim(),
    kind: data.kind,
    items: data.items.map((item) => item.trim())
});

const toPublicTree = (tree) => ({
    id: tree._id.toString(),
    name: tree.name,
    description: tree.description,
    kind: tree.kind,
    items: tree.items || [],
    owner_id: tree.owner_id,
    createdAt: tree.createdAt,
    updatedAt: tree.updatedAt
});

module.exports = (Tree, authenticate) => {
    const router = express.Router();
    router.use(authenticate);

    router.get('/', async (req, res) => {
        const trees = await Tree.find({ owner_id: req.user.userId }).sort({ _id: 1 }).lean();
        return res.json(trees.map(toPublicTree));
    });

    router.post('/', async (req, res) => {
        const validationError = validateTree(req.body);
        if (validationError) return res.status(400).json({ error: validationError });
        const tree = await Tree.create({ ...treeData(req.body), owner_id: req.user.userId });
        return res.status(201).json(toPublicTree(tree));
    });

    router.put('/:id', async (req, res) => {
        if (!treeIdPattern.test(req.params.id)) return res.status(400).json({ error: 'Некорректный ID дерева' });
        const validationError = validateTree(req.body);
        if (validationError) return res.status(400).json({ error: validationError });
        const tree = await Tree.findById(req.params.id);
        if (!tree) return res.status(404).json({ error: 'Дерево не найдено' });
        if (tree.owner_id !== req.user.userId) return res.status(403).json({ error: 'Изменять дерево может только его создатель' });
        Object.assign(tree, treeData(req.body));
        await tree.save();
        return res.json(toPublicTree(tree));
    });

    router.delete('/:id', async (req, res) => {
        if (!treeIdPattern.test(req.params.id)) return res.status(400).json({ error: 'Некорректный ID дерева' });
        const tree = await Tree.findById(req.params.id);
        if (!tree) return res.status(404).json({ error: 'Дерево не найдено' });
        if (tree.owner_id !== req.user.userId) return res.status(403).json({ error: 'Удалять дерево может только его создатель' });
        await tree.deleteOne();
        return res.status(204).send();
    });

    return router;
};
