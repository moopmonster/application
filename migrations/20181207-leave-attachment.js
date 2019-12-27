
'use strict';

var models = require('../lib/model/db');

module.exports = {
  up: function (queryInterface, Sequelize) {

    return queryInterface.describeTable('Leaves')
      .then(function(attributes){

        if (attributes.hasOwnProperty('attachment')) {
          return 1;
        }

        return queryInterface.addColumn(
          'Leaves',
          'attachment',
          models.Leave.attributes.attachment
        );
      });
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface
      .removeColumn('Leaves', 'attachment');
  }
};
