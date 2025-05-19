require.config({
  paths: {
    'xwiki-suggestUsers': "..\/..\/resources\/uicomponents\/suggest\/suggestUsersAndGroups.min.js"
  }
});
require(['deferred!ckeditor', 'xwiki-suggestUsers', 'jquery', 'xwiki-meta'], function (ckeditorPromise, suggestUsers, $, xm) {

  /**
   * Get the current wiki scope for displaying global, local or global and local users
   */
  const userScope = "GLOBAL_ONLY";

  // see https://stackoverflow.com/a/6248722/657524
  function random6chars() {
    // I generate the UID from two parts here 
    // to ensure the random number provide enough bits.
    var firstPart = (Math.random() * 46656) | 0;
    var secondPart = (Math.random() * 46656) | 0;
    firstPart = ("000" + firstPart.toString(36)).slice(-3);
    secondPart = ("000" + secondPart.toString(36)).slice(-3);
    return firstPart + secondPart;
  }

  /**
   * Compute a new unique anchor for the given reference.
   * The unique anchor is based on the mentionned user id, concatenaed with a random string of 6 alphanumeric
   * characters.
   * The chances of collision are quite low, about 46k mentions for a given mentioned user on a given page (assuming
   * that no mentions are ever deleted).
   */
  const getAnchor = function (reference) {
    const refId = reference.replace(/[.:]/g, '-');
    const randomId = random6chars();
    return refId + '-' + randomId;
  };

  const search = function (text, callback) {
    const params = {
      'input': text,
      'limit': 6,
    };
    suggestUsers.loadUsers(userScope, params).then(users => {
      const cct = users.map(function (x) {
        // insert an id because that's required by the mentions plugins.
        x.id = x.value;
        // Make sure to display the icon avatar or the image one.
        if (x.icon.cssClass) {
          x.imgClass = "hidden";
          x.cssClass = x.icon.cssClass;
        } else {
          x.imgUrl = x.icon.url;
          x.cssClass = "hidden";
          x.imgClass = "";
        }
        x.iconHtml
        return x;
      });
      callback(cct);
    });
  }

  ckeditorPromise.then(ckeditor => {
    function getUserMentionsConfig(editor) {
      return {
        feed: function (opts, callback) {
          search(opts.query, callback);
        },
        marker: '@',
        minChars: 0,
        itemsLimit: 6,
        itemTemplate:
         `<li data-id="{id}" class="ckeditor-autocomplete-item">
            <div>
              <span class="ckeditor-autocomplete-item-icon-wrapper">
                <span class="{cssClass}"></span>
                <img src="{imgUrl}" class="{imgClass}"/>
              </span>
              <span class="ckeditor-autocomplete-item-label">{label}</span>
            </div>
          </li>`,
        outputTemplate: function (param) {
          editor.once('afterInsertHtml', function() {
            editor.execCommand('xwiki-macro-insert', {
              name: 'mention',
              inline: 'enforce',
              parameters: {
                reference: param.id,
                style: 'FULL_NAME',
                anchor: getAnchor(param.id)
              }
            });
          });
          // the outputTemplate insert nothing but wait for the afterInsertHtml event to be triggered
          // at this point the xwiki-macro-insert deals with the macro insertion in the rich editor.
          return '';
        }
      };
    }

    // Enable the user mentions for the CKEditor instances that have been already created.
    Object.values(ckeditor.instances).forEach(maybeEnableUserMentions);
    // Enable the user mentions for the CKEditor instances that are going to be created from now on.
    ckeditor.on('instanceCreated', (event) => {
      maybeEnableUserMentions(event.editor);
    });

    function maybeEnableUserMentions(editor) {
      return waitForEditorReady(editor).then((editor) => {
        // Check if the Mentions plugin is enabled for the given editor instance.
        // TODO: Add support for disabling the user mentions for a particular editor instance (without disabling all
        // types of mentions).
        if (editor.plugins.mentions) {
          editor.plugins.mentions.instances.push(new ckeditor.plugins.mentions(editor, getUserMentionsConfig(editor)));
        }
        return editor;
      });
    }

    function waitForEditorReady(editor) {
      return new Promise((resolve, reject) => {
        if (editor.status === 'ready') {
          resolve(editor);
        } else {
          editor.once('instanceReady', (event) => {
            resolve(event.editor);
          });
        }
      });
    }
  });
});
