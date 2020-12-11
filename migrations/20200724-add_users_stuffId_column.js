'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {

    queryInterface.describeTable('Users').then(function(attributes){

      if (attributes.hasOwnProperty('staffId')) {
        return 1;
      }

      return queryInterface.addColumn(
        'Users',
        'staffId',
        {
          type         : Sequelize.STRING,
          allowNull    : true,
          defaultValue : false,
          comment      : 'Staff Unique Id',
        }
      ).then(function () {
        let sql = 'UPDATE Users set staffId = "staffId"';
        return queryInterface.sequelize.query( sql );
      }).then(function () {
          queryInterface.changeColumn("Users","staffId",{
            type         : Sequelize.STRING,
            allowNull    : false
          });
      });
    });
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.removeColumn('Users', 'staffId');
  }
};