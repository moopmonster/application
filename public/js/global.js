
/*
 * Book Leave request pop-up window.
 *
 * */
$(document).ready(function(){

  $('input.book-leave-from-input').datepicker(datepicker_default);
  $('input.book-leave-to-input').datepicker(datepicker_default);

  /*
   *  When FROM field in New absense form chnages: update TO one if necessary
   */
  $('input.book-leave-from-input').on('change', function(e){
    e.stopPropagation();

    var from_date = $('input.book-leave-from-input').datepicker('getDate');

    priorDateValidation();

    if ( ! from_date ) {
      // no new value for FROM part, do nothing
      console.log('No from date');
      return;
    }

    var to_date = $('input.book-leave-to-input').datepicker('getDate');

    if ( ! to_date || ( to_date && to_date.getTime() < from_date.getTime() )) {
      $('input.book-leave-to-input').datepicker('setDate', $('input.book-leave-from-input').datepicker('getFormattedDate'));
    }
  });
});

var datepicker_default = {
    monthsTitle : "Months",
    clear       : "Clear", 
    format      : getDefaultDateFormat(),
    todayHighlight: true,
    weekStart   : 0,
    /*daysOfWeekDisabled: [0,6],*/
    daysOfWeekHighlighted: "0,6",
    beforeShowDay: function(date)
    {
      var HOL_DS = eval($('#bank_holiday').val());  
      var DT = date.getFullYear() + '-' + (date.getMonth()+1) + '-' + (date.getDate()<10?'0':'')+date.getDate();

      var holfind = HOL_DS.find(o => o.dt === DT); 
      if (holfind) {
        return {classes: 'bank_holiday_cell', tooltip: holfind.name};
      }
  },
}
function getDefaultDateFormat() {
  return $('input.book-leave-from-input').attr("data-date-format");
}
function priorDateValidation() {
    var from_date = $('input.book-leave-from-input').datepicker('getDate');
    
    // prior date validation
    var today = new Date();
    var validate_prior = parseInt($("select#leave_type").find('option:selected').attr('data-tom-prior'));

    if ( ! from_date ) {
      $('.data-tom-prior-error').remove();
      return;
    }
    if( validate_prior > 0 && (getBusinessDatesCount(today, from_date) < validate_prior) ){
      error_msg = '' + validate_prior + ' working days required. Please choose Emergency Leave instead.';
      $('input.book-leave-from-input').val("");
      if($('.data-tom-prior-error').length==0) {
        $('input.book-leave-from-input').closest('[class^="col-md"]').append('<span class="data-tom-prior-error error text-danger">'+error_msg+'</span>');
      }
    }
    else $('.data-tom-prior-error').remove();
}

function getBusinessDatesCount(startDate, endDate) {
    var count = 1;
    var curDate = startDate;
    var HOL_DS = eval($('#bank_holiday').val());

    while (curDate <= endDate) {
        var dayOfWeek = curDate.getDay();
        var DT = curDate.getFullYear() + '-' + (curDate.getMonth()+1) + '-' + (curDate.getDate());
        var hol = (HOL_DS.find(o => o.dt === DT)?1:0);

        if(!((dayOfWeek == 6) || (dayOfWeek == 0) || (hol == 1) )) /* to add and public holiday */
           count++;
        curDate.setDate(curDate.getDate() + 1);
    }
    return count;
}


/*
 * Bootstrap-datepicker
 *
 * */
!function(a){
  a.fn.datepicker.dates["en-GB"] = {
    days : [
      "Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"
    ],
    daysShort : [
      "Sun","Mon","Tue","Wed","Thu","Fri","Sat"
    ],
    daysMin : [
      "Su","Mo","Tu","We","Th","Fr","Sa"
    ],
    months : [
      "January","February","March","April","May","June","July","August","September","October","November","December"
    ],
    monthsShort : [
      "Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"
    ],
    today       : "Today",
    monthsTitle : "Months",
    clear       : "Clear",
    weekStart   : 1,
    format      : "dd/mm/yyyy"
  }
}(jQuery);

$(function () {
  $('[data-toggle="tooltip"]').tooltip()
})

$(function () {
  $('[data-toggle="popover"]').popover()
})

/*
 * This is handler for invocation of "add secondary supervisors" modal
 *
 * */

$('#add_secondary_supervisers_modal').on('show.bs.modal', function (event) {
  var button = $(event.relatedTarget),
      department_name = button.data('department_name'),
      department_id = button.data('department_id');

  var modal = $(this);

  modal.find('.modal-title strong').text(department_name);

  // Make modal window to be no hiegher then window and its content
  // scrollable
  $('.modal .modal-body').css('overflow-y', 'auto');
  $('.modal .modal-body').css('max-height', $(window).height() * 0.7);

  $(this).find(".modal-body")
    // Show "loading" icon while content of modal is loaded
    .html('<p class="text-center"><i class="fa fa-refresh fa-spin fa-3x fa-fw"></i><span class="sr-only">Loading...</span></p>')
    .load('/settings/departments/available-supervisors/'+department_id+'/');
});

