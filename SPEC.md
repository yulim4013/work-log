---
name: SPEC -- 출퇴근관리
description: 출퇴근관리 앱 기능 명세 및 고도화 방향
type: spec
last_updated: 2026-04-22
---

# SPEC -- 출퇴근관리

## 앱 개요

행사(학회/이벤트) 단기 스태프 출퇴근 관리 + 급여 자동 계산 + 지급표 xlsx 추출 웹앱.
내부 전용 (공개 배포 X). GitHub Pages 무설치 배포, 당일 QR 링크 하나로 접속.

- **배포 URL**: https://yulim4013.github.io/work-log/
- **레포**: https://github.com/yulim4013/work-log
- **로컬 소스**: `06. APP/출퇴근관리/` (index.html, apps_script.js, jsQR.js, README.md, CHANGES.md)

---

## 기술 스택

| 레이어 | 기술 |
|---|---|
| 프론트엔드 | HTML + CSS + Vanilla JS (단일 파일 index.html) |
| QR 생성 | qrcodejs (CDN) |
| QR 스캔 | jsQR (로컬 번들) |
| 엑셀 추출 | SheetJS xlsx (CDN) |
| 아이콘 | Lucide Icons (CDN) |
| 백엔드 | Google Apps Script (doGet/doPost) |
| 배포 | GitHub Pages (index.html 자동 배포) |

---

## 데이터 모델

### Google Sheets 시트 구조

**[운영요원] 시트**
| A:이름 | B:급여타입 | C:시급/일급 | D:전화뒷4 | E:은행명 | F:계좌번호 | G:예금주 | H:주민번호 |

**[직원] 시트**
| A:이름 | B:급여타입 | C:평일시급(or일급) | D:주말시급 | E:전화뒷4 | F:은행명 | G:계좌번호 | H:예금주 | I:주민번호 |

**[기록] 시트**
| A:역할 | B:이름 | C:날짜 | D:출근 | E:퇴근 | F:행사 | G:급여타입 | H:단가 | I:근무시간(h) | J:당일급여 | K:세금 | L:실지급액 | M:기본급 | N:초과수당 | O:야간수당 |

**[설정] 시트**
키-값 구조: eventName, eventStart, eventEnd, albaRate, staffWeekday 등

### 앱 내 메모리 (localStorage)

```
settings: { sheetUrl, adminPw, staffPw, eventName, eventStart, eventEnd }
alba: [ { name, payType, rate, phone4 } ]
staff: [ { name, payType, rate, weekendRate, phone4 } ]
records: [ { role, name, date, checkIn, checkOut, event, payType, rate, hours, basePay, overPay, nightPay, tax, net } ]
personal: [ { name, bank, account, holder, ssn } ]  -- 지급표 추출 후 메모리 삭제
```

---

## 역할 구분

| 역할 | 설명 | 급여 계산 |
|---|---|---|
| 운영요원 (alba) | 단기 알바 스태프 | 시급: 기본+초과(1.5배)+야간(1.5배) / 일급: 날짜수 x 단가 |
| 직원 (staff) | 정규 직원 | 초과수당만 / 주말 별도 단가 적용 가능 |

---

## 현재 구현된 기능

### 출퇴근 탭
- 역할 전환 (운영요원 / 직원)
- QR 스캔 → 역할 인증 → 이름 선택 → PIN(전화번호 뒷4) 인증 → 출근/퇴근
- 풀스크린 QR 스캐너 (jsQR)
- 본인 출퇴근 기록 표시 (누적 시간 + 일자별 칩)
- QR 토큰 자정 갱신

### 관리자 탭
- **오늘**: 전체 출퇴근 현황 (가나다순, 출근/퇴근 상태 표시)
- **급여**: 인원별 급여 계산 (기본급/초과수당/야간수당/세금/실지급액)
- **기록**: 날짜별 사람별 그룹화 출퇴근 이력
- **직원관리**: 인원 추가/편집/삭제, 급여타입/금액/전화번호 설정
- **엑셀 업로드**: 운영요원/직원 2시트 마스터 Excel 일괄 업로드

### 설정 탭
- 행사 정보 저장 (행사명/기간) → Google Sheets [설정] 탭 자동 생성
- 비밀번호 변경 (일반/총괄)
- Google Sheets URL 등록 + 공유 링크 생성 (`?s=` 파라미터)
- 자동 싱크 (관리자 로그인 시 시트 자동 로드)

### 급여 계산 로직
- 시급 기본급: 8시간 이하 시급 x 시간
- 초과수당: 8시간 초과분 x 시급 x 1.5
- 야간수당: 22:00~06:00 겹치는 시간 x 시급 x 0.5 (할증분만)
- 세금: 소득세 3% + 지방소득세 0.3% = 3.3% / 33,333원 이하 면제 / ROUNDDOWN 10원
- 지급표 xlsx: 인원별 급여 명세 + 합계행 (개인정보 매칭 후 추출, 추출 후 메모리 삭제)

### Google Sheets 연동 (Apps Script v7)
- `getStaff`: 운영요원/직원 목록 + 설정 + 개인정보 로드
- `getRecords`: 기록 시트 로드
- `addRecord`: 출근 시 행 추가
- `updateRecord`: 퇴근/급여 계산 후 행 업데이트
- `syncStaff`: 앱 → 시트 전체 동기화
- `syncSettings`: 설정 저장

---

## 미완료 / 테스트 필요 항목

CHANGES.md UAT 섹션 참조. 주요 미검증 항목:
- 기기간 실시간 동기화 (addRecord/updateRecord)
- 개인정보 시트 → 앱 동기화 (은행/계좌/주민번호)
- 전화번호 0 보존 (writeAlba/writeStaff 후 앞자리 0)
- 지급표 xlsx 실제 추출 (개인정보 매칭)
- 크로스 디바이스 (iPhone Safari/Chrome, Android)

---

## 고도화 방향

### Phase 1 -- 안정화 (다음 행사 전)
- UAT 항목 실전 검증 (KCR 2026 또는 다른 행사)
- index.html 현재 MacBook GitHub push 미완료 → 완료 필요
- 출퇴근 기록 수정 기능 (관리자가 시간 수동 보정)

### Phase 2 -- 기능 고도화
- 지급표를 Google Sheets 탭에 직접 생성 (xlsx 다운로드 대체)
- 개인정보(주민/계좌)도 시트에 저장 (보안 고려)
- 수퍼바이저 별도 단가 UI 개선

### Phase 3 -- 구조 개선 (필요 시)
- 단일 HTML → 모듈화 (현재 2077줄, 유지보수 한계 도달 시)
- Firebase 전환 검토 (착착과 같은 구조, 실시간 동기화 개선)

---

## 미구현 후보 (백로그)

- 출퇴근 기록 수정 (관리자 수동 보정)
- 지급표 Google Sheets 직접 생성
- 개인정보 시트 저장 (보안 설계 필요)
- 다국어 지원 (외국인 직원)
- 다크 모드 토글
