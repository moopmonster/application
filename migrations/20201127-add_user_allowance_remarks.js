'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {

    queryInterface.describeTable('user_allowance_adjustment').then(function(attributes){

      if (attributes.hasOwnProperty('remarks')) {
        return 1;
      }

      return queryInterface.addColumn(
        'user_allowance_adjustment',
        'remarks',
        {
          type         : Sequelize.STRING,
          allowNull    : true,
          defaultValue : false,
          comment      : 'Remarks for initial adjustment',
        }
      ).then(function () {
        let sql = 'UPDATE user_allowance_adjustment set Remarks = ""';
        return queryInterface.sequelize.query( sql );
      });
    });
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.removeColumn('user_allowance_adjustment', 'remarks');
  }
};