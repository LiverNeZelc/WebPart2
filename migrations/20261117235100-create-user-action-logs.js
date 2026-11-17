'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('user_action_logs', {
            id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true, allowNull: false },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: { model: 'users', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            },
            username: { type: Sequelize.STRING(32), allowNull: true },
            action: { type: Sequelize.STRING(80), allowNull: false },
            resource_type: { type: Sequelize.STRING(40), allowNull: true },
            resource_id: { type: Sequelize.STRING(100), allowNull: true },
            success: { type: Sequelize.BOOLEAN, allowNull: false },
            status_code: { type: Sequelize.SMALLINT, allowNull: false },
            details: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
            created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }
        });
        await queryInterface.addIndex('user_action_logs', ['user_id', 'created_at']);
        await queryInterface.addIndex('user_action_logs', ['action', 'created_at']);
    },

    async down(queryInterface) {
        await queryInterface.dropTable('user_action_logs');
    }
};
