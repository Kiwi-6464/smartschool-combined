/**
 * Smartschool Combined — page guard. Loaded FIRST.
 *
 * The extension must do nothing on the sign-in flow. manifest.json already
 * excludes these paths, so on a normal school none of our scripts or CSS
 * load there. This is the second line of defence for a login screen that
 * shows up on another URL: every other content script starts with
 * `if (window.sscSkipPage) return;`.
 *
 * The paths are the same for every school (only the host differs):
 * /login, /account-verification (birthday check) and /2fa. `.login-app` is
 * the sign-in form's own root, in case a school serves it elsewhere.
 */
(function () {
  "use strict";

  var LOGIN_PATH = /^\/(login|account-verification|2fa)(\/|$)/i;

  var skip = false;
  try {
    skip = LOGIN_PATH.test(location.pathname) || !!document.querySelector(".login-app");
  } catch (e) {
    skip = false;
  }

  window.sscSkipPage = skip;
})();
