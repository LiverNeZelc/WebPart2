'use strict';

module.exports = (Algorithm, Op) => ({
    findAll: () => Algorithm.findAll({ order: [['id', 'ASC']] }),
    findByOwnerId: (ownerId, search = '') => Algorithm.findAll({
        where: {
            [Op.and]: [
                {
                    [Op.or]: [
                        { owner_id: ownerId },
                        { owner_id: null }
                    ]
                },
                ...(search ? [{
                    [Op.or]: [
                        { name: { [Op.iLike]: `%${search}%` } },
                        { type: { [Op.iLike]: `%${search}%` } },
                        { description: { [Op.iLike]: `%${search}%` } }
                    ]
                }] : [])
            ]
        },
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
