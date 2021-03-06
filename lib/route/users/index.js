
"use strict";

const
  express   = require('express'),
  router    = express.Router(),
  validator = require('validator'),
  Promise   = require('bluebird'),
  moment    = require('moment'),
  _         = require('underscore'),
  uuid      = require('node-uuid'),
  csv       = Promise.promisifyAll(require('csv')),
  fs        = require("fs"),
  formidable          = require('formidable'),
  LeaveCollectionUtil = require('../../model/leave_collection')(),
  Exception           = require('../../error'),
  UserImporter        = require('../../model/user_importer'),
  EmailTransport      = require('../../email'),
  {getAuditCaptureForUser} = require('../../model/audit');

// Make sure that current user is authorized to deal with settings
router.all(/.*/, require('../../middleware/ensure_user_is_admin'));
// router.all(/.*/, require('../../middleware/ensure_user_is_superadmin'));

router.get('/add/:company_id/', function(req, res){

  var company_id = validator.trim(req.param('company_id'));

    req.user
    .get_company_for_add_user(company_id)
    .then(function(company){
      res.render('user_add', {
        company : company,
      });
    });
});

router.post('/add/:company_id/', function(req, res){

  const
    model = req.app.get('db_model'),
    Email = new EmailTransport();

  var company_id = validator.trim(req.param('company_id'));

  let current_company,
    new_user_attributes;

  req.user
  .get_company_for_add_user(company_id)
  .then(function(company){

    current_company = company;

    new_user_attributes = get_and_validate_user_parameters({
      req              : req,
      item_name        : 'user',
      departments      : company.departments,
      // If current company has LDAP auth do not require password
      require_password : (company.ldap_auth_enabled ? false : true ),
    });

    // console.log(new_user_attributes);
    return Promise.resolve();
  })

  // Make sure that we do not add user with existing emails
  .then(() => UserImporter
    .validate_email_to_be_free({ email : new_user_attributes.email })
  )

  // Add new user to database
  .then(() => UserImporter.add_user({
    name          : new_user_attributes.name,
    lastname      : new_user_attributes.lastname,
    nickname      : new_user_attributes.nickname,
    email         : new_user_attributes.email,
    department_id : new_user_attributes.DepartmentId,
    start_date    : new_user_attributes.start_date,
    end_date      : new_user_attributes.end_date,
    admin         : new_user_attributes.admin,
    isManager     : new_user_attributes.isManager,
    auto_approve  : new_user_attributes.auto_approve,
    superadmin    : new_user_attributes.superadmin,
    // company_id    : req.user.companyId,
    company_id    : company_id,
    password      : new_user_attributes.password,
  }))

  .then(new_user => Email.promise_add_new_user_email({
    company    : current_company,
    admin_user : req.user,
    new_user   : new_user,
  }))

  .then(function(){
    if ( req.session.flash_has_errors() ) {
      return res.redirect_with_session('../add/'+company_id+'/');
    } else {
      req.session.flash_message('New user account successfully added');
      return res.redirect_with_session('../');
    }
  })

  .catch(function(error){
    console.log(
      'An error occurred when trying to add new user account by user '+req.user.id
    );
    console.dir(error);

    if ( error && error.tom_error) {
      req.session.flash_error( Exception.extract_user_error_message(error) );
    }

    req.session.flash_error(
      'Failed to add new user'
    );

    return res.redirect_with_session('../add/'+company_id+'/');
  });
});

router.get('/import/:company_id?/', function(req, res){
  var company_id = typeof req.param('company_id') === 'undefined' || req.param('company_id') === null?req.user.companyId:validator.trim(req.param('company_id'));

  if (!req.user.is_supervised_company(company_id)){ // prevent user to hijack the URL parameter
    req.session.flash_error('This company is not under your supervision');
    return res.redirect_with_session('./'+req.user.companyId);
  }

  req.user
    // .getCompany()
    .get_company_for_add_user(company_id)
    .then(company => res.render(
      'users_import', {
        company : company,
      }
    ));
});

