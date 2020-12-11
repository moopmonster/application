'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {

    queryInterface.describeTable('Users').then(function(attributes){

      if (attributes.hasOwnProperty('category')) {
        return 1;
      }

      return queryInterface.addColumn(
        'Users',
        'category',
        {
          type         : Sequelize.STRING,
          allowNull    : true,
          defaultValue : false,
          comment      : 'Category of Staff',
        }
      ).then(function () {
        let sql = 'UPDATE Users set category = "category"';
        return queryInterface.sequelize.query( sql );
      }).then(function () {
          queryInterface.changeColumn("Users","category",{
            type         : Sequelize.STRING,
            allowNull    : false
          });
      });
    });
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.removeColumn('Users', 'category');
  }
};