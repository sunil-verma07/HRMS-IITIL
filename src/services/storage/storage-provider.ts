export type UploadInput = {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  folder: string;
};

export type UploadResult = {
  provider: 'CLOUDINARY' | 'S3';
  key: string;
  url: string;
  mimeType: string;
  sizeBytes?: number;
};

export interface StorageProviderPort {
  upload(input: UploadInput): Promise<UploadResult>;
  delete(key: string): Promise<void>;
}
