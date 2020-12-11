"use strict";

const
    crypto        = require('crypto'),
    _             = require('underscore'),
    moment        = require('moment'),
    Promise       = require("bluebird"),
    config        = require('../../config'),

    UserAllowance = require('../user_allowance'),
    htmlToText = require('html-to-text'),

    // User mixins
    withCompanyAwareness = require('../mixin/user/company_aware'),
    withAbsenceAwareness = require('../mixin/user/absence_aware');


module.exports = function(sequelize, DataTypes) {

  var instance_methods = get_instance_methods(sequelize);

  withCompanyAwareness.call ( instance_methods, sequelize ) ;
  withAbsenceAwareness.call ( instance_methods, sequelize ) ;

  var class_methods = get_class_methods(sequelize);

  withAssociations.call ( class_methods, sequelize ) ;
  withScopes.call       ( class_methods, sequelize ) ;

  var User = sequelize.define("User", {
      // TODO add validators!
      email : {
          type      : DataTypes.STRING,
          allowNull : false
      },
      password : {
          type      : DataTypes.STRING,
          allowNull : false
      },
      name : {
          type      : DataTypes.STRING,
          allowNull : false
      },
      lastname : {
          type      : DataTypes.STRING,
          allowNull : false
      },
      activated : {
          type         : DataTypes.BOOLEAN,
          allowNull    : false,
          defaultValue : false,
          comment      : 'This flag means that user account was activated, e.g. login',
      },
      admin : {
          type         : DataTypes.BOOLEAN,
          allowNull    : false,
          defaultValue : false,
          comment      : 'Indicate if account can edit company wide settings that he/she belongs to',
      },
      auto_approve : {
        type         : DataTypes.BOOLEAN,
        allowNull    : false,
        defaultValue : false,
        comment      : 'Indicate if leave request from current employee are auto approved',
      },
      start_date : {
          type         : DataTypes.DATE,
          allowNull    : false,
          defaultValue : DataTypes.NOW,
          comment      : 'Date employee start to work for company',
          get: function(){
            return moment.utc(this.getDataValue('start_date')).format('YYYY-MM-DD');
          },
      },
      end_date : {
          type         : DataTypes.DATE,
          allowNull    : true,
          defaultValue : null,
          comment      : 'Date emplyee stop working for company',
          get: function(){
            const endDate = this.getDataValue('end_date');
            if ( ! endDate ) {
              return endDate;
            }

            return moment.utc(endDate).format('YYYY-MM-DD');
          },
      },
      user_leave : {
          type         : DataTypes.INTEGER,
          allowNull    : false,
          defaultValue : 0,
          comment      : 'User leave entitlment during initial import',
      },
      user_cf : {
          type         : DataTypes.INTEGER,
          allowNull    : false,
          defaultValue : 0,
          comment      : 'User carry forward entitlment during initial import',
      },
      global_adjuster : {
          type         : DataTypes.INTEGER,
          allowNull    : false,
          defaultValue : 0,
          comment      : 'able to add public holiday adjustments for all.',
      },
      nickname : {
          type      : DataTypes.STRING,
          allowNull : true
      },
      isManager : {
          type         : DataTypes.BOOLEAN,
          allowNull    : false,
          defaultValue : false,
          comment      : 'Indicate if account can is manager(Assigned as department head/supervisor)',
      },
      superadmin : {
          type         : DataTypes.BOOLEAN,
          allowNull    : false,
          defaultValue : false,
          comment      : 'Indicate if account can edit settings for every company(International)',
      },
      calculated_userleaves : {
          type         : DataTypes.INTEGER,
          allowNull    : true,
          defaultValue : false,
          comment      : 'Annual Leave entitlement based on Merimen leave policy',
      },
      calculated_sickleaves : {
          type         : DataTypes.INTEGER,
          allowNull    : true,
          defaultValue : false,
          comment      : 'Sick Leave entitlement based on Merimen leave policy',
      },
      staffId : {
          type      : DataTypes.STRING,
          allowNull : true,
          defaultValue : false,
          comment      : 'Staff Unique Id',
      },
      category : {
          type      : DataTypes.STRING,
          allowNull : true,
          defaultValue : false,
          comment      : 'Category of Staff',
      },     
  }, {
      indexes : [
        {
          fields : ['companyId'],
        },
        {
          fields : ['lastname'],
        },
      ],
      classMethods: class_methods,

      instanceMethods : instance_methods,
    });

    return User;
};


