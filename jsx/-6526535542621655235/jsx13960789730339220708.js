define('xwiki-pdf-export-messages', {
  keys: [
    'core.export.pdf.options.title',
    'export.pdf.options.template',
    'export.pdf.options.template.hint',
    'export.pdf.options.loadFailure',
    'export.pdf.generator.checking',
    'export.pdf.generator.unavailable',
    'export.pdf.generator.checkFailed',
    'export.pdf.modal.close',
    'export.pdf.inProgress',
    'export.pdf.failed',
    'export.pdf.lastError',
    'export.pdf.canceling',
    'export.pdf.canceled',
    'export.pdf.cancelFailed',
    'export.pdf.loading',
    'export.pdf.pageReadyTimeout',
    'cancel'
  ]
});

define('xwiki-pdf-export-config', ['jquery'], function($) {
  try {
    return JSON.parse($('#pdfExportConfig').text());
  } catch (e) {
    console.error(e);
    return {};
  }
});

require([
  'jquery',
  'xwiki-meta',
  'xwiki-pdf-export-config',
  'xwiki-l10n!xwiki-pdf-export-messages',
  'xwiki-job-runner',
  'bootstrap'
], function($, xwikiMeta, config, l10n, JobRunner) {
  const renderIcon = function(iconMetaData) {
    let icon = $([]);
    if (iconMetaData.cssClass) {
      icon = $('<span></span>').addClass(iconMetaData.cssClass);
    } else if (iconMetaData.url) {
      icon = $('<img/>').attr('src', iconMetaData.url);
    }
    return icon.addClass('icon');
  }

  const pdfExportOptionsModal = $(`
    <form class="modal xform" id="pdfExportOptions" tabindex="-1" role="dialog"
        aria-labelledby="pdfExportOptionsTitle">
      <div class="modal-dialog" role="document">
        <div class="modal-content">
          <div class="modal-header">
            <button type="button" class="close" data-dismiss="modal">
              <span aria-hidden="true">&times;</span>
            </button>
            <h4 class="modal-title" id="pdfExportOptionsTitle"></h4>
          </div>
          <div class="modal-body">
            <div class="alert alert-progress"></div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-default" data-dismiss="modal"></button>
          </div>
        </div>
      </div>
    </form>
  `);
  pdfExportOptionsModal.find('button.close').attr({
    'title': l10n['export.pdf.modal.close'],
    'aria-label': l10n['export.pdf.modal.close']
  });
  pdfExportOptionsModal.find('.modal-title').text(l10n['core.export.pdf.options.title'])
    .prepend(renderIcon(config.icons.pdf));
  pdfExportOptionsModal.find('.btn-default').text(l10n['cancel']);
  // Fade only on hide. We don't want to fade on show because we want the transition from the Export modal (previous
  // step) to be fast and smooth.
  pdfExportOptionsModal.on('shown.bs.modal', function() {
    // We need the fade CSS class name on the backdrop also, otherwise we get an ugly flicker when the modal is hidden.
    pdfExportOptionsModal.add('.modal-backdrop.in').addClass('fade');
  });

  const templateOption = $(`
    <dl>
      <dt>
        <label for="pdfTemplate"></label>
        <span class="xHint"></span>
      </dt>
      <dd>
        <select id="pdfTemplate" name="pdftemplate"></select>
      </dd>
    </dl>
  `);
  templateOption.find('label').text(l10n['export.pdf.options.template']);
  templateOption.find('.xHint').text(l10n['export.pdf.options.template.hint']);
  if (Array.isArray(config.templates)) {
    const select = templateOption.find('select');
    config.templates.forEach(template => {
      $('<option></option>').text(template.label).attr('value', template.value).appendTo(select);
    });
    // Select the first option by default.
    select.find('option').first().attr('selected', 'selected');
  }

  const checkIfPDFPrinterIsAvailable = function() {
    if (!config.serverSide) {
      return Promise.resolve();
    }

    $('body').css('cursor', 'wait');
    const notification = pdfExportOptionsModal.find('.modal-body > .alert')
      .text(l10n['export.pdf.generator.checking'])
      .prepend(renderIcon(config.icons.spinner));
    return fetch(XWiki.currentDocument.getURL('get', $.param({
      outputSyntax: 'plain',
      sheet: 'XWiki.PDFExport.WebHome',
      data: 'serverSidePrintingAvailable',
    }))).then(response => response.json()).then(data => {
      if (!data.serverSidePrintingAvailable) {
        return Promise.reject(l10n['export.pdf.generator.unavailable']);
      }
    }).catch(reason => {
      notification.removeClass('alert-progress').addClass('alert-danger')
        .text(reason || l10n['export.pdf.generator.checkFailed'])
        .prepend(renderIcon(config.icons.error));
      // Propagate the error in order to prevent the loading of the PDF export options.
      return Promise.reject(reason);
    }).finally(() => {
      $('body').css('cursor', '');
    });
  };

  const openPDFOptionsModal = function(url, data) {
    // Store the document selection so it can be used later when the modal is submitted.
    pdfExportOptionsModal.data('selection', data);
    // Disable the animation on show in order to have a smooth transition from the previous modal.
    pdfExportOptionsModal.removeClass('fade').modal();
    if (pdfExportOptionsModal.data('state')) {
      // The modal is either loaded or in the process of being loaded.
      return;
    }
    pdfExportOptionsModal.attr('data-state', 'loading');
    checkIfPDFPrinterIsAvailable().then(
      () => loadPDFOptions(url),
      // Fail silently because the user has already been notified.
      () => {}
    );
  };

  const loadPDFOptions = function(url) {
    const notification = pdfExportOptionsModal.find('.modal-body > .alert')
      .text(l10n['export.pdf.loading'])
      .prepend(renderIcon(config.icons.spinner));
    $('<div></div>').load(url + ' #pdfExportOptions', function() {
      const form = $(this).find('#pdfExportOptions');
      if (form.length) {
        form.find('.buttons').appendTo(pdfExportOptionsModal.find('.modal-footer').empty());
        // Hide useless options.
        form.find('#comments, #attachments').closest('dt').hide().parent().css('margin-bottom', '0');
        // Add the template option.
        form.find('dl').prepend(templateOption.contents());
        pdfExportOptionsModal.attr('action', form.attr('action'));
        pdfExportOptionsModal.find('.modal-body').empty().append(form.contents());
        pdfExportOptionsModal.attr('data-state', 'loaded');
      } else {
        notification.removeClass('alert-progress').addClass('alert-danger')
          .text(l10n['export.pdf.options.loadFailure'])
          .prepend(renderIcon(config.icons.error));
      }
    });
  };

  // There's no PDF export job started. This promise is used to cancel the PDF export job (the job needs to be started
  // before we can cancel it).
  let pdfExportJobStarted = false;

  const runPDFExportJob = function(data) {
    let resolvePDFExportJobStarted, rejectPDFExportJobStarted;
    pdfExportJobStarted = new Promise((resolve, reject) => {
      resolvePDFExportJobStarted = resolve;
      rejectPDFExportJobStarted = reject;
    });
    const locale = document.documentElement.getAttribute('lang') || '';
    data.push(
      {name: 'outputSyntax', value: 'plain'},
      {name: 'sheet', value: 'XWiki.PDFExport.WebHome'},
      {name: 'action', value: 'export'},
      {name: 'form_token', value: xwikiMeta.form_token},
      // We pass the locale in order to make sure the document saved in the PDF export job context (when the job is
      // scheduled) matches the current document translation.
      {name: 'language', value: locale},
      // We add the current value of the query string because we want to export the current state of the page (the query
      // string can hold for instance the state of the live data component).
      {name: 'pdfQueryString', value: window.location.search.substring(1)},
      // We add the hash (document fragment) because it can contain information used by the JavaScript code (e.g. the
      // state of the live table component).
      {name: 'pdfHash', value: window.location.hash.substring(1)}
    );
    // If the PDF export is triggered on a document revision then we need to make sure that document revision is saved
    // in the PDF export job context when the job is scheduled.
    const urlParams = new URLSearchParams(window.location.search);
    const revision = urlParams.get('rev');
    if (revision) {
      data.push({name: 'rev', value: revision});
    }
    return Promise.resolve(new JobRunner({
      createStatusRequest: function(jobId) {
        resolvePDFExportJobStarted(jobId);
        return {
          url: XWiki.currentDocument.getURL('get'),
          data: {
            outputSyntax: 'plain',
            sheet: 'XWiki.PDFExport.WebHome',
            data: 'jobStatus',
            jobId: jobId.join('/')
          }
        };
      }
    }).run(XWiki.currentDocument.getURL('get'), data)).catch((reason) => {
      // We need to reject any pending cancel requests.
      rejectPDFExportJobStarted();
      // But we also need to reject the PDF export itself.
      return Promise.reject(reason);
    }).finally(() => {
      pdfExportJobStarted = false;
    });
  };

  const cancelPDFExportJob = (jobId) => {
    return Promise.resolve($.post(XWiki.currentDocument.getURL('get'), {
      outputSyntax: 'plain',
      sheet: 'XWiki.PDFExport.WebHome',
      action: 'cancel',
      form_token: xwikiMeta.form_token,
      jobId: jobId.join('/')
    }));
  };

  const showPrintPreviewModal = function({jobId, language}) {
    return new Promise((resolve, reject) => {
      const iframe = $('<iframe/>').css({
        // The load event is not fired if we hide it completely with display:none.
        'visibility': 'hidden',
        // The iframe needs to be in the viewport otherwise Safari is very slow in rendering its document (it seems it
        // applies some kind of lazy processing but we couldn't disable this using loading=eager on the iframe).
        'position': 'fixed',
        'top': 0,
        // Use the same width as the main window because the CSS or JavaScript code could rely on it (we want the result
        // to look exactly as if the user has opened the export URL directly).
        'width': $(window).width(),
        // Remove the borders in order to have exacly the same width as the window (viewport). See above.
        'border': 0,
        // Reduce a bit the height (to the height of the top bar). This is technically not needed, but we want to make
        // sure the iframe doesn't cover something important.
        'height': '50px'
      }).on('load', () => {
        iframe[0].contentWindow.require(['xwiki-page-ready'], function(pageReady) {
          setTimeout(() => {
            // Remove the iframe because if an infinite loop prevented the page to be ready for print then it will
            // continue to drain resources, slowing down the user's browser.
            iframe.remove();
            reject(l10n['export.pdf.pageReadyTimeout']);
          }, config.pageReadyTimeout * 1000);
          pageReady.afterPageReady(() => {
            // Trigger the print only after all page ready callbacks were executed, because the print preview is
            // initialized as a page ready callback.
            pageReady.afterPageReady(() => {
              // Chrome incorrectly uses the title of this HTML page as the default file name when saving the PDF from
              // the Print Preview modal, instead of using the title of the HTML page loaded in the iframe for which we
              // triger the print (like Firefox does). We workaround this by temporarily setting the title of this HTML
              // page to match the title of the HTML page loaded in the iframe.
              const originalTitle = document.title;
              document.title = iframe[0].contentDocument.title;
              iframe[0].contentWindow.print();
              iframe.remove();
              document.title = originalTitle;
              resolve();
            });
          });
        });
      });
      const exportURL = XWiki.currentDocument.getURL('export', $.param({
        format: 'html-print',
        xpage: 'get',
        outputSyntax: 'plain',
        // Asynchronous rendering is disabled by default on the export action so we need to force it.
        async: true,
        sheet: 'XWiki.PDFExport.Sheet',
        jobId: jobId.join('/'),
        language
      // We add the query string and hash (fragment identifier) from the current URL because they can contain
      // information used by the JavaScript code (e.g. the state of the live table and live data components).
      }) + '&' + window.location.search.substring(1)) + window.location.hash;
      iframe.attr('src', exportURL).appendTo($('body'));
    });
  };

  const exportToPDF = function(data) {
    // The HTTP requests that start the PDF export job and load the print preview have the language specified in the
    // query string which changes the current locale. We need to restore the original locale after the export is done.
    // This is the original locale we need to restore.
    const uiLanguage = $('html').attr('lang');
    const language = data.find(entry => entry.name === 'language')?.value || uiLanguage;
    const restoreLanguage = () => {
      if (language !== uiLanguage) {
        // Make an additional request to restore the original locale. We're using sendBeacon because this can happen
        // right before the user is redirected to the generated PDF (when the PDF is generated server-side).
        navigator.sendBeacon(`${XWiki.contextPath}/rest?language=${encodeURIComponent(uiLanguage)}`);
      }
    };
    return runPDFExportJob(data).finally(restoreLanguage).then(job => {
      // Remove the exception name from the start of the error message to make it less technical.
      const lastError = ((job.lastError || '') + '').replace(/^\w+Exception: /, '');
      if (job.canceled) {
        // Do nothing.
      } else if (job.failed || (config.serverSide && !job.pdfFileURL)) {
        // Either the job failed, or the PDF file should have been generated server-side but it wasn't.
        return Promise.reject(lastError);
      } else if (job.pdfFileURL) {
        // The PDF file was generated on the server-side. The user just needs to download it.
        window.location.href = job.pdfFileURL;
      } else {
        // The PDF file is going to be generated using the user's own web browser.
        if (lastError) {
          // The PDF export job log contains some error messages that might explain why the PDF file doesn't have the
          // expected content.
          new XWiki.widgets.Notification(l10n.get('export.pdf.lastError', lastError), 'warning',
            // Increase a bit the timeout so that the user has the time to read the warning message.
            {timeout : 10});
        }
        // Show the Print Preview modal in order for the user to be able to save the result as PDF.
        return showPrintPreviewModal({jobId: job.id, language}).finally(restoreLanguage);
      }
    })
  };

  pdfExportOptionsModal.on('submit', event => {
    event.preventDefault();
    $('body').css('cursor', 'wait');
    const notification = new XWiki.widgets.Notification(l10n['export.pdf.inProgress'], 'inprogress');
    // Prevent multiple clicks on the export button.
    pdfExportOptionsModal.find('.modal-footer input[type=submit]').prop('disabled', true);
    // Concatenate the PDF export options with the document selection.
    const data = pdfExportOptionsModal.serializeArray().concat(pdfExportOptionsModal.data('selection'));
    exportToPDF(data).then(() => {
      // PDF export job finished.
      notification.hide();
    }).catch(reason => {
      // PDF export job failed.
      let message = l10n['export.pdf.failed'];
      if (reason) {
        message += `: ${reason}`;
      }
      notification.replace(new XWiki.widgets.Notification(message, 'error'));
    }).finally(() => {
      // Re-enable the PDF export options modal.
      pdfExportOptionsModal.find('.modal-footer input[type=submit]').prop('disabled', false);
      $('body').css('cursor', '');
    });
  });

  pdfExportOptionsModal.on('click', 'a.secondary.button', event => {
    event.preventDefault();
    pdfExportOptionsModal.modal('hide');
  });

  pdfExportOptionsModal.on('hide.bs.modal', event => {
    const closeButton = pdfExportOptionsModal.find('.modal-header button.close');
    if (closeButton.prop('disabled')) {
      // Don't close the modal because there's a pending cancel request.
      return event.preventDefault();
    } else if (pdfExportJobStarted) {
      // Cancel the running PDF export job.
      const notification = new XWiki.widgets.Notification(l10n['export.pdf.canceling'], 'inprogress');
      // Prevent multiple cancel requests.
      pdfExportOptionsModal.find('.modal-header button.close').prop('disabled', true);
      pdfExportOptionsModal.find('.modal-footer a.secondary.button').addClass('disabled');
      pdfExportJobStarted.then(cancelPDFExportJob).then(() => {
        notification.replace(new XWiki.widgets.Notification(l10n['export.pdf.canceled'], 'done'));
      }).catch(() => {
        notification.replace(new XWiki.widgets.Notification(l10n['export.pdf.cancelFailed'], 'error'));
      }).finally(() => {
        // Allow the user to retry the cancel (e.g. in case it failed due to some network issue).
        pdfExportOptionsModal.find('.modal-header button.close').prop('disabled', false);
        pdfExportOptionsModal.find('.modal-footer a.secondary.button').removeClass('disabled');
      });
      // Don't close the modal because the job doesn't finish immediately after being canceled.
      return event.preventDefault();
    }
  });

  const switchToPDFOptionsModal = function(event, previousModal, url, data) {
    event.preventDefault();
    event.stopPropagation();
    // Show the PDF Export Options modal only after the previous modal is completely hidden, otherwise the code that
    // hides the previous modal can revert changes done by the code that shows the PDF Export Options modal (e.g. we
    // loose the 'modal-open' CSS class on the BODY element which is needed in order to hide the page scrollbars).
    previousModal.one('hidden.bs.modal', () => {
      // Enable the animation back for the next time the previous modal is shown.
      previousModal.addClass('fade');
      openPDFOptionsModal(url, data);
    // Disable the animation when moving to the next step (PDF Export Options) in order to have a smooth transition.
    }).removeClass('fade').modal('hide');
  };

  // Customize the Export Tree Modal.
  const exportTreeModal = $('#exportTreeModal').on('show.bs.modal', event => {
    if (exportTreeModal.data('config').id === 'org.xwiki.platform.export.pdf.exportFormats') {
      $(document).on('submit.export.pdf', 'form#export-modal-form', event => {
        const form = $(event.target);
        // Pass the document selection to the PDF export options modal.
        switchToPDFOptionsModal(event, exportTreeModal, exportTreeModal.data('config').url, form.serializeArray());
      });
    }
  });

  exportTreeModal.on('hide.bs.modal', event => {
    // Cleanup.
    $(document).off('submit.export.pdf');
  });

  // Customize the Export Modal.
  $('.xwiki-select.xwiki-export-formats').on('xwiki:select:updated', function(event) {
    const exportFormat = $(this).find('.xwiki-select-option-selected input[name=exportFormat]');
    if (exportFormat.val() === 'org.xwiki.platform.export.pdf.exportFormats' && !$('#exportTreeModal').length) {
      // Single selection. Only the current page is exported.
      switchToPDFOptionsModal(event, $('#exportModal'), exportFormat.attr('data-url'), [{
        name: 'pages',
        value: XWiki.Model.serialize(XWiki.currentDocument.documentReference)
      }]);
    }
  });
});
