'use strict';

const express = require('express');

const graphIdPattern = /^[a-f\d]{24}$/i;
const vertexIdPattern = /^[a-zA-Z0-9_-]{1,40}$/;
const maxVertices = 40;
const maxEdges = 120;

const validateGraph = (data) => {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return 'Тело запроса должно быть объектом';
    }
    if (typeof data.name !== 'string' || !data.name.trim()) return 'Название обязательно';
    if (data.name.trim().length > 100) return 'Название не должно превышать 100 символов';
    if (typeof data.description !== 'string' || !data.description.trim()) return 'Описание обязательно';
    if (data.description.trim().length > 1000) return 'Описание не должно превышать 1000 символов';
    if (typeof data.directed !== 'boolean') return 'Укажите, является ли граф ориентированным';
    if (!Array.isArray(data.vertices)) return 'Вершины должны быть списком';
    if (data.vertices.length === 0) return 'Добавьте хотя бы одну вершину';
    if (data.vertices.length > maxVertices) return `Можно добавить не более ${maxVertices} вершин`;
    if (!Array.isArray(data.edges)) return 'Рёбра должны быть списком';
    if (data.edges.length > maxEdges) return `Можно добавить не более ${maxEdges} рёбер`;

    const vertexIds = new Set();
    const labels = new Set();
    for (const [index, vertex] of data.vertices.entries()) {
        if (!vertex || typeof vertex !== 'object' || Array.isArray(vertex)) {
            return `Вершина ${index + 1} должна быть объектом`;
        }
        if (typeof vertex.id !== 'string' || !vertexIdPattern.test(vertex.id) || vertexIds.has(vertex.id)) {
            return `Некорректный или повторяющийся ID вершины ${index + 1}`;
        }
        if (typeof vertex.label !== 'string' || !vertex.label.trim() || vertex.label.trim().length > 20) {
            return `Название вершины ${index + 1} должно содержать от 1 до 20 символов`;
        }
        const label = vertex.label.trim().toLocaleLowerCase('ru');
        if (labels.has(label)) return `Название вершины «${vertex.label.trim()}» уже используется`;
        if (!Number.isFinite(vertex.x) || vertex.x < 0 || vertex.x > 800
            || !Number.isFinite(vertex.y) || vertex.y < 0 || vertex.y > 440) {
            return `Некорректное положение вершины ${index + 1}`;
        }
        vertexIds.add(vertex.id);
        labels.add(label);
    }

    const edges = new Set();
    for (const [index, edge] of data.edges.entries()) {
        if (!edge || typeof edge !== 'object' || Array.isArray(edge)) {
            return `Ребро ${index + 1} должно быть объектом`;
        }
        if (typeof edge.source !== 'string' || typeof edge.target !== 'string'
            || !vertexIds.has(edge.source) || !vertexIds.has(edge.target)
            || edge.source === edge.target) {
            return `Ребро ${index + 1} должно соединять две разные существующие вершины`;
        }
        const key = data.directed || edge.source < edge.target
            ? `${edge.source}:${edge.target}`
            : `${edge.target}:${edge.source}`;
        if (edges.has(key)) return `Ребро ${index + 1} повторяется`;
        edges.add(key);
    }
    return null;
};

const graphData = (data) => ({
    name: data.name.trim(),
    description: data.description.trim(),
    directed: data.directed,
    vertices: data.vertices.map((vertex) => ({
        id: vertex.id,
        label: vertex.label.trim(),
        x: vertex.x,
        y: vertex.y
    })),
    edges: data.edges.map((edge) => ({ source: edge.source, target: edge.target }))
});

const toPublicGraph = (graph) => ({
    id: graph._id.toString(),
    name: graph.name,
    description: graph.description,
    directed: graph.directed,
    vertices: graph.vertices || [],
    edges: graph.edges || [],
    owner_id: graph.owner_id,
    createdAt: graph.createdAt,
    updatedAt: graph.updatedAt
});

module.exports = (Graph, authenticate) => {
    const router = express.Router();
    router.use(authenticate);

    router.get('/', async (req, res) => {
        const graphs = await Graph.find({ owner_id: req.user.userId }).sort({ _id: 1 }).lean();
        return res.json(graphs.map(toPublicGraph));
    });

    router.post('/', async (req, res) => {
        const validationError = validateGraph(req.body);
        if (validationError) return res.status(400).json({ error: validationError });

        const graph = await Graph.create({ ...graphData(req.body), owner_id: req.user.userId });
        return res.status(201).json(toPublicGraph(graph));
    });

    router.put('/:id', async (req, res) => {
        if (!graphIdPattern.test(req.params.id)) {
            return res.status(400).json({ error: 'Некорректный ID графа' });
        }
        const validationError = validateGraph(req.body);
        if (validationError) return res.status(400).json({ error: validationError });

        const graph = await Graph.findById(req.params.id);
        if (!graph) return res.status(404).json({ error: 'Граф не найден' });
        if (graph.owner_id !== req.user.userId) {
            return res.status(403).json({ error: 'Изменять граф может только его создатель' });
        }
        Object.assign(graph, graphData(req.body));
        await graph.save();
        return res.json(toPublicGraph(graph));
    });

    router.delete('/:id', async (req, res) => {
        if (!graphIdPattern.test(req.params.id)) {
            return res.status(400).json({ error: 'Некорректный ID графа' });
        }
        const graph = await Graph.findById(req.params.id);
        if (!graph) return res.status(404).json({ error: 'Граф не найден' });
        if (graph.owner_id !== req.user.userId) {
            return res.status(403).json({ error: 'Удалять граф может только его создатель' });
        }
        await graph.deleteOne();
        return res.status(204).send();
    });

    return router;
};
