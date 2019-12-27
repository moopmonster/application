'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {

    queryInterface.describeTable('LeaveTypes').then(function(attributes){

      if (attributes.hasOwnProperty('LeaveTypeCode')) {
        return 1;
      }

      return queryInterface.addColumn(
        'LeaveTypes',
        'LeaveTypeCode',
        {
          type      : Sequelize.STRING,
          allowNull : true,
          comment   : 'Unique Code that assigned for each leave type(developer usage only)',
        }
      ).then(function () {
        let sql = 'UPDATE leaveTypes SET LeaveTypeCode = CASE name '+
                      'WHEN "Annual Leave" THEN "ANNUAL" '+
                      'WHEN "Sick Leave" THEN "SICK" '+
                      'WHEN "Maternity" THEN "MATERNITY" '+
                      'WHEN "Emergency" THEN "EMERGENCY" '+
                      'WHEN "Compassionate" THEN "COMPASSIONATE" '+
                      'WHEN "Marital" THEN "MARTIAL" '+
                      'WHEN "Others" THEN "OTHERS" '+
                      'WHEN "Hospitalization" THEN "HOSPITALIZATION" '+
                      'WHEN "+ Add Annual Leave" THEN "ADDANNUAL" '+
                      'WHEN "Study Leave" THEN "STUDY" '+
                      'WHEN "Exam Leave" THEN "EXAM" '+
                  'END '+
                  'WHERE name IN("Annual Leave", "Sick Leave","Maternity","Emergency","Compassionate","Marital","Others","Hospitalization","+ Add Annual Leave","Study Leave","Exam Leave");'
        return queryInterface.sequelize.query( sql );
      });
    });
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.removeColumn('LeaveTypes', 'LeaveTypeCode');
  }
};