var HMS = function(secs) {
  secs = secs || 0;
  if (isNaN(secs)) {
      throw new Error('Invalid input');
  }
  this._secs = Number(secs);
  this._hours = Math.floor(secs / 3600);
  this._minutes = Math.floor(secs % 3600 / 60);
  this._seconds = Math.floor(secs % 3600 % 60);
};

HMS.fromString = function(hms_text) {
  var array = hms_text.split(/:/);
  var h = 0, m = 0, s = 0;
  if (array.length == 3) {
      h = array[0];
      m = array[1];
      s = array[2];
  } else if (array.length == 2) {
      m = array[0];
      s = array[1];
  } else if (array.length == 1) {
      s = array[0];
  } else {
      return undefined;
  }
  if (isNaN(h) || isNaN(m) || isNaN(s)) {
      throw 'Parameter to HMS.fromString(' + hms_text + ') is not a valid time ' + h + ':' + m + ':' + s;
  }
  return HMS.create(h, m, s);
};

HMS.create = function(h, m, s) {
  h = h || 0;
  m = m || 0;
  s = s || 0;
  if (isNaN(h) || isNaN(m) || isNaN(s)) {
      throw 'Parameter to HMS.create(' + h + ',' + m + ',' + s + ') is not a number';
  }
  return new HMS(Number(h)*3600 + Number(m)*60 + Number(s));
};

HMS.to_s = function(v) {
  if (v == 0) {
      return "00";
  }
  if (v < 10) {
      return "0" + v;
  }
  return "" + v;
};

HMS.prototype.h2s = function() {
  return HMS.to_s(this._hours);
};

HMS.prototype.m2s = function() {
  return HMS.to_s(this._minutes);
};

HMS.prototype.s2s = function() {
  return HMS.to_s(this._seconds);
};

HMS.prototype.adjust_minutes = function(mins) {
  if (mins > 59) {
      this.adjust_seconds(mins*60);
  } else {
      this._minutes = mins;
  }
};

HMS.prototype.adjust_seconds = function(secs) {
  var hms = new HMS(secs);
  this._seconds = hms.seconds;
  this._minutes += hms.minutes;
  this._hours += hms.hours;
  this.adjust();
};

HMS.prototype.adjust = function() {
  var hms = new HMS(this.toSeconds());
  this._seconds = hms.seconds;
  this._minutes = hms.minutes;
  this._hours = hms.hours;
};

Object.defineProperties(HMS.prototype, {
  'hours': {
      get: function() { return this._hours; },
      set: function(hours) { this._hours = hours; }
  },
  'minutes': {
      get: function() { return this._minutes; },
      set: function(minutes) { this._minutes = minutes; }
  },
  'seconds': {
      get: function() { return this._seconds; },
      set: function(seconds) { this._seconds = seconds; }
  }
});

HMS.prototype.toSeconds = function() {
  return this._hours*3600 + this._minutes*60 + this._seconds;
};

HMS.prototype.pretty = function() {
  return this.toString() + ' is ' + this.toSeconds();
};

HMS.prototype.toName = function() {
  if (this._hours == 0 && this._minutes == 0) {
      return this.seconds + " " + _("seconds");
  } else if (this._hours == 0) {
      if (this._seconds == 0) {
          return this.minutes + " " + _("minutes");
      }
      return this.minutes + "m" + this.seconds + "s";
  }
  if (this.minutes == 0 && this.seconds == 0) {
      return this.hours + " " + _("hours");
  }
  return this.hours + "h" + this.minutes + "m" + this.seconds + "s";
};

HMS.prototype.toString = function(compact) {
  if (compact) {
      if (this._hours == 0 && this._minutes == 0) {
          return HMS.to_s(this._seconds) + "s";
      } else if (this._hours == 0) {
          return HMS.to_s(this.minutes) + "m" + HMS.to_s(this.seconds) + "s";
      }
      return HMS.to_s(this.hours) + "h" + HMS.to_s(this.minutes) + "m" + HMS.to_s(this.seconds) + "s";
  }
  return HMS.to_s(this.hours) + ":" + HMS.to_s(this.minutes) + ":" + HMS.to_s(this.seconds);
};