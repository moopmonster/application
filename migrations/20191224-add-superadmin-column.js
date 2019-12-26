'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {

    queryInterface.describeTable('Users').then(function(attributes){

      if (attributes.hasOwnProperty('superadmin')) {
        return 1;
      }

      return queryInterface.addColumn(
        'Users',
        'superadmin',
        {
          type         : Sequelize.BOOLEAN,
          allowNull    : true,
          defaultValue : false,
          comment      : 'Indicate if account can is manager(Assigned as department head/supervisor)',
        }
      ).then(function () {
        let sql = 'UPDATE Users set superadmin = 0';
        return queryInterface.sequelize.query( sql );
      }).then(function () {
        let sql = 'update Users set superadmin = 1 where nickname = "Mei Shi"';
        return queryInterface.sequelize.query( sql );
      }).then(function () {
          queryInterface.changeColumn("Users","superadmin",{
            type         : Sequelize.BOOLEAN,
            allowNull    : false
          });
      });
    });
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.removeColumn('Users', 'superadmin');
  }
};