; Picked up automatically by electron-builder: nsis.include defaults to <buildResources>/installer.nsh.
;
; The stock uninstaller leaves the updater's cache behind:
;   %LOCALAPPDATA%\<package name>-updater\installer.exe         a copy of the installed version's setup exe
;   %LOCALAPPDATA%\<package name>-updater\pending\<setup>.exe   the last downloaded update
; which is two full installers, more than 200 MB. It is removed on a real uninstall, and never
; while an update is being installed: then this uninstaller runs with --updated and the new
; installer is executing from pending\.
;
; APP_PACKAGE_NAME is the "name" of package.json, defined by electron-builder for every NSIS
; build. The folder is named after it, so a build under another name removes its own folder
; and no one else's. Without the define nothing is removed.
!macro customUnInstall
  !ifdef APP_PACKAGE_NAME
    ${ifNot} ${isUpdated}
      ; Electron keeps its per-user data in the current user's profile even for an all-users install.
      ${if} $installMode == "all"
        SetShellVarContext current
      ${endif}
      RMDir /r "$LOCALAPPDATA\${APP_PACKAGE_NAME}-updater"
      ${if} $installMode == "all"
        SetShellVarContext all
      ${endif}
    ${endIf}
  !endif
!macroend
