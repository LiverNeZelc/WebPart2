'use strict';

const mongoose = require('mongoose');

const treeSchema = new mongoose.Schema({
    name: { type: String, required: true, maxlength: 100, trim: true },
    description: { type: String, required: true, maxlength: 1000, trim: true },
    kind: {
        type: String,
        required: true,
        enum: ['BST', 'AVL', 'RED_BLACK', 'B_TREE', 'B_PLUS_TREE', 'TRIE', 'SEGMENT', 'FENWICK', 'HEAP']
    },
    items: {
        type: [String],
        required: true,
        validate: { validator: (items) => items.length > 0 && items.length <= 40, message: 'Добавьте от 1 до 40 элементов' }
    },
    owner_id: { type: Number, required: true }
}, {
    collection: 'trees',
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.models.Tree || mongoose.model('Tree', treeSchema);
