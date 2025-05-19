define('attachment-validation-filesize-messages', {
  prefix: 'attachment.validation.filesize.',
  keys: [
    'errorMessage'
  ]
});

require(['jquery', 'xwiki-l10n!attachment-validation-filesize-messages', 'xwiki-events-bridge'], ($, l10n) => {
  function formatBytes(bytes) {
    // Inspired from https://stackoverflow.com/a/18650828/657524
    if (!+bytes) {
      return '0 bytes'
    }

    const k = 1024
    const sizes = [' bytes', 'Kb', 'Mb', 'Gb', 'Tb', 'Pb', 'Eb', 'Zb', 'Yb']

    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))}${sizes[i]}`
  }

  const configCache = {};

  $(document).on('xwiki:actions:beforeUpload', (event, data) => {
    let jsonString;
    if (data.documentReference) {
      if (!configCache[data.documentReference]) {
        $.ajax({
          url: new XWiki.Document(XWiki.Model.resolve('XWiki.Attachment.Validation.Code.FileSizeValidation',
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
      jsonString = document.getElementById('attachment-validation-filesize-configuration').textContent;
    }
    const config = JSON.parse(jsonString);
    const maxFileSize = config.maxFileSize;
    const tooLarge = data.file.size > maxFileSize;
    if (tooLarge) {
      const localizedMessage = l10n.get('errorMessage', data.file.name, formatBytes(data.file.size),
        formatBytes(maxFileSize));
      new XWiki.widgets.Notification(localizedMessage, "error")
      event.preventDefault();
    }
  });
})
