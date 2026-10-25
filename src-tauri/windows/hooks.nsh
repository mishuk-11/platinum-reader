; Registers Platinum Reader with Windows so it shows in "Open with" and Settings > Default apps.
; Tauri writes the ProgIDs (PlatinumReader.pdf, ...); this adds the capability list Windows 10/11 needs.
; SHCTX is HKCU for "Just me" installs and HKLM for "All users" (Program Files) installs.
; Generated from tauri.conf.json fileAssociations; keep both in sync.

!macro PR_ASSOC EXT PROGID
  WriteRegStr SHCTX "Software\Classes\.${EXT}\OpenWithProgids" "${PROGID}" ""
  WriteRegStr SHCTX "Software\PlatinumReader\Capabilities\FileAssociations" ".${EXT}" "${PROGID}"
!macroend

!macro PR_UNASSOC EXT PROGID
  DeleteRegValue SHCTX "Software\Classes\.${EXT}\OpenWithProgids" "${PROGID}"
!macroend

; The hold-to-preview helper runs from the same exe; stop it so files can be replaced.
!macro PR_STOP_HELPER
  nsExec::Exec 'taskkill /F /IM platinum-reader.exe'
!macroend

!macro NSIS_HOOK_PREINSTALL
  !insertmacro PR_STOP_HELPER
!macroend

!macro NSIS_HOOK_POSTINSTALL
  WriteRegStr SHCTX "Software\PlatinumReader\Capabilities" "ApplicationName" "Platinum Reader"
  WriteRegStr SHCTX "Software\PlatinumReader\Capabilities" "ApplicationDescription" "Ultra-lightweight open-source document reader"
  WriteRegStr SHCTX "Software\PlatinumReader\Capabilities" "ApplicationIcon" "$INSTDIR\platinum-reader.exe,0"
  !insertmacro PR_ASSOC "pdf" "PlatinumReader.pdf"
  !insertmacro PR_ASSOC "epub" "PlatinumReader.epub"
  !insertmacro PR_ASSOC "mobi" "PlatinumReader.mobi"
  !insertmacro PR_ASSOC "azw" "PlatinumReader.mobi"
  !insertmacro PR_ASSOC "azw3" "PlatinumReader.mobi"
  !insertmacro PR_ASSOC "fb2" "PlatinumReader.fb2"
  !insertmacro PR_ASSOC "cbz" "PlatinumReader.cbz"
  !insertmacro PR_ASSOC "cbr" "PlatinumReader.cbr"
  !insertmacro PR_ASSOC "djvu" "PlatinumReader.djvu"
  !insertmacro PR_ASSOC "djv" "PlatinumReader.djvu"
  !insertmacro PR_ASSOC "xps" "PlatinumReader.xps"
  !insertmacro PR_ASSOC "oxps" "PlatinumReader.xps"
  !insertmacro PR_ASSOC "md" "PlatinumReader.md"
  !insertmacro PR_ASSOC "markdown" "PlatinumReader.md"
  !insertmacro PR_ASSOC "chm" "PlatinumReader.chm"
  ; Per-type document icons (PDF, EPUB, MD, ...) instead of the app logo.
  WriteRegStr SHCTX "Software\Classes\PlatinumReader.pdf\DefaultIcon" "" "$INSTDIR\filetypes\pdf.ico"
  WriteRegStr SHCTX "Software\Classes\PlatinumReader.epub\DefaultIcon" "" "$INSTDIR\filetypes\epub.ico"
  WriteRegStr SHCTX "Software\Classes\PlatinumReader.mobi\DefaultIcon" "" "$INSTDIR\filetypes\mobi.ico"
  WriteRegStr SHCTX "Software\Classes\PlatinumReader.fb2\DefaultIcon" "" "$INSTDIR\filetypes\fb2.ico"
  WriteRegStr SHCTX "Software\Classes\PlatinumReader.cbz\DefaultIcon" "" "$INSTDIR\filetypes\cbz.ico"
  WriteRegStr SHCTX "Software\Classes\PlatinumReader.cbr\DefaultIcon" "" "$INSTDIR\filetypes\cbr.ico"
  WriteRegStr SHCTX "Software\Classes\PlatinumReader.djvu\DefaultIcon" "" "$INSTDIR\filetypes\djvu.ico"
  WriteRegStr SHCTX "Software\Classes\PlatinumReader.xps\DefaultIcon" "" "$INSTDIR\filetypes\xps.ico"
  WriteRegStr SHCTX "Software\Classes\PlatinumReader.md\DefaultIcon" "" "$INSTDIR\filetypes\md.ico"
  WriteRegStr SHCTX "Software\Classes\PlatinumReader.chm\DefaultIcon" "" "$INSTDIR\filetypes\chm.ico"
  ; Hold-to-preview helper: on unless the user turned it off (that choice survives updates).
  ; RunAsUser starts it as the signed-in user, not elevated, so it can talk to Explorer.
  ReadRegDWORD $0 HKCU "Software\PlatinumReaderPrefs" "PeekDisabled"
  IntCmp $0 1 pr_peek_done
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "PlatinumReaderPeek" '"$INSTDIR\platinum-reader.exe" --peek-helper'
  nsis_tauri_utils::RunAsUser "$INSTDIR\platinum-reader.exe" "--peek-helper"
  pr_peek_done:
  WriteRegStr SHCTX "Software\RegisteredApplications" "Platinum Reader" "Software\PlatinumReader\Capabilities"
  ; Tell Explorer that file associations changed (SHCNE_ASSOCCHANGED).
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  !insertmacro PR_STOP_HELPER
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "PlatinumReaderPeek"
  DeleteRegValue SHCTX "Software\RegisteredApplications" "Platinum Reader"
  DeleteRegKey SHCTX "Software\PlatinumReader"
  !insertmacro PR_UNASSOC "pdf" "PlatinumReader.pdf"
  !insertmacro PR_UNASSOC "epub" "PlatinumReader.epub"
  !insertmacro PR_UNASSOC "mobi" "PlatinumReader.mobi"
  !insertmacro PR_UNASSOC "azw" "PlatinumReader.mobi"
  !insertmacro PR_UNASSOC "azw3" "PlatinumReader.mobi"
  !insertmacro PR_UNASSOC "fb2" "PlatinumReader.fb2"
  !insertmacro PR_UNASSOC "cbz" "PlatinumReader.cbz"
  !insertmacro PR_UNASSOC "cbr" "PlatinumReader.cbr"
  !insertmacro PR_UNASSOC "djvu" "PlatinumReader.djvu"
  !insertmacro PR_UNASSOC "djv" "PlatinumReader.djvu"
  !insertmacro PR_UNASSOC "xps" "PlatinumReader.xps"
  !insertmacro PR_UNASSOC "oxps" "PlatinumReader.xps"
  !insertmacro PR_UNASSOC "md" "PlatinumReader.md"
  !insertmacro PR_UNASSOC "markdown" "PlatinumReader.md"
  !insertmacro PR_UNASSOC "chm" "PlatinumReader.chm"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend
