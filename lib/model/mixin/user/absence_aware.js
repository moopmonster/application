
/*
 * Mixin that inject to user model object consumer set of methods necessary for
 * dealing with absences.
 *
 * */

'use strict';

var
  _                   = require('underscore'),
  Promise             = require("bluebird"),
  CalendarMonth       = require('../../calendar_month'),
  LeaveCollectionUtil = require('../../leave_collection')(),
  moment              = require('moment'),
  helpers             = require('../../../view/helpers')();
  // createNewLeave      = require('../../leave').createNewLeave,

module.exports = function(sequelize){

  this._get_calendar_months_to_show = function(args){
    var
      self           = this,
      year           = args.year,
      show_full_year = args.show_full_year;

    if (show_full_year) {
      return _.map([1,2,3,4,5,6,7,8,9,10,11,12], function(i){
        return moment.utc(year.format('YYYY')+'-'+i+'-01');
      });
    }

    return _.map([0,1,2,3], function(delta){
      return self.company.get_today().add(delta, 'months').startOf('month');
    })
  };

  this._get_years_of_service = function() {
    var self = this;
    return self.company.get_today().diff( self.start_date, 'years' );
  };

  this._get_sick_leave_limit = function() {
    var self = this;
    var YOS = self._get_years_of_service();
    return (YOS<2?14:(YOS>5?22:18));
  };

  this.promise_calendar = function(args) {
    var
      this_user      = this,
      year           = args.year || this_user.company.get_today(),
      show_full_year = args.show_full_year || false,
      model          = sequelize.models,
      // Find out if we need to show multi year calendar
      is_multi_year = this_user.company.get_today().month() > 8;

    var months_to_show = this_user._get_calendar_months_to_show({
      year           : year.clone(),
      show_full_year : show_full_year
    });

    return Promise.join(

      Promise.try(() => this_user.getDepartment()),

      Promise.try(() => this_user.getCompany({
        scope : ['with_bank_holidays', 'with_leave_types']
      })),

      Promise.try(function(){
        return this_user.getMy_leaves({
          where : {
            $and : [
              { status : { $ne : sequelize.models.Leave.status_rejected() } },
              { status : { $ne : sequelize.models.Leave.status_canceled() } },
            ],
            $or : {
              date_start : {
                $between : [
                  moment.utc(year).startOf('year').format('YYYY-MM-DD'),
                  moment.utc(
                    year.clone().add((is_multi_year ? 1 : 0), 'years')
                  ).endOf('year').format('YYYY-MM-DD HH:mm'),
                ]
              },
              date_end : {
                $between : [
                  moment.utc( year ).startOf('year').format('YYYY-MM-DD'),
                  moment.utc(
                    year.clone().add((is_multi_year ? 1 : 0), 'years')
                  ).endOf('year').format('YYYY-MM-DD HH:mm'),
                ]
              }
            }
          },
        });
      }),

      Promise.try(() => this_user.promise_schedule_I_obey()),

      function(department, company, leaves, schedule){
        var leave_days = _.flatten( _.map(leaves, function(leave){
          return _.map( leave.get_days(), function(leave_day){
            leave_day.leave = leave;
            return leave_day;
          });
        }));

        return Promise.resolve(
          _.map(months_to_show, function(month){
            return new CalendarMonth(
              month,
              {
                bank_holidays :
                  department.include_public_holidays
                    ? company.bank_holidays
                    : [],
                leave_days : leave_days,
                schedule   : schedule,
                today      : company.get_today(),
                leave_types: company.leave_types,
              }
            );
          })
        );
      }

    ); // End of join
  };


  this.validate_overlapping = function(new_leave_attributes) {
    var this_user = this;

    var days_filter = {
      $between : [
        new_leave_attributes.from_date,
        moment.utc(new_leave_attributes.to_date)
          .add(1,'days').format('YYYY-MM-DD'),
      ],
    };

    return this_user.getMy_leaves({
      include : [{
        model : sequelize.models.LeaveType,
        as    : 'leave_type',
      }],
      where : {
        $and : [
          { status : { $ne : sequelize.models.Leave.status_pended_revoke() } },
          { status : { $ne : sequelize.models.Leave.status_rejected() } },
          { status : { $ne : sequelize.models.Leave.status_canceled() } },
          {'$leave_type.is_adjustment$': [0] }, 
          {'$leave_type.leaveTypeCode$': { $ne: 'OTHERS'} },
        ],
        $or : {
          date_start : days_filter,
          date_end : days_filter,
        },
      },
    })

    .then(function(overlapping_leaves){

      if(new_leave_attributes.is_adjustment > 0 && new_leave_attributes.by_user.is_admin() == 0 )
      {
        var error = new Error('Only HR may initiate leave adjustment. Kindly send an e-mail to HR and your manager for leave adjustment compensation. ');
        error.user_message = 'Only HR may initiate leave adjustment. Kindly send an e-mail to HR and your manager for leave adjustment compensation. ';
        throw error;
      }

      // Check there are overlapping leaves
      if (overlapping_leaves.length === 0 || new_leave_attributes.is_adjustment > 0){
          return Promise.resolve(1);
      }

      var overlapping_leave = overlapping_leaves[0];

      if (overlapping_leave.fit_with_leave_request(
            new_leave_attributes
      )){
          return Promise.resolve(1);
      }

      // Otherwise it is overlapping!
      var error = new Error('Overlapping booking!');
      error.user_message = 'Overlapping booking!';
      throw error;

    });
  }; // end of validate_overlapping


  // Promise all leaves requested by current user, regardless
  // their statuses
  //
  this.promise_my_leaves = function(args){

    var self         = this,
        where_clause = {},
        leaveType_where_clause = {},
        // Time zone does not really matter here, although there could be issues
        // around New Year (but we can tolerate that)
        year         = args.year || moment.utc();

    if (args && args.filter_status) {
      where_clause = { status : args.filter_status };
    }

    if (args && args.filter_leaveCode && args.filter_leaveCode != '') {
      leaveType_where_clause = { leaveTypeCode : args.filter_leaveCode };
    }

    if (args && ! args.ignore_year) {
      where_clause['$or'] = {
        date_start : {
          $between : [
            moment.utc(year).startOf('year').format('YYYY-MM-DD'),
            moment.utc(year).endOf('year').format('YYYY-MM-DD HH:mm'),
          ]
        },
        date_end : {
          $between : [
            moment.utc(year).startOf('year').format('YYYY-MM-DD'),
            moment.utc(year).endOf('year').format('YYYY-MM-DD HH:mm'),
          ]
        }
      };
    }
    
    var promise_my_leaves = this.getMy_leaves({
      // TODO here is cartesian product between leave types and users,
      // needs to be split
      include : [{
        where : leaveType_where_clause,
        model : sequelize.models.LeaveType,
        as    : 'leave_type',
      },{
        model : sequelize.models.User,
        as    : 'user',
        include : [{
          model : sequelize.models.Company,
          as : 'company',
          include : [{
            model : sequelize.models.BankHoliday,
            as : 'bank_holidays',
          }],
        }],
      }],
      where : where_clause,
    })

    // Fetch approvers for each leave in separate query, to avoid cartesian
    // products.
    .then(function(leaves){

      leaves.forEach(function(leave){ leave.user.cached_schedule = self.cached_schedule; });

      return Promise.resolve(leaves)
        .map(
          function(leave){
            return leave.promise_approver()
            .then(function(approver){
              leave.approver = approver;
              return Promise.resolve(leave);
            });
          }, {
            concurrency : 10,
          }
        );
    })

    .then(leaves => LeaveCollectionUtil.promise_to_sort_leaves(leaves));

    return promise_my_leaves;
  };

  //Return active leave with leavetype Filtered
  this.promise_my_active_leaves_filtered = function(args) {
    var year = args.year || moment.utc();
    var leavetype = args.leavetype || '';

    return this.promise_my_leaves({
      year          : year,
      filter_status : [
        sequelize.models.Leave.status_approved(),
      ],
      filter_leaveCode    : leavetype,
    })
    .then(leaves => LeaveCollectionUtil.promise_to_sort_leaves(leaves));
  };


  this.promise_my_active_leaves = function(args) {
    var year = args.year || moment.utc();

    return this.promise_my_leaves({
      year          : year,
      filter_status : [
        sequelize.models.Leave.status_approved(),
        sequelize.models.Leave.status_new(),
        sequelize.models.Leave.status_pended_revoke(),
      ],
    })
    .then(leaves => LeaveCollectionUtil.promise_to_sort_leaves(leaves));
  };

  // Promises leaves ever booked for current user
  this.promise_my_active_leaves_ever = function() {

    return this.promise_my_leaves({
      ignore_year : true,
      filter_status : [
        sequelize.models.Leave.status_approved(),
        sequelize.models.Leave.status_new(),
        sequelize.models.Leave.status_pended_revoke(),
        sequelize.models.Leave.status_rejected(),
        sequelize.models.Leave.status_canceled(),        
      ],
    })
    .then(leaves => LeaveCollectionUtil.promise_to_sort_leaves(leaves));
  };

  //
  this.promise_leaves_to_be_verified = function(){
    let self = this;

    return self
      .promise_supervised_users()
      .then(users => {
        var users_list =  _.map(users,user => user.id);
        return sequelize.models.Leave.findAll({
          include : [{
            model : sequelize.models.LeaveType,
            as    : 'leave_type',
          },{
            model : sequelize.models.User,
            as    : 'approver',            
          },{            
            model : sequelize.models.User,
            as    : 'user',
            include : [{
              model : sequelize.models.Company,
              as : 'company',
              include : [{
                model : sequelize.models.BankHoliday,
                as    : 'bank_holidays',
              }],
            },{
              model : sequelize.models.Department,
              as    : 'department',
            }],
          }],
          where : {
            // $or : [
            //   {
            //     status : [
            //         sequelize.models.Leave.status_approved(),
            //     ],
            //     verified : 0,
            //     '$leave_type.attachment_req$': [1,2],
            //     attachment: {$not: 'NULL'} ,
            //   },
            //   {
            //     status : [
            //         sequelize.models.Leave.status_approved(),
            //     ],
            //     verified : 0,
            //     '$leave_type.LeaveTypeCode$': 'OTHERS',
            //   }
            // ]
            userId  : users_list,
            status : [
                sequelize.models.Leave.status_approved(),
            ],
            verified : 0,
            $or : [
              { 
                '$leave_type.LeaveTypeCode$': {$not: 'ANNUAL'}
              },
              {
                '$leave_type.LeaveTypeCode$': {$eq: null} // Because LeaveTypeCode = NULL will not include in the result of LeaveTypeCode != Annual
              }
            ]
          },
        })
      })
      .then( leaves => Promise
        .resolve(leaves)
        .map(
          leave => leave.user.promise_schedule_I_obey(),
          { concurrency : 10 }
        )
        .then( () => Promise.resolve(leaves) )
        .then(leaves => LeaveCollectionUtil.promise_to_sort_leaves(leaves))
      );
  }; // END of promise_leaves_to_be_processed

  // Promise leaves that are needed to be Approved/Rejected
  //
  this.promise_leaves_with_attachments = function(reqid){
    let self = this;

    return self
      .promise_supervised_users()
      .then(users => {
        var users_list =  _.map(users,user => user.id);
        if (!users_list.length > 0){
          users_list = [self.id];
        }

        return sequelize.models.Leave.findAll({
          include : [{
            model : sequelize.models.LeaveType,
            as    : 'leave_type',
          },{
            model : sequelize.models.User,
            as    : 'user',
            include : [{
              model : sequelize.models.Company,
              as : 'company',
              include : [{
                model : sequelize.models.BankHoliday,
                as    : 'bank_holidays',
              }],
            },{
              model : sequelize.models.Department,
              as    : 'department',
            }],
          }],
          where : {
            userId  : users_list,
            id : reqid,
            '$Leave.attachment$': {$not: 'NULL'}
          },
        })
      })
      .then( leaves => Promise
        .resolve(leaves)
        .map(
          leave => leave.user.promise_schedule_I_obey(),
          { concurrency : 10 }
        )
        .then( () => Promise.resolve(leaves) )
        .then(leaves => LeaveCollectionUtil.promise_to_sort_leaves(leaves))
      );
  }; // END of promise_leaves_to_be_processed


  // Promise leaves that are needed to be Approved/Rejected
  //
  this.promise_leaves_to_be_processed = function(){
    let self = this;

    return self
      .promise_supervised_users()
      .then(users => {
        return sequelize.models.Leave.findAll({
          include : [{
            model : sequelize.models.LeaveType,
            as    : 'leave_type',
          },{
            model : sequelize.models.User,
            as    : 'user',
            include : [{
              model : sequelize.models.Company,
              as : 'company',
              include : [{
                model : sequelize.models.BankHoliday,
                as    : 'bank_holidays',
              }],
            },{
              model : sequelize.models.Department,
              as    : 'department',
            }],
          }],
          where : {
            status : [
              sequelize.models.Leave.status_new(),
              sequelize.models.Leave.status_pended_revoke(),
            ],
            userId : users.map(u => u.id==self.id?null:u.id)/*,
            $or: [ {'$leave_type.attachment_req$': [0,2] },
                    { $and: [ 
                       {'$leave_type.attachment_req$': [1] },  
                       {'$Leave.attachment$': {$not: 'NULL'} },
                    ]}
                  ],*/
          },
        })
      })
      .then( leaves => Promise
        .resolve(leaves)
        .map(
          leave => leave.user.promise_schedule_I_obey(),
          { concurrency : 10 }
        )
        .then( () => Promise.resolve(leaves) )
        .then(leaves => LeaveCollectionUtil.promise_to_sort_leaves(leaves))
      );
  }; // END of promise_leaves_to_be_processed

  this.promise_cancelable_leaves = function(){
    var self = this;

    return self.promise_my_leaves({
      ignore_year : true,
      filter_status : [ sequelize.models.Leave.status_new() ],
    })
    .then(function(leaves){
      return Promise.map(leaves, function(leave){
        return leave.user.promise_schedule_I_obey();
      },{
        concurrency : 10,
      })
      .then(function(){ return Promise.resolve(leaves) })
      .then(leaves => LeaveCollectionUtil.promise_to_sort_leaves(leaves));
    });
  };

  this.verify_leaves = function(verify_one,verify_list,byId){
    var self = this;
    var sql = "update Leaves set verified = 1, verifiedBy = " + byId + " where id "; 

    if (verify_one != "")
      sql += " = " + verify_one;
    else if (verify_list != "")
      sql += " in (" + verify_list + ")";        

    return sequelize.query( sql ).spread((results, metadata) => {
    }).catch((error) => {throw error;} );
  };

  this.calculate_number_of_days_taken_from_allowance = function(args){
    var self = this,
        leave_type = args ? args.leave_type : null,
        leaves_to_traverse = this.my_leaves || [];


    leaves_to_traverse.forEach(function(leave){ leave.user.cached_schedule = self.cached_schedule; });

    // If leave_type was provided, we care only about leaves of that type
    if (leave_type) {
      leaves_to_traverse = _.filter(
        leaves_to_traverse,
        function(leave){ return leave.leaveTypeId === leave_type.id; }
      );
    }

    return _.reduce(
      _.map(
        _.filter(
          leaves_to_traverse,
          function (leave){ return leave.is_approved_leave(); }
        ),
        function(leave){ return leave.get_deducted_days_number(args); }
      ),
      function(memo, num){ return memo + num },
      0
    ) || 0;
  };


  // Based on leaves attached to the current user object,
  // the method does not perform any additional queries
  //
  this.get_leave_statistics_by_types = function(args){

    if (! args ) args = {};

    var 
      sick_leave_limit = this.calculated_sickleaves;

    var statistics = {},
      limit_by_top = args.limit_by_top || false;

    this.company.leave_types.forEach(function(leave_type){
      var initial_stat = {
        leave_type : leave_type,
        days_taken : 0,
      };

      var lt_limit = (leave_type.leaveTypeCode=="SICK"&&sick_leave_limit > 0?sick_leave_limit:leave_type.limit);

      if (lt_limit && lt_limit > 0) {
        initial_stat.limit = lt_limit;
      }
      statistics[leave_type.id] = initial_stat;
    });

    // Calculate statistics as an object
    _.filter(
      this.my_leaves,
      function (leave){ return leave.is_approved_leave() }
    )
    .forEach(
      function(leave){

        var stat_obj = statistics[leave.leave_type.id];

        stat_obj.days_taken = stat_obj.days_taken + leave.get_deducted_days_number({
          ignore_allowance : true,
        });
      }
    );

    var statistic_arr = _.map(
      _.pairs(statistics),
      function(pair){
        return pair[1];
      }
    );

    statistic_arr = _.sortBy(
        statistic_arr,
        'days_taken'
      )
      .reverse();


    if (limit_by_top) {
      statistic_arr = _.first(statistic_arr, 4);
    }

    return _.sortBy(statistic_arr, function(rec){ return rec.leave_type.sort_order; });
  },


  this.promise_adjustment_and_carry_over_for_year = function(year){
    let self = this;

    year = year || moment.utc();
    year = moment.utc(year).format('YYYY');

    return self
      .getAdjustments({
        where : { year : year }
      })
      .then(adjustment_records => {

        // By default there is not adjustments
        let result = {
          adjustment : 0,
          carried_over_allowance : 0,
          initial_adjustment : 0,
          remarks : ''
        };

        if (adjustment_records.length === 1) {
          result.adjustment = adjustment_records[0].adjustment;
          result.carried_over_allowance = adjustment_records[0].carried_over_allowance;
          result.initial_adjustment = adjustment_records[0].initial_adjustment;
          result.remarks = adjustment_records[0].remarks
        }

        return Promise.resolve(result);
      });
  };

  this.promise_initial_adjustmet_for_year = function(year){
    let self = this;

    return self
      .promise_adjustment_and_carry_over_for_year(year)
      .then(combined_record => Promise.resolve(combined_record.initial_adjustment));
  };

  this.promise_initial_adjustmet_remarks_for_year = function(year){
    let self = this;

    return self
      .promise_adjustment_and_carry_over_for_year(year)
      .then(combined_record => Promise.resolve(combined_record.remarks));
  };

  this.promise_adjustmet_for_year = function(year){
    let self = this;

    return self
      .promise_adjustment_and_carry_over_for_year(year)
      .then(combined_record => Promise.resolve(combined_record.adjustment));
  };

  this.promise_carried_over_allowance_for_year = function(year){
    let self = this;

    return self
      .promise_adjustment_and_carry_over_for_year(year)
      .then(combined_record => Promise.resolve(combined_record.carried_over_allowance));
  };

  this.promise_to_add_adjustment = function(args) {
    let
        self       = this,
        employee   = args.employee,
        user_id    = args.user_id,
        leave_type = args.leave_type,
        leave      = args.leave,
        year       = args.year || moment.utc(args.date_start).format("YYYY");

     let deducted_days_ignore_allowance =  leave.get_deducted_days_number({
         year       : year,
         user       : employee,
         leave_type : leave_type,
         ignore_allowance : true,
       });

    let add_days = deducted_days_ignore_allowance * (leave_type.is_adjustment==2?-1:1);            

    // Update related allowance adjustement record
    return sequelize.models.UserAllowanceAdjustment
      .findOrCreate({
        where : {
          user_id : user_id,
          year    : year,
        },
        defaults : { adjustment : add_days },
      })
      .spread((record, created) => {

        if ( created ) {
          return Promise.resolve();
        }

        record.increment( {adjustment: add_days});

        return record.save();
      });
  };

  this.promise_to_update_adjustment = function(args) {
    let
      self = this,
      year = args.year || moment.utc().format('YYYY'),
      adjustment = args.adjustment;

    // Update related allowance adjustement record
    return sequelize.models.UserAllowanceAdjustment
      .findOrCreate({
        where : {
          user_id : self.id,
          year    : year,
        },
        defaults : { adjustment : adjustment },
      })
      .spread((record, created) => {

        if ( created ) {
          return Promise.resolve();
        }

        record.set('adjustment', adjustment);

        return record.save();
      });
  };

  this.promise_to_update_carried_over_allowance = function(args) {
    let
      self = this,
      year = args.year || moment.utc().format('YYYY'),
      carried_over_allowance = args.carried_over_allowance;

    // Update related allowance adjustement record
    return sequelize.models.UserAllowanceAdjustment
      .findOrCreate({
        where : {
          user_id : self.id,
          year    : year,
        },
        defaults : { carried_over_allowance : carried_over_allowance },
      })
      .spread((record, created) => {

        if ( created ) {
          return Promise.resolve();
        }

        record.set('carried_over_allowance', carried_over_allowance);

        return record.save();
      });
  };

  this.promise_to_intitial_adjustment_and_remarks = function(args) {
    let
      self = this,
      year = args.year || moment.utc().format('YYYY'),
      initial_adjustment = args.initial_adjustment,
      remarks = args.remarks;

    return sequelize.models.UserAllowanceAdjustment
      .findOrCreate({
        where : {
          user_id : self.id,
          year    : year,
        },
        defaults : { 
            initial_adjustment : initial_adjustment,
            remarks            : remarks
        },
      })
      .spread((record, created) => {

        if ( created ) {
          return Promise.resolve();
        }

        record.set('initial_adjustment', initial_adjustment);
        record.set('remarks', remarks);


        return record.save();
      });
  };


  this.promise_my_leaves_for_calendar = function(args){
    var year = args.year || this.company.get_today();

    return this.getMy_leaves({
      where : {

        $and : [
          { status : { $ne : sequelize.models.Leave.status_rejected() } },
          { status : { $ne : sequelize.models.Leave.status_canceled() } },
        ],

        $or : {
          date_start : {
            $between : [
              moment.utc(year).startOf('year').format('YYYY-MM-DD'),
              moment.utc(year).endOf('year').format('YYYY-MM-DD HH:mm'),
            ]
          },
          date_end : {
            $between : [
              moment.utc(year).startOf('year').format('YYYY-MM-DD'),
              moment.utc(year).endOf('year').format('YYYY-MM-DD HH:mm'),
            ]
          }
        }
      },
    }); // End of MyLeaves
  };

  // For given leave object (not necessary one with corresponding record in DB)
  // check if current user is capable to have it, that is if user's remaining
  // vacation allowance is big enough to accommodate the leave.
  //
  // If validation fails an exceptionis thrown.
  //
  this.validate_leave_fits_into_remaining_allowance = function(args){
    var self   = this,
    leave_type = args.leave_type,
    leave      = args.leave,
    // Derive year from Leave object
    year       = args.year || moment.utc(leave.date_start);

    // Make sure object contain all necessary data for that check
    return self.reload_with_leave_details({
      year : year.clone(),
    })
    .then( employee => employee.reload_with_session_details() )
    .then(employee => employee.company.reload_with_bank_holidays()
      .then(() => Promise.resolve(employee))
    )
    .then(employee =>
      employee.promise_allowance({year})
      .then(allowance_obj => Promise.resolve([allowance_obj.number_of_days_available_in_allowance, employee]))
    )
    .then(function(args){
      let days_remaining_in_allowance = args[0],
        employee = args[1];

      let deducted_days =  leave.get_deducted_days_number({
          year       : year.format('YYYY'),
          user       : employee,
          leave_type : leave_type,
        });

      let deducted_days_ignore_allowance =  leave.get_deducted_days_number({
          year       : year.format('YYYY'),
          user       : employee,
          leave_type : leave_type,
          ignore_allowance : true,
        });
      
      // check for 0 leave deduction. That means nothing will be deducted from allowance
      if( deducted_days == 0 && deducted_days_ignore_allowance == 0)
      {
          var error = new Error(deducted_days + ' working days detected!');
          error.user_message = deducted_days + ' working days detected!';
          throw error;
      }

      // Throw an exception when less than zero vacation would remain
      // if we add currently requested absence
      if (
        days_remaining_in_allowance - deducted_days < 0
      ) {

        var error = new Error('Requested absence is longer than remaining allowance');
        error.user_message = error.toString();
        throw error;
      }

      return Promise.resolve(employee);
    })

    // Check that adding new leave of this type will not exceed maximum limit of
    // that type (if it is defined)
    .then(function(employee){

      var sickleave_limit = self.calculated_sickleaves,
          lt_limit = (leave_type.leaveTypeCode=="SICK"&&sickleave_limit > 0?sickleave_limit:leave_type.limit);

      if (
        // There is a limit for current type
        lt_limit
        // ... and lemit is bigger than zero
        && lt_limit > 0
      ) {

        // ... sum of used dayes for this limit is going to be bigger then limit
        var would_be_used = employee.calculate_number_of_days_taken_from_allowance({
            year             : year.format('YYYY'),
            leave_type       : leave_type,
            ignore_allowance : true,
          })
            +
          leave.get_deducted_days_number({
            year             : year.format('YYYY'),
            user             : employee,
            leave_type       : leave_type,
            ignore_allowance : true,
          });

        if (would_be_used > lt_limit) {

          var error = new Error('Adding requested '+leave_type.name
            +" absence would exceed maximum allowed for such type by "
            +(would_be_used - lt_limit)
          );

          error.user_message = error.toString();
          throw error;
        }
      }

      return Promise.resolve();
    });
  };

  this.promise_to_add_Annual_Leave = function(args){
    let
      self = this,
      remarks = args.remarks,
      date =  moment(args.date, "DD/MM/YYYY"), 
      employee = args.employee,
      companyid = args.companyid,
      user = args.requested;
    var
      CreditDate = helpers.as_datetime_from_timestamp(date,user);

      CreditDate = moment(CreditDate,"DD/MM/YYYY HH:mm Z").format("YYYY-MM-DD");

      return sequelize.models.LeaveType.promise_getLeaveTypeID({
        leaveTypeCode   : 'ADDANNUAL',
        companyid       : companyid
      })
      .then(function(LeaveTypeId){

        if (! LeaveTypeId ) throw new Error("Leave Type Id couldn't be found");

        sequelize.models.Leave
        .create({ // remove find and create because the query was too heavy and cause deadlock on db
          // where: { //Don't create new leave record if the date selected in db
          //   $and : [
          //     {userID: employee.id}, 
          //     {date_start: {
          //         $between : [
          //           moment(CreditDate).subtract(1, 'seconds').format("YYYY-MM-DD HH:mm:sss"), //No result return if just enter CreditDate
          //           moment(CreditDate).add(1, 'seconds').format("YYYY-MM-DD HH:mm:sss")
          //         ]
          //       }
          //     },
          //     {date_end: {
          //         $between : [
          //           moment(CreditDate).subtract(1, 'seconds').format("YYYY-MM-DD HH:mm:sss"), //No result return if just enter CreditDate
          //           moment(CreditDate).add(1, 'seconds').format("YYYY-MM-DD HH:mm:sss")
          //         ]
          //       }
          //     },
          //   ]
          // },
          // defaults : {
            userId           : employee.id,
            leaveTypeId      : LeaveTypeId.id,
            status           : sequelize.models.Leave.status_approved(),
            verified         : sequelize.models.Leave.status_verified(),
            verifiedBy       : user.id,
            approverId       : user.id,
            employee_comment : remarks, 
            date_start     : CreditDate,
            date_end       : CreditDate,
            day_part_start : sequelize.models.Leave.leave_day_part_all(),
            day_part_end   : sequelize.models.Leave.leave_day_part_all()
          // },
        }).then(function(CreatedLeave) {

          return sequelize.models.UserAllowanceAdjustment
            .findOrCreate(
                {where: //Insert new record if no user adjustment leave record found in db
                  {
                      $and : [
                        {user_id: employee.id},
                        {year: moment(CreditDate).format("YYYY")}
                      ]
                  },
                  defaults : {
                    year          : moment(CreditDate).format("YYYY"),
                    adjustment    : 0,
                    user_id       : employee.id
                  },
                }
            ) 
          }).then(function(UserAllowanceAdjustment){
            UserAllowanceAdjustment[0].adjustment += 1;
            return UserAllowanceAdjustment[0].save();
          }).catch(err => {
            console.log("Error while credit leave for user "+employee.id+" : "+err);
          })
      });
  };
};

