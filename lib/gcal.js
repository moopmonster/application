
'use strict';

const { google } = require('googleapis');

let bluebird    = require('bluebird');
let moment      = require('moment');
let privatekey  = require("../privatekey.json");
let calendar    = google.calendar('v3');
let config      = require('./config');
let Models      = require('./model/db');

// configure a JWT auth client
let jwtClient = new google.auth.JWT(
  privatekey.client_email,
  null,
  privatekey.private_key,
  ['https://www.googleapis.com/auth/calendar'],
  config.get('gauth_as')
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
  return (deptid>=12 && deptid<=16?config.get('gcalendar_id_dev'):config.get('gcalendar_id_all'));
}

//Google Calendar API
/*let calendarId = 'merimen.com_hrb642vk9be3uhh5g6jticjt6o@group.calendar.google.com';*/

function gcal(){

};

function constructEvent(leave) {
  var lname = leave.leave_type.name;
  var lduration = leave.day_part_start;
  var lstatus = leave.status; 
  var showstatus = 1;

  var title = leave.user.nickname + ' - ';

  /* Title of the Event */
  if(lname == "Sick Leave") {
    title += "MC";
    showstatus = 0;
  }
  else if(lname == "Emergency") {
    title += "EL";
    showstatus = 0;
  } 
  else if(lname == "Annual Leave") 
    title += "AL";
  else 
    title += lname ;

  /* Title of the Event - append AM or PM */
  if (lduration == 2) // AM
    title += " (AM)"
  else if (lduration == 3) // PM
    title += " (PM)"
  
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
              "date": moment(leave.date_start).format("YYYY-MM-DD"),
            },  
            "start": {
              "date": moment(leave.date_end).format("YYYY-MM-DD"),
            },
            "transparency": "transparent",
          };
}


gcal.prototype.promise_gevent_create = function(args){
  var self   = this,
  leave      = args.leave;

  var leave_event = constructEvent(leave);
  
  jwtConnect();

  calendar.events.insert({
    auth: jwtClient,
    calendarId: getCalendarId(leave.user.DepartmentId),
    resource: leave_event,
  }, function(err, resource) {
    if (err) {
      console.log("There was an error contacting the Calendar service: " + err);
      return;
    } 
    return leave.promise_geventid(resource.data.id);
  })
  
};


gcal.prototype.promise_leave_request_decision_gevent = function(args){
  var self          = this,
  leave             = args.leave;

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
        console.log("There was an error contacting the Calendar service: " + err);
        return;
      } 
      return;
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
        console.log("There was an error contacting the Calendar service: " + err);
        return;
      }
    })
  }
};

module.exports = gcal;
