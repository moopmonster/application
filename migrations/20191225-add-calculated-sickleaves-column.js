'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {

    queryInterface.describeTable('Users').then(function(attributes){

      if (attributes.hasOwnProperty('calculated_sickleaves')) {
        return 1;
      }

      return queryInterface.addColumn(
        'Users',
        'calculated_sickleaves',
        {
          type         : Sequelize.INTEGER,
          allowNull    : true,
          defaultValue : false,
          comment      : 'Annual Leave entitlement based on Merimen leave policy',
        }
      ).then(function () {
        let sql = 'UPDATE Users set calculated_sickleaves = 14';
        return queryInterface.sequelize.query( sql );
      }).then(function () {
          queryInterface.changeColumn("Users","calculated_sickleaves",{
            type         : Sequelize.INTEGER,
            allowNull    : false
          });
      });
    });
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.removeColumn('Users', 'calculated_sickleaves');
  }
};