import { svgAspect, svgToUrl } from './svg';

export interface PaletteItem {
  name: string;
  svg: string;
  url: string;
  aspect: { w: number; h: number };
  builtin?: boolean;
}

// 빌트인 에셋: src/assets/builtin/*.svg 를 빌드 타임에 raw 텍스트로 인라인
const mods = import.meta.glob('../assets/builtin/*.svg', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

export const builtinAssets: PaletteItem[] = Object.entries(mods)
  .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
  .map(([path, svg]) => {
    const name = path.split('/').pop()!.replace(/\.svg$/i, '');
    return { name, svg, url: svgToUrl(svg), aspect: svgAspect(svg), builtin: true };
  });

// 디버그: 로드 개수 확인
if (typeof console !== 'undefined') {
  console.log(`[builtinAssets] loaded ${builtinAssets.length} svg(s)`);
}
