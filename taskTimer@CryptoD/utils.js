const GETTEXT_DOMAIN = 'tasktimer';
const Gettext = imports.gettext.domain(GETTEXT_DOMAIN);
const _ = Gettext.gettext;

String.prototype.format = imports.format.format;

const { GLib } = imports.gi;
const ByteArray = imports.byteArray;

const shellVersion = 40;
function isGnome3x() {
  return shellVersion < 40;
}

function isGnome40() {
  return shellVersion >= 40;
}

function logObjectPretty(obj) {
  log(JSON.stringify(obj, null, 2));
}

 // let clearTimeout, clearInterval;
clearTimeout = clearInterval = GLib.Source.remove;

function setTimeout(func, delay, ...args) {
  const wrappedFunc = () => {
    func.apply(this, args);
    return false;
  };
  return GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, wrappedFunc);
}

function setInterval(func, delay, ...args) {
  const wrappedFunc = () => {
    return func.apply(this, args);
  };
  return GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, wrappedFunc);
}

function spawn(command, callback) {
  const [status, pid] = GLib.spawn_async(
    null,
    ['/usr/bin/env', 'bash', '-c', command],
    null,
    GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
    null,
  );

  if (callback)
    GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, callback);
  var clearTimeout = GLib.Source.remove;
  var clearInterval = GLib.Source.remove;
}

function bytesToString(data) {
  if (!data)
    return '';

  if (typeof TextDecoder !== 'undefined' && data instanceof Uint8Array)
    return new TextDecoder().decode(data);

  try {
    return ByteArray.toString(data);
  } catch (e) {
    try {
      return data.toString();
    } catch (err) {
      return '';
    }
  }
}

function execute(cmdargs, params, glib = GLib) {
  if (!params)
    params = { wdir: null, envp: null, flags: 8 };
  else {
    if (params.wdir === undefined)
      params.wdir = null;
    if (params.envp === undefined)
      params.envp = null;
    if (params.flags === undefined)
      params.flags = 8;
  }

  const [ok, stdoutRaw, stderrRaw, exit_status] = glib.spawn_sync(
    params.wdir,
    cmdargs,
    params.envp,
    params.flags,
    null,
  );

  if (ok) {
    const stdout = bytesToString(stdoutRaw);
    const stderr = bytesToString(stderrRaw);
    return [exit_status, stdout, stderr];
  }

  return [-1, undefined, "execute failed: %s".format(cmdargs.join(" "))];
}

function uuid(id = undefined) {
  return id === undefined || id.length === 0 ? GLib.uuid_string_random() : id;
}

function addSignalsHelperMethods(prototype) {
  prototype._connectSignal = function(subject, signal_name, method) {
    if (!this._signals)
      this._signals = [];

    const signal_id = subject.connect(signal_name, method);
    this._signals.push({
      subject,
      signal_id,
    });
  };

  prototype._disconnectSignals = function() {
    if (!this._signals)
      return;

    this._signals.forEach(signal => {
      signal.subject.disconnect(signal.signal_id);
    });
    this._signals = [];
  };
}

const moduleExports = {
  isGnome3x,
  isGnome40,
  logObjectPretty,
  clearTimeout,
  clearInterval,
  setTimeout,
  setInterval,
  spawn,
  bytesToString,
  execute,
  uuid,
  addSignalsHelperMethods,
};

this.isGnome3x = isGnome3x;
this.isGnome40 = isGnome40;
this.logObjectPretty = logObjectPretty;
this.clearTimeout = clearTimeout;
this.clearInterval = clearInterval;
this.setTimeout = setTimeout;
this.setInterval = setInterval;
this.spawn = spawn;
this.bytesToString = bytesToString;
this.execute = execute;
this.uuid = uuid;
this.addSignalsHelperMethods = addSignalsHelperMethods;