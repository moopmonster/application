
'use strict';


const models = require('../lib/model/db');
const GcalEvent = require('../lib/gcal');
/*
const sequelize = require('sequelize');*/

// 1. get all leaves that have no google calender event id
// 2. iterate through each leave and google cal function to create the missing calendar events.
// 3. todo: add new column to stamp in errors from google calendar. 

models.Leave.findAll({
 include : [{
    model : models.LeaveType,
    as    : 'leave_type',
  },{            
    model : models.User,
    as    : 'user',
    include : [{
      model : models.Company,
      as : 'company',
      include : [{
        model : models.BankHoliday,
        as    : 'bank_holidays',
      }],
    },{
      model : models.Department,
      as    : 'department',
    }],
  }],	
  where: {
    gevent_id: {$eq: null},    
    '$leave_type.is_adjustment$': 0,
    status : [1,2,4],
  }
})
//models.sequelize.query("SELECT * FROM `Leaves` a inner join `users` b on a.userId = b.id inner join `LeaveTypes` c on c.id = a.leavetypeid where a.gevent_id is null", { type: models.sequelize.QueryTypes.SELECT})
.then(function(leaves) {
	
	leaves.forEach(function(leave){ 
		var gcal = new GcalEvent();
		gcal.promise_gevent_create({
			leave : leave,
		});
	});

})
