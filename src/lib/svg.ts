// SVG 파일 → object URL / HTMLImageElement 로딩 유틸

export function svgToUrl(svgText: string): string {
  const blob = new Blob([svgText], { type: 'image/svg+xml' });
  return URL.createObjectURL(blob);
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** SVG 의 intrinsic 종횡비를 추정 (width/height 또는 viewBox) */
export function svgAspect(svgText: string): { w: number; h: number } {
  const wMatch = svgText.match(/width="([\d.]+)/);
  const hMatch = svgText.match(/height="([\d.]+)/);
  if (wMatch && hMatch) {
    return { w: parseFloat(wMatch[1]), h: parseFloat(hMatch[1]) };
  }
  const vb = svgText.match(/viewBox="[\d.\s-]*?([\d.]+)\s+([\d.]+)"/);
  if (vb) return { w: parseFloat(vb[1]), h: parseFloat(vb[2]) };
  return { w: 16, h: 16 };
}

export async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = reject;
    fr.readAsText(file);
  });
}
