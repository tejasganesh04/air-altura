'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('Users', 'name', {
            type: Sequelize.STRING,
            allowNull: true, // nullable — existing rows predate this migration and have no name
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('Users', 'name');
    }
};
