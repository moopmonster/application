
'use strict';

var models = require('../lib/model/db');

module.exports = {
  up: (queryInterface, Sequelize) => {


    queryInterface.describeTable('Leaves').then(attributes => {

        if (attributes.hasOwnProperty('gevent_error')) {
          return 1;
        }

        return queryInterface.addColumn('Leaves','gevent_error', models.Leave.attributes.gevent_error);

    });

  },

  down: (queryInterface, Sequelize) => queryInterface
    .removeColumn('Leaves', 'gevent_error')
};
