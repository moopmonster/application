
'use strict';

var models = require('../lib/model/db');

module.exports = {
  up: (queryInterface, Sequelize) => {


    queryInterface.describeTable('Leaves').then(attributes => {

        if (attributes.hasOwnProperty('verified')) {
          return 1;
        }

        return queryInterface.addColumn('Leaves','verified',{
              type         : Sequelize.INTEGER,
              allowNull    : true,
              defaultValue : 0,
        }).then(function (data) {
            let sql = 'UPDATE Leaves set verified = 0';
            return queryInterface.sequelize.query( sql );
        }).then(function (data) {
            queryInterface.changeColumn("Leaves","verified",{
                    type         : Sequelize.INTEGER,
                    allowNull    : false
            });
        });

    });


    queryInterface.describeTable('Leaves').then(attributes => {

        if (attributes.hasOwnProperty('verifiedBy')) {
          return 1;
        }

        return queryInterface.describeTable('Leaves')
          .then(function(attributes){
            return queryInterface.addColumn(
              'Leaves',
              'verifiedBy',
              models.Leave.attributes.verifiedBy
            );
          });  

    });

  },

  down: (queryInterface, Sequelize) => queryInterface
    .removeColumn('Leaves', 'verified')
    .then(() => queryInterface.removeColumn('Leaves', 'verifiedBy')),

};
