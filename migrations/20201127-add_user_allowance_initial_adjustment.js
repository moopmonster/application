'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {

    queryInterface.describeTable('user_allowance_adjustment').then(function(attributes){

      if (attributes.hasOwnProperty('initial_adjustment')) {
        return 1;
      }

      return queryInterface.addColumn(
        'user_allowance_adjustment',
        'initial_adjustment',
        {
          type         : Sequelize.INTEGER,
          allowNull    : true,
          defaultValue : false,
          comment      : 'Initial adjustment for the leave entitlement of the staff',
        }
      ).then(function () {
        let sql = 'UPDATE user_allowance_adjustment set initial_adjustment = 0';
        return queryInterface.sequelize.query( sql );
      });
    });
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.removeColumn('user_allowance_adjustment', 'initial_adjustment');
  }
};