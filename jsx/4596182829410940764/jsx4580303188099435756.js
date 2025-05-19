/*!
*/
// Start JavaScript-only code.
(function(l10n) {
  "use strict";

/**
 * Update the content after changing the activations status and create/delete objects.
 */
require(['jquery', 'NumberedHeadingsConfig', 'bootstrap'], function($, config) {
  var isActivated = function(selectElement) {
    switch (selectElement.val()) {
      case "activated":
        return true;
      case "deactivated":
        return false;
      default:
        return config.isActivatedOnParent()
    }
  }

  $(document).on('change.numberedHeadingsStatus', '.PanelsDocumentInformation #NumberedHeadings\\.Code\\.NumberedHeadingsClass_0_status', function() {
    const activationSelect = $(this);
    const selectedValue = activationSelect.val();

    const currentStatus = config.isActivated();
    const targetStatus = isActivated(activationSelect);

    if (selectedValue === '') {
      activationSelect.siblings().remove('input[name=addedObjects]');
      if (!activationSelect.siblings('input[name=deletedObjects]').length) {
        activationSelect.parent().append($('<input />', {type: 'hidden', name: 'deletedObjects', value: 'NumberedHeadings.Code.NumberedHeadingsClass_0'}));
      }
    } else {
      activationSelect.siblings().remove('input[name=deletedObjects]');
      if (!activationSelect.siblings('input[name=addedObjects]').length) {
        activationSelect.parent().append($('<input />', {type: 'hidden', name: 'addedObjects', value: 'NumberedHeadings.Code.NumberedHeadingsClass_0'}));
      }
    }

    if (currentStatus !== targetStatus) {
      config.updateActivationStatus(targetStatus);
    }
  });

  $(document).on('xwiki:document:saved.xwikiHeadingNumberingChange', function(event) {
    // See if there is a heading numbering selector in the saved form.
    var form = $(event.target).closest('form, .form');
    var headingNumberingSelector = form.find('#NumberedHeadings\\.Code\\.NumberedHeadingsClass_0_status');
    if (headingNumberingSelector.length) {
      var currentStatus = config.isActivated();
      var targetStatus = isActivated(headingNumberingSelector);
      if (currentStatus == targetStatus) {
        return;
      }

      config.updateActivationStatus(targetStatus);
      // Check if we are viewing the document content.
      var contentWrapper = $('#xwikicontent').not('[contenteditable]');
      if (contentWrapper.length) {
        var notification = new XWiki.widgets.Notification(l10n['numbered.headings.activationUI.contentUpdate.inProgress'], 'inprogress');
        return render().done(function(output) {
          // Update the displayed document title and content.
          $('#document-title h1').html(output.renderedTitle);
          contentWrapper.html(output.renderedContent);
          // Let others know that the DOM has been updated, in order to enhance it.
          $(document).trigger('xwiki:dom:updated', {'elements': contentWrapper.toArray()});
          notification.replace(new XWiki.widgets.Notification(l10n['numbered.headings.activationUI.contentUpdate.done'], 'done'));
        }).fail(function() {
          notification.replace(new XWiki.widgets.Notification(l10n['numbered.headings.activationUI.contentUpdate.failed'], 'error'));
        });
      }
    }
  });

  var render = function() {
    var data = {
      // Get only the document content and title (without the header, footer, panels, etc.)
      xpage: 'get',
      // The displayed document title can depend on the rendered document content.
      outputTitle: true
    };
    return $.get(XWiki.currentDocument.getURL('view'), data).then(function(html) {
      // Extract the rendered title and content.
      var container = $('<div/>').html(html);
      return {
        renderedTitle: container.find('#document-title h1').html(),
        renderedContent: container.find('#xwikicontent').html()
      };
    });
  };
});

// End JavaScript-only code.
}).apply('', [{"numbered.headings.activationUI.contentUpdate.inProgress":"Updating content...","numbered.headings.activationUI.contentUpdate.done":"Content updated","numbered.headings.activationUI.contentUpdate.failed":"Content update failed"}]);
require(['jquery', 'deferred!ckeditor', 'NumberedHeadingsConfig'], function($, ckeditorPromise, config) {
  ckeditorPromise.done(ckeditor => {
    if (!('xwiki-numberedContent-activationUI' in ckeditor.plugins.registered)) {
      ckeditor.plugins.add('xwiki-numberedContent-activationUI', {
        init: function(editor) {
          // Refresh the content of the editor. The 'xwiki:wysiwyg:convertHTML' listened below will be triggered indirectly.
          $('#NumberedHeadings\\.Code\\.NumberedHeadingsClass_0_status').on('change', function() {
            editor.execCommand('xwiki-refresh');
          });
        }
      });

      // Read the current configuration of numbered heading in the select of the UIX and provide it for the convertHTML request.
      $(document).on('xwiki:wysiwyg:convertHTML', function(event, data) {
        const value = $('#NumberedHeadings\\.Code\\.NumberedHeadingsClass_0_status').val();
        var enableNumberedHeadings = false;

        if (value === '') {
          enableNumberedHeadings = config.isActivated();
        } else if (value == 'activated') {
          enableNumberedHeadings = true;
        }

        data.enableNumberedHeadings = enableNumberedHeadings;
      });

      ckeditor.on('instanceCreated', event => {
        if (event.editor.config.extraPlugins === '') {
          event.editor.config.extraPlugins = 'xwiki-numberedContent-activationUI';
        } else {
          event.editor.config.extraPlugins += ',xwiki-numberedContent-activationUI';
        }
      });
    }
  });
});
