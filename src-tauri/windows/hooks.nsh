; Registers Quire with Windows so it shows in "Open with" and Settings > Default apps.
; Tauri writes the ProgIDs (Quire.pdf, ...); this adds the capability list Windows 10/11 needs.
; Generated from tauri.conf.json fileAssociations; keep both in sync.

!macro QUIRE_ASSOC EXT PROGID
  WriteRegStr HKCU "Software\Classes\.${EXT}\OpenWithProgids" "${PROGID}" ""
  WriteRegStr HKCU "Software\Quire\Capabilities\FileAssociations" ".${EXT}" "${PROGID}"
!macroend

!macro QUIRE_UNASSOC EXT PROGID
  DeleteRegValue HKCU "Software\Classes\.${EXT}\OpenWithProgids" "${PROGID}"
!macroend

!macro NSIS_HOOK_POSTINSTALL
  WriteRegStr HKCU "Software\Quire\Capabilities" "ApplicationName" "Quire"
  WriteRegStr HKCU "Software\Quire\Capabilities" "ApplicationDescription" "Ultra-lightweight open-source document reader"
  WriteRegStr HKCU "Software\Quire\Capabilities" "ApplicationIcon" "$INSTDIR\quire.exe,0"
  !insertmacro QUIRE_ASSOC "pdf" "Quire.pdf"
  !insertmacro QUIRE_ASSOC "epub" "Quire.epub"
  !insertmacro QUIRE_ASSOC "mobi" "Quire.mobi"
  !insertmacro QUIRE_ASSOC "azw" "Quire.mobi"
  !insertmacro QUIRE_ASSOC "azw3" "Quire.mobi"
  !insertmacro QUIRE_ASSOC "fb2" "Quire.fb2"
  !insertmacro QUIRE_ASSOC "cbz" "Quire.cbz"
  !insertmacro QUIRE_ASSOC "cbr" "Quire.cbr"
  !insertmacro QUIRE_ASSOC "djvu" "Quire.djvu"
  !insertmacro QUIRE_ASSOC "djv" "Quire.djvu"
  !insertmacro QUIRE_ASSOC "xps" "Quire.xps"
  !insertmacro QUIRE_ASSOC "oxps" "Quire.xps"
  !insertmacro QUIRE_ASSOC "md" "Quire.md"
  !insertmacro QUIRE_ASSOC "markdown" "Quire.md"
  !insertmacro QUIRE_ASSOC "chm" "Quire.chm"
  WriteRegStr HKCU "Software\RegisteredApplications" "Quire" "Software\Quire\Capabilities"
  ; Tell Explorer that file associations changed (SHCNE_ASSOCCHANGED).
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  DeleteRegValue HKCU "Software\RegisteredApplications" "Quire"
  DeleteRegKey HKCU "Software\Quire"
  !insertmacro QUIRE_UNASSOC "pdf" "Quire.pdf"
  !insertmacro QUIRE_UNASSOC "epub" "Quire.epub"
  !insertmacro QUIRE_UNASSOC "mobi" "Quire.mobi"
  !insertmacro QUIRE_UNASSOC "azw" "Quire.mobi"
  !insertmacro QUIRE_UNASSOC "azw3" "Quire.mobi"
  !insertmacro QUIRE_UNASSOC "fb2" "Quire.fb2"
  !insertmacro QUIRE_UNASSOC "cbz" "Quire.cbz"
  !insertmacro QUIRE_UNASSOC "cbr" "Quire.cbr"
  !insertmacro QUIRE_UNASSOC "djvu" "Quire.djvu"
  !insertmacro QUIRE_UNASSOC "djv" "Quire.djvu"
  !insertmacro QUIRE_UNASSOC "xps" "Quire.xps"
  !insertmacro QUIRE_UNASSOC "oxps" "Quire.xps"
  !insertmacro QUIRE_UNASSOC "md" "Quire.md"
  !insertmacro QUIRE_UNASSOC "markdown" "Quire.md"
  !insertmacro QUIRE_UNASSOC "chm" "Quire.chm"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend
