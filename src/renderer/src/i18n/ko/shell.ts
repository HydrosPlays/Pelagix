import type { Translation } from '../en'

const messages: Translation<'shell'> = {
  'route.home': '홈',
  'route.dex': '포켓몬 도감',
  'route.species': '포켓몬',
  'route.living': '리빙 도감',
  'route.homedex': 'HOME 도감',
  'route.journal': '일지',
  'route.achievements': '도전 과제',
  'route.settings': '설정',
  'route.kit': '컴포넌트 키트',
  'route.notFound': '찾을 수 없음',

  'nav.label': '주 메뉴',
  'nav.tagline': '리빙 도감',
  'nav.progress.eyebrow': '리빙 도감',
  'nav.progress.count': '{total}마리 중 {caught}마리 잡음',
  'nav.progress.tooltip': '리빙 도감: {count} ({percent})',
  'nav.progress.label': '리빙 도감 진행도: {count}',
  'nav.progress.ring': '리빙 도감 완성도',

  'topbar.fixture': '테스트 데이터',
  'topbar.fixtureHint': '실제 데이터 세트를 찾지 못해 개발용 소형 데이터를 불러왔습니다. npm run data를 실행하세요.',
  'topbar.notSaved': '저장 안 됨',
  'topbar.search': '포켓몬 검색…',
  'topbar.shiny.on': '색이 다른 모습 보기 켜짐',
  'topbar.shiny.off': '색이 다른 모습 보기 꺼짐',
  'topbar.shiny.showing': '색이 다른 모습으로 표시 중',
  'topbar.shiny.show': '색이 다른 모습으로 표시',

  'skipToContent': '본문으로 건너뛰기',
  'pageError': '이 페이지에 문제가 발생했습니다',
  'appError': 'Pelagix에 문제가 발생했습니다',
  'notFound.title': '미지의 바다',
  'notFound.description': '이 주소에는 페이지가 없습니다.',
  'notFound.back': '홈으로 돌아가기',

  'boot.step.save': '세이브를 불러오는 중',
  'boot.step.dex': '도감 데이터를 끌어올리는 중',
  'boot.retry': '다시 시도',
  'boot.reload': '앱 새로 고침',
  'boot.dataMissing.title': '도감 데이터 세트가 없습니다',
  'boot.dataMissing.hint': '<code>npm run data</code>를 실행해 데이터 세트를 만든 뒤 다시 시도하세요.',
  'boot.dataMissing.detail': '데이터 세트를 불러오지 못했습니다.',
  'boot.saveFailed.title': '세이브를 불러오지 못했습니다',
  'boot.saveFailed.hint': '덮어쓴 내용은 없습니다. 세이브 파일을 읽을 수 있는지 확인한 뒤 다시 시도하세요.',

  'loadReport.newer': '더 새로운 Pelagix에서 만든 세이브입니다',
  'loadReport.repaired': '불러오는 중 세이브를 복구했습니다',

  'language.title': '언어를 선택하세요',
  'language.description': 'Pelagix와 포켓몬, 게임, 장소의 이름이 이 언어로 표시됩니다. 나중에 설정에서 바꿀 수 있습니다.',
  'language.list': '언어',
  'language.confirm': '계속'
}

export default messages
