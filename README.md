# Tasks Timer Extension

## Table of Contents
- [Installation](#installation)
- [Compatibility](#compatibility)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Alarm Timers](#alarm-timers)
- [Configuration](#configuration)
- [Support](#support)
- [Development](#development)

## Installation

### Prerequisites
- GNOME Shell 40.0 - 44.x
- git
- gjs
- gnome-shell-extensions

Verify GNOME version:

gnome-shell --version


To install the extension, clone the repository and run `install_local.sh`:


mkdir ~/github
cd ~/github
git clone https://github.com/CryptoD/tasksTimer
cd tasksTimer
./install_local.sh


After installation, restart gnome shell to enable the extension (use Alt-F2 'r' or logout/login).

## Keyboard Shortcuts

There are currently two global keyboard shortcuts, which can be enabled in Preferences/Options:

* `<ctrl><super>T` - show end time in panel
* `<ctrl><super>K` - stop next timer to expire

You can also edit the shortcuts in dconf-editor or with the following script:
```
$ tasksTimer@yourdomain.com/bin/dconf-editor.sh
```

## Alarm Timer Syntax

Format: `name @ HH[:MM[:SS[.ms]]] [am|pm]`

Validation Rules:
- Hours: 1-12 (am/pm format) or 0-23 (24hr format)
- Minutes: 0-59
- Seconds: 0-59
- Milliseconds: 0-999

Examples with explanations:
- `meeting @ 14:30` - Sets alarm for 2:30 PM
- `lunch @ 12pm` - Sets alarm for noon
- `wakeup @ 5:30am` - Sets alarm for early morning

To create an alarm timer that goes off at 5am tomorrow:
```
![taxi @ 5am create](https://github.com/CryptoD/tasksTimer/blob/main/img/taxi_at_5am_quick.png)

![taxi @ 5am running](https://github.com/CryptoD/tasksTimer/blob/main/img/taxi_at_5am_running.png)
```
Click the regular timer icon for a running timer to make the alarm persistent. The icon will change to an alarm clock. The pool timer alarm will ring persistently until the notification is closed, while the tea alarm will ring as defined in the play sound setting.

![image](https://user-images.githubusercontent.com/825403/118677121-ff08ac00-b7c9-11eb-9259-b19ed468b44c.png)

## Support

If you find this extension useful, feel free to support the original author:

[<img src="https://raw.githubusercontent.com/blackjackshellac/tasksTimer/main/img/bmc_logo_wordmark_25.png" alt="Buy Me A Coffee" width="150"/>](https://www.buymeacoffee.com/blckjackshellac)

## Development

## Development

### Setup Development Environment

git clone https://github.com/CryptoD/tasksTimer
cd tasksTimer
./install_local.sh --dev


This fork is based on the original extension by [blackjackshellac](https://github.com/blackjackshellac/kitchenTimer). The functionality of this extension has also been updated with code from [olebowle's fork](https://github.com/olebowle/gnome-shell-timer) and techniques from [gnome-bluetooth-quick-connect](https://github.com/bjarosze/gnome-bluetooth-quick-connect).

## Compatibility

- GNOME Shell: 40.0 - 44.x
- Required packages: gjs, gnome-shell-extensions

### System Requirements
- Linux distribution running GNOME Shell
- git (for installation)

## Configuration

### Available Options
- Sound notifications: Enable/disable and customize alarm sounds
- Panel display: Show/hide timer in panel
- Persistent alarms: Configure which timers should persist
- Custom keyboard shortcuts

![Configuration Screenshot](img/preferences.png)

### Troubleshooting

If installation fails:
1. Check extension logs: `journalctl -f -o cat /usr/bin/gnome-shell`
2. Verify permissions: `ls -l ~/.local/share/gnome-shell/extensions/`
3. Clear extension cache: `rm -rf ~/.cache/gnome-shell`
4. Restart GNOME Shell: Alt+F2, type 'r', press Enter

### Uninstallation

To remove the extension:
```bash
gnome-extensions disable tasksTimer@yourdomain.com
rm -rf ~/.local/share/gnome-shell/extensions/tasksTimer@yourdomain.com
