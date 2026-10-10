Pelagix now tells you when a new version is out, shows what changed, and the installed copy updates itself.

## Highlights

- **In-app updates.** A few seconds after start-up, and every six hours after that, Pelagix asks GitHub whether a newer release exists. Switch this off under *Settings › Updates*.
- **What's new.** After an update, the notes of every release you skipped are shown once.
- A faster Living Dex: boxes outside the window are no longer drawn.

> [!NOTE]
> The portable copy still has to be replaced by hand. It tells you about new versions and links to the download.

### Step by step

1. Open **Settings** and scroll to *Updates*.
2. Press `Check for updates`.
   - If there is a newer version, the changelog opens.
   - If not, the line under the button says so.
3. Choose *Download and install*, then *Restart and update*.

### Checklist for this release

- [x] Installer updates in place
- [x] Save and backups are left alone
- [ ] ~~Linux and macOS builds~~ (not planned)

## Where things are kept

| Folder | What is in it | Removed on uninstall |
| :-- | :-- | :-: |
| `%APPDATA%\Pelagix` | Your save, backups, the sprite cache and `updates.json` | No |
| `%LOCALAPPDATA%\pelagix-updater` | The downloaded installer | Yes |

To look at the save yourself:

```powershell
Get-Item "$env:APPDATA\Pelagix\save.json" | Select-Object Length, LastWriteTime
```

> A quote from the README: everything Pelagix writes stays on this computer.

---

## What's Changed

* Add the update check and the changelog window by @HydrosPlays in https://github.com/HydrosPlays/Pelagix/pull/12
* Fix the shiny toggle switching the Living Dex mode in https://github.com/HydrosPlays/Pelagix/pull/14
* A screenshot of the new window: ![The changelog window](https://raw.githubusercontent.com/HydrosPlays/Pelagix/main/docs/screenshots/01-home.png)

**Full Changelog**: https://github.com/HydrosPlays/Pelagix/compare/v0.2.1...v0.3.0
