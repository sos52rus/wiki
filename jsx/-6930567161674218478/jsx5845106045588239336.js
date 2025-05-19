require(['jquery', 'XWikiAsyncNotificationsMacro', 'xwiki-meta'],
        function ($, XWikiAsyncNotificationsMacro, xm) {
  'use strict';
  /**
   * Maximum number of events to count
   */
  var maxCountNumber = 20;

  /**
   * The current number of unread notifications (-1 means we don't know yet how many notifications there are)
   */
  var notificationCount = -1;

  /**
   * URL to the service that return the notifications to display
   */
  var url = new XWiki.Document(XWiki.Model.resolve('XWiki.Notifications.Code.NotificationsDisplayerUIX',
    XWiki.EntityType.DOCUMENT)).getURL('get');

  /**
   * Will contain the Notifications Macro object.
   */
  var macro = 0;

  /**
   * Update notification counter
   */
  var updateNotificationCount = function (count) {
    // Get the counter
    var counter = $('.notifications-count');
    // Update the global variable
    notificationCount = count;
    // Remove the counter if there is no unread notifications
    if (count == 0) {
      counter.remove();
      return;
    }
    // Create the counter if it is not present
    if (counter.length == 0) {
      counter = $('<span>').addClass('notifications-count badge');
      $('#tmNotifications > button.dropdown-toggle').append(counter);
    }
    // Update the counter
    counter.text(count);
    if (count > maxCountNumber) {
      counter.text(maxCountNumber + '+');
    };
  };

  /**
   * Add a button to clear all the notifications (which actually only change the start date of the user).
   */
  var createCleanButton = function (startDate) {
    var notificationsHeader = $('.notifications-header-uix');
    // If the clean button is already here, don't do anything
    if (notificationsHeader.find('a.notification-event-clean').length > 0) {
      return;
    }
    var markAllReadButton = $('<a href="#">')
      .addClass('notification-event-clean')
      .html("<span class=\"fa fa-trash\" aria-hidden=\"true\"><\/span>&nbsp;Очистить все")
      .on('click', function (event) {
        // Avoid the menu closing
        event.preventDefault();
        // Ask confirmation
        new XWiki.widgets.ConfirmationBox({
          onYes: function(event) {
            // Avoid the menu closing
            event.stopPropagation();
            // Display a saving message
            var notification = new XWiki.widgets.Notification("\u041E\u0447\u0438\u0441\u0442\u043A\u0430 \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u0439", 'inprogress');
            // Send the request to change the start date
            $.post(url, {
              outputSyntax: 'plain',
              action: 'clear',
              date: startDate
            }).then(() => {
              // Display the success message
              notification.hide();
              new XWiki.widgets.Notification("\u0423\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F \u043E\u0447\u0438\u0449\u0435\u043D\u044B", 'done');
              // Remove the notifications from the UI and display the "nothing!" message instead.
              $('.notifications-area').html($('<p>').addClass('text-center noitems').text("\u041D\u0435\u0442 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B\u0445 \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u0439!"));
              // Update the notifications counter
              updateNotificationCount(0);
            });
          },
          onNo: function(event) {
            // Avoid the menu closing
            event.stopPropagation();
          }
        });
      });
    // Append the button just before the "settings" link in the menu
    $('.notifications-header-uix').append(markAllReadButton);
  };

  /**
   * Get the number of unread notifications.
   */
  var getUnreadNotificationsCount = function (asyncId) {
    var restURL = '/rest/notifications/count?media=json';
    var params = {
      'userId':              XWiki.Model.serialize(xm.userReference),
      'useUserPreferences':  true,
      'currentWiki':         xm.documentReference.extractReferenceValue(XWiki.EntityType.WIKI),
      'async':               true
    };
    if (asyncId) {
      params.asyncId = asyncId;
    }
    $.ajax(restURL, {cache: false, data: params}).done(function (data, textStatus, jqXHR) {
      switch (jqXHR.status) {
        case 200:
          // 200 means that the search is done, we displayer the count notifications
          updateNotificationCount(data.unread);
        break;
        case 202:
          // 202 means that the background search is still running, we wait 1 second and ask again if it's done this time
          setTimeout(getUnreadNotificationsCount, 1000, data.asyncId);
        break;
      }
    });
  };

  /**
   * Initialize the widget.
   */
  $(function () {

    var container = $('.notification-uix');
    getUnreadNotificationsCount();
    container.on('eventMarkedAsRead', function (notif) {
      if (notificationCount <= maxCountNumber) {
        // Update the counter only if we really know how many notifications we have, which is not true if we display the "20+" message.
        // We could even hide the counter, but I am affraid it would let the user think there is no more notifications. We could also send an
        // ajax request to get the new count, but I do not want to flood the server.
        updateNotificationCount(notificationCount - 1);
      }
    });

    /**
     * Prevent the dropdown menu for being closed when the user clicks on the notifications menu.
     */
    $('#tmNotifications .dropdown-menu').on('click', function(event) {
      event.stopPropagation();
    });

    var processEvents = function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var mutation = mutations[i];
        for (var j = 0; j < mutation.addedNodes.length; j++) {
          var element = mutation.addedNodes[j];

          if ($(element).hasClass('notification-event')) {
            // We don't specify the date since we want to fallback on the current date in the end.
            createCleanButton();
          }
          if ($(element).hasClass('notifications-count')) {
            // We call the method to handle the special cases like 0 notif etc.
            updateNotificationCount($(element).text());
          }
        }
      }
    };
    var observer = new MutationObserver(processEvents);
    observer.observe(document, { childList: true, subtree : true});

    /**
    * Load the notifications content when the user open the notification menu (lazy loading to have better scalability).
    */
    var notificationsMenusHasBeenOpened = false;
    var documentReference = xm.documentReference.toString();
    $('#tmNotifications').on('show.bs.dropdown', function () {
      // Don't load the notifications if the menu has already be opened before.
      // use POST to send the document reference without any issue with URL.
      if (!notificationsMenusHasBeenOpened) {
        $.post(url, {
          outputSyntax: 'html',
          action: 'getNotifications',
          document: documentReference
        }).then(html => {
          $('.notification-uix').html(html).removeClass('loading');
          $('.notification-uix').find('.notifications-macro').each(function() {
            new XWikiAsyncNotificationsMacro(this);
          });
          $(document).trigger('xwiki:notification:loaded');
        });
      }
      notificationsMenusHasBeenOpened = true;
    });

  });

});

