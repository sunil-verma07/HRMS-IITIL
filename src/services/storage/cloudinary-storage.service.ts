import { v2 as cloudinary } from 'cloudinary';
import { env } from '../../config/env';
import type { StorageProviderPort, UploadInput, UploadResult } from './storage-provider';

export class CloudinaryStorageService implements StorageProviderPort {
  constructor() {
    cloudinary.config({
      secure: true,
      ...(env.CLOUDINARY_CLOUD_NAME ? { cloud_name: env.CLOUDINARY_CLOUD_NAME } : {}),
      ...(env.CLOUDINARY_API_KEY ? { api_key: env.CLOUDINARY_API_KEY } : {}),
      ...(env.CLOUDINARY_API_SECRET ? { api_secret: env.CLOUDINARY_API_SECRET } : {})
    });
  }

  async upload(input: UploadInput): Promise<UploadResult> {
    const dataUri = `data:${input.mimeType};base64,${input.buffer.toString('base64')}`;
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: input.folder,
      public_id: input.fileName,
      resource_type: 'auto'
    });

    return {
      provider: 'CLOUDINARY',
      key: result.public_id,
      url: result.secure_url,
      mimeType: input.mimeType,
      sizeBytes: result.bytes
    };
  }

  async delete(key: string): Promise<void> {
    await cloudinary.uploader.destroy(key, { resource_type: 'auto' });
  }
}
