/**
 * The text the main process shows by itself: the titles and file-type names of the native file
 * dialogs. Everything else the user reads lives in the renderer's text table
 * (src/renderer/src/i18n). A key a language does not have reads in English.
 *
 * Keep this file dependency-free apart from languages.ts, and free of non-erasable TypeScript syntax.
 */

import type { LanguageId } from './languages'

const ENGLISH = {
  'dialog.exportSave': 'Export Pelagix save',
  'dialog.importSave': 'Import Pelagix save',
  'dialog.importGameSave': 'Import from a game save',
  'dialog.importShinyDex': 'Import from ShinyDex',
  'filter.pelagixSave': 'Pelagix save',
  'filter.shinyDex': 'ShinyDex export or saved page',
  'filter.allFiles': 'All files'
}

export type MainTextKey = keyof typeof ENGLISH

export const MAIN_TEXT: Readonly<Record<LanguageId, Readonly<Partial<Record<MainTextKey, string>>>>> = {
  ja: {
    'dialog.exportSave': 'Pelagixのセーブをエクスポート',
    'dialog.importSave': 'Pelagixのセーブをインポート',
    'dialog.importGameSave': 'ゲームのセーブデータからインポート',
    'dialog.importShinyDex': 'ShinyDexからインポート',
    'filter.pelagixSave': 'Pelagixのセーブ',
    'filter.shinyDex': 'ShinyDexのエクスポートまたは保存したページ',
    'filter.allFiles': 'すべてのファイル'
  },
  en: ENGLISH,
  fr: {
    'dialog.exportSave': 'Exporter la sauvegarde Pelagix',
    'dialog.importSave': 'Importer une sauvegarde Pelagix',
    'dialog.importGameSave': 'Importer depuis une sauvegarde de jeu',
    'dialog.importShinyDex': 'Importer depuis ShinyDex',
    'filter.pelagixSave': 'Sauvegarde Pelagix',
    'filter.shinyDex': 'Export ShinyDex ou page enregistrée',
    'filter.allFiles': 'Tous les fichiers'
  },
  it: {
    'dialog.exportSave': 'Esporta salvataggio di Pelagix',
    'dialog.importSave': 'Importa salvataggio di Pelagix',
    'dialog.importGameSave': 'Importa da un salvataggio di gioco',
    'dialog.importShinyDex': 'Importa da ShinyDex',
    'filter.pelagixSave': 'Salvataggio di Pelagix',
    'filter.shinyDex': 'Esportazione o pagina salvata di ShinyDex',
    'filter.allFiles': 'Tutti i file'
  },
  de: {
    'dialog.exportSave': 'Pelagix-Speicherstand exportieren',
    'dialog.importSave': 'Pelagix-Speicherstand importieren',
    'dialog.importGameSave': 'Aus einem Spielstand importieren',
    'dialog.importShinyDex': 'Aus ShinyDex importieren',
    'filter.pelagixSave': 'Pelagix-Speicherstand',
    'filter.shinyDex': 'ShinyDex-Export oder gespeicherte Seite',
    'filter.allFiles': 'Alle Dateien'
  },
  es: {
    'dialog.exportSave': 'Exportar guardado de Pelagix',
    'dialog.importSave': 'Importar guardado de Pelagix',
    'dialog.importGameSave': 'Importar de una partida guardada',
    'dialog.importShinyDex': 'Importar de ShinyDex',
    'filter.pelagixSave': 'Guardado de Pelagix',
    'filter.shinyDex': 'Exportación o página guardada de ShinyDex',
    'filter.allFiles': 'Todos los archivos'
  },
  'es-419': {
    'dialog.exportSave': 'Exportar guardado de Pelagix',
    'dialog.importSave': 'Importar guardado de Pelagix',
    'dialog.importGameSave': 'Importar de una partida guardada',
    'dialog.importShinyDex': 'Importar de ShinyDex',
    'filter.pelagixSave': 'Guardado de Pelagix',
    'filter.shinyDex': 'Exportación o página guardada de ShinyDex',
    'filter.allFiles': 'Todos los archivos'
  },
  ko: {
    'dialog.exportSave': 'Pelagix 세이브 내보내기',
    'dialog.importSave': 'Pelagix 세이브 가져오기',
    'dialog.importGameSave': '게임 세이브에서 가져오기',
    'dialog.importShinyDex': 'ShinyDex에서 가져오기',
    'filter.pelagixSave': 'Pelagix 세이브',
    'filter.shinyDex': 'ShinyDex 내보내기 파일 또는 저장한 페이지',
    'filter.allFiles': '모든 파일'
  },
  'zh-Hans': {
    'dialog.exportSave': '导出 Pelagix 存档',
    'dialog.importSave': '导入 Pelagix 存档',
    'dialog.importGameSave': '从游戏存档导入',
    'dialog.importShinyDex': '从 ShinyDex 导入',
    'filter.pelagixSave': 'Pelagix 存档',
    'filter.shinyDex': 'ShinyDex 导出文件或保存的网页',
    'filter.allFiles': '所有文件'
  },
  'zh-Hant': {
    'dialog.exportSave': '匯出 Pelagix 存檔',
    'dialog.importSave': '匯入 Pelagix 存檔',
    'dialog.importGameSave': '從遊戲存檔匯入',
    'dialog.importShinyDex': '從 ShinyDex 匯入',
    'filter.pelagixSave': 'Pelagix 存檔',
    'filter.shinyDex': 'ShinyDex 匯出檔或儲存的頁面',
    'filter.allFiles': '所有檔案'
  }
}

export function mainText(language: LanguageId, key: MainTextKey): string {
  const text = MAIN_TEXT[language]?.[key]
  return text === undefined || text === '' ? ENGLISH[key] : text
}
