// Runs in the page's MAIN world — can intercept window.fetch
(function () {
  'use strict';

  const USAGE_KEYS = ['limit', 'usage', 'quota', 'session', 'plan', 'remaining', 'rate_limit'];

  function mightBeUsageData(obj) {
    if (!obj || typeof obj !== 'object') return false;
    try {
      const str = JSON.stringify(obj).toLowerCase();
      return USAGE_KEYS.some((k) => str.includes(k));
    } catch {
      return false;
    }
  }

  function dispatch(url, data) {
    window.dispatchEvent(
      new CustomEvent('__claude_monitor__', { detail: { url, data } })
    );
  }

  // Intercept fetch
  const _fetch = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    const response = await _fetch(input, init);
    const url = typeof input === 'string' ? input : input?.url || '';
    const ct = response.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      response
        .clone()
        .json()
        .then((data) => {
          if (mightBeUsageData(data)) dispatch(url, data);
        })
        .catch(() => {});
    }
    return response;
  };

  // Intercept XHR
  const _open = XMLHttpRequest.prototype.open;
  const _send = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__monitorUrl = url;
    return _open.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (body) {
    this.addEventListener('load', function () {
      try {
        const ct = this.getResponseHeader('content-type') || '';
        if (ct.includes('application/json')) {
          const data = JSON.parse(this.responseText);
          if (mightBeUsageData(data)) dispatch(this.__monitorUrl || '', data);
        }
      } catch {}
    });
    return _send.call(this, body);
  };
})();
