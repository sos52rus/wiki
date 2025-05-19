'use strict';
require(['jquery', 'XWikiAsyncNotificationsMacro', 'xwiki-events-bridge'], function ($, XWikiAsyncNotificationsMacro) {
  var init = function(event, data) {
    var container = $((data && data.elements) || document);
    container.find('.notifications-macro').each(function () {
      new XWikiAsyncNotificationsMacro(this);
    });
  };

  // Initialize the notification macros inserted after this code is loaded.
  $(document).on('xwiki:dom:updated', init);

  // Initialize the notification macros found initially when this code is loaded.
  $(init);
});
define('XWikiNotificationsMacro', ['jquery', 'xwiki-meta'], function($, xm) {
  /**
   * Construct a XWikiNotificationsMacro.
   *
   * Deprecated: This macro relies only on REST API calls which don't allow all usecases to display notifications.
   * In particular, the macro won't benefits from the Skin Extension capabilities when displayed with it.
   * It is strongly recommended to now use the XWikiAsyncNotificationsMacro defined in the other JSX.
   *
   * Except the first one, all the parameters are optional in the constructor. If they are not provided, the macro will
   * load them from the DOM element, where they should be present with the "data-" attributes.
   *
   * @param macro DOM element that will be uses as container for the notifications.
   * @param userId (optional) full serialization of the current user for who we are loading the notifications-macro
   * @param count (optional) maximum number of notifications to load for each batch
   * @param displayReadStatus (optional) either or not to display if the notifications have been read or notifications
   * @param blackList (optional) the list of the ids of events that have already been displayed and that we don't want
       to get again in next batches.
   * @param useUserPreferences (optional) either or not to use the preferences of the user instead of handling the
   *   following parameters
   * @param displayOwnEvents (optional) either or not to display the events of the current user
   * @param displayMinorEvents (optional) either or not to display minor update events on documents
   * @param displaySystemEvents (optional) either or not to display events triggered by the system
   * @param displayReadEvents (optional) either or not to display events that have been marked as read by the user
   * @param wikis (optional) list of wikis, comma-separated, to include in the notifications
   * @param spaces (optional) list of spaces, comma-separated, to include in the notifications
   * @param pages (optional) list of pages, comma-separated, to include in the notifications
   * @param users (optional) list of users, comma-separated, to include in the notifications (and only them)
   * @param tags (optional) list of tags, comma-separated, to include in the notifications (and only them)
   */
  var factory = function(macro, userId, count, displayReadStatus, blackList, useUserPreferences,
      displayOwnEvents, displayMinorEvents, displaySystemEvents, displayReadEvents, wikis, spaces, pages, users, tags) {
    var self = this;
    self.macro = $(macro);
    self.userId = userId ? userId : self.macro.attr('data-userId');
    self.notificationsLimit = count ? count : self.macro.attr('data-maxCount');
    self.displayReadStatus = displayReadStatus != undefined
      ? displayReadStatus : self.macro.attr('data-displayReadStatus').toLowerCase() == 'true' && self.userId != '';
    self.blackList = blackList ? blackList : [];
    self.useUserPreferences = useUserPreferences != undefined
      ? useUserPreferences : self.macro.attr('data-useuserpreferences');
    self.displayOwnEvents = displayOwnEvents != undefined ? displayOwnEvents : self.macro.attr('data-displayOwnEvents');
    self.displayMinorEvents = displayMinorEvents != undefined ? displayMinorEvents
      : self.macro.attr('data-displayMinorEvents');
    self.displaySystemEvents = displaySystemEvents != undefined ? displaySystemEvents
      : self.macro.attr('data-displaySystemEvents');
    self.displayReadEvents = displayReadEvents != undefined ? displayReadEvents
      : self.macro.attr('data-displayReadEvents');
    self.wikis = wikis != undefined ? wikis : self.macro.attr('data-wikis');
    self.spaces = spaces != undefined ? spaces : self.macro.attr('data-spaces');
    self.pages = pages != undefined ? pages : self.macro.attr('data-pages');
    self.users = users != undefined ? users : self.macro.attr('data-users');
    self.tags = tags != undefined ? tags : self.macro.attr('data-tags');
    console.warn("XWikiNotificationMacro is now deprecated. Please consider using XWikiAsyncNotificationsMacro instead.");

    /**
     * Function that load notifications.
     *
     * The parameter `untilDate` is used as an "offset" to get events in a paginate mode.
     * We cannot rely on an integer offset because new events could have been stored recently and we want to display
     * older ones only.
     */
    self.load = function(untilDate) {
      var params = {
        'userId':              self.userId,
        'useUserPreferences':  self.useUserPreferences,
        'count':               self.notificationsLimit,
        'displayOwnEvents':    self.displayOwnEvents,
        'displayMinorEvents':  self.displayMinorEvents,
        'displaySystemEvents': self.displaySystemEvents,
        'displayReadEvents':   self.displayReadEvents,
        'wikis':               self.wikis,
        'spaces':              self.spaces,
        'pages':               self.pages,
        'users':               self.users,
        'displayReadStatus':   self.displayReadStatus,
        'tags':                self.tags,
        'currentWiki':         xm.documentReference.extractReferenceValue(XWiki.EntityType.WIKI),
        'async':               true
      };
      if (untilDate) {
        params.untilDate = untilDate;
        params.untilDateIncluded = false;
        params.blackList = self.blackList.join(',');
      }
      var promise = $.Deferred();
      self.doLoad(params, untilDate, promise);
      return promise;
    };

    self.doLoad = function(params, untilDate, promise) {
      var restURL = '/rest/notifications?media=json';
      $.ajax(restURL, {cache: false, data: params, method: 'POST'}).done(function(data, textStatus, jqXHR) {
        switch (jqXHR.status) {
            case 200:
              // 200 means that the search is done, we displayer the received notifications
              self.showNotifications(data, untilDate, promise);
              break;
            case 202:
              // 202 means that the background search is still running, we wait 1 second and ask again if it's done this time
              params.asyncId = data.asyncId
              setTimeout(self.doLoad, 1000, params, untilDate, promise);
              break;
        }
      }).catch(() => {
        self.displayNoNotification();
      });
    };

    self.showNotifications = function(data, untilDate, promise) {
      // Display the "nothing!" message if there is no notification
      if (data.notifications.length == 0 && !untilDate) {
        self.displayNoNotification();
      }
      // Display each entry
      for (var i = 0; i < data.notifications.length; ++i) {
        self.displayEntry(data.notifications[i]);
      }
      self.macro.find('.notifications-macro-load-more').remove();
      var lastCompositeEvent = data.notifications[data.notifications.length - 1];
      var lastEventDate = lastCompositeEvent.dates[lastCompositeEvent.dates.length - 1];

      // If there is other notifications to load
      if (data.notifications.length == self.notificationsLimit) {
        var loadMore = $('<div>').addClass('text-center').addClass('notifications-macro-load-more');
        // Prevent the new macro which listens on events on the DOM to add one more button.
        loadMore.data('augmented', true);
        var btn = $('<button>');
        btn.text("\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0441\u0442\u0430\u0440\u044B\u0435 \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F");
        btn.addClass('btn').addClass('btn-default').addClass('btn-block');
        loadMore.append(btn);
        self.insertElementInMacroContainer(loadMore);
        btn.on('click', function(event) {
          loadMore.text('').addClass('loading').css('height', '50px');
          // We use the date of the last displayed event as an offset to display those that come next
          self.load(lastEventDate);
        });
      }
      // Remove loading items
      self.macro.removeClass('loading');
      // Call the listeners
      promise.resolve(data.notifications);
    };

    /**
     * Add the given DOM element into the macro container (could be before the RSS link if there is one).
     */
    self.insertElementInMacroContainer = function (domToInsert) {
        self.macro.append(domToInsert);
    };

    /**
     * Display a notification entry
     */
    self.displayEntry = function (entry) {
      // Add the id of the entry to the blacklist
      for (var i = 0; i < entry.ids.length; ++i) {
        self.blackList.push(entry.ids[i]);
      }
      // Create the container
      var notif = $('<div>').addClass('notification-event');
      notif.attr('data-eventtype', entry.type);
      // Put the content
      notif.append(entry.html);
      // Enable the "read" button
      var readButton = notif.find('.notification-event-read-button');
      if (!entry.read && self.displayReadStatus) {
        // Make sure the style of the notification is in line with its status.
        notif.addClass('notification-event-unread');
        readButton.prop('disabled', false);
        readButton.removeClass('hidden');
      }
      if (entry.exception) {
        var exceptionBox = $('<div>').addClass('box errormessage');
        exceptionBox.text(entry.exception);
        notif.append(exceptionBox);
      }
      // Store the data in the DOM element so that any javascript code can retrieve it
      notif.data('notif', entry);
      // Prevent the data to call the new macro augmentation
      notif.data('augmented', true);
      // Add the notification entry
      self.insertElementInMacroContainer(notif);
      // Add the "mark as read" button if the notif is not already read
      if (!entry.read) {
        // On click
        readButton.on('click', function() {
          var notif = $(this).parents('div.notification-event');
          notif.removeClass('notification-event-unread');
          var url = new XWiki.Document(XWiki.Model.resolve('XWiki.Notifications.Code.NotificationsDisplayerUIX',
            XWiki.EntityType.DOCUMENT)).getURL('get', 'outputSyntax=plain');
          $.post(url, {
            action: 'read',
            eventIds: notif.data('notif').ids.join(','),
            read: true
          });
          $(this).remove();
          self.macro.trigger('eventMarkedAsRead', notif);
        });
      }
      // Details
      var details = notif.find('.notification-event-details');
      details.hide();
      var arrow = notif.find('.notification-event-arrow');
      notif.find('.toggle-notification-event-details').on('click', function() {
        details.toggle();
        arrow.text(arrow.text() == '▸' ? '▾' : '▸');
      });
    };

    /**
     * Display a message saying there is no content
     */
    self.displayNoNotification = function () {
      self.macro.removeClass('loading').html($('<p>').addClass('text-center noitems')
        .text("\u041D\u0435\u0442 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B\u0445 \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u0439!"));
    };
  };

  return factory;
});

