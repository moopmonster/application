
'use strict';

const { google } = require('googleapis');

let bluebird    = require('bluebird');
let moment      = require('moment');
let privatekey  = require("../privatekey.json");
let calendar    = google.calendar('v3');
let config      = require('./config');
let Models      = require('./model/db');
let gauth       = config.get('gauth_as');
let update_gcal = config.get('gcalendar');

// configure a JWT auth client
let jwtClient = new google.auth.JWT(
  privatekey.client_email,
  null,
  privatekey.private_key,
  ['https://www.googleapis.com/auth/calendar'],
  gauth
);

function jwtConnect() {
  //authenticate request
  return jwtClient.authorize(function (err, tokens) {
    if (err) {
      console.log(err);
      return;
    } else {
      console.log("Successfully connected!");
    }
  })
}

function getCalendarId(deptid){
  return (deptid>=11 && deptid<=17?config.get('gcalendar_id_dev'):config.get('gcalendar_id_all'));
}

function gcal(){

};

function constructEvent(leave) {
  var lname = leave.leave_type.name;
  var lcode = leave.leave_type.leavetypecode;
  var lduration = leave.day_part_start;
  var endpart = leave.day_part_end;
  var lstatus = leave.status; 
  var showstatus = 1;
  var nickname = leave.user.nickname;
  var lastname = leave.user.lastname;
  var username = leave.user.name;
  let datediff = moment(leave.date_end).diff(moment(leave.date_start), 'days', true);

  var title = "@" + (nickname != ""? nickname : username + " " + lastname)  + ' - ';

  /* Title of the Event */
  if(lcode == "SICK") {
    title += "MC";
    showstatus = 0;
  }
  else if(lcode == "EMERGENCY") {
    title += "EL";
    showstatus = 0;
  } 
  else if(lcode == "ANNUAL") 
    title += "AL";
  else if(lcode == "OTHERS") 
    title += "WFH";  
  else 
    title += lname ;

  /* Title of the Event - append AM or PM */
  if(datediff == 0)
  {
    if (lduration == 2) // AM
      title += " (AM)"
    else if (lduration == 3) // PM
      title += " (PM)"
  }
  else /*more than few days*/
  {
    let str_start = moment(leave.date_start).format("DD/MM");
    let str_end  = moment(leave.date_end).format("DD/MM");
    if(lduration == 3 || endpart == 2)
    {
      title += ' (' + str_start.toString();
      if (lduration == 3) 
        title += " PM";
      title += " - ";

      if(endpart == 2)
        title += str_end + ' AM';
      else title += str_end;
      
      title += ')';
    }
  }

  /* Title of the Event - append status */
  /*if(showstatus)
  {*/

  if(lstatus === Models.Leave.status_new()) //new
    title += " (Pending)";
  else if(lstatus === Models.Leave.status_approved()) //approved
    title += "";
  else if(lstatus === Models.Leave.status_pended_revoke()) //pending revoke
    title += " (Pending Revoke)"; 
  else if(lstatus === Models.Leave.status_rejected()) //rejected
    title += " (Rejected)";  // remove
  else if(lstatus === Models.Leave.status_canceled()) //cancelled
    title += " (Cancelled)"; // remove
  /*}*/
	
  
  /* Return gcalendar friendly event format  */
  return { "summary": title,
            "end": {
              "date": (leave.date_end === leave.date_start?moment(leave.date_end).format("YYYY-MM-DD"):moment(leave.date_end).add(1,'d').format("YYYY-MM-DD")),
            },  
            "start": {
              "date": moment(leave.date_start).format("YYYY-MM-DD"),
            },
            "transparency": "transparent",
          };
}


gcal.prototype.promise_gevent_create = function(args){
  var self   = this,
  leave      = args.leave;

  var leave_event = constructEvent(leave);
  var department_id = leave.user.DepartmentId;

  if(update_gcal == false)
    return;

  jwtConnect();
  
  calendar.events.insert({
    auth: jwtClient,
    calendarId: getCalendarId(department_id),
    resource: leave_event,
  }, function(err, resource) {
    if (err) {      
      return leave.promise_gevent_failed( "INSERT - " + err );
    }

    if( typeof resource.data != 'undefined' ) 
      return leave.promise_geventid(resource.data.id);
    else 
      return leave.promise_gevent_failed( "Create Failed with undefined resource returned.");
  })
  
};


gcal.prototype.promise_leave_request_decision_gevent = function(args){
  var self          = this,
  leave             = args.leave;

  if(update_gcal == false)
    return;
  
  jwtConnect();

  var leave_event = constructEvent(leave),
      gevent_id = leave.gevent_id;

  
  if(leave.status === Models.Leave.status_approved() || leave.status === Models.Leave.status_pended_revoke())
  {
    calendar.events.update({
      auth: jwtClient,
      calendarId: getCalendarId(leave.user.DepartmentId),
      eventId: gevent_id,
      resource: leave_event,
    }, function(err, resource) {
      if (err) {
        //console.log("There was an error contacting the Calendar service: " + err);
        return leave.promise_gevent_failed( "UPDATE - " + err );
      } 
      return leave.promise_gevent_failed(null);
    })
  }
  else
  {
    calendar.events.delete({
      auth: jwtClient,
      calendarId: getCalendarId(leave.user.DepartmentId),
      eventId: gevent_id,
    }, function(err, resp) {
      if (err) {
        //console.log("There was an error contacting the Calendar service: " + err);
        return leave.promise_gevent_failed( "DELETE - " + err );
      }
      return leave.promise_gevent_failed(null);
    })
  }
};

module.exports = gcal;
