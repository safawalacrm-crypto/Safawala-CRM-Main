declare module 'qrcode' {
  export interface QRCodeToDataURLOptions {
    margin?: number;
    scale?: number;
    width?: number;
    color?: { dark?: string; light?: string };
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  }
  export function toDataURL(
    text: string,
    options?: QRCodeToDataURLOptions,
  ): Promise<string>;
}
