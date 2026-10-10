import type { Translation } from '../en'

const messages: Translation<'gamesave'> = {
  'failure.not-a-save': '這個檔案不是 Pelagix 能讀取的寶可夢遊戲存檔。',
  'failure.too-large': '這個檔案太大，不可能是遊戲存檔。',
  'failure.unreadable': '無法開啟這個檔案，可能有其他程式正在使用它。',
  'failure.reader-missing': 'Pelagix 缺少讀取遊戲存檔的元件。重新安裝 Pelagix 即可恢復。',
  'failure.reader-failed': '讀取存檔時發生問題。',
  'failure.timed-out': '讀取存檔花費太久，已經中止。',
  'shinydexFailure.not-shinydex': '這個檔案既不是 ShinyDex 匯出檔，也不是儲存下來的 ShinyDex History 頁面：裡面找不到任何異色寶可夢。',
  'shinydexFailure.too-large': '這個檔案太大，不可能是 ShinyDex 匯出檔或儲存下來的 ShinyDex 頁面。',
  'shinydexFailure.unreadable': '無法開啟這個檔案，可能有其他程式正在使用它。',
  'shinydexFailure.other': '讀取檔案時發生問題。',

  'dialog.title': '要匯入這些寶可夢嗎？',
  'dialog.add': { other: '新增 {count} 筆記錄' },
  'dialog.complete': { other: '補齊 {count} 筆既有記錄' },
  'dialog.nothing': '沒有可新增的項目',
  'dialog.failed': '無法新增這些寶可夢',

  'counts.new': { other: '{count} 隻新的' },
  'counts.fills': { other: '{count} 隻可填入 Living Dex 的空格' },
  'counts.imported': { other: '{count} 隻已匯入' },
  'counts.completes': { other: '{count} 筆既有記錄會補上缺少的資料' },
  'counts.egg': { other: '略過 {count} 顆蛋' },
  'counts.unsupported': { other: '{count} 隻無法匯入' },

  'ask.label': '這些寶可夢來自哪款遊戲？',
  'ask.hint': '這個存檔沒有記錄部分寶可夢確切來自哪款遊戲。你的回答會套用在可能來自該遊戲的寶可夢上。',
  'ask.placeholder': '選擇遊戲…',

  'bar.chosen': '已選擇 {total} 隻新寶可夢中的 {chosen} 隻',
  'bar.allNew': '全部新的',
  'bar.onlyEmpty': '只選空格',

  'row.import': '匯入{name}',
  'row.nickname': '「{nickname}」',
  'row.eggOf': '{species}的蛋',
  'row.egg': '蛋',
  'row.unknownPokemon': '不明的寶可夢',
  'status.new': '新的',
  'status.newSlot': '新的一格',
  'status.imported': '已匯入',
  'status.completes': '補上缺少的資料',
  'status.egg': '蛋',
  'status.eggSkipped': '蛋，已略過',
  'status.unsupported': '無法匯入',

  'reason.unreadable': '無法讀取。',
  'reason.unknownPokemon': 'Pelagix 不認得這隻寶可夢。',
  'reason.unknownForm': 'Pelagix 不認得這個形態。',
  'reason.untrackedGame': '牠來自 Pelagix 沒有追蹤的遊戲。',
  'reason.wrongGame': '牠不可能來自你選擇的遊戲。',
  'reason.askGame': '存檔沒有記錄牠來自哪款遊戲。請在上方選擇。',
  'reason.gameNotRecognised': '無法辨識遊戲。',
  'reason.gameNotRecognisedNamed': '無法辨識遊戲（{game}）。',
  'reason.noDate': '無法讀取牠的日期。',

  'source.save.description': '{file} 是{game}的存檔。目前尚未變更任何內容，存檔只會被讀取。',
  'source.save.descriptionTrainer': '{file} 是{game}的存檔，訓練家為 {trainer}。目前尚未變更任何內容，存檔只會被讀取。',
  'source.save.games': '寶可夢 {names}',
  'source.save.unknownGame': '第 {generation} 世代遊戲',
  'source.save.dropped': { other: '這個存檔中有 {count} 隻寶可夢無法讀取，已排除。' },
  'source.save.empty': '這個存檔裡沒有寶可夢。',
  'source.save.list': '這個存檔裡的寶可夢',

  'source.shinydex.export': {
    other: '{file} 是 ShinyDex 匯出檔，內含 {count} 隻異色寶可夢。目前尚未變更任何內容，檔案只會被讀取。只會讀取其中的寶可夢：遊戲、方法、日期及檔案內含的其他資料。你的規則、設定和成就維持不變。'
  },
  'source.shinydex.page': {
    other: '{file} 是儲存下來的 ShinyDex 歷史記錄，內含 {count} 隻異色寶可夢。目前尚未變更任何內容，檔案只會被讀取。遊戲、方法、日期和球來自 ShinyDex，其餘資料請自行補上。'
  },
  'source.shinydex.dropped': { other: '這個檔案列出的異色寶可夢超過 Pelagix 一次能讀取的數量，最後 {count} 隻已排除。' },
  'source.shinydex.unusable': { other: '這個檔案中有 {count} 筆記錄無法讀取，已排除。' },
  'source.shinydex.empty': '這個檔案裡沒有異色寶可夢。',
  'source.shinydex.list': '這個檔案裡的異色寶可夢'
}

export default messages
