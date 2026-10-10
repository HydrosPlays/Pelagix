import type { Translation } from '../en'

const messages: Translation<'gamesave'> = {
  'failure.not-a-save': '该文件不是 Pelagix 能读取的宝可梦游戏存档。',
  'failure.too-large': '文件过大，不是游戏存档。',
  'failure.unreadable': '无法打开该文件。可能有其他程序正在使用它。',
  'failure.reader-missing': 'Pelagix 中读取游戏存档的组件缺失。重新安装 Pelagix 即可恢复。',
  'failure.reader-failed': '读取该存档时出了点问题。',
  'failure.timed-out': '读取该存档耗时过长，已中止。',
  'shinydexFailure.not-shinydex': '该文件既不是 ShinyDex 导出文件，也不是保存的 ShinyDex History 页面：其中没有找到异色宝可梦。',
  'shinydexFailure.too-large': '文件过大，不是 ShinyDex 导出文件或保存的 ShinyDex 页面。',
  'shinydexFailure.unreadable': '无法打开该文件。可能有其他程序正在使用它。',
  'shinydexFailure.other': '读取该文件时出了点问题。',

  'dialog.title': '导入这些宝可梦？',
  'dialog.add': { other: '添加 {count} 条记录' },
  'dialog.complete': { other: '补全 {count} 条已有记录' },
  'dialog.nothing': '没有可添加的内容',
  'dialog.failed': '无法添加这些宝可梦',

  'counts.new': { other: '{count} 只新增' },
  'counts.fills': { other: '{count} 只可填入 Living Dex 的空格' },
  'counts.imported': { other: '{count} 只已导入过' },
  'counts.completes': { other: '{count} 条已有记录将补上缺少的信息' },
  'counts.egg': { other: '已跳过 {count} 个蛋' },
  'counts.unsupported': { other: '{count} 只无法导入' },

  'ask.label': '这些宝可梦来自哪款游戏？',
  'ask.hint': '此存档没有记录部分宝可梦的具体游戏版本。你的选择将用于可能来自该游戏的宝可梦。',
  'ask.placeholder': '选择游戏…',

  'bar.chosen': '已选 {chosen} / {total} 只新增',
  'bar.allNew': '全部新增',
  'bar.onlyEmpty': '仅空格',

  'row.import': '导入{name}',
  'row.nickname': '“{nickname}”',
  'row.eggOf': '{species}的蛋',
  'row.egg': '蛋',
  'row.unknownPokemon': '未知宝可梦',
  'status.new': '新增',
  'status.newSlot': '新格子',
  'status.imported': '已导入过',
  'status.completes': '补充缺少的信息',
  'status.egg': '蛋',
  'status.eggSkipped': '蛋，已跳过',
  'status.unsupported': '无法导入',

  'reason.unreadable': '无法读取。',
  'reason.unknownPokemon': 'Pelagix 不认识这只宝可梦。',
  'reason.unknownForm': 'Pelagix 不认识这种形态。',
  'reason.untrackedGame': '它来自 Pelagix 不追踪的游戏。',
  'reason.wrongGame': '它不可能来自你选择的游戏。',
  'reason.askGame': '存档没有记录它来自哪款游戏。请在上方选择。',
  'reason.gameNotRecognised': '无法识别游戏。',
  'reason.gameNotRecognisedNamed': '无法识别游戏（{game}）。',
  'reason.noDate': '无法读取它的日期。',

  'source.save.description': '{file} 是{game}的存档。尚未做出任何更改，存档文件只会被读取。',
  'source.save.descriptionTrainer': '{file} 是{game}的存档，训练家为 {trainer}。尚未做出任何更改，存档文件只会被读取。',
  'source.save.games': '宝可梦 {names}',
  'source.save.unknownGame': '第 {generation} 世代游戏',
  'source.save.dropped': { other: '此存档中有 {count} 只宝可梦无法读取，已略去。' },
  'source.save.empty': '此存档中没有宝可梦。',
  'source.save.list': '此存档中的宝可梦',

  'source.shinydex.export': { other: '{file} 是 ShinyDex 导出文件，包含 {count} 只异色宝可梦。尚未做出任何更改，文件只会被读取。只读取其中的宝可梦：游戏、方式、日期以及其中包含的其他信息。你的规则、设置和成就保持不变。' },
  'source.shinydex.page': { other: '{file} 是保存的 ShinyDex 历史页面，包含 {count} 只异色宝可梦。尚未做出任何更改，文件只会被读取。游戏、方式、日期和球种来自 ShinyDex；其他信息需要你手动补充。' },
  'source.shinydex.dropped': { other: '此文件列出的异色超过了 Pelagix 一次能读取的数量。最后 {count} 只已略去。' },
  'source.shinydex.unusable': { other: '此文件中有 {count} 条记录无法读取，已略去。' },
  'source.shinydex.empty': '此文件中没有异色宝可梦。',
  'source.shinydex.list': '此文件中的异色宝可梦'
}

export default messages
