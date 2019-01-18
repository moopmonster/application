
'use strict';

var models = require('../lib/model/db');

module.exports = {
  up: (queryInterface, Sequelize) => {


    queryInterface.describeTable('LeaveTypes').then(attributes => {

        if (attributes.hasOwnProperty('comment_req')) {
          return 1;
        }

        return queryInterface.addColumn('LeaveTypes','comment_req',{
              type         : Sequelize.INTEGER,
              allowNull    : true,
              defaultValue : 0,
              comment      : '1 = comment is compulsory when creating a leave request',
        }).then(function (data) {
            let sql = 'UPDATE LeaveTypes set comment_req = 0';
            return queryInterface.sequelize.query( sql );
        }).then(function (data) {
            queryInterface.changeColumn("LeaveTypes","comment_req",{
                    type         : Sequelize.INTEGER,
                    allowNull    : false
            });
        });

    });

    queryInterface.describeTable('LeaveTypes').then(attributes => {

        if (attributes.hasOwnProperty('min_days_prior')) {
          return 1;
        }

        return queryInterface.addColumn('LeaveTypes','min_days_prior',{
              type         : Sequelize.INTEGER,
              allowNull    : true,
              defaultValue : 0,
              comment      : 'Minimum number of working days in advance for the leave application',
        }).then(function (data) {
            let sql = 'UPDATE LeaveTypes set min_days_prior = 0';
            return queryInterface.sequelize.query( sql );
        }).then(function (data) {
            queryInterface.changeColumn("LeaveTypes","min_days_prior",{
                    type         : Sequelize.INTEGER,
                    allowNull    : false
            });
        });

    });
  },

  down: (queryInterface, Sequelize) => queryInterface
    .removeColumn('LeaveTypes', 'comment_req')
    .then(() => queryInterface.removeColumn('LeaveTypes', 'min_days_prior')),

};
