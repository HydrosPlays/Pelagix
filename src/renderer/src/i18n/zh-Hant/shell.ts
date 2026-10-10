import type { Translation } from '../en'

const messages: Translation<'shell'> = {
  'route.home': '首頁',
  'route.dex': '寶可夢圖鑑',
  'route.species': '寶可夢',
  'route.living': 'Living Dex',
  'route.homedex': 'HOME Dex',
  'route.journal': '日誌',
  'route.achievements': '成就',
  'route.settings': '設定',
  'route.kit': '元件庫',
  'route.notFound': '找不到頁面',

  'nav.label': '主選單',
  'nav.tagline': 'Living Dex',
  'nav.progress.eyebrow': 'Living Dex',
  'nav.progress.count': '已捕獲 {caught} / {total}',
  'nav.progress.tooltip': 'Living Dex：{count}（{percent}）',
  'nav.progress.label': 'Living Dex 進度：{count}',
  'nav.progress.ring': 'Living Dex 完成度',

  'topbar.fixture': '測試資料',
  'topbar.fixtureHint': '找不到正式資料，因此載入了小型的開發用資料。請執行 npm run data。',
  'topbar.notSaved': '尚未儲存',
  'topbar.search': '搜尋寶可夢…',
  'topbar.shiny.on': '異色檢視已開啟',
  'topbar.shiny.off': '異色檢視已關閉',
  'topbar.shiny.showing': '正在顯示異色圖像',
  'topbar.shiny.show': '顯示異色圖像',

  'skipToContent': '跳到主要內容',
  'pageError': '這個頁面發生問題',
  'appError': 'Pelagix 發生問題',
  'notFound.title': '未知的海域',
  'notFound.description': '這個位址沒有頁面。',
  'notFound.back': '返回首頁',

  'boot.step.save': '正在載入你的存檔',
  'boot.step.dex': '正在讀取寶可夢圖鑑資料',
  'boot.retry': '再試一次',
  'boot.reload': '重新載入應用程式',
  'boot.dataMissing.title': '找不到寶可夢圖鑑資料',
  'boot.dataMissing.hint': '請執行 <code>npm run data</code> 建立資料，然後再試一次。',
  'boot.dataMissing.detail': '無法載入資料。',
  'boot.saveFailed.title': '無法載入你的存檔',
  'boot.saveFailed.hint': '沒有任何內容被覆寫。請確認存檔可以讀取，然後再試一次。',

  'loadReport.newer': '這個存檔來自較新版本的 Pelagix',
  'loadReport.repaired': '載入時已修復你的存檔',

  'language.title': '選擇語言',
  'language.description': 'Pelagix 以及寶可夢、遊戲和地點的名稱都會以這個語言顯示。之後可以在設定中變更。',
  'language.list': '語言',
  'language.confirm': '繼續'
}

export default messages
