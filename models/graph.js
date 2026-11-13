'use strict';

const mongoose = require('mongoose');

const vertexSchema = new mongoose.Schema({
    id: { type: String, required: true, maxlength: 40 },
    label: { type: String, required: true, maxlength: 20, trim: true },
    x: { type: Number, required: true, min: 0, max: 800 },
    y: { type: Number, required: true, min: 0, max: 440 }
}, { _id: false });

const edgeSchema = new mongoose.Schema({
    source: { type: String, required: true, maxlength: 40 },
    target: { type: String, required: true, maxlength: 40 }
}, { _id: false });

const graphSchema = new mongoose.Schema({
    name: { type: String, required: true, maxlength: 100, trim: true },
    description: { type: String, required: true, maxlength: 1000, trim: true },
    directed: { type: Boolean, default: false },
    vertices: {
        type: [vertexSchema],
        default: [],
        validate: { validator: (vertices) => vertices.length <= 40, message: 'Можно добавить не более 40 вершин' }
    },
    edges: {
        type: [edgeSchema],
        default: [],
        validate: { validator: (edges) => edges.length <= 120, message: 'Можно добавить не более 120 рёбер' }
    },
    owner_id: { type: Number, required: true }
}, {
    collection: 'graphs',
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.models.Graph || mongoose.model('Graph', graphSchema);
