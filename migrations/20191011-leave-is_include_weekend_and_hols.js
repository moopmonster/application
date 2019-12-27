
'use strict';

var models = require('../lib/model/db');

module.exports = {
  up: (queryInterface, Sequelize) => {


    queryInterface.describeTable('LeaveTypes').then(attributes => {

        if (attributes.hasOwnProperty('is_include_weekend_and_hols')) {
          return 1;
        }

        return queryInterface.addColumn('LeaveTypes','is_include_weekend_and_hols',{
              type         : Sequelize.INTEGER,
              allowNull    : true,
              defaultValue : 0,
              comment      : '1: calculation of leave usage includes weekends and hols.',
        }).then(function () {
            let sql = 'UPDATE LeaveTypes set is_include_weekend_and_hols = 0';
            return queryInterface.sequelize.query( sql );
        }).then(function () {
            queryInterface.changeColumn("LeaveTypes","is_include_weekend_and_hols",{
                    type         : Sequelize.INTEGER,
                    allowNull    : false
            });
        });

    });

  },

  down: (queryInterface, Sequelize) => queryInterface
    .removeColumn('LeaveTypes', 'is_include_weekend_and_hols')
};