/*
 * Convenience method that returns an object with definition of User's instance methods.
 *
 * */
function get_instance_methods(sequelize) {

  return {
    get_others : function(isManager){
      var sql = 'SELECT * FROM USERS WHERE NOT companyId = 1'; //temporary hardcode

      if (isManager != '' && isManager == 1){
        sql = sql + ' AND isManager = 1'
      }else if (isManager != '' && isManager == 0){
        sql = sql + ' AND isManager = 0'
      }

      return sequelize.query(sql).catch((error) => {throw error;} );
    },

    is_my_password : function( password ) {
        return sequelize.models.User.hashify_password( password ) === this.password;
    },

    /*
     * Activate user only when it is inactive.
     * Return promise that gets user's object.
     * */
    maybe_activate : function(){
      if ( ! this.activated ) {
          this.activated = true;
      }
      return this.save();
    },

    is_admin : function() {
      return this.admin === true;
    },

    is_manager : function() {
      return this.isManager === true;
    },

     is_superAdmin : function() {
        if (this.is_admin() === true){ //By right if a user is superAdmin then he/she must an Admin too
            return this.superadmin === true;
        }else{
            return false;
        }
    },

    /*
     * Indicates is leave requests from current user are automatically approved
     * */
    is_auto_approve : function(){
      return this.auto_approve === true;
    },

    full_name : function() {
      return this.name + ' ' + this.lastname;
    },

    /*
     * Indicates if the user is active
     * */
    is_active : function(){
      return this.end_date === null || moment(this.end_date).isAfter(moment());
    },

    // TODO VPP: rename this method as its name misleading: it returns all users
    // managed by current users + user itself, so it should be something like
    // "promise_all_supervised_users_plus_me"
    // In fact this method probably have to be ditched in favour of more granular ones
    //
    promise_users_I_can_manage : function(){
      var this_user = this;

      // Check if current user is admin or superAdmin, then fetch all users form company
      if ( this_user.is_superAdmin()){
        return sequelize.models.User.findAll({  //Return all active user
          where : {
            $or : [
                { end_date : {$eq : null}},
                { end_date : {$gte : moment.utc().startOf('day').format('YYYY-MM-DD') }},
              ]
          }
        }) 

      }else if ( this_user.is_admin() ) {
        return this_user
          .getCompany({
            scope : ['with_active_users','order_by_active_users'], 
          })
          .then(function(company){
            return Promise.resolve( company.users );
          });
      }

      // If current user has any departments under supervision then get
      // all users from those departments plus user himself,
      // if no supervised users an array with only current user is returned
      return this_user.promise_supervised_departments()
      .then(function(departments){
        var users = _.flatten(
          _.map(
            departments,
            function(department){ return department.users; }
          )
        );

        // Make sure current user is considered as well
        users.push(this_user);
        // Remove duplicates
        users = _.uniq(
          users,
          function(user){ return user.id; }
        );
        
        // Order by last name
        users = _.sortBy(
          users,
          function(user){ return user.lastname; }
        );

        return users;
      });

    }, // promise_users_I_can_manage

    promise_companies_I_can_manage : function(){
      var this_user = this;
      
      // •Return all company if user is a superadmin
      // •Return current company if user is a normal admin
      // •Return nothing if user is not an admin (normal user)
      if ( this_user.is_superAdmin()){
        return sequelize.models.Company.findAll(
        {
            include: [{
              model: sequelize.models.LeaveType,
              as: 'leave_types',
            }],
            order : [
              [{model : sequelize.models.LeaveType, as : 'leave_types'}, 'sort_order', 'ASC']
            ],
        }
        ) ;
      }
      else if ( this_user.is_admin() ) {
        return sequelize.models.Company.findAll(
        {
            where  : {id : this_user.companyId},
            include: [{
              model: sequelize.models.LeaveType,
              as: 'leave_types',
            }],
            order : [
              [{model : sequelize.models.LeaveType, as : 'leave_types'}, 'sort_order', 'ASC']
            ],
        }
        ) ;
        // return this_user.getCompany();
      }else{
        return;
      }

    }, // promise_companies_I_can_manage

    /*
     * Return user's boss, the head of department user belongs to
     *
     * */
    promise_boss : function(){
      return this.getDepartment({
        scope : ['with_boss'],
      })
      .then(department => Promise.resolve( department.boss ));
    },

    /*
     *  Return users who could supervise current user, that is those who could
     *  approve its leave requests and who can create leave requests on behalf of
     *  those user.
     *
     * */
    promise_supervisors : function(){
      return this.getDepartment({
        scope : ['with_boss', 'with_supervisors'],
      })
      .then( department => Promise.resolve( _.flatten([ department.boss, department.supervisors ]) ) );
    },

    promise_supervised_departments : function() {
      let self = this;

      if (self.isManager != true && self.is_superAdmin() != true && self.is_admin() != true){ //if user is not manager/department head user, ignore every department head setting
        return sequelize.models.Department.scope('with_simple_users').findAll({ where : {id : []}});
      }
      else if (self.is_superAdmin() == true || self.is_admin() == true){
        return sequelize.models.Department.findAll({
            where : {
              companyId : self.supervised_company.map(obj => obj.id)
            }
        })
      }
      else{
        return sequelize.models.DepartmentSupervisor.findAll({ where : { user_id : self.id } })
          // Obtain departments current user supervises as secondary supervisor
          .then(department_supervisors => department_supervisors.map( obj => obj.department_id ))
          .then( department_ids => {

            if ( ! department_ids ) {
              department_ids = [];
            }

            return sequelize.models.Department.scope('with_simple_users').findAll({
              where : {
                $or : [
                  { id : department_ids },
                  { bossId : self.id },
                ]
              }
            });
          });
      }
    },

    promise_supervised_users : function () {
      let self = this;

      return self
        .promise_supervised_departments()
        .then(departments => {
          return self.Model.findAll({ where : { DepartmentId : departments.map(d => d.id ) } });
        })
    },


    // Generate object that represent Employee allowance
    promise_allowance : function(args) {
      args = args || {};
      // Override user to be current one
      args.user = this;
      return UserAllowance.promise_allowance(args);
    },

    reload_with_leave_details : function(args){
      var self = this;

      return Promise.join(
        self.promise_my_active_leaves(args),
        self.getDepartment(),
        self.promise_schedule_I_obey(),
        function(leaves, department, schedule){
          self.my_leaves = leaves;
          self.department = department;

          // Note: we do not do anything with scheduler as "promise_schedule_I_obey"
          // sets the "cached_schedule" attribute under the hood, which is used in
          // synchronous code afterwards. Yes... it is silly, but it is where we are
          // at thi moment after mixing non blocking and blocking code together...
          //
          return Promise.resolve(self);
        }
      );

    },

    // This method reload user object to have all necessary information to render
    // each page
    reload_with_session_details : function(){
      var self = this;

      return Promise.join(
        self.promise_users_I_can_manage(),
        self.get_company_with_all_leave_types(),
        self.promise_schedule_I_obey(),
        self.promise_companies_I_can_manage(),
        function(users, company, schedule,supervised_company){
          self.supervised_users = users || [];
          self.company = company;
          self.supervised_company = supervised_company || [];
          // Note: we do not do anithing with scheduler as "promise_schedule_I_obey"
          // sets the "cached_schedule" attribute under the hood, which is used in
          // synchronous code afterwards. Yes... it is silly, but it is where we are
          // at thi moment after mixing non blocking and blocking code together...
          
          return Promise.resolve(self);
        });
    },


    remove : function() {
      var self = this;

      // make sure I am not admin, otherwise throw an error
      if (self.is_admin()) {
        throw new Error('Cannot remove administrator user');
      }

      // make sure I am not supervisor, otherwise throw an error
      return self.promise_supervised_departments()
        .then(departments => {
          if (departments.length > 0){
            throw new Error("Cannot remove supervisor");
          }

          return self.getMy_leaves();
        })
        .then(function(leaves){
          // remove all leaves
          return Promise.all(
            _.map( leaves, function(leave){ return leave.destroy(); })
          );
        })

        // remove user record
        .then(function(){
          return self.destroy();
        })

    },

    get_highest_user_leaves : function(){
      var self = this;

      return Math.max(self.user_leave,self.calculated_userleaves);
    },

    get_reset_password_token : function(){
      var self = this;

      return new Buffer( self.email + ' ' + self.Model.hashify_password( self.password ) ).toString('base64');
    },

    // Accept an object that represent email to be sent to current user and
    // record it into the corresponding audit table
    //
    record_email_addressed_to_me : function(email_obj) {

      // validate email object to contain all necessary fields
      if ( ! email_obj ||
        ! email_obj.hasOwnProperty('subject') ||
        ! email_obj.subject ||
        ! email_obj.hasOwnProperty('body') ||
        ! email_obj.body
      ) {
        throw new Error(
          'Got incorrect parameters. There should be an object '+
          'to represent and email and contain subject and body'
        );
      }

      const promise_action = this.sequelize.models.EmailAudit.create({
        email      : this.email,
        subject    : htmlToText.fromString(email_obj.subject),
        body       : htmlToText.fromString(email_obj.body),
        user_id    : this.id,
        company_id : this.companyId,
      });

      return promise_action;
    },

    promise_schedule_I_obey : function(){
      var self = this;

      if ( self.cached_schedule ) {
        return Promise.resolve( self.cached_schedule );
      }

      return self.sequelize.models.Schedule
        .findAll({
          where : {
            $or : [
              { user_id : self.id },
              { company_id : self.companyId },
            ]
          }
        })
        .then(function(schedules){

          // no schedules for current user in DB, return default one
          if (schedules.length === 0) {
            return self.sequelize.models.Schedule
              .promise_to_build_default_for({ company_id : self.companyId })
              .then(function(sch){ self.cached_schedule = sch; return Promise.resolve(sch) });
          }

          // there are two schedules, presumably one company wide and another
          // is user specific, return later one
          if (schedules.length === 2) {
            return Promise.resolve(
              _.find(schedules, function(sch){ return sch.is_user_specific() })
            )
            .then(function(sch){ self.cached_schedule = sch; return Promise.resolve(sch) });
          }

          // single schedule means it is company wide one
          return Promise.resolve( schedules.pop() )
            .then(function(sch){ self.cached_schedule = sch; return Promise.resolve(sch) });
        });
    },

    is_supervised_company : function(company_id){
      let adminUser = this;

      if(adminUser.is_admin() || adminUser.is_superAdmin()){
        let filterList = _.filter(adminUser.supervised_company,function(company){
          return company.id == company_id;
        })
        if (filterList.length > 0){
          return true;
       }
      }
      
      return false;

    },

    promise_to_return_AL_entitlement : function(year){
      let self = this,
          first_day_of_year =  moment({ year :year, month :0, day :1}),
          Last_day_of_year = moment({ year :year, month :11, day :31}),
          days_in_year = Last_day_of_year.diff(first_day_of_year,'days')+1, //include end date
          joinedDate = moment(self.start_date).format('YYYY-MM-DD'),
          date_to_calcalate =  moment({ year :year, month :moment(joinedDate).month(), day :moment(joinedDate).date()}).add(-1,'days'),
          year_of_service = (date_to_calcalate.diff(joinedDate,'days')+1)/days_in_year,
          partial_year_of_service = year_of_service + 1;

      return self.getCompany()
      .then(function(company){
        return company.country;
      })
      .then(function(Country){
        if (calculateALEntitlement(year_of_service,Country) == calculateALEntitlement(partial_year_of_service,Country))
        {
          return calculateALEntitlement(year_of_service,Country);
        }else{ 
          let 
            leave_entitle_for_full_year,
            leave_entitle_for_partial_year,
            totalALentilement,
            remainder;

          leave_entitle_for_full_year = calculateALEntitlement(year_of_service,Country)*((date_to_calcalate.diff(first_day_of_year,'days')+1)/days_in_year); //add one day to include end date
          partial_year_of_service = calculateALEntitlement(partial_year_of_service,Country)*(Last_day_of_year.diff(date_to_calcalate,'days')/days_in_year); //no need to add one day because date_to_calcalate already include end-date for this part

          totalALentilement = leave_entitle_for_full_year + partial_year_of_service;

          remainder = totalALentilement%1;

          if (remainder > 0 && remainder <= 0.5){
            totalALentilement = Math.floor(totalALentilement) + 0.5;
          }
          else{
             totalALentilement = Math.ceil(totalALentilement);
          }

          return totalALentilement;
        }
      })
      .then(day => {
        return Promise.resolve(day);
      })

      function calculateALEntitlement(year_of_service,country){
        let total_AL_entitlment;

        if (country == 'JP'){
           if (year_of_service <= 2){
            total_AL_entitlment = 15;
          }else
          if (year_of_service > 2 && year_of_service <= 4){
            total_AL_entitlment = 17;
          }else
          if (year_of_service > 4 && year_of_service <= 6){
            total_AL_entitlment = 19;
          }else
          if (year_of_service > 6 && year_of_service <= 10){
            total_AL_entitlment = 21;
          }else
          if (year_of_service > 10 && year_of_service <= 15){
            total_AL_entitlment = 23;
          }else{
            total_AL_entitlment = 25;
          }
        }
        if (country == 'UAE'){
           if (year_of_service <= 1){
            total_AL_entitlment = 12;
          }else{
            total_AL_entitlment = 30;
          }
        }
        else if (country == 'TH' || country == 'VN' || country == 'HK' || country == 'PH'){
          if (year_of_service > 0 && year_of_service <= 5){
            total_AL_entitlment = 15;
          }else
          if (year_of_service > 5 && year_of_service <= 10){
            total_AL_entitlment = 18;
          }else
          if (year_of_service > 10 && year_of_service <= 20){
            total_AL_entitlment = 20;
          }else{
            total_AL_entitlment = 25;
          }
        }
        else{ //default is for MY
          if (year_of_service <= 2){
            total_AL_entitlment = 15;
          }else
          if (year_of_service > 2 && year_of_service <= 4){
            total_AL_entitlment = 17;
          }else
          if (year_of_service > 4 && year_of_service <= 7){
            total_AL_entitlment = 19;
          }else
          if (year_of_service > 7 && year_of_service <= 10){
            total_AL_entitlment = 21;
          }else
          if (year_of_service > 10 && year_of_service <= 15){
            total_AL_entitlment = 23;
          }else{
            total_AL_entitlment = 25;
          }
        }

        return total_AL_entitlment;
      }
    },

    promise_to_return_SL_entitlement : function(year){
      let self = this,
          joinedDate = moment(self.start_date).format('YYYY-MM-DD'),
          // date_to_calcalate =  moment({ year :year, month :11, day :31}),
          date_to_calcalate = moment(),
          year_of_service = (date_to_calcalate.diff(joinedDate,'days')+1)/365,
          total_SL_entitlment;

        if (year_of_service < 2){
          total_SL_entitlment = 14;
        }else
        if (year_of_service >= 2 && year_of_service <= 5){
          total_SL_entitlment = 18;
        }else{
          total_SL_entitlment = 22;
        }

        return total_SL_entitlment;
    },
  };

};

