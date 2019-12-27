'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {

    queryInterface.describeTable('Users').then(function(attributes){

      if (attributes.hasOwnProperty('calculated_userleaves')) {
        return 1;
      }

      return queryInterface.addColumn(
        'Users',
        'calculated_userleaves',
        {
          type         : Sequelize.INTEGER,
          allowNull    : true,
          defaultValue : false,
          comment      : 'Annual Leave entitlement based on Merimen leave policy',
        }
      ).then(function () {
        let sql = 'UPDATE Users set calculated_userleaves = user_leave';
        return queryInterface.sequelize.query( sql );
      }).then(function () {
          queryInterface.changeColumn("Users","calculated_userleaves",{
            type         : Sequelize.INTEGER,
            allowNull    : false
          });
      });
    });
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.removeColumn('Users', 'calculated_userleaves');
  }
};