router.post('/import/:company_id?/', function(req, res){
  let
    form = new formidable.IncomingForm(),
    model = req.app.get('db_model'),
    parseAsync = Promise.promisify(form.parse),
    company_id = validator.trim(req.param('company_id'));

  if (!req.user.is_supervised_company(company_id)){ // prevent user to hijack the URL parameter
    req.session.flash_error('This company is not under your supervision');
    return res.redirect_with_session('./'+req.user.companyId);
  }

  parseAsync
    .call(form, req)
    .then(args => {

      let files = args[1];

      if (files.users_import.size === 0) {
        Exception.throw_user_error({
          user_error   : 'No .CSV file to restore from was provided',
          system_error : 'User ' + req.user.id + ' tried to import employees '
            + 'without submitting .CSV file',
        });
      } else if ( files.users_import.size > 2097152 ) {
        Exception.throw_user_error({
          user_error   : '.CSV file could not be bigger then 2M',
          system_error : 'User ' + req.user.id + ' tried to submit file bigger then '
            + '2M',
        });
      }

      return fs.readFileAsync(files.users_import.path, "utf8");
    })
    .then(csv_data_string => csv.parseAsync(csv_data_string,{trim:true}))
    .then(parsed_data => {

      // Limit number of employees to be imported at one go
      //
      if (parsed_data.length > 201) {
        Exception.throw_user_error({
          user_error : 'Cannot import more then 200 employees per one go. '
            + 'Please splite .CSV file into chunks of no more then 200 employees '
            + 'and process them each at the time',
          system_error : 'User ' + req.user.id + ' tried to import more then 200 '
            + 'user at one time'
        });
      }

      return UserImporter.add_users_in_bulk({
        to_company_id : company_id,
        bulk_header   : parsed_data.shift(),
        bulk_data     : parsed_data,
      });
    })
    .then(action_result => {
      console.dir(action_result);
      if ( action_result.users.length > 0 ) {
        req.session.flash_message(
          'Successfully imported users with following emails: '
            + action_result.users.map(user => user.email).sort().join(', ')
        );
      }
      if (action_result.errors.length > 0) {
        action_result.errors.forEach(err => req.session.flash_error(
          'Failed to add user ' + err.email + '. Reason: ' + err.error
        ));
      }
      res.redirect_with_session('/users/import/'+company_id+'/');
    })
    .catch(function(error){
      console.error(
        'An error occurred when trying to import users for company'
          + req.user.companyId
          + '. Reason: ' + Exception.extract_system_error_message(error)
      );
      req.session.flash_error(
        'Failed to import users, reason: '
          + Exception.extract_user_error_message(error)
      );
      res.redirect_with_session('/users/import/');
    });
});

router.post('/import-sample/:company_id/', function(req, res){
  let
    company_id = typeof req.param('company_id') === 'undefined' || req.param('company_id') === null?req.user.companyId:validator.trim(req.param('company_id')),
    model = req.app.get('db_model');

  if (!req.user.is_supervised_company(company_id)){ // prevent user to hijack the URL parameter
    req.session.flash_error('This company is not under your supervision');
    return res.redirect_with_session('./'+req.user.companyId);
  }

  model.Company.findOne({
    where   : {id : company_id},
    include : [{
      model : model.User,
      as : 'users',
      where : model.User.get_active_user_filter(),
    },
    { model : model.Department, 
      as : 'departments' }]
  })
  // req.user
    // .getCompany({
    //   scope : ['with_active_users', 'with_simple_departments'],
    // })
    .then(company => {
      res.attachment(
        company.name_for_machine()+'.csv'
      );
      
      let content = company.users.map( user => [
        user.staffId,
        user.email,
        user.lastname,
        user.name,
        user.nickname,
        user.category,
        company.departments.find( dep => dep.id === user.DepartmentId ).name,
        moment(user.start_date).format(company.get_default_date_format()),
        0,0
      ]);

      content.unshift( ['staff ID','email','lastname', 'name', 'nickname','category' , 'department','start date ('+company.get_default_date_format()+')','AL entitlment','Carry Forward'] );

      return csv.stringifyAsync( content );
    })
    .then(csv_data_string => res.send(csv_data_string));

});

