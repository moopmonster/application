
'use strict';

var models = require('../lib/model/db');

module.exports = {
  up: (queryInterface, Sequelize) => {


    queryInterface.describeTable('Users').then(attributes => {

        if (attributes.hasOwnProperty('user_leave')) {
          return 1;
        }

        return queryInterface.addColumn('Users','user_leave',{
              type         : Sequelize.INTEGER,
              allowNull    : true,
              defaultValue : 0,
              comment      : 'user leave entitlment during initial import',
        }).then(function (data) {
            let sql = 'UPDATE Users set user_leave = 0';
            return queryInterface.sequelize.query( sql );
        }).then(function (data) {
            queryInterface.changeColumn("Users","user_leave",{
                    type         : Sequelize.INTEGER,
                    allowNull    : false
            });
        });

    });

    queryInterface.describeTable('Users').then(attributes => {

        if (attributes.hasOwnProperty('user_cf')) {
          return 1;
        }

        return queryInterface.addColumn('Users','user_cf',{
              type         : Sequelize.INTEGER,
              allowNull    : true,
              defaultValue : 0,
              comment      : 'user mc entitlment during initial import',
        }).then(function (data) {
            let sql = 'UPDATE Users set user_cf = 0';
            return queryInterface.sequelize.query( sql );
        }).then(function (data) {
            queryInterface.changeColumn("Users","user_cf",{
                    type         : Sequelize.INTEGER,
                    allowNull    : false
            });
        });

    });

  },

  down: (queryInterface, Sequelize) => queryInterface
    .removeColumn('Users', 'user_leave')
    .then(() => queryInterface.removeColumn('Users', 'user_cf')),
};