function get_class_methods(sequelize) {
  return {

    /* hashify_password( password_string ) : string
     *
     * For provided string return hashed string.
     *
     * */
    hashify_password : function( password ) {
      return crypto
        .createHash('md5')
        .update(
          password + config.get('crypto_secret'),
          (config.get('crypto_hash_encoding') || 'binary')
        )
        .digest('hex');
    },


    get_user_by_reset_password_token : function(token) {
      var self                  = this,
      unpacked_token            = new Buffer(token, 'base64').toString('ascii'),
      email_and_hashed_password = unpacked_token.split(/\s/);

      return self.find_by_email(email_and_hashed_password[0])
        .then(function(user){
          if (user && self.hashify_password(user.password) === email_and_hashed_password[1]) {
            return Promise.resolve(user);
          } else {
            return Promise.resolve();
          }
        })
    },

    // Get active user by provided email address
    find_by_email : function( email ) {

      // TODO validate email

      var condition = { email : email };
      var active_users_filter = this.get_active_user_filter();
      for (var attrname in active_users_filter) {
        condition[attrname] = active_users_filter[attrname];
      }

      return this.find({ where : condition });
    },

    find_by_id : function(id) {
      return this.find({ where : {id : id}});
    },


    /*
     * Create new admin user within new environment - company etc
     * */
    register_new_admin_user : function(attributes){

      // TODO add parameters validation

      // Make sure we hash the password before storing it to DB
      attributes.password = this.hashify_password(attributes.password);

      var new_departments,
          new_user,
          country_code = attributes.country_code,
          timezone     = attributes.timezone,
          company_name = attributes.company_name;

      delete attributes.company_name;
      delete attributes.country_code;

      return sequelize.models.User.find_by_email( attributes.email )
        .then(function(existing_user){
          if (existing_user) {
            const error = new Error('Email is already used')
            error.show_to_user = true;
            throw error;
          }

          if (attributes.name.toLowerCase().indexOf('http') >= 0) {
            const error = new Error('Name cannot have links');
            error.show_to_user = true;
            throw error;
          }

          return sequelize.models.Company
            .create_default_company({
              name         : company_name,
              country_code : country_code,
              timezone     : timezone,
            });
        })

        // Make sure new user is going to be linked with a company
        .then(function(company){

          attributes.companyId = company.id;
          attributes.admin     = true;

          return company.getDepartments();
        })

        // Make sure new user is linked with department
        .then(function(departments){

          new_departments = departments;

          attributes.DepartmentId = departments[0].id;

          return sequelize.models.User.create( attributes );
        })

        // Make sure new departments know who is their boss
        .then(function(user){
          new_user = user;

          return Promise.all(_.map(new_departments, function(department){
            department.bossId = user.id;
            return department.save();
          }));
        })

        // Return promise with newly created user
        .then(function(){
          return Promise.resolve(new_user);
        });
    },

    get_active_user_filter : function(){
      return {
        $or : [
          { end_date : {$eq : null}},
          { end_date : {$gte : moment.utc().startOf('day').format('YYYY-MM-DD') }},
        ],
      };
    },

    get_manager_user_filter : function(){
      return {
           isManager : 1
      };
    },

  };
}; // END of class methods