router.get('/edit/:user_id/', function(req, res){
  const user_id = validator.trim(req.params['user_id']);

  // Promise.try(function(){
  Promise.resolve(function(){
    ensure_user_id_is_integer({req : req, user_id : user_id});
  })
  .then(function(){
    return req.user.get_company_for_user_details_basic({
      user_id : user_id,
    });
  })
  .then(function(company){
    var employee = company.users[0];

    return employee.promise_schedule_I_obey()
      .then(function(){
        res.render('user_details', {
          company       : company,
          employee      : employee,
          show_main_tab : true,
        });
      });
  })
  // .catch(function(error){
  //   console.error(
  //     'An error occurred when trying to open employee details by user '+req.user.id
  //     + ' : ' + error
  //   );

  //   return res.redirect_with_session('../../');
  // });
});

router.get('/edit/:user_id/absences/', function(req, res){
  let
    user_id = validator.trim(req.params['user_id']),
    user_allowance;
    
    let cur_year = moment(req.user.company.get_today()).format("YYYY");

  Promise

  .try( () => ensure_user_id_is_integer({req : req, user_id : user_id}) )
  .then(() => req.user.get_company_for_user_details_basic({ user_id : user_id }) )
  .then(function(company){
    let employee = company.users[0];
    return employee.reload_with_session_details();
  })
  .then( employee => employee.reload_with_leave_details({}))
  .then(employee => Promise.join(

    employee
      .promise_allowance()
      .then( allowance_obj => Promise.resolve([user_allowance = allowance_obj, employee]) ),

    employee
      .promise_adjustmet_for_year(cur_year),

    employee
      .promise_carried_over_allowance_for_year(cur_year),

    employee
      .promise_initial_adjustmet_for_year(cur_year),

    employee
      .promise_initial_adjustmet_remarks_for_year(cur_year),

    (args, employee_adjustment, carried_over_allowance, initial_adjustment, remarks) => {
      args.push(null);
      args.push(employee_adjustment);
      args.push(carried_over_allowance);
      args.push(initial_adjustment);
      args.push(remarks);
      return Promise.resolve(args);
    })
  )
  .then(args => {
    let
      allowance_obj = args[0],
      remaining_allowance = allowance_obj.total_number_of_days_in_allowance - allowance_obj.number_of_days_taken_from_allowance,
      employee = args[1],
      total_days_number = allowance_obj.total_number_of_days_in_allowance,
      employee_adjustment = args[3],
      carried_over_allowance = args[4],
      initial_adjustment = args[5],
      remarks = args[6];

    let leave_statistics = {
      total_for_current_year : total_days_number,
      remaining              : remaining_allowance,
    };

    leave_statistics.used_so_far = allowance_obj.number_of_days_taken_from_allowance;

    leave_statistics.used_so_far_percent = leave_statistics.total_for_current_year > 0
      ? 100 * leave_statistics.used_so_far / leave_statistics.total_for_current_year
      : 0;

    leave_statistics.remaining_percent = leave_statistics.total_for_current_year > 0
      ? 100 *  (leave_statistics.total_for_current_year - leave_statistics.used_so_far) / leave_statistics.total_for_current_year
      : 0;

    return employee
      .promise_schedule_I_obey()
      .then(function(){
        employee
          .promise_my_active_leaves_ever({})
          .then(leaves => LeaveCollectionUtil.promise_to_group_leaves(leaves))
          .then(function(grouped_leaves){

            res.render('user_details', {
              employee         : employee,
              grouped_leaves   : grouped_leaves,
              show_absence_tab : true,
              leave_type_statistics : employee.get_leave_statistics_by_types(),
              leave_statistics      : leave_statistics,
              employee_adjustment   : employee_adjustment,
              carried_over_allowance: carried_over_allowance,
              initial_adjustment    : initial_adjustment,
              remarks               : remarks,
              user_allowance        : user_allowance,
            });

          });
      });
  })
  .catch(function(error){
    console.error(
      'An error occurred when trying to open employee absences by user '+req.user.id
      + ' : ' + error
    );

    return res.redirect_with_session('../../../');
  });
});