/*
 *  Given URL string return its query paramters as object.
 *
 *  If URL is not provided location of current page is used.
 * */

function getUrlVars(url){
  if ( ! url ) {
    url = window.location.href;
  }
  var vars = {}, hash;
  var hashes = url.slice( url.indexOf('?') + 1).split('&');
  for (var i = 0; i < hashes.length; i++) {
    hash = hashes[i].split('=');
    vars[hash[0]] = hash[1];
  }
  return vars;
}

/*
 * Evend that is fired when user change base date (current month) on Team View page.
 *
 * */

$(document).ready(function(){

  $('#team_view_month_select_btn')
    .datepicker()
    .on('changeDate', function(e) {
      var url = $(e.currentTarget).data('tom');

      var form = document.createElement("form");
      form.method = 'GET';
      form.action = url;

      var url_params = getUrlVars( url );
      url_params['date'] = e.format('yyyy-mm');

      // Move query parameters into the form
      $.each( url_params, function(key, val){
        var inp = document.createElement("input");
        inp.name = key;
        inp.value = val;
        inp.type = 'hidden';
        form.appendChild(inp);
      });

      document.body.appendChild(form);

      return form.submit();
    });
});

/*
 * This is to use tablesorter and allow table columns to be sorted client side.
 *
 * */
$(document).ready(function() {
  $(".sortable-table").tablesorter();
});

/*
 * Shortcut to reset to default table sorting
 *
 * */
$(function() {
  $('#reset-sort').click(function() {
    $('.sortable-table').trigger('sortReset');
    return false;
  });
});


$(document).ready(function(){

  $('[data-tom-color-picker] a')
    .on('click', function(e){
      e.stopPropagation();

      // Close dropdown
      $(e.target).closest('.dropdown-menu').dropdown('toggle');

      var new_class_name =  $(e.target).data('tom-color-picker-css-class');

      // Ensure newly selected color is on triggering element
      $(e.target).closest('[data-tom-color-picker]')
        .find('button.dropdown-toggle')
        .attr('class', function(idx, c){ return c.replace(/leave_type_color_\d+/g, '') })
        .addClass( new_class_name );

      // Capture newly picked up color in hidden input for submission
      $(e.target).closest('[data-tom-color-picker]')
        .find('input[type="hidden"]')
        .attr('value', new_class_name);

      return false;
    });
});


/*
 * leave request UI triggers
 *
 * */

$(document).ready(function(){
  $('select#leave_type')
    .on('change', function(e){
      var optsel = $(this).find('option:selected');
      var validate_comment = optsel.attr('data-tom-comment');
      var validate_attachment = optsel.attr('data-tom-attachment');
      var optsel_name = optsel.attr('data-tom');

      // hardcode for "Others"      
      toggleShow($('#wfh-block'),(optsel_name == "Others"?true:false));      
      $('input#wfh-chk').prop("checked", false);
      toggleShow($('div#wfh-warn'), false);

      // set compulsory comments
      toggleReq($('textarea#employee_comment'),(validate_comment==1?true:false));

      // set compulsory attachment
      toggleReq($('input#attachment-inp'),(validate_attachment==1?true:false));
      toggleShowGroup($('input#attachment-inp'),(validate_attachment!=0?true:false));
      toggleShow($('.attachment-later'),(validate_attachment==1?true:false));

      // date from/to 
      toggleReq($('input#from'),true);
      toggleReq($('input#to'),true);

      // from date
      priorDateValidation();

      return false;
    });

  // leave type
  $('select#leave_type').trigger("change");
  
  // defer attachment 
  $('input#attachment-later').on('click', function(e){
    e.stopPropagation();
    toggleReq($('input#attachment-inp'),!$(this).prop("checked"));
  });

  // Wfh 
  $('input#wfh-chk').on('click', function(e){
    e.stopPropagation();
    toggleShow($('div#wfh-warn'), $(this).prop("checked"));
  });  

});

function toggleReq(obj,flag)
{
  if(flag == true) {
    obj.prop("required",true);
    obj.closest(".form-group").addClass("required");
  }
  else {
    obj.removeProp("required");
    obj.closest(".form-group").removeClass("required");
  }
}

function toggleShowGroup(obj,flag)
{
  if(flag == true) {
    obj.closest(".form-group").show();
  }
  else {
    obj.removeProp("required");
    obj.closest(".form-group").hide();
  }
}

function toggleShow(obj,flag)
{
  if(flag == true) {
    obj.show();
  }
  else {
    obj.hide();
  }
}

/*** 
Approval
***/

$('#rejectModal').on('show.bs.modal', function (e) {
    var button = $(e.relatedTarget);
    var leave_id = button.attr("data-lid");
    $('#reject_with_comments').attr("lid", leave_id);
});

function reject_comment()
{
  var lid = $('#reject_with_comments').attr("lid");
  document.getElementById('comment_' +  lid).value = $('#reject_with_comments').val();
  document.getElementById('rejectForm_' +  lid).submit();
}

$(document).ready(function(){
  $('.dropdown-submenu a.test').on("click", function(e){
    $(this).next('ul').toggle();
    e.stopPropagation();
    e.preventDefault();
  });
});
