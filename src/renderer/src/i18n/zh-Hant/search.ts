import type { Translation } from '../en'

const messages: Translation<'search'> = {
  'label': '搜尋與指令',
  'input': '搜尋寶可夢、頁面和動作',
  'results': '結果',
  'empty.title': '找不到符合「{query}」的項目',
  'empty.hint': '試試寶可夢的名稱或圖鑑編號，或是「日誌」之類的頁面。',
  'footer.move': '<keys/> 移動',
  'footer.open': '<keys/> 開啟',
  'footer.close': '<keys/> 關閉',
  'status.none': '沒有結果',
  'status.count': { other: '{count} 個結果' },

  'section.pokemon': '寶可夢',
  'section.recent': '最近開啟',
  'section.pages': '頁面',
  'section.actions': '動作',

  'row.shiny': '已記錄異色',
  'row.missing': '尚未捕獲',

  'action.log': '記錄{name}的捕獲',
  'action.shiny.on': '開啟異色檢視',
  'action.shiny.off': '關閉異色檢視',
  'action.theme.light': '切換為淺色主題',
  'action.theme.dark': '切換為深色主題',
  'action.motion.on': '開啟減少動態效果',
  'action.motion.off': '關閉減少動態效果',
  'hint.on': '開啟',
  'hint.off': '關閉',
  'hint.dark': '深色',
  'hint.light': '淺色',

  'toast.shiny.on': '異色檢視已開啟',
  'toast.shiny.on.body': '寶可夢會以異色的樣子顯示。',
  'toast.shiny.off': '異色檢視已關閉',
  'toast.motion.on': '減少動態效果已開啟',
  'toast.motion.off': '減少動態效果已關閉',

  'keywords.page.home': '首頁 主頁 總覽 概覽 儀表板 進度 開始',
  'keywords.page.dex': '圖鑑 寶可夢圖鑑 寶可夢 瀏覽 種類 清單 列表',
  'keywords.page.living': '盒子 收藏 收集 形態 格子 全圖鑑 活圖鑑',
  'keywords.page.homedex': '寶可夢 home 傳送 已傳送 存放 銀行 盒子',
  'keywords.page.journal': '日誌 記錄 紀錄 歷史 捕獲 日記',
  'keywords.page.achievements': '成就 獎盃 獎牌 徽章 目標',
  'keywords.page.settings': '設定 偏好 選項 規則 主題 語言 匯入 匯出 備份',
  'keywords.action.log': '記錄 紀錄 捕獲 捕捉 抓到 新增 加入',
  'keywords.action.shiny': '切換 異色 色違 閃光 檢視 圖片 圖像',
  'keywords.action.theme': '切換 主題 深色 淺色 暗色 亮色 外觀 模式',
  'keywords.action.motion': '切換 減少 動態 動畫 效果',
  'keywords.logPhrase': '記錄捕獲'
}

export default messages
