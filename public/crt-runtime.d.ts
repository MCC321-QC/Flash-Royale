export function preserveFramesDuring<T>(load: () => Promise<T> | T): Promise<T>;
export function findGameCanvas(root: HTMLElement | ShadowRoot): HTMLCanvasElement | null;
export function findFrameCanvas(root: HTMLElement | ShadowRoot): HTMLCanvasElement | null;
export function royaleSourcePoint(u: number, v: number, aspect: number, radius: number, viewDistance?: number): { u: number; v: number };
export function createRoyaleProjection(aspect: number, radius: number, viewDistance?: number): {
  sourcePoint(u: number, v: number): { u: number; v: number };
  screenPoint(u: number, v: number): { u: number; v: number };
};
export function attachRoyale(source: HTMLCanvasElement, baseUrl: URL, parameters: () => Record<string, number>, failed: (error: unknown) => void, inputSize?: { width: number; height: number }, inputSmoothing?: () => boolean, signal?: AbortSignal, ready?: () => void): Promise<() => void>;
export function createRoyale(output: HTMLCanvasElement, baseUrl: URL): Promise<{ canRender(): boolean; render(source: HTMLCanvasElement, parameters?: Record<string, number>): boolean; dispose(): void }>;
