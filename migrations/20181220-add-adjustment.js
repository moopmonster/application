
'use strict';

var models = require('../lib/model/db');

module.exports = {
  up: (queryInterface, Sequelize) => {


    queryInterface.describeTable('LeaveTypes').then(attributes => {

        if (attributes.hasOwnProperty('is_adjustment')) {
          return 1;
        }

        return queryInterface.addColumn('LeaveTypes','is_adjustment',{
              type         : Sequelize.INTEGER,
              allowNull    : true,
              defaultValue : 0,
              comment      : '1 = Positive leave type adjustment. 2 = negative leave type adjustment',
        }).then(function (data) {
            let sql = 'UPDATE LeaveTypes set is_adjustment = 0';
            return queryInterface.sequelize.query( sql );
        }).then(function (data) {
            queryInterface.changeColumn("LeaveTypes","is_adjustment",{
                    type         : Sequelize.INTEGER,
                    allowNull    : false
            });
        });

    });



    queryInterface.describeTable('Users').then(attributes => {

        if (attributes.hasOwnProperty('global_adjuster')) {
          return 1;
        }

        return queryInterface.addColumn('Users','global_adjuster',{
              type         : Sequelize.INTEGER,
              allowNull    : true,
              defaultValue : 0,
              comment      : '1 = able to create global leave adjustments',
        }).then(function (data) {
            let sql = 'UPDATE Users set global_adjuster = 0';
            return queryInterface.sequelize.query( sql );
        }).then(function (data) {
            queryInterface.changeColumn("Users","global_adjuster",{
                    type         : Sequelize.INTEGER,
                    allowNull    : false
            });
        });

    });


  },

  down: (queryInterface, Sequelize) => queryInterface
    .removeColumn('LeaveTypes', 'is_adjustment')
    .then(() => queryInterface.removeColumn('Users', 'global_adjuster')),
};
