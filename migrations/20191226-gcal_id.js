'use strict';

var models = require('../lib/model/db');

module.exports = {
  up: (queryInterface, Sequelize) => {

    queryInterface.describeTable('Companies').then(attributes => {

      if (attributes.hasOwnProperty('gcal_id')) {
        return 1;
      }

      return queryInterface.addColumn(
        'Companies',
        'gcal_id',
        models.Company.attributes.gcal_id
      );
    });

    queryInterface.describeTable('Departments').then(attributes => {

      if (attributes.hasOwnProperty('gcal_id')) {
        return 1;
      }

      return queryInterface.addColumn(
        'Departments',
        'gcal_id',
        models.Company.attributes.gcal_id
      );
    });

  },

  down: (queryInterface, Sequelize) => queryInterface
    .removeColumn('Companies', 'gcal_id')
    .then(() => queryInterface.removeColumn('Departments', 'gcal_id')),
};
