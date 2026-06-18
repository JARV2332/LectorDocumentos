export type ScanMode = "dpi" | "license";

export interface DpiScanResult {
  type: "dpi";
  cui: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento: string;
  rawMrz: string[];
}

export interface LicenseScanResult {
  type: "license";
  numeroLicencia: string;
  cui: string;
  nombres: string;
  apellidos: string;
  tipoLicencia: string;
  fechaNacimiento: string;
  restricciones: string;
  tipoSangre: string;
  rawBarcode: string;
}

export type ScanResult = DpiScanResult | LicenseScanResult;

export type CameraStatus =
  | "idle"
  | "requesting"
  | "active"
  | "success"
  | "error";
