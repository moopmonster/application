
"use strict";

const
  express   = require('express'),
  router    = express.Router(),
  validator = require('validator'),
  Promise   = require('bluebird'),
  moment    = require('moment'),
  config    = require('../config'),
  TeamView  = require('../model/team_view'),
  Exception = require('../error'),
  csv       = Promise.promisifyAll(require('csv')),
  _         = require('underscore');

// Make sure that current user is authorized to deal with settings
router.all(/.*/, require('../middleware/ensure_user_is_admin'));

router.get('/', (req, res) => {
  res.render('report/index');
});

router.get('/allowanceclosing/', (req,res) => {

  let model = req.app.get('db_model');
  let users_filter = {};

  let start_date = validator.isDate(req.param('start_date'))
    ? moment.utc(req.param('start_date'))
    : req.user.company.get_today();

  let end_date = validator.isDate(req.param('end_date'))
    ? moment.utc(req.param('end_date'))
    : req.user.company.get_today();


  let current_deparment_id = undefined; 

  if (validator.isNumeric( req.param('department') )) {
    users_filter = { DepartmentId : req.param('department') };
    current_deparment_id = req.param('department');
  } else {
    current_deparment_id = undefined;
  }

    req.user.getCompany({
      include : [
        {
          model    : model.User,
          as       : 'users',
          where    : users_filter,
          required : false,
          include : [
            { model : model.Department, as : 'department' },
            // Following is needed to be able to calculate how many days were
            // taken from allowance
            {
              model    : model.Leave,
              as       : 'my_leaves',
              required : false,
              where : {
                // status : model.Leave.status_approved(),
                status : [
                  model.Leave.status_approved(),
                  model.Leave.status_new(),
                  model.Leave.status_pended_revoke(),
                ],
                $or : {
                  date_start : {
                    $between : [
                      start_date.format('YYYY-MM-DD'),
                      end_date.endOf("day").format('YYYY-MM-DD HH:mm'),
                    ]
                  },
                  date_end : {
                    $between : [
                      start_date.format('YYYY-MM-DD'),
                      end_date.endOf("day").format('YYYY-MM-DD HH:mm'),
                    ]
                  }
                }
              },
              include : [{
                    model : model.LeaveType,
                    as    : 'leave_type',
                },
              ] // End of my_leaves include
            }
          ],
        },
      ],
      order : [
        [{ model : model.User, as : 'users' }, 'name'],
        [
          { model : model.User, as : 'users' },
          { model : model.Department, as : 'department'},
          model.Department.default_order_field()
        ],
      ]
    })

    // Make sure that objects have all necessary attributes to render page
    // (template system is sync only)
    .then(function(company){
      return company.getBank_holidays()
        // stick bank holidays to company
        .then(function(bank_holidays){
          company.bank_holidays = bank_holidays;
          return company.getDepartments({
            order : [ model.Department.default_order_field() ],
          });
        })
        // stick departments to company as well
        .then(function(departments){
          company.departments = departments;
          return Promise.resolve(company);
        })
    })

    // Make sure that user's leaves have reference back to user in question
    .then(function(company){
      company.users.forEach(function(user){
        user.company = company;
        user.my_leaves.forEach(function(leave){ leave.user = user });
      });

      return Promise.resolve(company);
    })

    // Update users to have neccessary data for leave calculations
    .then(function(company){
      return Promise.resolve(company.users).map(function(user){
        return user.promise_schedule_I_obey();
      },{
        concurrency : 10,
      })
      .then(function(){ return Promise.resolve(company) });
    })

    /*
     * Following block builds array of object for each user in company.
     * Each object consist of following keys:
     *  - user_row : reference to the sequelize user row object
     *  - number_of_days_available_in_allowance : number of days remaining in allowance for given user
     *
     * This step is necessary because we are moving to non-blocking API for libraries,
     * so we need to get all data before passing it into template as template
     *
     * */

    .then(company => Promise
      .resolve(company.users)
      .map(user => user
        .promise_allowance()
        .then(allowance_obj => Promise.resolve({
          user_row : user,
          number_of_days_available_in_allowance : allowance_obj.number_of_days_available_in_allowance,
          manual_adjustment                     : allowance_obj.manual_adjustment,
          carry_over                            : allowance_obj.carry_over,
          nominal_allowance                     : allowance_obj.nominal_allowance,
        })),
        {
          concurrency : 10
        }
      )
      .then(users_info => Promise.resolve([company, users_info]))
    )

    // We are moving away from passing complex objects into templates
    // for callting complicated methods from within templates
    // Now only basic simple objects to be sent over to tamples,
    // all preparation to be done before rendering.
    //
    // So prepare special rendering datastructure here
    .then(args => promise_user_list_closing_report(args))

    .then(function(args){
      let
        company = args[0],
        users_info = args[1];

      if ( req.param('as-csv') ) {
        return render_allowanceclosing_as_csv({
          users_info : users_info,
          company    : company,
          req        : res,
          res        : res,
          start_date : start_date,
          end_date   : end_date,
          same_month : (start_date.format('YYYYMM') === end_date.format('YYYYMM')),              
        });
      }

      res.render('report/allowanceclosing', {
        company       : company,
        department_id : Number(current_deparment_id),
        users_info    : users_info,
        start_date_str : start_date.format("YYYY-MM-DD"),
        end_date_str   : end_date.format("YYYY-MM-DD"),
        same_month     : (start_date.format('YYYYMM') === end_date.format('YYYYMM')),        
      });

    });


})


