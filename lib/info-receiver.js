'use strict';

var EventEmitter = require('events').EventEmitter
  , inherits = require('inherits')
  , urlUtils = require('./utils/url')
  , XDR = require('./transport/sender/xdr')
  , XHRCors = require('./transport/sender/xhr-cors')
  , XHRLocal = require('./transport/sender/xhr-local')
  , XHRFake = require('./transport/sender/xhr-fake')
  , InfoIframe = require('./info-iframe')
  , InfoAjax = require('./info-ajax')
  ;

var debug = function() {};
if (process.env.NODE_ENV !== 'production') {
  debug = require('debug')('sockjs-client:info-receiver');
}

function InfoReceiver(baseUrl, urlInfo, options) {
  debug(baseUrl);
  var self = this;
  EventEmitter.call(this);

  setTimeout(function() {
    self.doXhr(baseUrl, urlInfo, options);
  }, 0);
}

inherits(InfoReceiver, EventEmitter);

// TODO this is currently ignoring the list of available transports and the whitelist

InfoReceiver._getReceiver = function(baseUrl, url, urlInfo, options) {
  // determine method of CORS support (if needed)
  if (urlInfo.sameOrigin) {
    return new InfoAjax(url, XHRLocal, options);
  }
  if (XHRCors.enabled) {
	var xhrOpts = options && options.transportOptions ? (options.transportOptions['xhr-polling'] || options.transportOptions['xhr-streaming']) : null;
	return new InfoAjax(url, XHRCors, xhrOpts);
  }
  if (XDR.enabled && urlInfo.sameScheme) {
    return new InfoAjax(url, XDR, options);
  }
  if (InfoIframe.enabled()) {
    return new InfoIframe(baseUrl, url, options);
  }
  return new InfoAjax(url, XHRFake, options);
};

InfoReceiver.prototype.doXhr = function(baseUrl, urlInfo, options) {
  var self = this
    , url = urlUtils.addPath(baseUrl, '/info')
    ;
  debug('doXhr', url);

  this.xo = InfoReceiver._getReceiver(baseUrl, url, urlInfo, options);

  this.timeoutRef = setTimeout(function() {
    debug('timeout');
    self._cleanup(false);
    self.emit('finish');
  }, InfoReceiver.timeout);

  this.xo.once('finish', function(info, rtt) {
    debug('finish', info, rtt);
    self._cleanup(true);
    self.emit('finish', info, rtt);
  });
};

InfoReceiver.prototype._cleanup = function(wasClean) {
  debug('_cleanup');
  clearTimeout(this.timeoutRef);
  this.timeoutRef = null;
  if (!wasClean && this.xo) {
    this.xo.close();
  }
  this.xo = null;
};

InfoReceiver.prototype.close = function() {
  debug('close');
  this.removeAllListeners();
  this._cleanup(false);
};

InfoReceiver.timeout = 8000;

module.exports = InfoReceiver;
