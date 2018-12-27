
'use strict';

var models = require('../lib/model/db');

module.exports = {
  up: (queryInterface, Sequelize) => {


    queryInterface.describeTable('Users').then(attributes => {

        if (attributes.hasOwnProperty('nickname')) {
          return 1;
        }

        return queryInterface.addColumn('Users','nickname', models.User.attributes.nickname);

    });

  },

  down: (queryInterface, Sequelize) => queryInterface
    .removeColumn('Users', 'nickname')
};
