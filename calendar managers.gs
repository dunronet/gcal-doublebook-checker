/**
 * Daily run of funnction
 * @return void
 */
function identifyConflictsAuto(){
  identifyConflicts(true);
}

/**
 * Pass constant variables into identifyConflictsGeneralized.  Consider moving these into a Google Sheet
 * @param {boolean} sendEmail Whether to send user an email with results.
 * @return void
 */
function identifyConflicts(sendEmail) {
  const MASTER_CALENDAR_ID = "gsuitedomain.com_v8gad11234567893ps6atq78@group.calendar.google.com";  
  var CALENDARS_TO_CHECK = [
    "user1@gsuitedomain.com",
    "user2@gsuitedomain.com"
  ];  // list all calendars you have can view details for who would be invited to events on the master calendar

  const MAX_DAYS_TO_REVIEW = 90;
  
  return identifyConflictsGeneralized(sendEmail, MASTER_CALENDAR_ID, CALENDARS_TO_CHECK, MAX_DAYS_TO_REVIEW);
  
}

/**
 * Review calendars to see if they have double booked themselves against any events in the master calendar
 * @param {boolean} sendEmail Whether to send user an email with results
 * @param {String} masterCalendarID Calendar ID of the calendar with events
 * @param {String[]} calendarsToCheck Calendar IDs of calendars you wish to monitor
 * @param {int} daysToReview Number of days to look forward
 */
function identifyConflictsGeneralized(sendEmail, masterCalendarID, calendarsToCheck, daysToReview){  
  const ONE_DAY = 86400000;

  var now = new Date();
  var startOfRange = new Date(now.getTime())
  var endOfRange = new Date(now.getTime() + (daysToReview*ONE_DAY));
  // Looks between now and daysToReview days from now. (e.g. 90 days)

  var problemEventsByCalendar = [];
  
  // load up all the calendars to check...
  var targetCalendars = calendarsToCheck.map(function(e){return CalendarApp.getCalendarById(e);});

  for(var i = 0;i < targetCalendars.length;i++){
    var targetCalendar = targetCalendars[i];

    // STEP 1: create a new placeholder for conflicts
    var problemEvents = [];  

    // STEP 2: load all events on user's calendar unsorted events, reset sorted events
    var unsortedEvents = targetCalendar.getEvents(startOfRange, endOfRange);
    var sortedEvents = []; // placeholder for events booked on the master calendar
    
        
    // STEP 3: Move all events booked on "master" unit into sortedEvents
    while(unsortedEvents.length > 0){
      var currentEvent = unsortedEvents.pop();
      if (currentEvent.getOriginalCalendarId() == masterCalendarID) { sortedEvents.push(currentEvent); }
    }
    
    
    // STEP 4: replace full unsorted stack with only the events booked on "master" calendar, reset sorted events
    unsortedEvents = sortedEvents;
    sortedEvents = [];    
    
    // STEP 5: check "master" calendar events that include the user for conflicts with rest of user calendar
    while(unsortedEvents.length > 0){
      currentEvent = unsortedEvents.pop();
      
      if (!(currentEvent.isAllDayEvent())){ // don't check all day events on master calendar.
          
        // load all events that overlap the current event
        var unconfirmedConflicts = targetCalendar.getEvents(currentEvent.getStartTime(),currentEvent.getEndTime());
        var conflicts = [];
        var conflictCounter = unconfirmedConflicts.length; 
         
            const CONFLICT_FLAG = "conflictsAlreadyFlagged";
          
        while(unconfirmedConflicts.length>0){ // we have conflicts, but the user may have all day events
          var checkingConflict = unconfirmedConflicts.pop();
          if(
            (
            (checkingConflict === currentEvent)||
            (checkingConflict == currentEvent)||
            (checkingConflict.getId() === currentEvent.getId())
            )||  // event shows up as its own conflict
            (checkingConflict.isAllDayEvent()) // all day event... don't even try.
            ){
            currentEvent.deleteTag(CONFLICT_FLAG);
            
            } // do nothing other than clear conflict flag
          else { 
            conflicts.push(checkingConflict); } // save conflict if not an all day event
        } // done reviewing conflicts
        
        if (currentEvent.getTag(CONFLICT_FLAG) == "true"){} // skip things that have already been flagged
        else if (conflicts.length>0){
          problemEvents.push({masterEvent: currentEvent, conflictEvents: conflicts}); // mark this as a problem event
          /*currentEvent.setTag(CONFLICT_FLAG,"true"); // flag event so that it doesn't show up again*/
        }
      }
    }  // end while
    
    problemEventsByCalendar.push({calendar: targetCalendar, problemEvents: problemEvents});
  } // end for i (for each calendar...)
    
  var htmlOutputT = HtmlService.createTemplateFromFile("CalendarCleanup.html");
  htmlOutputT.problemEventsByCalendar = problemEventsByCalendar;
  htmlOutputT.masterCalendarId = MASTER_CALENDAR_ID;
  var htmlOutput = htmlOutputT.evaluate().getContent();
  
  if (sendEmail == true) {
    if (htmlOutput.length > 0) {
      GmailApp.sendEmail(
        Session.getEffectiveUser().getEmail(),         // recipient
        'Director Calendar Checkup ' + now.toDateString()  , // subject 
        'error: html not displayed', {                        // body
          htmlBody: htmlOutput // advanced options
        }
      );       
    }
  }
      
  
}
