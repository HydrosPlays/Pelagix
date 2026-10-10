import type { Translation } from '../en'

const messages: Translation<'search'> = {
  'label': '검색 및 명령',
  'input': '포켓몬, 페이지, 작업 검색',
  'results': '결과',
  'empty.title': '“{query}”와(과) 일치하는 항목이 없습니다',
  'empty.hint': '포켓몬의 이름이나 도감 번호, 또는 일지 같은 페이지 이름으로 검색해 보세요.',
  'footer.move': '<keys/> 이동',
  'footer.open': '<keys/> 열기',
  'footer.close': '<keys/> 닫기',
  'status.none': '결과 없음',
  'status.count': { other: '결과 {count}개' },

  'section.pokemon': '포켓몬',
  'section.recent': '최근에 연 항목',
  'section.pages': '페이지',
  'section.actions': '작업',

  'row.shiny': '색이 다른 포켓몬 기록됨',
  'row.missing': '아직 잡지 못함',

  'action.log': '{name} 포획 기록',
  'action.shiny.on': '색이 다른 모습 보기 켜기',
  'action.shiny.off': '색이 다른 모습 보기 끄기',
  'action.theme.light': '밝은 테마로 전환',
  'action.theme.dark': '어두운 테마로 전환',
  'action.motion.on': '애니메이션 줄이기 켜기',
  'action.motion.off': '애니메이션 줄이기 끄기',
  'hint.on': '켜짐',
  'hint.off': '꺼짐',
  'hint.dark': '어둡게',
  'hint.light': '밝게',

  'toast.shiny.on': '색이 다른 모습 보기 켜짐',
  'toast.shiny.on.body': '포켓몬이 색이 다른 모습으로 표시됩니다.',
  'toast.shiny.off': '색이 다른 모습 보기 꺼짐',
  'toast.motion.on': '애니메이션 줄이기 켜짐',
  'toast.motion.off': '애니메이션 줄이기 꺼짐',

  'keywords.page.home': '홈 대시보드 개요 시작 진행도 진행 현황',
  'keywords.page.dex': '도감 포켓몬 포켓몬도감 둘러보기 종 목록',
  'keywords.page.living': '리빙 리빙도감 박스 수집 컬렉션 폼 칸',
  'keywords.page.homedex': '포켓몬 홈 포켓몬홈 보냄 전송 보관 뱅크 박스',
  'keywords.page.journal': '일지 기록 로그 내역 포획 일기',
  'keywords.page.achievements': '도전 과제 도전과제 업적 트로피 메달 배지 목표',
  'keywords.page.settings': '설정 환경설정 옵션 규칙 테마 가져오기 내보내기 백업',
  'keywords.action.log': '기록 포획 추가 새 등록 잡음 잡기',
  'keywords.action.shiny': '전환 색이 다른 이로치 색다른 보기 스프라이트 렌더',
  'keywords.action.theme': '전환 테마 다크 라이트 어두운 밝은 모양 모드',
  'keywords.action.motion': '전환 줄이기 모션 애니메이션 움직임',
  'keywords.logPhrase': '포획 기록'
}

export default messages
