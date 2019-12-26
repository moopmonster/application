'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {

    queryInterface.describeTable('Users').then(function(attributes){

      if (attributes.hasOwnProperty('isManager')) {
        return 1;
      }

      return queryInterface.addColumn(
        'Users',
        'isManager',
        {
          type         : Sequelize.BOOLEAN,
          allowNull    : true,
          defaultValue : false,
          comment      : 'Indicate if account can is manager(Assigned as department head/supervisor)',
        }
      ).then(function () {
        let sql = 'UPDATE Users set isManager = 0';
        return queryInterface.sequelize.query( sql );
      }).then(function () {
        let sql = 'Update Users set isManager = 1 where id in (Select bossID from Departments UNION Select user_id from DepartmentSupervisor)';
        return queryInterface.sequelize.query( sql );
      }).then(function () {
          queryInterface.changeColumn("Users","isManager",{
            type         : Sequelize.BOOLEAN,
            allowNull    : false
          });
      });
    });
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.removeColumn('Users', 'isManager');
  }
};