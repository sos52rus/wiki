define('attachment-validation-mimetype-messages', {
  prefix: 'attachment.validation.mimetype.',
  keys: [
    'errorMessage',
    'allowedMimetypes',
    'blockerMimetypes'
  ]
});

require(['jquery', 'xwiki-l10n!attachment-validation-mimetype-messages', 'xwiki-events-bridge'], ($, l10n) => {
  function checkMimetype(mimetypes, mimetype) {
    return mimetypes.some(mimetypePattern => {
      const indexOfJoker = mimetypePattern.indexOf('*');
      if (indexOfJoker === -1) {
        return mimetypePattern === mimetype;
      } else {
        const prefix = mimetypePattern.substring(0, indexOfJoker);
        const suffix = mimetypePattern.substring(indexOfJoker + 1, mimetypePattern.length);
        return mimetype.startsWith(prefix) && mimetype.endsWith(suffix);
      }
    });
  }

  const configCache = {};

  $(document).on('xwiki:actions:beforeUpload', function (event, data) {
    let jsonString;
    if (data.documentReference) {
      if (!configCache[data.documentReference]) {
        $.ajax({
          url: new XWiki.Document(XWiki.Model.resolve('XWiki.Attachment.Validation.Code.MimetypeValidation',
            XWiki.EntityType.DOCUMENT)).getURL('get', $.param({
            outputSyntax: 'plain',
            documentReference: data.documentReference
          })),
          async: false,
          method: 'GET',
          success: function (getData) {
            configCache[data.documentReference] = getData;
          }
        })
      }
      jsonString = configCache[data.documentReference];
    } else {
      jsonString = document.getElementById('attachment-validation-mimetypes-configuration').textContent;
    }
    const config = JSON.parse(jsonString);
    const mimeType = data.file.type.toLowerCase();
    const allowedMimetypes = config.allowedMimetypes;
    const blockerMimetypes = config.blockerMimetypes;
    const hasAllowedMimetypes = allowedMimetypes.length > 0;
    const hasBlockerMimetypes = blockerMimetypes.length > 0;
    const hasInvalidMimetype = hasAllowedMimetypes && !checkMimetype(allowedMimetypes, mimeType)
      || hasBlockerMimetypes && checkMimetype(blockerMimetypes, mimeType);
    if (hasInvalidMimetype) {
      let localizedMessage = l10n.get('errorMessage', data.file.name, mimeType);
      if (hasAllowedMimetypes) {
        localizedMessage += '<br/>' + l10n.get('allowedMimetypes', allowedMimetypes);
      }
      if (hasBlockerMimetypes) {
        localizedMessage += '<br/>' + l10n.get('blockerMimetypes', blockerMimetypes)
      }
      new XWiki.widgets.Notification(localizedMessage, "error");
      event.preventDefault();
    }
  });
})
