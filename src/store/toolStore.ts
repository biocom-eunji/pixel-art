import { create } from 'zustand';

export type Tool = 'pen' | 'eraser' | 'fill' | 'line' | 'eyedropper' | 'pan';

interface ToolStore {
  drawMode: boolean;
  tool: Tool;
  brush: number; // 1~4
  color: string; // 자유색(독립)
  showGuides: boolean;
  setDrawMode: (v: boolean) => void;
  setTool: (t: Tool) => void;
  setBrush: (n: number) => void;
  setColor: (c: string) => void;
  setShowGuides: (v: boolean) => void;
}

export const useTool = create<ToolStore>((set) => ({
  drawMode: false,
  tool: 'pen',
  brush: 1,
  color: '#ffffff',
  showGuides: true,
  setDrawMode: (drawMode) => set({ drawMode }),
  setTool: (tool) => set({ tool }),
  setBrush: (brush) => set({ brush: Math.max(1, Math.min(4, Math.round(brush))) }),
  setColor: (color) => set({ color }),
  setShowGuides: (showGuides) => set({ showGuides }),
}));