function promise_user_list_closing_report(args) {
  let
    company = args[0],
    users_info = args[1];

  let users_info_for_rendering = users_info.map(ui => ({
    user_id                               : ui.user_row.id,
    user_email                            : ui.user_row.email,
    user_name                             : ui.user_row.name,
    user_nickname                         : ui.user_row.nickname,
    user_lastname                         : ui.user_row.lastname,
    user_full_name                        : ui.user_row.full_name(),
    department_id                         : ui.user_row.department.id,
    department_name                       : ui.user_row.department.name,

    number_of_days_available_in_allowance : ui.number_of_days_available_in_allowance,
    number_of_days_taken_from_allowance   : ui.user_row.calculate_number_of_days_taken_from_allowance(),
    manual_adjustment                     : ui.manual_adjustment,
    carry_over                            : ui.carry_over,
    nominal_allowance                     : ui.nominal_allowance,

    user_dtjoin                           : moment(ui.user_row.start_date).format('YYYY-MM-DD'),
    user_dtleave                          : moment(ui.user_row.end_date).format('YYYY-MM-DD'),
    is_resigned                           : (ui.user_row.end_date != null && moment(ui.user_row.end_date).format('YYYY-MM-DD') <  moment.utc().startOf('day').format('YYYY-MM-DD')? 1:0),

  }));

  return Promise.resolve([company, users_info_for_rendering]);
};



router.get('/allowancebytime/', (req, res) => {

  let start_date = validator.isDate(req.param('start_date'))
    ? moment.utc(req.param('start_date'))
    : req.user.company.get_today();

  let end_date = validator.isDate(req.param('end_date'))
    ? moment.utc(req.param('end_date'))
    : req.user.company.get_today();

  var team_view = new TeamView({
    user      : req.user,
    start_date : start_date,
    end_date   : end_date,
  });

  var current_deparment_id  = validator.isNumeric(req.param('department'))
    ? req.param('department')
    : null;

  Promise.join(
    team_view.promise_team_view_details({
      department_id : current_deparment_id,
    }),
    req.user.get_company_with_all_leave_types(),
    (team_view_details, company) => {
      return team_view
        .inject_statistics({
          team_view_details : team_view_details,
          leave_types       : company.leave_types,
        })
        .then(team_view_details => render_allowancebytime({
          req               : req,
          res               : res,
          team_view_details : team_view_details,
          company           : company,
          start_date        : start_date,
          end_date          : end_date,
        }))
    })
    .catch(error => {
      console.error(
        'An error occured when user '+req.user.id+
        ' tried to access /reports/allowancebytime page: '+error
      );

      let
        user_error_message = 'Failed to produce report. Please contact administrator.',

        // By default go back to root report page
        redirect_path = '../';

      if ( error.tom_error ) {
        user_error_message = Exception.extract_user_error_message(error);

        // If it is known error: stay on current page
        redirect_path = './';
      }

      req.session.flash_error(user_error_message);

      return res.redirect_with_session(redirect_path);
    });
});

