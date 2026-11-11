declare module "gifenc" {
  export interface FrameOptions {
    palette?: number[][];
    delay?: number;
    repeat?: number;
    transparent?: boolean;
    transparentIndex?: number;
    dispose?: number;
  }
  export interface Encoder {
    writeFrame(index: Uint8Array, width: number, height: number, opts?: FrameOptions): void;
    finish(): void;
    bytes(): Uint8Array;
  }
  const gifenc: { GIFEncoder(): Encoder };
  export default gifenc;
}
