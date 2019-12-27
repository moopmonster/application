
'use strict';

var models = require('../lib/model/db');

module.exports = {
  up: (queryInterface, Sequelize) => {


    queryInterface.describeTable('LeaveTypes').then(attributes => {

        if (attributes.hasOwnProperty('attachment_req')) {
          return 1;
        }

        return queryInterface.addColumn('LeaveTypes','attachment_req',{
              type         : Sequelize.INTEGER,
              allowNull    : true,
              defaultValue : 0,
              comment      : '1 = attachment is compulsory when creating a leave request, 2 = attachment is optional',
        }).then(function (data) {
            let sql = 'UPDATE LeaveTypes set attachment_req = 0';
            return queryInterface.sequelize.query( sql );
        }).then(function (data) {
            queryInterface.changeColumn("LeaveTypes","attachment_req",{
                    type         : Sequelize.INTEGER,
                    allowNull    : false
            });
        });

    });

  },

  down: (queryInterface, Sequelize) => queryInterface
    .removeColumn('LeaveTypes', 'attachment_req')
};
