'use strict';

module.exports = (sequelize, DataTypes) => sequelize.define('UserActionLog', {
    id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
    },
    username: { type: DataTypes.STRING(32), allowNull: true },
    action: { type: DataTypes.STRING(80), allowNull: false },
    resource_type: { type: DataTypes.STRING(40), allowNull: true },
    resource_id: { type: DataTypes.STRING(100), allowNull: true },
    success: { type: DataTypes.BOOLEAN, allowNull: false },
    status_code: { type: DataTypes.SMALLINT, allowNull: false },
    details: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
    tableName: 'user_action_logs',
    timestamps: false,
    indexes: [
        { fields: ['user_id', 'created_at'] },
        { fields: ['action', 'created_at'] }
    ]
});