router.get('/edit/:user_id/schedule/', function(req, res){
  var user_id = validator.trim(req.params['user_id']);

  Promise.try(function(){
    ensure_user_id_is_integer({req : req, user_id : user_id});
  })
  .then(function(){
    return req.user.get_company_for_user_details_basic({
      user_id : user_id,
    });
  })
  .then(function(company){

    var employee = company.users[0];

    return employee
      .promise_schedule_I_obey()
      .then(function(schedule){
        res.render('user_details', {
          employee          : employee,
          schedule          : schedule,
          show_schedule_tab : true,
        });
      });
  })
  .catch(function(error){
    console.error(
      'An error occurred when trying to open employee absences by user '+req.user.id
      + ' : ' + error
    );

    return res.redirect_with_session('../../../');
  });
});


// Special step performed while saving existing employee account details
//
// In case when employee had "end date" populated and now it is going
// to be updated to be in future - check if during the time user was inactive
// new user was added (including other companies)
//
var ensure_user_was_not_useed_elsewhere_while_being_inactive = function(args){
  var
    employee            = args.employee,
    new_user_attributes = args.new_user_attributes,
    req                 = args.req,
    model               = args.model;

  if (
    // Employee has end_date defined
    employee.end_date &&
    (
     ! new_user_attributes.end_date
     ||
      (
        // new "end_date" is provided
        // new "end_date" is in future
        new_user_attributes.end_date &&
        moment.utc( new_user_attributes.end_date ).startOf('day').toDate() >= req.user.company.get_today().startOf('day').toDate()
      )
    )
  ) {
    return model.User.find_by_email(new_user_attributes.email)
      .then(function(user){

        if (user && user.companyId !== employee.companyId) {
          var error_msg = 'There is an active account with similar email somewhere within system.';
          req.session.flash_error(error_msg);
          throw new Error(error_msg);
        }

        return Promise.resolve();
      });
  }

  return Promise.resolve();
};

// Extra step: in case when employee is going to have new email,
// check that it is not duplicated
//
var ensure_email_is_not_used_elsewhere = function(args){
  var
    employee            = args.employee,
    new_user_attributes = args.new_user_attributes,
    req                 = args.req,
    model               = args.model;

  if (new_user_attributes.email === employee.email) {
    return Promise.resolve();
  }

  return model.User
    .find_by_email(new_user_attributes.email)
    .then(function(user){

      if (user) {
        req.session.flash_error('Email is already in use');
        throw new Error('Email is already used');
      }

      return Promise.resolve();
    });
};

var ensure_we_are_not_removing_last_admin = function(args){
  var
    employee            = args.employee,
    new_user_attributes = args.new_user_attributes,
    req                 = args.req,
    model               = args.model;

  if (
    // It is about to change admin rights
    new_user_attributes.admin !== employee.admin
    // and it is revoking admin rights
    && ! new_user_attributes.admin
  ) {
    return model.User
      .count({ where : {
        // companyId : employee.companyId,
        id        : { $ne : employee.id},
        admin     : true,
        superadmin: true,
      }})
      .then(function(number_of_admins_to_be_left){
        if (number_of_admins_to_be_left > 0) {
          return Promise.resolve();
        }

        req.session.flash_error('This is last admin within company. Cannot revoke admin rights.');
        throw new Error('Attempt to revoke admin rights from last admin in comapny '+employee.companyId);
      });
  }

  return Promise.resolve();
};

