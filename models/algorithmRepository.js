'use strict';

module.exports = (Algorithm) => ({
    findAll: () => Algorithm.findAll({ order: [['id', 'ASC']] }),
    findByOwnerId: (ownerId) => Algorithm.findAll({
        where: { owner_id: ownerId },
        order: [['id', 'ASC']]
    }),
    create: (data) => Algorithm.create(data),
    update: async (id, data) => {
        const algorithm = await Algorithm.findByPk(id);

        if (!algorithm) {
            return null;
        }

        return algorithm.update(data);
    },
    remove: async (id) => {
        const algorithm = await Algorithm.findByPk(id);

        if (!algorithm) {
            return false;
        }

        await algorithm.destroy();
        return true;
    }
});
