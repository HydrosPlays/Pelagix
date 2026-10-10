import type { Translation } from '../en'

const messages: Translation<'living'> = {
  'box.name': '盒子 {number}',
  'box.nameOfDex': '{dex}的盒子 {number}',
  'box.nameOfOther': '《{game}》其他可獲得寶可夢的盒子 {number}',
  'box.mark': '將盒子 {number} 標記為在 HOME',
  'box.markOfDex': '將{dex}的盒子 {number} 標記為在 HOME',
  'box.markOfOther': '將《{game}》其他可獲得寶可夢的盒子 {number} 標記為在 HOME',
  'box.markHint': '將盒子標記為在 HOME',
  'box.markShort': '標記盒子',
  'box.status.complete': '已完成',
  'box.complete': '{box}已完成',
  'box.completeUnnamed': '盒子已完成',
  'box.complete.body': { other: '全部 {count} 格都填滿了。' },

  'status.caught': '已捕獲',
  'status.caughtCount': { other: '已捕獲 · {count} 筆記錄' },
  'status.missing': '尚未捕獲',
  'status.shinyCaught': '已捕獲異色',
  'status.shinyCaughtCount': { other: '已捕獲異色 · {count} 筆異色記錄' },
  'status.noShiny': '尚無異色',
  'status.noShinyRegular': { other: '尚無異色 · {count} 筆一般記錄' },
  'status.withEntries': { other: '{status} · {count} 筆記錄' },
  'slot.label': '{slot}，{status}',

  'rules.preset': '「{preset}」預設',
  'rules.custom': '自訂規則',
  'rules.line': { other: '{rules} · {count} 格' },
  'rules.lineInGame': { other: '{rules} · 《{game}》中可獲得 {count} 格' },
  'rules.change': '變更規則',

  'hero.title': 'Living Dex',
  'hero.titleShiny': '異色 Living Dex',
  'hero.ring': 'Living Dex 完成度',
  'hero.ringShiny': '異色 Living Dex 完成度',
  'hero.count': { other: '{count} 格中已捕獲 {filled} 格' },
  'hero.countShiny': { other: '{count} 格中已捕獲 {filled} 格異色' },
  'hero.countGame': { other: '{count} 格中已在《{game}》捕獲 {filled} 格' },
  'hero.countShinyGame': { other: '{count} 格中已在《{game}》捕獲 {filled} 格異色' },
  'hero.unit': '已捕獲',
  'hero.unitShiny': '已捕獲異色',
  'hero.unitGame': '已在《{game}》捕獲',
  'hero.unitShinyGame': '已在《{game}》捕獲異色',
  'hero.anyColour': { other: '不分顏色已捕獲 <b>{count}</b> 隻' },
  'hero.shiny': { other: '<b>{count}</b> 隻異色' },
  'hero.toGo': { other: '還差 {count} 隻' },
  'hero.done': '沒有要捕獲的了',
  'hero.mode': 'Living Dex 模式',
  'hero.mode.normal': 'Living Dex',
  'hero.boxesComplete': '已完成的盒子',
  'hero.species': '種類',
  'hero.speciesShiny': '異色種類',

  'notice.rules': {
    other: '<b>你的 Living Dex 規則已變更。</b>現在共有 {count} 格要填（先前為 {before} 格）。你記錄的內容都沒有遺失。'
  },
  'notice.data': {
    other: '<b>寶可夢圖鑑資料已更新。</b>現在共有 {count} 格要填（先前為 {before} 格）。你記錄的內容都沒有遺失。'
  },
  'notice.review': '檢視規則',
  'notice.dismiss': '關閉',
  'complete.all': {
    other: '<b>Living Dex 完成！</b>全部 {count} 格都填滿了。整套收藏到此齊全。'
  },
  'complete.game': {
    other: '<b>Living Dex 完成！</b>全部 {count} 格都填滿了。《{game}》中能獲得的全都到手了。'
  },
  'complete.shinyAll': {
    other: '<b>異色 Living Dex 完成！</b>全部 {count} 格都填上了異色。整套收藏到此齊全。'
  },
  'complete.shinyGame': {
    other: '<b>異色 Living Dex 完成！</b>全部 {count} 格都填上了異色。《{game}》中能獲得的全都到手了。'
  },
  'waiting': '<b>你的 Living Dex 正等著你。</b>在寶可夢圖鑑中找一隻寶可夢，選擇捕獲牠的遊戲和地點，牠就會出現在這裡的格子裡。',
  'openPokedex': '開啟寶可夢圖鑑',
  'gameEmpty': '<b>還沒有在《{game}》捕獲任何寶可夢。</b>這裡只有在《{game}》獲得的寶可夢才能填格；你在其他遊戲捕獲的仍保留在完整的 Living Dex 中。',
  'gameEmptyShiny': '<b>還沒有來自《{game}》的異色寶可夢。</b>這裡只有在《{game}》獲得的寶可夢才能填格；你在其他遊戲捕獲的仍保留在完整的 Living Dex 中。',
  'noShiny': {
    other: '<b>還沒有異色寶可夢。</b>將捕獲記錄為異色，牠的格子就會在這裡亮起。你已捕獲的 {count} 格仍保留在一般的 Living Dex 中。'
  },
  'logShiny': '記錄異色',
  'unplaced': {
    other: '有 {count} 筆記錄屬於這個版本還不認得的寶可夢。它們安全地保存在你的<link>日誌</link>中。'
  },

  'empty.noSlots.title': '沒有可顯示的寶可夢',
  'empty.noSlots.description': '寶可夢圖鑑資料中沒有寶可夢，所以還沒有可以填的格子。',
  'empty.game.title': '《{game}》中沒有可收集的寶可夢',
  'empty.game.titleUnknown': '這款遊戲中沒有可收集的寶可夢',
  'empty.game.description': '你的 Living Dex 中，沒有不靠活動就能在這款遊戲獲得的寶可夢。',
  'empty.nothingMissing.title': '什麼都不缺',
  'empty.nothingMissing.description': '每一格都填滿了，沒有要捕獲的了。',
  'empty.nothingMissing.descriptionShiny': '每一格都有異色，沒有要狩獵的了。',
  'empty.showEverySlot': '顯示所有格子',
  'find.title': '正在顯示所有格子',
  'find.body': '{name}已經捕獲，因此已關閉「僅顯示缺少的」。',
  'find.bodyUnnamed': '這隻寶可夢已經捕獲，因此已關閉「僅顯示缺少的」。',

  'toolbar.view': '檢視',
  'toolbar.view.boxes': '盒子',
  'toolbar.view.list': '清單',
  'toolbar.missingOnly': '僅顯示缺少的',
  'toolbar.jumpDex': '跳到圖鑑',
  'toolbar.jumpGeneration': '跳到世代',
  'toolbar.generation': { other: '{generation}，{count} 格中已捕獲 {filled} 格' },
  'toolbar.find.label': '在你的 Living Dex 中尋找寶可夢',
  'toolbar.find.placeholder': '尋找寶可夢…',
  'toolbar.find.empty': '沒有這個名稱的寶可夢',
  'toolbar.boxIndex': '盒子索引',
  'toolbar.box': { other: '{box}，{range}，{count} 格中已捕獲 {filled} 格' },
  'toolbar.boxComplete': '{box}，{range}，已完成',
  'toolbar.tip.complete': '已完成',
  'toolbar.tip.caught': { other: '已捕獲 {filled} / {count}' },
  'toolbar.tip.shinyCaught': { other: '已捕獲異色 {filled} / {count}' },

  'grid.label': 'Living Dex 的格子',
  'grid.labelShiny': '異色 Living Dex 的格子',
  'grid.labelHome': 'HOME Dex 的格子',
  'grid.labelHomeShiny': '異色 HOME Dex 的格子',
  'grid.hint': '使用方向鍵在格子之間移動，按 Enter 開啟。',
  'grid.hintHome': '使用方向鍵在格子之間移動。按 Enter 可將已捕獲的寶可夢標記為已在 Pokémon HOME；格子裡有多筆記錄或沒有記錄時則會開啟格子。',
  'grid.otherPokemon': '其他寶可夢',
  'grid.missing': { other: '缺少 {count} 隻' },

  'drawer.place': '{box} · 第 {row} 列，第 {column} 欄',
  'drawer.previous': '上一格',
  'drawer.next': '下一格',
  'drawer.find': '哪裡可以找到',
  'drawer.log': '記錄這隻寶可夢',
  'drawer.gmax': '超極巨化',
  'drawer.shinyOwned': '已擁有異色',
  'drawer.entries': '這一格的記錄',
  'drawer.empty': '這一格沒有記錄。捕獲了嗎？<b>記錄這隻寶可夢</b>，牠就會直接放進這一格。',
  'drawer.emptyIdle': '這裡還沒有任何記錄。捕獲了嗎？<b>記錄這隻寶可夢</b>，牠就會直接放進這一格。',
  'drawer.regularOnly': {
    other: '你在這裡有 {count} 筆一般記錄。在異色 Living Dex 中，只有異色才能填滿這一格。'
  },
  'drawer.inHome': '已在 Pokémon HOME'
}

export default messages
