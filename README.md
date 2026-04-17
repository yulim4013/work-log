# work-log

행사 출퇴근 관리 웹앱

- QR 기반 출퇴근 체크 (알바생/직원 역할 분리)
- 급여 자동 계산 (알바: 기본+초과, 직원: 초과만)
- 사업소득 원천징수 자동 계산 (소득세 3% + 지방소득세)
- 급여 지급표 xlsx 추출
- Google Sheets 연동 (선택)

## 사용법

GitHub Pages에서 `index.html`이 자동 배포됩니다.

- 기본 비밀번호: 일반 `1234` / 총괄 `5678` (설정 탭에서 변경)
- 카메라 사용을 위해 HTTPS 환경 필요 (GitHub Pages가 이 조건을 만족)

## 기술 스택

- HTML / CSS / Vanilla JavaScript
- qrcodejs (QR 생성)
- jsQR (QR 스캔)
- SheetJS (xlsx 처리)
- Lucide Icons