router.post('/edit/:user_id/', function(req, res){
  var user_id = validator.trim(req.params['user_id']);

  var new_user_attributes,
    employee,
    model = req.app.get('db_model');

  Promise.try(function(){
    ensure_user_id_is_integer({req : req, user_id : user_id});
  })
  .then(function(){
    return req.user.get_company_for_user_details_basic({
      user_id : user_id,
    });
  })
  .then(function(company){
    new_user_attributes = get_and_validate_user_parameters({
      req         : req,
      item_name   : 'user',
      departments : company.departments,
    });

    if (new_user_attributes.password) {
        new_user_attributes.password = model.User.hashify_password(
        new_user_attributes.password
      );
    }

    employee = company.users[0];

    // console.log(new_user_attributes);

    return Promise.resolve();
  })

  // Ensure that new email if it was changed is not used anywhere else
  // withing system
  .then(function(){ return ensure_email_is_not_used_elsewhere({
    employee            : employee,
    new_user_attributes : new_user_attributes,
    req                 : req,
    model               : model,
  })})

  // Double check user in case it is re-activated
  .then(function(){ return ensure_user_was_not_useed_elsewhere_while_being_inactive({
    employee            : employee,
    new_user_attributes : new_user_attributes,
    req                 : req,
    model               : model,
  })})

  .then(function(){ return ensure_we_are_not_removing_last_admin({
    employee            : employee,
    new_user_attributes : new_user_attributes,
    req                 : req,
    model               : model,
  })})

  // All validations are passed: update database
  .then(function(){

    let adjustment = new_user_attributes.adjustment;
    delete new_user_attributes.adjustment;

    const captureAuditTrail = getAuditCaptureForUser({
      byUser: req.user,
      forUser: employee.get({plain: true}),
      newAttributes: new_user_attributes,
    });
    let carried_over_allowance = new_user_attributes.carried_over_allowance;
    delete new_user_attributes.carried_over_allowance;

    let initial_adjustment = new_user_attributes.initial_adjustment;
    delete new_user_attributes.initial_adjustment;

    let remarks = new_user_attributes.remarks;
    delete new_user_attributes.remarks;

    let cur_date = req.user.company.get_today();

    employee

      // Update user record
      .updateAttributes(new_user_attributes)

      .then(() => captureAuditTrail())

      // Update adjustment if necessary
      .then(() => {
        if ( adjustment !== undefined  ) {
          return employee.promise_to_update_adjustment({
            year : moment.utc(cur_date).format('YYYY'),
            adjustment : adjustment,
          });
        }

        return Promise.resolve();
      })

      // Update carry forward if necessary
      .then(() => {
        if ( carried_over_allowance !== undefined  ) {
          return employee.promise_to_update_carried_over_allowance({
            year : moment.utc(cur_date).format('YYYY'),
            carried_over_allowance : carried_over_allowance,
          });
        }

        return Promise.resolve();
      })

      // Update initial adjustment and remarks if necessary
      .then(() => {
        if ( initial_adjustment !== undefined  && remarks !== undefined) {
          return employee.promise_to_intitial_adjustment_and_remarks({
            year : moment.utc(cur_date).format('YYYY'),
            initial_adjustment : initial_adjustment,
            remarks            : remarks
          });
        }

        return Promise.resolve();
      })

      .then(function(){
        req.session.flash_message(
          'Details for '+employee.full_name()+' were updated'
        );
        return res.redirect_with_session(req.body.back_to_absences ? './absences/' : '.');
      });
  })

  .catch(function(error){
    console.error(
      'An error occurred when trying to save chnages to user account by user '+req.user.id
      + ' : ' + error
    );

    req.session.flash_error(
      'Failed to save changes.'
    );

    return res.redirect_with_session(req.body.back_to_absences ? './absences/' : '.');
  });
});


