require.config({
  paths: {
    'xwiki-suggestUsers': "..\/..\/resources\/uicomponents\/suggest\/suggestUsersAndGroups.min.js"
  }
});

require(['jquery', 'xwiki-suggestUsers'], function($) {
  'use strict';

  var modal = $(
    '<div class="modal" tabindex="-1" role="dialog" data-backdrop="static">' +
      '<div class="modal-dialog share-dialog" role="document">' +
        '<div class="modal-content">' +
          '<div class="modal-header">' +
            '<button type="button" class="close" data-dismiss="modal" aria-label="' +
                  "Отмена" +
                '">' +
              '<span aria-hidden="true">&times;</span>' +
            '</button>' +
            '<div class="modal-title">' +
              "Поделиться страницей" +
            '</div>' +
          '</div>' +
          '<div class="modal-body"></div>' +
        '</div>' +
      '</div>' +
    '</div>'
  );

  var initSharePage = function() {
    modal.find('.modal-body').removeClass('loading');
    modal.find('form').on('submit', onSubmit);
    modal.find('a.secondary.button').attr('data-dismiss', 'modal');
    modal.find('input[type="submit"]').prop('disabled', true);
    var shareTarget = modal.find('#shareTarget').suggestUsers({
      // Make it easier for the users to enter email addresses.
      createOnBlur: true,
      createFilter: /^.+@.+\..+$/
    });
    var selectize = shareTarget[0].selectize;
    selectize.on('change', function(value) {
      modal.find('input[type="submit"]').prop('disabled', !value);
    });
    var oldItemRenderer = selectize.settings.render.item;
    selectize.settings.render.item = function(item) {
      if (item && !item.icon && item.value && item.value.indexOf('@') > 0) {
        item.icon = {
          url: "..\/..\/resources\/icons\/silk\/email.png"
        };
      }
      return oldItemRenderer.call(this, item);
    };
    selectize.focus();
  };

  var onSubmit = function(event) {
    event.preventDefault();
    var form = $(this);
    var data = $(this).serialize() + '&xpage=shareinline';
    modal.find('.modal-body').addClass('loading').html('')
      .load(XWiki.currentDocument.getURL('get'), data, initShareStatus);
  };

  var initShareStatus = function() {
    modal.find('.modal-body').removeClass('loading');
    modal.find('.share-backlink').attr('data-dismiss', 'modal');
  };

  // If the share page form is present then initialize it right away.
  $('#shareTarget').length > 0 && initSharePage();

  // Load the share page form when the corresponding menu entry is clicked.
  $('#tmActionShare').on('click', function(event) {
    event.preventDefault();
    modal.find('.modal-body').addClass('loading').html('')
      .load(XWiki.currentDocument.getURL('get'), {'xpage': 'shareinline'}, initSharePage);
    modal.modal();
  });
});