// Mixin-like function that injects definition of User's associations into supplied object.
// (Define relations between User class and other entities in the domain).
//
function withAssociations() {

  this.associate = function(models){

    models.User.belongsTo(models.Company, {
      as : 'company',
    });
    models.User.belongsTo(models.Department, {
      as         : 'department',
      foreignKey : 'DepartmentId',
    });
    models.User.hasMany(models.Leave, {
      as         : 'my_leaves',
      foreignKey : 'userId',
    });
    models.User.hasMany(models.UserFeed, {
      as         : 'feeds',
      foreignKey : 'userId',
    });
    models.User.hasMany(models.UserAllowanceAdjustment, {
      as         : 'adjustments',
      foreignKey : 'user_id',
    });
  };
}


function withScopes() {

  this.loadScope = function(models) {

    models.User.addScope(
      'active',
      function () {
        return { where : models.User.get_active_user_filter() };
      }
    );

    models.User.addScope(
      'withDepartments',
      () => ({
        include: [{
          model: models.Department,
          as: 'department',
        }],
      })
    );

    models.User.addScope(
      'isManager',
      function () {
        return { where : models.User.get_manager_user_filter() };
      }
    );
    
    models.User.addScope(
      'with_simple_leaves',
      () => ({
        include : [{
          model : models.Leave,
          as : 'my_leaves',
          where : {
            $and : [
              { status : { $ne : models.Leave.status_rejected() } },
              { status : { $ne : models.Leave.status_canceled() } },
            ],
          },
        }],
      })
    );

  };
}
