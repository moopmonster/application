
'use strict';

var models = require('../lib/model/db');

module.exports = {
  up: (queryInterface, Sequelize) => {


    queryInterface.describeTable('Leaves').then(attributes => {

        if (attributes.hasOwnProperty('gevent_id')) {
          return 1;
        }

        return queryInterface.addColumn('Leaves','gevent_id', models.Leave.attributes.gevent_id);

    });

  },

  down: (queryInterface, Sequelize) => queryInterface
    .removeColumn('Leaves', 'gevent_id')
};