router.post('/delete/:user_id/', function(req, res){
    const user_id = validator.trim(req.params['user_id']);
    let auditCapture;

    Promise.try(() => ensure_user_id_is_integer({req, user_id}))
    .then(() => req.user.get_company_for_user_details_basic({user_id}))
    .then(company => {
      const employee = company.users[0];
      const employeePlain = employee.get({plain: true});
      auditCapture = getAuditCaptureForUser({
        byUser:        req.user,
        forUser:       employeePlain,
        newAttributes: Object.assign(
          {},
          ...Object.keys(employeePlain).map(k => ({[k]:null}))
        ),
      });
      return employee.remove();
    })
    .then(() => auditCapture())
    .then(() => {
      req.session.flash_message(
        'Employee records were removed from the system'
      );
      return res.redirect_with_session('../..');
    })
    .catch(error => {
      console.error(
        `An error occurred when trying to remove user ${user_id} by user `
          + `${req.user.id}. Error: ${error}`
      );

      req.session.flash_error(`Failed to remove user. ${error}`);

      return res.redirect_with_session(`../../edit/${user_id}/`);
    });
});


router.all('/search/', function(req, res){

  // Currently we support search only by email and only JSON type requests
  if ( ! req.accepts('json')) {
    // redirect client to the users index page
    return res.redirect_with_session('../'); 
  }

  var email = validator.trim( req.params['email'] ).toLowerCase();

  if ( ! validator.isEmail( email )) {
    req.session.flash_error('Provided email does not look like valid one: "'+email+'"');
    return res.json([]);
  }

  // search for users only related to currently login admin
  //
  var promise_result = req.user.getCompany({
    include : [{
      model : req.app.get('db_model').User,
      as : 'users',
      where : {
        email : email
      }
    }]
  });

  promise_result.then(function(company){
    if (company.users.length > 0) {
      res.json(company.users)
    } else {
      res.json([]);
    }
  });
});


/* Handle the root for users section, it shows the list of all users
 * */
router.get('/', function(req, res) {

    var 
    model = req.app.get('db_model'),
    users_filter = {},
    company_filter = {},
    department_id = req.query['department'];

    if (validator.isNumeric( department_id )) {
      users_filter = { DepartmentId : department_id };
    } else {
      department_id = undefined;
    }

    if (typeof req.query['company'] != 'undefined' || req.query['company'] != null){
      company_filter = {id : req.query['company']};
    }
    else if (req.user.superadmin != true){ //Only return the employee list that within the same company for the normal admin
      company_filter = {id : req.user.companyId};
    }

    model.Company.findAll({
      where    : company_filter,
      include: [{// Notice `include` takes an ARRAY
        model    : model.User,
        as       : 'users',
        where    : users_filter,
        required : true,
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
                    moment.utc().startOf('year').format('YYYY-MM-DD'),
                    moment.utc().endOf('year').format('YYYY-MM-DD HH:mm'),
                  ]
                },
                date_end : {
                  $between : [
                    moment.utc().startOf('year').format('YYYY-MM-DD'),
                    moment.utc().endOf('year').format('YYYY-MM-DD HH:mm'),
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
      }]
    })
    // Make sure that objects have all necessary attributes to render page
    // (template system is sync only)
    .then(function(companies){
      return Promise.all( //Return When all promise resolved
        _.map(companies,function(company){ 
        return company.getBank_holidays()
        //stick bank holidays to company
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
      }));
    })

    // Make sure that user's leaves have reference back to user in question
    .then(function(companies){
      return Promise.all(
        _.map(companies,function(company){
          company.users.forEach(function(user){
            user.company = company;
            user.my_leaves.forEach(function(leave){ leave.user = user });
          });

          return Promise.resolve(company);
        })
      );
    })

    // Update users to have neccessary data for leave calculations
    .then(function(companies){
      return Promise.all(
        _.map(companies,function(company){
          return Promise.resolve(company.users).map(function(user){
            return user.promise_schedule_I_obey();
          },{
            concurrency : 10,
          })
          .then(function(){ return Promise.resolve(company) });
        })
      );
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
    .then(function(companies){
      return Promise.all(
        _.map(companies,company => Promise
        .resolve(company.users)
        .map(user => user
           .promise_allowance()
           .then(allowance_obj => Promise.resolve({
             user_row : user,
             number_of_days_available_in_allowance : allowance_obj.number_of_days_available_in_allowance,
           })),
           {
             concurrency : 10
           }
         )
         .then(users_info => Promise.resolve([company, users_info]))
        )
      );
    })

    // We are moving away from passing complex objects into templates
    // for callting complicated methods from within templates
    // Now only basic simple objects to be sent over to tamples,
    // all preparation to be done before rendering.
    //
    // So prepare special rendering datastructure here
    .then(function(args){
      return Promise.all(
        _.map(args,function(arg){
          return promise_user_list_data_for_rendering(arg);
        })
      );
    })

    .then(function(result){
      // let args = result[1];
      //  console.log(args);
      //let
        // company = args[0],
        // users_info = args[1];

      if ( req.param('as-csv') ) {
        let args = result[0],
            company = args[0],
            users_info = args[1];

        return users_list_as_csv({
          users_info : users_info,
          company    : company,
          req        : res,
          res        : res,
        });
      }

      res.render('users', {
        companies     : result,
        // company       : company,
        department_id : Number(department_id),
        // title         : company.name + "'s people",
        title         : "Company's Staff",
        // users_info    : users_info,
      });
    });
});

function promise_user_list_data_for_rendering(args) {
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
    is_admin                              : ui.user_row.admin,
    is_manager                            : ui.user_row.isManager,
    number_of_days_available_in_allowance : ui.number_of_days_available_in_allowance,
    number_of_days_taken_from_allowance   : ui.user_row.calculate_number_of_days_taken_from_allowance(),
    is_active                             : ui.user_row.is_active(),
    user_dtjoin                           : moment(ui.user_row.start_date).format('YYYY-MM-DD'),
    user_dtleave                          : moment(ui.user_row.end_date).format('YYYY-MM-DD'),
    is_resigned                           : (ui.user_row.end_date != null && moment(ui.user_row.end_date).format('YYYY-MM-DD') <  moment.utc().startOf('day').format('YYYY-MM-DD')? 1:0),
  }));

  return Promise.resolve([company, users_info_for_rendering]);
};

