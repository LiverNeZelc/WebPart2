'use strict';

module.exports = (sequelize, DataTypes) => sequelize.define('SortingCompetition', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true
    },
    challenger_user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
    },
    challenger_username: { type: DataTypes.STRING(32), allowNull: false },
    challenger_algorithm_id: { type: DataTypes.STRING(24), allowNull: false },
    challenger_algorithm_name: { type: DataTypes.STRING(100), allowNull: false },
    opponent_user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
    },
    opponent_username: { type: DataTypes.STRING(32), allowNull: false },
    opponent_algorithm_id: { type: DataTypes.STRING(24), allowNull: false },
    opponent_algorithm_name: { type: DataTypes.STRING(100), allowNull: false },
    input_values: { type: DataTypes.JSONB, allowNull: false },
    winner_user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
    },
    challenger_elapsed_ms: { type: DataTypes.DOUBLE, allowNull: true },
    opponent_elapsed_ms: { type: DataTypes.DOUBLE, allowNull: true },
    challenger_steps: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    opponent_steps: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    input_size: { type: DataTypes.INTEGER, allowNull: false },
    status: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: 'matched'
    },
    started_at: { type: DataTypes.DATE, allowNull: true },
    completed_at: { type: DataTypes.DATE, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
    tableName: 'sorting_competitions',
    timestamps: false,
    indexes: [
        { fields: ['challenger_user_id', 'created_at'] },
        { fields: ['opponent_user_id', 'created_at'] },
        { fields: ['status', 'created_at'] }
    ]
});