function render_allowancebytime(args) {
  let
    req               = args.req,
    res               = args.res,
    team_view_details = args.team_view_details,
    company           = args.company,
    start_date        = args.start_date,
    end_date          = args.end_date;

    return Promise
      .try(() => req.param('as-csv')
        ? render_allowancebytime_as_csv(args)
        : res.render('report/allowancebytime', {
          users_and_leaves    : team_view_details.users_and_leaves,
          related_departments : team_view_details.related_departments,
          current_department  : team_view_details.current_department,
          company             : company,
          start_date_str      : start_date.format('YYYY-MM'),
          end_date_str        : end_date.format('YYYY-MM'),
          start_date_obj      : start_date,
          end_date_obj        : end_date,
          same_month          : (start_date.format('YYYYMM') === end_date.format('YYYYMM')),
        })
      );
}

function render_allowancebytime_as_csv(args) {
  let
    req               = args.req,
    res               = args.res,
    team_view_details = args.team_view_details,
    company           = args.company,
    start_date        = args.start_date,
    end_date          = args.end_date;

  // Compose file name
  res.attachment(
    company.name_for_machine()
      + '_employee_allowances_between'
      + start_date.format('YYYY_MM')
      + '_and_'
      + end_date.format('YYYY_MM')
      + '.csv'
  );

  // Compose result CSV header
  let content = [
    ['Email', 'Full Name', 'Nickname', 'Department']
    // Add dynamic list of Leave Types
    .concat(
      team_view_details.users_and_leaves.length > 0
        ? team_view_details.users_and_leaves[0].statistics.leave_type_break_down.pretty_version.map(it => it.name)
        : []
    )
    .concat(['days deducted from allowance'])
  ];

  // ... and body
  team_view_details.users_and_leaves.forEach(ul => {
    if(ul.user.id != 1)
      content.push(
        [
          ul.user.email,
          ul.user.name + ' ' + ul.user.lastname,
          ul.user.nickname,
          ul.department,
        ]
        // Dynamic part of the column list
        .concat( ul.statistics.leave_type_break_down.pretty_version.map(it => it.stat))
        .concat([ul.statistics.deducted_days])
      );
  });

  return csv.stringifyAsync( content )
    .then(csv_data_string => res.send(csv_data_string));
}



function render_allowanceclosing_as_csv(args) {

  let users_info = args.users_info,
      company = args.company,
      req = args.req,
      res = args.res,
      start_date = args.start_date,
      end_date = args.end_date;

  // Compose file name
  res.attachment(
    company.name_for_machine()
      + '_closing_between_'
      + start_date.format('YYYY_MM_DD')
      + '_and_'
      + end_date.endOf("day").format('YYYY_MM_DD_HHmm')
      + '.csv'
  );

  // Compose result CSV header
  let content = [
    ['Nickname', 'Full Name', 'Department', 'Joined date', 'Resigned date',  'Allowance', 'Manual Adjustment', 'Carry Over', 'Days used']
  ];


  // ... and body
  users_info.forEach(ui => {
    content.push([
      ui.user_nickname,
      ui.user_full_name,      
      ui.department_name,

      " "+moment(ui.user_dtjoin).format('YYYY-MM-DD'),
      (ui.is_resigned? "'"+moment(ui.user_dtleave).format('YYYY-MM-DD'): ""),

      ui.nominal_allowance,
      ui.manual_adjustment,
      ui.carry_over,
      ui.number_of_days_taken_from_allowance
    ]);
  });

  return csv.stringifyAsync( content )
    .then(csv_data_string => res.send(csv_data_string));
}



module.exports = router;
