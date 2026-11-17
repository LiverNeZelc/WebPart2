'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { DataTypes, Sequelize } = require('sequelize');
const sortingCompetitionModel = require('../models/sortingCompetition');
const userActionLogModel = require('../models/userActionLog');
const sortingCompetitionMigration = require('../migrations/20261117235000-create-sorting-competitions');
const userActionLogMigration = require('../migrations/20261117235100-create-user-action-logs');

test('history models and migrations reference PostgreSQL users, not MongoDB algorithms', async () => {
    const sequelize = new Sequelize('postgres://app:secret@localhost/history_test', {
        dialect: 'postgres',
        logging: false
    });
    try {
        const Competition = sortingCompetitionModel(sequelize, DataTypes);
        const ActionLog = userActionLogModel(sequelize, DataTypes);
        assert.equal(Competition.getTableName(), 'sorting_competitions');
        assert.equal(ActionLog.getTableName(), 'user_action_logs');
        assert.equal(Competition.rawAttributes.challenger_user_id.references.model, 'users');
        assert.equal(Competition.rawAttributes.winner_user_id.references.model, 'users');
        assert.equal(Competition.rawAttributes.challenger_algorithm_id.references, undefined);
        assert.equal(ActionLog.rawAttributes.user_id.references.model, 'users');

        const tables = new Map();
        const constraints = [];
        const queryInterface = {
            async createTable(name, columns) { tables.set(name, columns); },
            async addConstraint(table, constraint) { constraints.push({ table, ...constraint }); },
            async addIndex() {},
            async dropTable() {}
        };
        await sortingCompetitionMigration.up(queryInterface, Sequelize);
        await userActionLogMigration.up(queryInterface, Sequelize);

        const competitionColumns = tables.get('sorting_competitions');
        assert.equal(competitionColumns.challenger_user_id.references.model, 'users');
        assert.equal(competitionColumns.challenger_algorithm_id.references, undefined);
        assert.equal(competitionColumns.challenger_elapsed_ms.allowNull, true);
        const logColumns = tables.get('user_action_logs');
        assert.equal(logColumns.user_id.references.model, 'users');
        assert.equal(logColumns.details.type, DataTypes.JSONB);
    } finally {
        await sequelize.close();
    }
});
