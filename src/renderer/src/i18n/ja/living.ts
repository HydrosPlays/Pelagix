import type { Translation } from '../en'

const messages: Translation<'living'> = {
  'box.name': 'ボックス{number}',
  'box.nameOfDex': '{dex}のボックス{number}',
  'box.nameOfOther': '{game}で手に入るそのほかのポケモンのボックス{number}',
  'box.mark': 'ボックス{number}にHOMEの印を付ける',
  'box.markOfDex': '{dex}のボックス{number}にHOMEの印を付ける',
  'box.markOfOther': '{game}で手に入るそのほかのポケモンのボックス{number}にHOMEの印を付ける',
  'box.markHint': 'ボックスにHOMEの印を付ける',
  'box.markShort': 'ボックスに印',
  'box.status.complete': 'コンプリート',
  'box.complete': '{box}をコンプリート',
  'box.completeUnnamed': 'ボックスをコンプリート',
  'box.complete.body': { other: '{count}枠すべてが埋まりました。' },

  'status.caught': 'ゲット済み',
  'status.caughtCount': { other: 'ゲット済み · {count}件' },
  'status.missing': '未ゲット',
  'status.shinyCaught': '色違いゲット済み',
  'status.shinyCaughtCount': { other: '色違いゲット済み · 色違い{count}件' },
  'status.noShiny': '色違いは未ゲット',
  'status.noShinyRegular': { other: '色違いは未ゲット · 通常色{count}件' },
  'status.withEntries': { other: '{status} · {count}件' },
  'slot.label': '{slot}、{status}',

  'rules.preset': 'プリセット「{preset}」',
  'rules.custom': 'カスタムルール',
  'rules.line': { other: '{rules} · {count}枠' },
  'rules.lineInGame': { other: '{rules} · {game}で手に入る{count}枠' },
  'rules.change': 'ルールを変更',

  'hero.title': 'リビング図鑑',
  'hero.titleShiny': '色違いリビング図鑑',
  'hero.ring': 'リビング図鑑の完成度',
  'hero.ringShiny': '色違いリビング図鑑の完成度',
  'hero.count': { other: '{count}匹中{filled}匹ゲット' },
  'hero.countShiny': { other: '{count}匹中{filled}匹の色違いをゲット' },
  'hero.countGame': { other: '{game}で{count}匹中{filled}匹ゲット' },
  'hero.countShinyGame': { other: '{game}で{count}匹中{filled}匹の色違いをゲット' },
  'hero.unit': 'ゲット',
  'hero.unitShiny': '色違いゲット',
  'hero.unitGame': '{game}でゲット',
  'hero.unitShinyGame': '{game}で色違いゲット',
  'hero.anyColour': { other: '色を問わず<b>{count}</b>匹ゲット' },
  'hero.shiny': { other: '色違い<b>{count}</b>匹' },
  'hero.toGo': { other: 'あと{count}匹' },
  'hero.done': 'すべてゲットしました',
  'hero.mode': 'リビング図鑑のモード',
  'hero.mode.normal': 'リビング図鑑',
  'hero.boxesComplete': 'コンプリートしたボックス',
  'hero.species': '種類',
  'hero.speciesShiny': '色違いの種類',

  'notice.rules': {
    other: '<b>リビング図鑑のルールが変わりました。</b>埋める枠は{count}枠になりました（以前は{before}枠）。記録は何も失われていません。'
  },
  'notice.data': {
    other: '<b>ポケモン図鑑のデータが更新されました。</b>埋める枠は{count}枠になりました（以前は{before}枠）。記録は何も失われていません。'
  },
  'notice.review': 'ルールを確認',
  'notice.dismiss': '閉じる',
  'complete.all': {
    other: '<b>リビング図鑑完成！</b>{count}枠すべてが埋まりました。コレクションはこれで全部です。'
  },
  'complete.game': {
    other: '<b>リビング図鑑完成！</b>{count}枠すべてが埋まりました。{game}で手に入るポケモンはこれで全部です。'
  },
  'complete.shinyAll': {
    other: '<b>色違いリビング図鑑完成！</b>{count}枠すべてが色違いで埋まりました。コレクションはこれで全部です。'
  },
  'complete.shinyGame': {
    other: '<b>色違いリビング図鑑完成！</b>{count}枠すべてが色違いで埋まりました。{game}で手に入るポケモンはこれで全部です。'
  },
  'waiting': '<b>リビング図鑑が待っています。</b>ポケモン図鑑でポケモンを探し、ゲットしたゲームと場所を選ぶと、ここの枠に入ります。',
  'openPokedex': 'ポケモン図鑑を開く',
  'gameEmpty': '<b>{game}ではまだ何もゲットしていません。</b>ここでは{game}で手に入れたポケモンだけが枠を埋めます。ほかのゲームでゲットしたポケモンは、全体のリビング図鑑に残っています。',
  'gameEmptyShiny': '<b>{game}の色違いポケモンはまだいません。</b>ここでは{game}で手に入れたポケモンだけが枠を埋めます。ほかのゲームでゲットしたポケモンは、全体のリビング図鑑に残っています。',
  'noShiny': {
    other: '<b>色違いのポケモンはまだいません。</b>ゲットを色違いとして記録すると、ここの枠が光ります。ゲット済みの{count}枠は通常のリビング図鑑に残っています。'
  },
  'logShiny': '色違いを記録',
  'unplaced': {
    other: '{count}件の記録は、このバージョンがまだ知らないポケモンのものです。<link>ジャーナル</link>に安全に残っています。'
  },

  'empty.noSlots.title': '表示するポケモンがいません',
  'empty.noSlots.description': 'ポケモン図鑑のデータにポケモンがいないため、埋める枠がまだありません。',
  'empty.game.title': '{game}で集めるポケモンはいません',
  'empty.game.titleUnknown': 'このゲームで集めるポケモンはいません',
  'empty.game.description': 'リビング図鑑のポケモンのうち、このゲームでイベントなしに手に入るものはいません。',
  'empty.nothingMissing.title': '足りないポケモンはいません',
  'empty.nothingMissing.description': 'すべての枠が埋まっています。ゲットするポケモンはもういません。',
  'empty.nothingMissing.descriptionShiny': 'すべての枠に色違いがいます。探す色違いはもういません。',
  'empty.showEverySlot': 'すべての枠を表示',
  'find.title': 'すべての枠を表示しています',
  'find.body': '{name}はゲット済みのため、「未ゲットのみ」をオフにしました。',
  'find.bodyUnnamed': 'そのポケモンはゲット済みのため、「未ゲットのみ」をオフにしました。',

  'toolbar.view': '表示',
  'toolbar.view.boxes': 'ボックス',
  'toolbar.view.list': 'リスト',
  'toolbar.missingOnly': '未ゲットのみ',
  'toolbar.jumpDex': '図鑑へ移動',
  'toolbar.jumpGeneration': '世代へ移動',
  'toolbar.generation': { other: '{generation}、{count}匹中{filled}匹ゲット' },
  'toolbar.find.label': 'リビング図鑑でポケモンを探す',
  'toolbar.find.placeholder': 'ポケモンを探す…',
  'toolbar.find.empty': 'その名前のポケモンはいません',
  'toolbar.boxIndex': 'ボックス一覧',
  'toolbar.box': { other: '{box}、{range}、{count}匹中{filled}匹ゲット' },
  'toolbar.boxComplete': '{box}、{range}、コンプリート',
  'toolbar.tip.complete': 'コンプリート',
  'toolbar.tip.caught': { other: '{filled} / {count} ゲット' },
  'toolbar.tip.shinyCaught': { other: '{filled} / {count} 色違いゲット' },

  'grid.label': 'リビング図鑑の枠',
  'grid.labelShiny': '色違いリビング図鑑の枠',
  'grid.labelHome': 'HOME図鑑の枠',
  'grid.labelHomeShiny': '色違いHOME図鑑の枠',
  'grid.hint': '矢印キーで枠を移動し、Enterで開きます。',
  'grid.hintHome': '矢印キーで枠を移動します。Enterでゲット済みのポケモンにPokémon HOMEの印を付けます。記録が複数ある枠や空の枠では、枠を開きます。',
  'grid.otherPokemon': 'そのほかのポケモン',
  'grid.missing': { other: '未ゲット{count}匹' },

  'drawer.place': '{box} · {row}行目、{column}列目',
  'drawer.previous': '前の枠',
  'drawer.next': '次の枠',
  'drawer.find': '出会える場所',
  'drawer.log': 'このポケモンを記録',
  'drawer.gmax': 'キョダイマックス',
  'drawer.shinyOwned': '色違い所持',
  'drawer.entries': 'この枠の記録',
  'drawer.empty': 'この枠に記録はありません。ゲットしましたか？<b>このポケモンを記録</b>すると、この枠に入ります。',
  'drawer.emptyIdle': 'ここにはまだ記録がありません。ゲットしましたか？<b>このポケモンを記録</b>すると、この枠に入ります。',
  'drawer.regularOnly': {
    other: 'ここには通常色の記録が{count}件あります。色違いリビング図鑑では、色違いだけがこの枠を埋めます。'
  },
  'drawer.inHome': 'Pokémon HOMEにいます'
}

export default messages
