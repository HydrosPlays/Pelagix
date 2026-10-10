import type { Translation } from '../en'

const messages: Translation<'search'> = {
  'label': '搜索与命令',
  'input': '搜索宝可梦、页面和操作',
  'results': '结果',
  'empty.title': '没有与“{query}”相符的结果',
  'empty.hint': '试试宝可梦的名字或图鉴编号，或“日志”这样的页面名。',
  'footer.move': '<keys/> 移动',
  'footer.open': '<keys/> 打开',
  'footer.close': '<keys/> 关闭',
  'status.none': '没有结果',
  'status.count': { other: '{count} 个结果' },

  'section.pokemon': '宝可梦',
  'section.recent': '最近打开',
  'section.pages': '页面',
  'section.actions': '操作',

  'row.shiny': '已记录异色',
  'row.missing': '尚未捕获',

  'action.log': '为{name}记录捕获',
  'action.shiny.on': '开启异色视图',
  'action.shiny.off': '关闭异色视图',
  'action.theme.light': '切换到浅色主题',
  'action.theme.dark': '切换到深色主题',
  'action.motion.on': '开启减弱动态效果',
  'action.motion.off': '关闭减弱动态效果',
  'hint.on': '开',
  'hint.off': '关',
  'hint.dark': '深色',
  'hint.light': '浅色',

  'toast.shiny.on': '异色视图已开启',
  'toast.shiny.on.body': '宝可梦将以异色显示。',
  'toast.shiny.off': '异色视图已关闭',
  'toast.motion.on': '减弱动态效果已开启',
  'toast.motion.off': '减弱动态效果已关闭',

  'keywords.page.home': '首页 主页 概览 总览 开始 进度 仪表盘',
  'keywords.page.dex': '图鉴 宝可梦图鉴 宝可梦 精灵 浏览 种类 列表',
  'keywords.page.living': '盒子 箱子 收集 收藏 形态 格子 全图鉴 活图鉴',
  'keywords.page.homedex': 'pokemon home 宝可梦home 传送 已传送 存放 银行 盒子',
  'keywords.page.journal': '日志 记录 历史 捕获 日记',
  'keywords.page.achievements': '成就 奖杯 奖牌 徽章 目标',
  'keywords.page.settings': '设置 偏好 选项 规则 主题 导入 导出 备份 语言',
  'keywords.action.log': '记录 捕获 添加 新建 新增 抓到',
  'keywords.action.shiny': '切换 异色 闪光 视图 图片 渲染图',
  'keywords.action.theme': '切换 主题 深色 浅色 暗色 亮色 外观 模式 夜间',
  'keywords.action.motion': '切换 减弱 减少 动态 动画 动效',
  'keywords.logPhrase': '记录捕获'
}

export default messages
