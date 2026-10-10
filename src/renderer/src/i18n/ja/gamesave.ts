import type { Translation } from '../en'

const messages: Translation<'gamesave'> = {
  'failure.not-a-save': 'このファイルは、Pelagixが読み取れるポケモンのゲームのセーブデータではありません。',
  'failure.too-large': 'このファイルはゲームのセーブデータにしては大きすぎます。',
  'failure.unreadable': 'このファイルを開けませんでした。ほかのプログラムが使用している可能性があります。',
  'failure.reader-missing': 'Pelagixのセーブデータ読み取り機能が見つかりません。Pelagixを再インストールすると元に戻ります。',
  'failure.reader-failed': 'セーブデータの読み取り中に問題が発生しました。',
  'failure.timed-out': 'セーブデータの読み取りに時間がかかりすぎたため、中止しました。',
  'shinydexFailure.not-shinydex': 'このファイルはShinyDexのエクスポートでも、保存したShinyDexのHistoryページでもありません。色違いが見つかりませんでした。',
  'shinydexFailure.too-large': 'このファイルはShinyDexのエクスポートや保存したShinyDexのページにしては大きすぎます。',
  'shinydexFailure.unreadable': 'このファイルを開けませんでした。ほかのプログラムが使用している可能性があります。',
  'shinydexFailure.other': 'ファイルの読み取り中に問題が発生しました。',

  'dialog.title': 'これらのポケモンをインポートしますか？',
  'dialog.add': { other: '{count}件の記録を追加' },
  'dialog.complete': { other: '以前の記録{count}件を補完' },
  'dialog.nothing': '追加するものがありません',
  'dialog.failed': 'ポケモンを追加できませんでした',

  'counts.new': { other: '新規{count}件' },
  'counts.fills': { other: '{count}件がリビング図鑑の空き枠を埋めます' },
  'counts.imported': { other: '{count}件はインポート済み' },
  'counts.completes': { other: '以前の記録{count}件に不足している詳細を追加' },
  'counts.egg': { other: 'タマゴ{count}個をスキップ' },
  'counts.unsupported': { other: '{count}件はインポート不可' },

  'ask.label': 'どのゲームのポケモンですか？',
  'ask.hint': 'このセーブデータには、一部のポケモンの正確なゲームが記録されていません。選んだゲームは、そのゲーム出身の可能性があるポケモンに使われます。',
  'ask.placeholder': 'ゲームを選択…',

  'bar.chosen': '新規{total}件中{chosen}件を選択',
  'bar.allNew': '新規すべて',
  'bar.onlyEmpty': '空き枠のみ',

  'row.import': '{name}をインポート',
  'row.nickname': '「{nickname}」',
  'row.eggOf': '{species}のタマゴ',
  'row.egg': 'タマゴ',
  'row.unknownPokemon': '不明なポケモン',
  'status.new': '新規',
  'status.newSlot': '新しい枠',
  'status.imported': 'インポート済み',
  'status.completes': '不足している詳細を追加',
  'status.egg': 'タマゴ',
  'status.eggSkipped': 'タマゴ（スキップ）',
  'status.unsupported': 'インポート不可',

  'reason.unreadable': '読み取れませんでした。',
  'reason.unknownPokemon': 'Pelagixが知らないポケモンです。',
  'reason.unknownForm': 'Pelagixが知らないすがたです。',
  'reason.untrackedGame': 'Pelagixが対応していないゲームのポケモンです。',
  'reason.wrongGame': '選んだゲームのポケモンではありえません。',
  'reason.askGame': 'セーブデータにどのゲームのポケモンかが記録されていません。上で選んでください。',
  'reason.gameNotRecognised': 'ゲームを認識できません。',
  'reason.gameNotRecognisedNamed': 'ゲームを認識できません（{game}）。',
  'reason.noDate': '日付を読み取れませんでした。',

  'source.save.description': '{file}は{game}のセーブデータです。まだ何も変更されていません。セーブファイルは読み取るだけです。',
  'source.save.descriptionTrainer': '{file}は{game}のセーブデータです（トレーナー：{trainer}）。まだ何も変更されていません。セーブファイルは読み取るだけです。',
  'source.save.games': 'ポケットモンスター {names}',
  'source.save.unknownGame': '第{generation}世代のゲーム',
  'source.save.dropped': { other: 'このセーブデータのポケモン{count}匹は読み取れなかったため、除外されます。' },
  'source.save.empty': 'このセーブデータにポケモンはいません。',
  'source.save.list': 'このセーブデータのポケモン',

  'source.shinydex.export': {
    other: '{file}は色違いポケモン{count}匹を含むShinyDexのエクスポートです。まだ何も変更されていません。ファイルは読み取るだけです。読み取るのはポケモンだけで、ゲーム、方法、日付と、含まれている詳細が対象です。ルール、設定、実績はそのままです。'
  },
  'source.shinydex.page': {
    other: '{file}は色違いポケモン{count}匹を含む保存済みのShinyDexの履歴です。まだ何も変更されていません。ファイルは読み取るだけです。ゲーム、方法、日付、ボールはShinyDexから読み取り、それ以外は手動で追加します。'
  },
  'source.shinydex.dropped': { other: 'このファイルには、Pelagixが一度に読み取れる数より多くの色違いが含まれています。最後の{count}匹は除外されます。' },
  'source.shinydex.unusable': { other: 'このファイルの記録{count}件は読み取れなかったため、除外されます。' },
  'source.shinydex.empty': 'このファイルに色違いはいません。',
  'source.shinydex.list': 'このファイルの色違い'
}

export default messages
