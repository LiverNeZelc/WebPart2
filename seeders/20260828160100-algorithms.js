'use strict';

module.exports = {
    async up(queryInterface) {
        const now = new Date();

        await queryInterface.bulkInsert('algorithms', [
            {
                name: 'BFS',
                type: 'graph',
                description: 'Обход графа в ширину',
                createdAt: now,
                updatedAt: now
            },
            {
                name: 'Quick Sort',
                type: 'sorting',
                description: 'Быстрая сортировка массива',
                createdAt: now,
                updatedAt: now
            }
        ]);
    },

    async down(queryInterface) {
        await queryInterface.bulkDelete('algorithms', null, {});
    }
};
