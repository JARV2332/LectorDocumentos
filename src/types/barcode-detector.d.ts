interface DetectedBarcode {
  rawValue?: string;
  format?: string;
}

declare global {
  interface BarcodeDetector {
    detect(source: ImageBitmapSource): Promise<DetectedBarcode[]>;
  }

  interface BarcodeDetectorOptions {
    formats?: string[];
  }

  // eslint-disable-next-line no-var
  var BarcodeDetector: {
    prototype: BarcodeDetector;
    new (options?: BarcodeDetectorOptions): BarcodeDetector;
  };

  interface Window {
    BarcodeDetector?: typeof BarcodeDetector;
  }
}

export {};
