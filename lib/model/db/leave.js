
"use strict";

var
    _       = require('underscore'),
    moment  = require('moment'),
    Promise = require("bluebird"),
    LeaveDay = require('../leave_day'),
    path = require('path');

module.exports = function(sequelize, DataTypes) {
    var Leave = sequelize.define("Leave", {
        // TODO add validators!
        'status' : {
            type      : DataTypes.INTEGER,
            allowNull : false
        },
        employee_comment : {
            type      : DataTypes.STRING,
            allowNull : true,
        },
        approver_comment : {
            type      : DataTypes.STRING,
            allowNull : true,
        },
        decided_at : {
            type      : DataTypes.DATE,
            allowNull : true,
        },

        date_start : {
            type         : DataTypes.DATE,
            allowNull    : false,
            defaultValue : sequelize.NOW,
        },
        day_part_start : {
            type         : DataTypes.INTEGER,
            allowNull    : false,
            defaultValue : 1, // VPP TODO replace with constant value
        },
        date_end : {
            type         : DataTypes.DATE,
            allowNull    : false,
            defaultValue : sequelize.NOW,
        },
        day_part_end : {
            type         : DataTypes.INTEGER,
            allowNull    : false,
            defaultValue : 1, // VPP TODO replace with constant value
        },
        attachment   : {
            type         : DataTypes.STRING,
            allowNull    : true,
        },
        gevent_id   : {
            type         : DataTypes.STRING,
            allowNull    : true,
        },
        verified : {
            type         : DataTypes.INTEGER,
            allowNull    : false,
            defaultValue : 0, 
        },
        verifiedBy : {
            type         : DataTypes.INTEGER,
            allowNull    : true,
        },
        gevent_error : {
            type      : DataTypes.STRING,
            allowNull : true,
        },
    }, {

      indexes : [
        {
          fields : ['userId'],
        },
        {
          fields : ['leaveTypeId'],
        },
        {
          fields : ['approverId'],
        },
      ],
      classMethods : {
        associate : function( models ){
          Leave.belongsTo(models.User, { as : 'user',foreignKey     : 'userId' });
          Leave.belongsTo(models.User, { as : 'approver',foreignKey : 'approverId' });
          Leave.belongsTo(models.LeaveType, { as : 'leave_type' } );
          Leave.hasMany(models.Comment, {
            as : 'comments',
            foreignKey: 'companyId',
            scope: {
              entityType: models.Comment.getEntityTypeLeave(),
            },
          });
        },

        status_new           : () => 1,
        status_approved      : () => 2,
        status_rejected      : () => 3,
        status_pended_revoke : () => 4,
        status_canceled      : () => 5,

        status_pending_verify      : () => 0,
        status_verified            : () => 1,

        leave_day_part_all       : () => 1,
        leave_day_part_morning   : () => 2,
        leave_day_part_afternoon : () => 3,
      },

      instanceMethods : {

reloadWithAssociates : function() {
  const self = this;

  return self.reload({
    include : [
      {model : self.sequelize.models.User,      as : 'user'},
      {model : self.sequelize.models.User,      as : 'approver'},
      {model : self.sequelize.models.LeaveType, as : 'leave_type'},
    ],
  });
},

get_days : function() {

  var self   = this,
  start_date = moment.utc(this.date_start),
  end_date   = moment.utc(this.date_end),
  days       = [ start_date ];

  if (self.hasOwnProperty('_days')) {
    return self._days;
  }

  if ( ! start_date.isSame( end_date, 'day') ){

      var days_in_between = end_date.diff( start_date, 'days' ) - 1;

      for (var i=1; i<=days_in_between; i++) {
          days.push( start_date.clone().add(i, 'days') );
      }

      days.push( end_date );
  }

  days = _.map(
      days,
      function(day){
          return new LeaveDay({
            leave_type_id : self.leaveTypeId,
            sequelize : sequelize,
            date     : day.format('YYYY-MM-DD'),
            day_part : day.isSame(start_date, 'day')
              ? self.day_part_start
              : day.isSame(end_date, 'day')
              ? self.day_part_end
              : Leave.leave_day_part_all(),
          });
      }
  );

  return self._days = days;
},

fit_with_leave_request : function(leave_request) {

    // If start and end dates are the same, check if one of them fit
    // into fist or last leave_days.
    if (
        leave_request.is_within_one_day() && (
            leave_request.does_fit_with_leave_day( _.last(this.get_days()) )
            ||
            leave_request.does_fit_with_leave_day( _.first(this.get_days()) )
        )
      ) {
        return true;
    }

    // If start and end dates are different, check if start date
    // fits into end leave_day or end date fits int start leave_date.
    if (
        (! leave_request.is_within_one_day()) && (
            leave_request.does_fit_with_leave_day_at_start(
                 _.last(this.get_days())
            )
            ||
            leave_request.does_fit_with_leave_day_at_end(
                 _.first(this.get_days())
            )
        )
    ) {
        return true;
    }

    return false;
}, // End of fit_with_leave_request

is_new_leave : function() {
    return this.status === Leave.status_new();
},

is_pended_revoke_leave : function(){
  return this.status === Leave.status_pended_revoke();
},

is_cancelled_or_rejected_leave : function(){
  return this.status === Leave.status_canceled() ||
    this.status === Leave.status_rejected() ;
},

get_leave_status : function(){
  var status_str = "";
  if(this.status === Leave.status_rejected())
  {
    status_str = "Rejected";
  }
  else if(this.status === Leave.status_canceled()) 
  {
    status_str = "Cancelled";
  }
  else if(this.status === Leave.status_approved() || this.status === Leave.status_pended_revoke()) 
  {
    status_str = "Approved";
  }
  else if(this.status === Leave.status_new())
  { 
    if(this.get_leave_type_missing_attachment())
      status_str = "Incomplete";
    else
      status_str = "Pending";  
  }
  return status_str;
},

// Leave is treated as "approved" one if it is in approved staus
// or if it is waiting decision on revoke action
//
is_approved_leave : function() {
  return this.status === Leave.status_approved() ||
    this.status === Leave.status_pended_revoke() ;
},

is_approved_or_rejected : function() {
  return this.status === Leave.status_approved() ||
    this.status === Leave.status_pended_revoke() ||
    this.status === Leave.status_rejected();
},

// Determine if leave starts with half day in the morning
//
does_start_half_morning : function() {
  return this.day_part_start === Leave.leave_day_part_morning();
},

does_start_half_afternoon : function() {
  return this.day_part_start === Leave.leave_day_part_afternoon();
},

// Determine if leave ends with half a day in the afternoon
//
does_end_half_afternoon : function() {
  return this.day_part_end === Leave.leave_day_part_afternoon();
},

does_end_half_morning : function() {
  return this.day_part_end === Leave.leave_day_part_morning();
},

get_start_leave_day : function(){
    return this.get_days()[0];
},

get_end_leave_day : function(){
    return this.get_days()[ this.get_days().length - 1 ];
},

get_deducted_days_number_ignore_allowance : function() {
  return this.get_deducted_days_number({ignore_allowance:true});
},

get_deducted_days_number : function(args) {
  var ignore_cancelled = false;
  var number_of_days = this.get_deducted_days(args).length;

  if (args && args.hasOwnProperty('ignore_cancelled')) {
    ignore_cancelled = args.ignore_cancelled;
  }

  // leave spans via on working day only, pay attention only to the start date
  if (number_of_days === 1 && !this.get_start_leave_day().is_all_day_leave()) {
    number_of_days = number_of_days - 0.5;
  }

  // case when leave spreads for more then one day, then check if both start and day
  // are halfs
  else if (number_of_days > 1) {
    if ( ! this.get_start_leave_day().is_all_day_leave() ){
      number_of_days = number_of_days - 0.5;
    }
    if ( ! this.get_end_leave_day().is_all_day_leave() ) {
      number_of_days = number_of_days - 0.5;
    }
  }

  if(ignore_cancelled && (this.status === Leave.status_canceled() || this.status === Leave.status_rejected()))
      number_of_days = 0;

  return number_of_days;
},

get_deducted_days : function(args) {
  var leave_days = [],
    ignore_allowance = false,
    include_weekend_and_hols = false,
    leave_type = this.leave_type || args.leave_type,
    year;

  if (args && args.hasOwnProperty('ignore_allowance')) {
    ignore_allowance = args.ignore_allowance;
  }

  if (args && args.hasOwnProperty('year')) {
    year = moment.utc(args.year, 'YYYY');
  }

  if (leave_type.is_include_weekend_and_hols == 1) {
    include_weekend_and_hols = true;
  }
  
  // If current Leave stands for type that does not use
  // allowance, ignore rest of the code;
  if (!ignore_allowance && !leave_type.use_allowance) return leave_days;


  var user = this.user || this.approver || args.user;

  var bank_holiday_map = {};

  user.company.bank_holidays.forEach(function(bank_holiday){
    bank_holiday_map[ bank_holiday.get_pretty_date() ] = 1;
  });

  // Because we currently in synchronos code we have to rely on cahed value
  // rather then fetching it here, and prey that whoever called current
  // method made sure that the cach is populated
  var schedule = user.cached_schedule;

  leave_days = _.filter(
    _.map(this.get_days(), function(leave_day){

      // Ignore bank holidays
      if ( (leave_type.is_adjustment==0 && include_weekend_and_hols==false) && bank_holiday_map[ leave_day.get_pretty_date() ] ) return;

      // If it happenned that current leave day is from the year current
      // call was made of, ignore that day
      if (year && year.year() !== moment.utc(leave_day.date).year()) return;

      // Ignore non-working days (weekends)
      if ( (leave_type.is_adjustment==0 && include_weekend_and_hols==false) && ! schedule.is_it_working_day({ day : moment.utc(leave_day.date) }) ){
        return;
      }
      
      return leave_day;
    }),
    function(leave_day){
      return !! leave_day;
    }
  ) || [];

  return leave_days;
}, // End get_deducted_days

get_employee_comment : function() {
  if (!this.employee_comment) {
    return '';
  } else {
    return this.employee_comment;
  }
},

get_approver_comment : function() {
  if (!this.approver_comment) {
    return '';
  } else {
    return this.approver_comment;
  }
},

promise_to_reject : function(args) {
  let self = this;

  if ( ! args ) {
    args = {};
  }

  if ( ! args.by_user ) {
    throw new Error('promise_to_reject has to have by_user parameter');
  }

  let by_user = args.by_user;
  let comment = args.comment || "";

  // See explanation to promise_to_approve
  self.status = self.is_pended_revoke_leave() ?
    Leave.status_approved():
    Leave.status_rejected();

  self.approverId = by_user.id;
  self.approver_comment = comment;

  return self.save();
},

promise_to_approve : function(args) {
  let self = this;

  if ( ! args ) {
    args = {};
  }

  if ( ! args.by_user ) {
    throw new Error('promise_to_approve has to have by_user parameter');
  }

  let by_user = args.by_user;

  // If current leave is one with requested revoke, then
  // approve action set it into Rejected status
  // otherwise it is approve action for new leave
  // so put leave into Approved
  self.status = self.is_pended_revoke_leave() ?
    Leave.status_rejected():
    Leave.status_approved();

  self.approverId = by_user.id;

  return self.save();
},

promise_to_revoke : function(){
  let self = this;

  return self.getUser({
      include : [
        {
          model : sequelize.models.Department,
          as    : 'department',
        }
      ],
    })
    .then(function(user){

      var new_leave_status = user.is_auto_approve()
        ? Leave.status_rejected()
        : Leave.status_pended_revoke();

      // By default it is user main boss is one who has to approve the revoked request
      self.approverId = user.department.bossId;

      self.status = new_leave_status;

      return self.save();
    });
},

promise_to_cancel : function(){
  var self = this;

  if ( ! self.is_new_leave() ) {
    throw new Error('An attempt to cancel non-new leave request id : '+self.id);
  }

  self.status = Leave.status_canceled();

  return self.save();
},


promise_geventid : function(geventid) {
  var self = this;

  self.gevent_id  = geventid;
  self.gevent_error  = null;

  return self.save();
},

promise_gevent_failed : function(errstr) {
  var self = this;

  self.gevent_error = errstr;

  return self.save();
},

get_leave_type_name : function() {
  var leave_type = this.get('leave_type');

  if (! leave_type ) {
    return '';
  } else {
    return leave_type.name;
  }
},

leave_is_adjustment : function() {
  var leave_type = this.get('leave_type');

  if (! leave_type ) {
    return 0;
  } else {
    return (leave_type.is_adjustment==1?1:0);
  }
},

get_leave_type_adjustment : function() {
  var leave_type = this.get('leave_type');

  if (! leave_type ) {
    return 0;
  } else {
    return leave_type.is_adjustment;
  }
},

get_leave_type_missing_attachment : function() {
  var leave_type = this.get('leave_type');

  if (! leave_type ) {
    return 0;
  } else {
    return (leave_type.attachment_req==1 && !this.attachment?1:0);
  }
},

get_leave_type_attachment_is_image : function() {
  var self = this;
  if((self.attachment != null)&&(path.extname(self.attachment).toUpperCase() == '.JPG' || path.extname(self.attachment).toUpperCase() == '.PNG' || path.extname(self.attachment).toUpperCase() == '.JPEG')){
    return 1;
  }else{
    return 0;
  }
},

get_leave_type_attachment_is_pdf : function() {
  var self = this;
  if((self.attachment != null)&&(path.extname(self.attachment).toUpperCase() == '.PDF')){
    return 1;
  }else{
    return 0;
  }
},

get_leave_type_attachment_req : function(flag) {
  var leave_type = this.get('leave_type');
  if (! leave_type ) {
    return 0;
  } else {
    return (leave_type.attachment_req==1 || this.attachment?1:0);
  }
},

get_leave_type_attachment_can_approve : function(flag) {
  var leave_type = this.get('leave_type');
  if (! leave_type ) {
    return 0;
  } else {
    return (leave_type.attachment_req!=1 || (leave_type.attachment_req==1 && this.attachment)?1:0);
  }
},

promise_to_upload : function(path) {
  var self = this;
  if (path) self.attachment = path;
  return self.save();
},

promise_approver : function() {

  return this.getApprover({
    include : [{
      model : sequelize.models.Company,
      as : 'company',
      include : [{
        model : sequelize.models.BankHoliday,
        as : 'bank_holidays',
      }],
    }],
  })
},



        },
    });

    return Leave;
};