define('XWikiAsyncNotificationsMacro', ['jquery', 'xwiki-meta', 'XWikiNotificationsMacro'], function($, xm, XWikiNotificationsMacro) {
  /**
   * Construct a XWikiAsyncNotificationsMacro.
   *
   * @param macro DOM element that will be uses as container for the notifications.
   */
  var factory = function(macro) {
    var self = this;
    self.macro = $(macro);
    self.displayReadStatus = self.macro.attr('data-displayReadStatus').toLowerCase() == 'true';
    self.asyncLoaded = false;

    self.bindLoadMore = function (loadMore) {
      if (!loadMore.data('augmented')) {
        loadMore.data('augmented', true);
        loadMore.addClass('text-center');
        var btn = $('<button>');
        btn.text("\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0441\u0442\u0430\u0440\u044B\u0435 \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F");
        btn.addClass('btn').addClass('btn-default').addClass('btn-block');
        loadMore.append(btn);
        btn.on('click', function(event) {
          loadMore.text('').addClass('loading').css('height', '50px');
          // We use the date of the last displayed event as an offset to display those that come next
          var lastEventDate = self.macro.find('.notification-event').last().attr('data-eventdate');
          new XWikiNotificationsMacro(self.macro).load(lastEventDate);
        });
      }
    };

    self.augmentEntry = function (entry) {
      if (!entry.data('augmented')) {
        // Ensure to not call twice this method.
        entry.data('augmented', true);
        if (entry.hasClass("notification-event-unread") && self.displayReadStatus) {
          // Enable the "read" button
          var readButton = entry.find('.notification-event-read-button');
          readButton.prop('disabled', false);
          readButton.removeClass('hidden');
          // On click
          readButton.on('click', function() {
            var notif = $(this).parents('div.notification-event');
            notif.removeClass('notification-event-unread');
            var url = new XWiki.Document(XWiki.Model.resolve('XWiki.Notifications.Code.NotificationsDisplayerUIX',
              XWiki.EntityType.DOCUMENT)).getURL('get', 'outputSyntax=plain');
            $.post(url, {
              action: 'read',
              eventIds: notif.attr('data-ids'),
              read: true
            });
            $(this).remove();
            self.macro.trigger('eventMarkedAsRead', entry);
          });
        }
        // Details
        var details = entry.find('.notification-event-details');
        details.hide();
        var arrow = entry.find('.notification-event-arrow');
        entry.find('.toggle-notification-event-details').on('click', function() {
          details.toggle();
          arrow.text(arrow.text() == '▸' ? '▾' : '▸');
        });
      }
    };

    // Ensure that if the async already answered before the definition of the observer we augment it.
    self.macro.find('.notifications-macro-load-more').each(function() {
      self.bindLoadMore($(this));
    });
    self.macro.find('.notification-event').each(function() {
      self.augmentEntry($(this));
    });

    self.processEvents = function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var mutation = mutations[i];
        for (var j = 0; j < mutation.addedNodes.length; j++) {
          var element = mutation.addedNodes[j];

          // We perform the binding only if the newly added element concern the current macro container
          if (self.macro.has($(element)).length > 0) {
            if ($(element).hasClass('notification-event')) {
              self.augmentEntry($(element));
            }

            if ($(element).hasClass('notifications-macro-load-more')) {
              self.bindLoadMore($(element))
            }
          }
        }
      }
    };

    // Register a callback for when the async is done.
    var observer = new MutationObserver(self.processEvents);
    observer.observe(document, { childList: true, subtree : true});
  };

  return factory;
});

