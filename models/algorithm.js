'use strict';

const mongoose = require('mongoose');

const criterionSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        maxlength: 100,
        trim: true
    },
    description: {
        type: String,
        maxlength: 2000,
        trim: true,
        default: ''
    }
}, { _id: false });

const algorithmSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        maxlength: 100,
        trim: true
    },
    type: {
        type: String,
        required: true,
        maxlength: 50,
        trim: true
    },
    description: {
        type: String,
        required: true,
        maxlength: 1000,
        trim: true
    },
    criteria: {
        type: [criterionSchema],
        default: [],
        validate: {
            validator: (criteria) => criteria.length <= 50,
            message: 'Можно добавить не более 50 критериев'
        }
    },
    owner_id: {
        type: Number,
        default: null
    },
    legacyId: {
        type: Number,
        select: false
    }
}, {
    collection: 'algorithms',
    timestamps: true,
    versionKey: false
});

algorithmSchema.index({ legacyId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.models.Algorithm
    || mongoose.model('Algorithm', algorithmSchema);
