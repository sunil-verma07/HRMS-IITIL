import { CloudinaryStorageService } from './cloudinary-storage.service';
import type { StorageProviderPort } from './storage-provider';

export class FileStorageService {
  constructor(private readonly provider: StorageProviderPort = new CloudinaryStorageService()) {}

  get client(): StorageProviderPort {
    return this.provider;
  }
}
