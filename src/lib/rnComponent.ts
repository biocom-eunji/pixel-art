import type { EditorState, Manifest } from '../types';

/** manifest 를 읽어 좌캡/반복타일/우캡+꼬리를 Flexbox 로 합성하는 RN 컴포넌트 소스 생성 */
export function buildPixelBubbleTsx(s: EditorState, m: Manifest): string {
  const tailEnabled = s.tail.enabled;
  const tailLeft =
    m.tail.anchorX === 'center'
      ? `left: '50%', marginLeft: -m.tail.width / 2,`
      : `left: ${s.tail.offsetX},`;

  const tailBlock = tailEnabled
    ? `
      <Image
        source={TAIL}
        style={{
          position: 'absolute',
          bottom: -(m.tail.height - m.tail.overlap),
          ${tailLeft}
          width: m.tail.width,
          height: m.tail.height,
        }}
      />`
    : '';

  return `// 자동 생성 — Pixel Bubble Editor
// 좌캡(고정) / 반복 타일(가변) / 우캡(고정) + 꼬리 를 Flexbox 로 합성한다.
// 블리드(B): 조각 PNG에 투명 여백이 포함돼 있어, 음수 오프셋 + overflow:'visible' 로
//   프레임 박스 "밖으로" 장식이 삐져나오게 보인다. (레이아웃/텍스트는 프레임 크기 기준)
// 주의: Android 일부 환경은 overflow:'visible' 가 제한될 수 있음.
// PNG 들은 @1x/@2x/@3x 가 함께 들어있어 RN 이 화면 밀도에 맞게 자동 선택한다.
import React from 'react';
import { View, Image } from 'react-native';

const LEFT = require('./left.png');
const MID = require('./mid.png');
const RIGHT = require('./right.png');
${tailEnabled ? "const TAIL = require('./tail.png');\n" : ''}
export const manifest = ${JSON.stringify(m, null, 2)} as const;

/** 말풍선 텍스트 기본 스타일 (에디터에서 지정한 색/크기) */
export const defaultTextStyle = { color: manifest.textColor, fontSize: manifest.fontSize } as const;

export function PixelBubble({ children }: { children: React.ReactNode }) {
  const m = manifest;
  const B = m.bleed;
  return (
    <View style={{ alignSelf: 'flex-start', overflow: 'visible' }}>
      <View style={{ flexDirection: 'row', minWidth: m.minWidth, overflow: 'visible' }}>
        {/* 좌캡 (왼쪽+상하 블리드가 박스 밖으로) */}
        <View style={{ width: m.capLeftWidth, height: m.height, overflow: 'visible' }}>
          <Image
            source={LEFT}
            style={{ position: 'absolute', left: -B, top: -B, width: m.capLeftWidth + B, height: m.height + 2 * B }}
          />
        </View>
        {/* 가운데 타일 (상/하 블리드만, 가로 반복) */}
        <View
          style={{
            flex: 1,
            minWidth: m.tileWidth,
            height: m.height,
            overflow: 'visible',
            paddingTop: m.contentInsets.top,
            paddingBottom: m.contentInsets.bottom,
            paddingLeft: m.contentInsets.left,
            paddingRight: m.contentInsets.right,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Image
            source={MID}
            resizeMode={m.tileMode === 'repeat' ? 'repeat' : 'stretch'}
            style={{ position: 'absolute', left: 0, right: 0, top: -B, bottom: -B }}
          />
          {children}
        </View>
        {/* 우캡 (오른쪽+상하 블리드가 박스 밖으로) */}
        <View style={{ width: m.capRightWidth, height: m.height, overflow: 'visible' }}>
          <Image
            source={RIGHT}
            style={{ position: 'absolute', left: 0, top: -B, width: m.capRightWidth + B, height: m.height + 2 * B }}
          />
        </View>
      </View>${tailBlock}
    </View>
  );
}
`;
}

/** 사용 예시 파일 */
export function buildUsageExample(): string {
  return `// 사용 예시
import React from 'react';
import { Text } from 'react-native';
import { PixelBubble, defaultTextStyle } from './PixelBubble';

export function Demo() {
  return (
    <>
      <PixelBubble>
        <Text style={defaultTextStyle}>안녕!</Text>
      </PixelBubble>
      <PixelBubble>
        <Text style={defaultTextStyle}>긴 텍스트를 넣으면 가운데 타일만 늘어나고 캡은 고정됩니다.</Text>
      </PixelBubble>
    </>
  );
}
`;
}
