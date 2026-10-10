import type { Translation } from '../en'

const messages: Translation<'shell'> = {
  'route.home': '首页',
  'route.dex': '宝可梦图鉴',
  'route.species': '宝可梦',
  'route.living': 'Living Dex',
  'route.homedex': 'HOME 图鉴',
  'route.journal': '日志',
  'route.achievements': '成就',
  'route.settings': '设置',
  'route.kit': '组件库',
  'route.notFound': '未找到',

  'nav.label': '主导航',
  'nav.tagline': 'Living Dex',
  'nav.progress.eyebrow': 'Living Dex',
  'nav.progress.count': '已捕获 {caught} / {total}',
  'nav.progress.tooltip': 'Living Dex：{count}（{percent}）',
  'nav.progress.label': 'Living Dex 进度：{count}',
  'nav.progress.ring': 'Living Dex 完成度',

  'topbar.fixture': '测试数据',
  'topbar.fixtureHint': '未找到正式数据集，已加载小型开发用测试数据。请运行 npm run data。',
  'topbar.notSaved': '未保存',
  'topbar.search': '搜索宝可梦…',
  'topbar.shiny.on': '异色视图已开启',
  'topbar.shiny.off': '异色视图已关闭',
  'topbar.shiny.showing': '正在显示异色图片',
  'topbar.shiny.show': '显示异色图片',

  'skipToContent': '跳到正文',
  'pageError': '此页面出了点问题',
  'appError': 'Pelagix 出了点问题',
  'notFound.title': '未知的海域',
  'notFound.description': '这个地址没有对应的页面。',
  'notFound.back': '返回首页',

  'boot.step.save': '正在读取存档',
  'boot.step.dex': '正在载入图鉴数据',
  'boot.retry': '重试',
  'boot.reload': '重新加载应用',
  'boot.dataMissing.title': '缺少宝可梦图鉴数据集',
  'boot.dataMissing.hint': '请运行 <code>npm run data</code> 生成数据集，然后重试。',
  'boot.dataMissing.detail': '无法加载数据集。',
  'boot.saveFailed.title': '无法读取你的存档',
  'boot.saveFailed.hint': '没有任何内容被覆盖。请确认存档文件可以读取，然后重试。',

  'loadReport.newer': '此存档来自更新版本的 Pelagix',
  'loadReport.repaired': '读取时已修复你的存档',

  'language.title': '选择语言',
  'language.description': 'Pelagix 以及宝可梦、游戏和地点的名称都会以这种语言显示。之后可以在“设置”中更改。',
  'language.list': '语言',
  'language.confirm': '继续'
}

export default messages
