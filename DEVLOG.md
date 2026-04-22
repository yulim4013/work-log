---
name: DEVLOG -- 출퇴근관리
description: 출퇴근관리 앱 개발 이력. app-builder가 쓰고 app-reviewer가 읽음.
type: devlog
last_updated: 2026-04-22
---

# DEVLOG -- 출퇴근관리

---

## 2026-04-22 -- 출퇴근 기록 수정 기능

### 기능 추가
- 관리자 [기록] 탭 각 row에 ✏️ 수정 버튼 추가
- 관리자 [오늘] 탭 각 row에 ✏️ 수정 버튼 추가 (출근 기록 있는 경우만)
- 수정 모달: 출근/퇴근 시간 `input[type=time]` + 저장/삭제/취소
- 저장 시 급여 자동 재계산 (퇴근 있을 때만) + Google Sheets updateRecord sync
- 삭제 시 confirm 후 S.records에서 제거 + 화면 갱신

### 헬퍼 함수
- `timeToInput(t)`: "오전 9:30" → "09:30" (input[type=time] 포맷)
- `inputToTime(v)`: "14:30" → "오후 2:30" (내부 포맷)
- `escRec(s)`: onclick 속성 내 따옴표 이스케이프

---

## 2026-04-22 -- 에이전트 시스템 온보딩

- APP_REGISTRY.md에 출퇴근관리 등록 (active)
- SPEC.md / DEVLOG.md 신규 작성
- 현재 상태: 기능 완성, UAT 미완료, index.html GitHub push 대기 중 (iMac 인증 없음 → MacBook에서 push 필요)

---

## 2026-04-18 -- 안정화 (v5~v7)

### Apps Script 버전업
- v5: [설정] 탭 지원 (행사 정보 저장/로드)
- v6: [기록] 시트에 급여 스냅샷 컬럼 G-L 추가, ensureRecordHeader() 자동 확장
- v7: 기본급/초과수당/야간수당 컬럼 M-O 추가

### 버그 수정
- jsQR CDN 로드 실패 → jsdelivr로 교체
- normalizePerson phone4 필드 누락
- closePinModal pendingAction 리셋 순서 버그
- 탭 복귀 시 QR 인증 상태 복원

### 기능 추가
- 캐시 무효화 메타 태그 (모바일 캐시 문제 해결)
- 행사 정보 / 급여 설정 시트 저장 ([설정] 탭)
- 모든 기기가 같은 행사 정보 공유

---

## 2026-04-17 -- 초기 개발

### 기반 구조
- GitHub Pages 배포 (yulim4013/work-log)
- 단일 index.html (HTML + CSS + Vanilla JS)
- Google Apps Script 백엔드 (doGet/doPost)
- jsQR 로컬 번들 (CDN 불안정 대비)

### 데이터 설계
- 운영요원 / 직원 역할 분리
- 급여 타입: 시급(hourly) / 일급(daily)
- 개인정보 별도 관리 (지급표 추출 후 메모리 삭제)
- 공유 링크 (`?s=` 파라미터) → 기기별 시트 설정 불필요

### 구현 기능
- QR 스캔 + 역할 인증 + PIN(전화번호 뒷4) 인증 → 출/퇴근
- 풀스크린 QR 스캐너
- 관리자: 오늘 현황 / 급여 계산 / 기록 / 직원관리
- 엑셀 업로드 (운영요원/직원 마스터)
- 기기간 출퇴근 기록 실시간 동기화 (addRecord/updateRecord)
- 급여 계산: 기본급 + 초과(1.5배) + 야간(1.5배) + 세금(3.3%, 33,333원 이하 면제)
- 지급표 xlsx 추출 (개인정보 매칭 후 추출)
- UI: 라벤더 그라데이션 + 흰 카드 + 바이올렛 (FundFlow 스타일)
- 가나다순 정렬 (오늘/급여/직원관리)

### 버그 수정
- 지급표 합계행 근무시간 누락 + 컬럼 정렬 오류
- staffWorkStart 파싱 안정화
- 개인정보 메모리 정리 (지급표 추출 후)
- 세금 수식: KCR 실제 원천징수 로직으로 교체
- updateAdminSub 템플릿 리터럴 따옴표 오류

---

## 현재 상태 (2026-04-22 기준)

| 항목 | 상태 |
|---|---|
| 배포 | GitHub Pages 배포 중 (index.html push 대기) |
| Apps Script | v7 배포 완료 |
| UAT | 미완료 (CHANGES.md 체크리스트 참조) |
| 다음 실전 투입 | KCR 2026 또는 다른 행사 |

---

## 다음 단계

1. index.html MacBook에서 GitHub push (iMac 인증 없음)
2. 실전 행사 투입 전 UAT 항목 검증
3. 출퇴근 기록 수정 기능 (관리자 수동 보정) 개발
