// TEST 6: audio + notifications + timers (headless smoke tests)
//
// Run:
//   gjs tests/test6_audio_smoke.js
//
// This test does NOT attempt real audio playback. Instead it verifies that:
//   - TimersCore calls notifier.notify on completion.
//   - The notifier adapter triggers AudioManager.playTimerAlarm() only when
//     settings.play_sound is true.
//   - Loop semantics via AudioManager._loopsForTimer() obey sound_loops,
//     notification, and timer.persist_alarm.
//   - AudioManager.stopTimerAlarm() is wired for dismissal paths (simulated).

imports.searchPath.unshift('.');

const { GLib } = imports.gi;

const TimersCoreModule = imports['taskTimer@CryptoD'].timers_core;
const TimerServicesModule = imports['taskTimer@CryptoD'].timer_services;
const StorageModule = imports['taskTimer@CryptoD'].storage;
const AudioManagerModule = imports['taskTimer@CryptoD'].audio_manager;

function assert(cond, msg) {
    if (!cond) {
        throw new Error('ASSERT FAILED: ' + msg);
    }
}

// Minimal settings stub sufficient for TimersCore + AudioManager tests.
class SettingsStub {
    constructor() {
        this.debug = false;
        this.sort_by_duration = false;
        this.sort_descending = false;
        this.show_endtime = false;
        this.show_label = true;
        this.show_time = true;
        this.show_progress = false;

        this.play_sound = true;
        this.sound_loops = 2;
        this.notification = true;

        this.volume_level_warn = false;
        this.volume_threshold = 25;

        this._running = '[]';
    }

    get running() { return this._running; }
    set running(v) { this._running = String(v); }
    get run_states() {
        try { return JSON.parse(this._running || '[]'); } catch (e) { return []; }
    }
}

// Stub AudioManager used by integration tests to avoid real GStreamer calls.
class AudioManagerStub {
    constructor() {
        this.playCalls = [];
        this.stopCalls = [];
        this._playing = new Map(); // id -> boolean
    }

    playTimerAlarm(timer) {
        const id = timer && timer.id ? String(timer.id) : 'timer';
        this.playCalls.push(id);
        this._playing.set(id, true);
    }

    stopTimerAlarm(timerOrId) {
        const id = typeof timerOrId === 'string'
            ? timerOrId
            : (timerOrId && timerOrId.id ? String(timerOrId.id) : null);
        if (!id) {
            return;
        }
        this.stopCalls.push(id);
        this._playing.set(id, false);
    }

    isPlaying(id) {
        return !!this._playing.get(String(id));
    }
}

function runTimersWithStubbedAudio() {
    const settings = new SettingsStub();
    const audioStub = new AudioManagerStub();

    const timersPath = GLib.build_filenamev([
        GLib.get_tmp_dir(),
        `tasktimer-test6-audio-${GLib.uuid_string_random()}.json`,
    ]);

    // notifier adapter that mimics the shape used in main.js coreNotifier.
    const notifications = [];
    const notifier = {
        notify: (timer, text, fmt, ...args) => {
            const title = text;
            const body = fmt && typeof fmt.format === 'function'
                ? fmt.format(...args)
                : (fmt ? String(fmt) : '');
            notifications.push({ timer, title, body });
            if (settings.play_sound) {
                audioStub.playTimerAlarm(timer);
            }
        },
        warning: () => {},
    };

    const services = new TimerServicesModule.TimerServices({
        settings,
        notifier,
        inhibitor: null,
        storage: {
            timersPath,
            saveJSON: StorageModule.saveJSON || (StorageModule.StorageModule && StorageModule.StorageModule.saveJSON),
            loadJSON: StorageModule.loadJSON || (StorageModule.StorageModule && StorageModule.StorageModule.loadJSON),
        },
    });

    const timers = new TimersCoreModule.TimersCore(services);
    const TimerCore = TimersCoreModule.TimerCore;

    // Short 1-second timer for smoke test.
    const t = new TimerCore(timers, 'Audio test timer', 1);
    assert(timers.add(t), 'add timer');

    assert(t.start() === true, 'start timer');
    assert(t.running, 'timer is running');

    const loop = new GLib.MainLoop(null, false);

    // Wait a bit longer than duration to allow stop_callback to fire.
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
        loop.quit();
        return GLib.SOURCE_REMOVE;
    });

    loop.run();

    // After completion we expect one notification and one audio play call.
    assert(notifications.length === 1, 'one completion notification fired');
    assert(audioStub.playCalls.length === 1, 'audio play called once');
    assert(audioStub.isPlaying(t.id), 'audio marked as playing for timer');

    // Simulate user dismissing the notification: stop audio.
    audioStub.stopTimerAlarm(t);
    assert(!audioStub.isPlaying(t.id), 'audio stopped after dismissal');

    // Now verify that when play_sound is false, notify does not call audio.
    settings.play_sound = false;

    const t2 = new TimerCore(timers, 'Silent timer', 1);
    assert(timers.add(t2), 'add second timer');
    t2.start();

    const loop2 = new GLib.MainLoop(null, false);
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
        loop2.quit();
        return GLib.SOURCE_REMOVE;
    });
    loop2.run();

    const audioCallsAfterSecond = audioStub.playCalls.filter(id => id === String(t2.id)).length;
    assert(audioCallsAfterSecond === 0, 'no audio when play_sound is false');
}

function testAudioManagerLoopSemantics() {
    const settings = new SettingsStub();
    const audio = new AudioManagerModule.AudioManager({ settings });

    // Case 1: finite loops from settings when not persistent.
    settings.sound_loops = 3;
    settings.notification = true;
    let loops = audio._loopsForTimer({ persist_alarm: false });
    assert(loops === 3, 'finite loops from settings when not persistent');

    // Case 2: infinite loops for persistent alarms.
    loops = audio._loopsForTimer({ persist_alarm: true });
    assert(loops === 0, 'infinite loops (0) for persistent alarms');

    // Case 3: notifications off with sound_loops == 0 -> clamp to 2.
    settings.sound_loops = 0;
    settings.notification = false;
    loops = audio._loopsForTimer({ persist_alarm: false });
    assert(loops === 2, 'guard against endless loops when notifications off');
}

function main() {
    runTimersWithStubbedAudio();
    testAudioManagerLoopSemantics();
    print('TEST 6 audio smoke tests: OK');
}

main();

