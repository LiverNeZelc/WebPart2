'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('sorting_competitions', {
            id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
            challenger_user_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: { model: 'users', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            },
            challenger_username: { type: Sequelize.STRING(32), allowNull: false },
            challenger_algorithm_id: { type: Sequelize.STRING(24), allowNull: false },
            challenger_algorithm_name: { type: Sequelize.STRING(100), allowNull: false },
            opponent_user_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: { model: 'users', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            },
            opponent_username: { type: Sequelize.STRING(32), allowNull: false },
            opponent_algorithm_id: { type: Sequelize.STRING(24), allowNull: false },
            opponent_algorithm_name: { type: Sequelize.STRING(100), allowNull: false },
            input_values: { type: Sequelize.JSONB, allowNull: false },
            winner_user_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: { model: 'users', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            },
            challenger_elapsed_ms: { type: Sequelize.DOUBLE, allowNull: true },
            opponent_elapsed_ms: { type: Sequelize.DOUBLE, allowNull: true },
            challenger_steps: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
            opponent_steps: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
            input_size: { type: Sequelize.INTEGER, allowNull: false },
            status: { type: Sequelize.STRING(16), allowNull: false, defaultValue: 'matched' },
            started_at: { type: Sequelize.DATE, allowNull: true },
            completed_at: { type: Sequelize.DATE, allowNull: true },
            created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }
        });
        await queryInterface.addIndex('sorting_competitions', ['challenger_user_id', 'created_at']);
        await queryInterface.addIndex('sorting_competitions', ['opponent_user_id', 'created_at']);
        await queryInterface.addIndex('sorting_competitions', ['status', 'created_at']);
    },

    async down(queryInterface) {
        await queryInterface.dropTable('sorting_competitions');
    }
};