function users_list_as_csv(args) {
  let users_info = args.users_info,
      company = args.company,
      req = args.req,
      res = args.res;

  // Compose file name
  res.attachment(
    company.name_for_machine()
      + '_employees_on_'
      + company.get_today().format('YYYY_MMM_DD')
      + '.csv'
  );

  // Compose result CSV header
  let content = [['email', 'lastname', 'name', 'nickname', 'department', 'remaining allowance', 'days used']];

  // ... and body
  users_info.forEach(ui => {
    content.push([
      ui.user_email,
      ui.user_lastname,      
      ui.user_name,
      ui.user_nickname,
      ui.department_name,
      ui.number_of_days_available_in_allowance,
      ui.number_of_days_taken_from_allowance
    ]);
  });

  return csv.stringifyAsync( content )
    .then(csv_data_string => res.send(csv_data_string));
}

function get_and_validate_user_parameters(args) {
    var req         = args.req,
        item_name   = args.item_name,
        require_password = args.require_password || false;

    // Get user parameters
    var name     = validator.trim(req.body['name']),
        lastname = validator.trim(req.body['lastname']),
        nickname = validator.trim(req.body['nickname']),
        email    = validator.trim(req.body['email_address']),
        department_id     = validator.trim(req.body['department']),
        start_date        = validator.trim(req.body['start_date']),
        end_date          = validator.trim(req.body['end_date']),
        adjustment        = validator.trim(req.body['adjustment']),
        password          = validator.trim(req.body['password_one']),
        password_confirm  = validator.trim(req.body['password_confirm']),
        admin             = validator.toBoolean(req.body['admin']),
        superadmin        = validator.toBoolean(req.body['superadmin']),
        isManager         = validator.toBoolean(req.body['supervisor']),
        auto_approve      = validator.toBoolean(req.body['auto_approve']),
        carried_over_allowance = validator.trim(req.body['carried_over_allowance']),
        user_leave      = validator.trim(req.body['user_leave']),
        calculated_sickleaves      = validator.trim(req.body['user_sick_leave']),
        initial_adjustment      = validator.trim(req.body['int_adjustment']),
        remarks      = validator.trim(req.body['remarks']),
        staffId            = validator.trim(req.body['staffId']),
        category           = validator.trim(req.body['category']);

    // Validate provided parameters
    if (!validator.isEmail(email)) {
        req.session.flash_error(
            'New email of '+item_name+' should be valid email address'
        );
    }

    if (!validator.isNumeric(department_id)) {
        req.session.flash_error(
            'New department number of '+item_name+' should be a valid number'
        );
    }

    if (adjustment && ! validator.isFloat(adjustment) ) {
      req.session.flash_error(
        'New allowance adjustment of '+item_name+' should be a valid number'
      );
    } else if (adjustment && ! ( adjustment % 1 === 0 || Math.abs( adjustment % 1 ) === 0.5 )) {
      req.session.flash_error(
        'New allowance adjustment of '+item_name+' should be either whole integer number or with half'
      );
    }

    if (initial_adjustment && ! validator.isFloat(initial_adjustment) ) {
      req.session.flash_error(
        'New initial adjustment of '+item_name+' should be a valid number'
      );
    } else if (initial_adjustment && ! ( initial_adjustment % 1 === 0 || Math.abs( initial_adjustment % 1 ) === 0.5 )) {
      req.session.flash_error(
        'New initial adjustment of '+item_name+' should be either whole integer number or with half'
      );
    }

    start_date = req.user.company.normalise_date( start_date );

    if (!validator.isDate(start_date)) {
      req.session.flash_error(
        'New start date for '+item_name+' should be valid date'
      );
    }

    if (end_date ){

      end_date = req.user.company.normalise_date( end_date );

      if ( ! validator.isDate(end_date)) {
        req.session.flash_error(
          'New end date for '+item_name+' should be valid date'
        );
      }
    }

    if (
        start_date &&
        end_date &&
        moment.utc(start_date).toDate() > moment.utc(end_date).toDate()
    ){
        req.session.flash_error(
            'End date for '+item_name+' is before start date'
        );
    }

    if (password && password !== password_confirm) {
      req.session.flash_error('Confirmed password does not match initial one');
    }

    if (require_password && ! password) {
      req.session.flash_error('Password is required');
    }

    if ( req.session.flash_has_errors() ) {
        throw new Error( 'Got validation errors' );
    }

    // Normalize email as we operate only with lower case letters in emails
    email = email.toLowerCase();

    var attributes = {
        name         : name,
        lastname     : lastname,
        nickname     : nickname,
        email        : email,
        DepartmentId : department_id,
        start_date   : start_date,
        end_date     : (end_date || null),
        admin        : admin,
        superadmin   : superadmin,
        isManager    : isManager,
        auto_approve : auto_approve,
        staffId      : staffId,
        category     : category,
        remarks      : remarks,
    };

    if (adjustment || String(adjustment) === '0') {
      attributes.adjustment = adjustment;
    }

    if (carried_over_allowance || String(carried_over_allowance) === '0') {
      attributes.carried_over_allowance = carried_over_allowance;
    }

    if (initial_adjustment || String(initial_adjustment) === '0') {
      attributes.initial_adjustment = initial_adjustment;
    }

    if (user_leave || String(user_leave) === '0') {
      attributes.user_leave = user_leave;
    }

    if (calculated_sickleaves || String(calculated_sickleaves) === '0') {
      attributes.calculated_sickleaves = calculated_sickleaves;
    }

    if ( password ) {
      attributes.password = password;
    }

    return attributes;
}

function ensure_user_id_is_integer(args){
    var req     = args.req,
        user_id = args.user_id;

    if (! validator.isInt(user_id)){
        throw new Error(
          'User '+req.user.id+' tried to edit user with non-integer ID: '+user_id
        );
    }

    return;
}

module.exports = router;
