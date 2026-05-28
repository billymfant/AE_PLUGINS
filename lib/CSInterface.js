/**
 * CSInterface stub for browser-based UI preview.
 *
 * IMPORTANT: In production, replace this file with the real CSInterface.js
 * from Adobe's CEP SDK:
 *   https://github.com/Adobe-CEP/CEP-Resources/tree/master/CEP_11.x
 *
 * Copy CEP_11.x/CSInterface.js (or the version matching your CSXS requirement)
 * to this location.  The real file is required for the extension to communicate
 * with After Effects.  This stub only prevents JS errors when previewing the
 * panel layout in a web browser.
 */
if (typeof CSInterface === 'undefined') {
  function CSInterface() {}

  CSInterface.prototype.evalScript = function(script, callback) {
    if (typeof callback === 'function') {
      callback(JSON.stringify({ error: 'Running outside After Effects — CSInterface stub active.' }));
    }
  };

  CSInterface.prototype.getSystemPath    = function() { return ''; };
  CSInterface.prototype.addEventListener = function() {};
  CSInterface.prototype.removeEventListener = function() {};
  CSInterface.prototype.getApplicationID  = function() { return 'AEFT'; };
  CSInterface.prototype.getExtensionID    = function() { return 'com.aeplugins.suite.panel'; };
}
