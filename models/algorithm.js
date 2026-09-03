'use strict';

module.exports = (sequelize, DataTypes) => {
    const Algorithm = sequelize.define('Algorithm', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        type: {
            type: DataTypes.STRING,
            allowNull: false
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        owner_id: {
            type: DataTypes.INTEGER,
            allowNull: true
        }
    }, {
        tableName: 'algorithms'
    });

    return Algorithm;
};
