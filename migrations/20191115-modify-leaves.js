
'use strict';

var models = require('../lib/model/db');

module.exports = {
  up: (queryInterface, Sequelize) => {

    queryInterface.describeTable('Leaves').then(() => {
        return queryInterface.addColumn('Leaves','ori_date_start', models.Leave.attributes.ori_date_start)
          .then(()=>queryInterface.addColumn('Leaves','ori_day_part_start', models.Leave.attributes.ori_day_part_start));
    });

    queryInterface.describeTable('Leaves').then(() => {
      return queryInterface.addColumn('Leaves','ori_date_end', models.Leave.attributes.ori_date_end)
        .then(()=>queryInterface.addColumn('Leaves','ori_day_part_end', models.Leave.attributes.ori_day_part_end));
    });    
  },

  down: (queryInterface, Sequelize) => queryInterface.removeColumn('Leaves', 'ori_date_start')
    .then(() => queryInterface.removeColumn('Leaves', 'ori_day_part_start'))
    .then(() => queryInterface.removeColumn('Leaves', 'ori_date_end'))
    .then(() => queryInterface.removeColumn('Leaves', 'ori_day_part_end'))
};
