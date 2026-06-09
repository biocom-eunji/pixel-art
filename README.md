# Pixel Bubble Editor

브라우저에서 동작하는 **픽셀아트 말풍선 디자인 툴** (서버·로그인·DB 없음, 전부 클라이언트).
가로 3분할(좌캡 / 반복 타일 / 우캡) + 꼬리 모델로 디자인하고,
React Native에서 바로 쓸 수 있는 **Flexbox 스프라이트 합성** 산출물(PNG @1x·2x·3x + manifest.json + PixelBubble.tsx)을 ZIP으로 내보냅니다.

## 실행

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 타입체크 + 프로덕션 빌드
```

## 기술 스택
React + Vite + TypeScript / react-konva(캔버스) / Tailwind / zustand / jszip + file-saver

## 핵심 모델
- **세로 높이 고정, 가로 가변.** 전체 폭 = `capLeftWidth + tileWidth + capRightWidth`
- **좌캡/우캡**: 고정 폭. 모서리 장식이 들어가며 절대 안 늘어남
- **가운데 타일**: `tileWidth` = 반복 1주기. 텍스트가 길어지면 가로 repeat
- **꼬리**: 별도 스프라이트(타일에 포함하지 않음). 바닥에 절대 위치로 overlap 만큼 겹침
- 캔버스의 두 세로 가이드(초록=좌캡 경계 / 주황=타일 끝)를 드래그해 캡·타일 폭 결정

## 픽셀 크리스프 보장
- 프레임은 디자인 해상도(1px=1px)에서 `ImageData`로 직접 래스터화
- 표시/내보내기는 **정수 배율 nearest-neighbor**(`imageSmoothingEnabled=false`)로 확대
- 슬라이싱은 정수 픽셀 경계에서 잘려 **mid.png가 정확히 타일 1주기 폭** → 가로 repeat 시 이음매 없음
- 점선/파선 사용 시 `tileWidth`가 선 주기(점선 2 / 파선 4)의 배수가 아니면 경고 표시

## 에디터 단축키 / 사용성
- **실행취소/재실행**: ⌘Z / ⌘⇧Z (헤더 버튼도 제공), 700ms coalescing
- **줌/팬**: 하단 줌 툴바, ⌘+스크롤 줌, Space+드래그 팬, `0`=Fit, `+`/`-`=줌
- **에셋**: 드래그/리사이즈/회전/반전, 방향키 1셀 이동(Shift=4셀), 레이어 패널(숨김🚫/잠금🔒/순서/삭제)
- **숫자 입력**: ↔ 핸들 좌우 드래그-스크럽
- **색상**: 최근색·프리셋 스와치 + 스포이드(EyeDropper 지원 브라우저), localStorage 저장
- **RN 미리보기**: 짧은/긴 텍스트로 캡 고정·가운데 신축·이음매를 상시 확인
- **프로젝트**: 헤더의 새로/열기/저장/복제 — `.pbproj.json` 한 파일에 SVG까지 인라인 저장되어 완전 복원

## 사용 순서
1. 좌측에서 SVG 에셋 업로드 → 썸네일 클릭하면 캔버스에 배치
2. 가운데 캔버스에서 이동/리사이즈/회전/반전, 가이드로 캡·타일 폭 조정
3. 우측 패널에서 색·선 스타일·여백·꼬리·타일 모드 설정
4. "타일 미리보기" 켜서 이음매 확인
5. **ZIP 내보내기** → `left/mid/right(.png @1x·2x·3x)`, `tail.png`, `manifest.json`, `PixelBubble.tsx`, `Demo.example.tsx`

## RN에서 사용
ZIP을 풀어 RN 프로젝트에 폴더째 넣고:

```tsx
import { PixelBubble } from './bubble/PixelBubble';
<PixelBubble><Text>안녕!</Text></PixelBubble>
```
캡은 고정되고 가운데 타일만 늘어나며, 텍스트 길이에 따라 폭이 가변됩니다.
