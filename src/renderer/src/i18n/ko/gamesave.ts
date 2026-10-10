import type { Translation } from '../en'

const messages: Translation<'gamesave'> = {
  'failure.not-a-save': '이 파일은 Pelagix가 읽을 수 있는 포켓몬 게임의 세이브 파일이 아닙니다.',
  'failure.too-large': '게임 세이브 파일이라고 하기에는 파일이 너무 큽니다.',
  'failure.unreadable': '파일을 열지 못했습니다. 다른 프로그램에서 사용 중일 수 있습니다.',
  'failure.reader-missing': 'Pelagix에서 게임 세이브를 읽는 구성 요소가 없습니다. Pelagix를 다시 설치하면 복구됩니다.',
  'failure.reader-failed': '세이브 파일을 읽는 중 문제가 발생했습니다.',
  'failure.timed-out': '세이브 파일을 읽는 데 너무 오래 걸려 중단했습니다.',
  'shinydexFailure.not-shinydex': '이 파일은 ShinyDex 내보내기 파일도, 저장한 ShinyDex History 페이지도 아닙니다. 색이 다른 포켓몬을 찾지 못했습니다.',
  'shinydexFailure.too-large': 'ShinyDex 내보내기 파일이나 저장한 ShinyDex 페이지라고 하기에는 파일이 너무 큽니다.',
  'shinydexFailure.unreadable': '파일을 열지 못했습니다. 다른 프로그램에서 사용 중일 수 있습니다.',
  'shinydexFailure.other': '파일을 읽는 중 문제가 발생했습니다.',

  'dialog.title': '이 포켓몬들을 가져올까요?',
  'dialog.add': { other: '기록 {count}개 추가' },
  'dialog.complete': { other: '이전 기록 {count}개 보완' },
  'dialog.nothing': '추가할 항목 없음',
  'dialog.failed': '포켓몬을 추가하지 못했습니다',

  'counts.new': { other: '신규 {count}마리' },
  'counts.fills': { other: '{count}마리가 리빙 도감의 빈칸을 채움' },
  'counts.imported': { other: '{count}마리는 이미 가져옴' },
  'counts.completes': { other: '이전 기록 {count}개에 빠진 정보 추가' },
  'counts.egg': { other: '알 {count}개 건너뜀' },
  'counts.unsupported': { other: '{count}마리는 가져올 수 없음' },

  'ask.label': '어느 게임의 포켓몬인가요?',
  'ask.hint': '이 세이브에는 일부 포켓몬의 정확한 게임이 기록되어 있지 않습니다. 선택한 게임은 그 게임에서 나올 수 있는 포켓몬에 적용됩니다.',
  'ask.placeholder': '게임 선택…',

  'bar.chosen': '신규 {total}마리 중 {chosen}마리 선택',
  'bar.allNew': '신규 전체',
  'bar.onlyEmpty': '빈칸만',

  'row.import': '{name} 가져오기',
  'row.nickname': '“{nickname}”',
  'row.eggOf': '{species}의 알',
  'row.egg': '알',
  'row.unknownPokemon': '알 수 없는 포켓몬',
  'status.new': '신규',
  'status.newSlot': '새 칸',
  'status.imported': '이미 가져옴',
  'status.completes': '빠진 정보 추가',
  'status.egg': '알',
  'status.eggSkipped': '알, 건너뜀',
  'status.unsupported': '가져올 수 없음',

  'reason.unreadable': '읽지 못했습니다.',
  'reason.unknownPokemon': 'Pelagix가 모르는 포켓몬입니다.',
  'reason.unknownForm': 'Pelagix가 모르는 폼입니다.',
  'reason.untrackedGame': 'Pelagix가 다루지 않는 게임의 포켓몬입니다.',
  'reason.wrongGame': '선택한 게임에서 나올 수 없는 포켓몬입니다.',
  'reason.askGame': '세이브에 어느 게임의 포켓몬인지 기록되어 있지 않습니다. 위에서 게임을 선택하세요.',
  'reason.gameNotRecognised': '게임을 인식하지 못했습니다.',
  'reason.gameNotRecognisedNamed': '게임을 인식하지 못했습니다({game}).',
  'reason.noDate': '날짜를 읽지 못했습니다.',

  'source.save.description': '{file}: {game}의 세이브 파일입니다. 아직 아무것도 바뀌지 않았으며, 세이브 파일은 읽기만 합니다.',
  'source.save.descriptionTrainer': '{file}: {game}의 세이브 파일입니다(트레이너 {trainer}). 아직 아무것도 바뀌지 않았으며, 세이브 파일은 읽기만 합니다.',
  'source.save.games': '포켓몬스터 {names}',
  'source.save.unknownGame': '{generation}세대 게임',
  'source.save.dropped': { other: '이 세이브의 포켓몬 {count}마리는 읽지 못해 제외했습니다.' },
  'source.save.empty': '이 세이브에는 포켓몬이 없습니다.',
  'source.save.list': '이 세이브의 포켓몬',

  'source.shinydex.export': {
    other: '{file}: 색이 다른 포켓몬 {count}마리가 담긴 ShinyDex 내보내기 파일입니다. 아직 아무것도 바뀌지 않았으며, 파일은 읽기만 합니다. 포켓몬만 읽습니다: 게임, 방법, 날짜와 파일에 담긴 세부 정보. 규칙, 설정, 도전 과제는 그대로 유지됩니다.'
  },
  'source.shinydex.page': {
    other: '{file}: 색이 다른 포켓몬 {count}마리가 담긴 저장된 ShinyDex 기록 페이지입니다. 아직 아무것도 바뀌지 않았으며, 파일은 읽기만 합니다. 게임, 방법, 날짜, 볼은 ShinyDex에서 가져오고, 나머지는 직접 추가합니다.'
  },
  'source.shinydex.dropped': { other: '이 파일에는 Pelagix가 한 번에 읽을 수 있는 것보다 많은 포켓몬이 있습니다. 마지막 {count}마리는 제외했습니다.' },
  'source.shinydex.unusable': { other: '이 파일의 항목 {count}개는 읽지 못해 제외했습니다.' },
  'source.shinydex.empty': '이 파일에는 색이 다른 포켓몬이 없습니다.',
  'source.shinydex.list': '이 파일의 색이 다른 포켓몬'
}

export default messages
