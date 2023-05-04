# Tasks Timer Extension

This is a fork of the [Gnome shell kitchen timer extension](https://extensions.gnome.org/extension/3955/kitchen-timer/) that allows running multiple simultaneous timers, but has not been updated for 2 years.

## Installation

To install the extension, clone the repository and run `install_local.sh`:


```
mkdir ~/github
cd ~/github
git clone https://github.com/CryptoD/tasksTimer
cd kitchenTimer
./install_local.sh
```

and then restart gnome shell to enable (Alt-F2 'r') or logout/login.

After installation, restart gnome shell to enable the extension (use Alt-F2 'r' or logout/login).

## Keyboard Shortcuts

There are currently two global keyboard shortcuts, which can be enabled in Preferences/Options:

* `<ctrl><super>T` - show end time in panel
* `<ctrl><super>K` - stop next timer to expire

You can also edit the shortcuts in dconf-editor or with the following script:
```
$ kitchentimer@yourdomain.com/bin/dconf-editor.sh
```

## Alarm Timers

You can specify alarms as timers with the following syntax:
```
name @ HH[:MM[:SS[.ms]]] [am|pm]
```

The `time_spec` can include am/pm or use 24-hour time.

Examples:
```
alarm @ 5am
alarm @ 11:30pm
alarm @ 23:30
alarm @ 8:45:00.444am
```

To create an alarm timer that goes off at 5am tomorrow:
```
![taxi @ 5am create](https://github.com/CryptoD/tasksTimer/blob/main/img/taxi_at_5am_quick.png)

![taxi @ 5am running](https://github.com/CryptoD/tasksTimer/blob/main/img/taxi_at_5am_running.png)
```
Click the regular timer icon for a running timer to make the alarm persistent. The icon will change to an alarm clock. The pool timer alarm will ring persistently until the notification is closed, while the tea alarm will ring as defined in the play sound setting.

![image](https://user-images.githubusercontent.com/825403/118677121-ff08ac00-b7c9-11eb-9259-b19ed468b44c.png)

## Support

If you find this extension useful, feel free to support the original author:

[<img src="https://raw.githubusercontent.com/blackjackshellac/kitchenTimer/main/img/bmc_logo_wordmark_25.png" alt="Buy Me A Coffee" width="150"/>](https://www.buymeacoffee.com/blckjackshellac)

## References

This fork is based on the original extension by [blackjackshellac](https://github.com/blackjackshellac/kitchenTimer). The functionality of this extension has also been updated with code from [olebowle's fork](https://github.com/olebowle/gnome-shell-timer) and techniques from [gnome-bluetooth-quick-connect](https://github.com/bjarosze/gnome-bluetooth-quick-connect).
