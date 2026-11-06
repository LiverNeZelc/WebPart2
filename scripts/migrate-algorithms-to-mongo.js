'use strict';

require('dotenv').config();
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '..', 'atlas-credentials.env') });

const mongoose = require('mongoose');
const { Sequelize } = require('sequelize');
const Algorithm = require('../models/algorithm');

const migrateAlgorithms = async () => {
    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is not configured.');
    }
    if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI is not configured. Set it in .env or atlas-credentials.env.');
    }

    const sequelize = new Sequelize(process.env.DATABASE_URL, {
        dialect: process.env.DB_DIALECT || 'postgres'
    });

    try {
        await sequelize.authenticate();
        await mongoose.connect(process.env.MONGODB_URI);

        const queryInterface = sequelize.getQueryInterface();
        if (!await queryInterface.tableExists('algorithms')) {
            console.log('PostgreSQL algorithms table does not exist; nothing to migrate.');
            return;
        }

        await Algorithm.init();
        const [rows] = await sequelize.query('SELECT * FROM "algorithms" ORDER BY "id" ASC');
        const operations = rows.map((row) => ({
            updateOne: {
                filter: { legacyId: row.id },
                update: {
                    $set: {
                        legacyId: row.id,
                        name: String(row.name),
                        type: String(row.type),
                        description: String(row.description),
                        criteria: [],
                        owner_id: row.owner_id ?? null,
                        createdAt: row.createdAt,
                        updatedAt: row.updatedAt
                    }
                },
                upsert: true
            }
        }));

        if (operations.length) {
            await Algorithm.bulkWrite(operations, { ordered: true });
        }

        const legacyIds = rows.map((row) => row.id);
        const migratedCount = legacyIds.length
            ? await Algorithm.countDocuments({ legacyId: { $in: legacyIds } })
            : 0;
        if (migratedCount !== rows.length) {
            throw new Error(`Migration verification failed: expected ${rows.length}, found ${migratedCount}.`);
        }

        await queryInterface.dropTable('algorithms');
        console.log(`Migrated ${rows.length} algorithms to MongoDB and removed the PostgreSQL table.`);
    } finally {
        await Promise.allSettled([sequelize.close(), mongoose.disconnect()]);
    }
};

migrateAlgorithms().catch((error) => {
    console.error('Algorithm migration failed:', error);
    process.exitCode = 1;
});
