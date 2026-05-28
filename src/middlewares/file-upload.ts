import multer from 'multer';
import { BadRequestError } from '../common/errors/app-error';

const DEFAULT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

type FileUploadOptions = {
  fieldName: string;
  allowedMimeTypes: string[];
  maxSizeBytes?: number;
};

export function singleFileUpload(options: FileUploadOptions) {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: options.maxSizeBytes ?? DEFAULT_MAX_FILE_SIZE_BYTES
    },
    fileFilter: (_request, file, callback) => {
      if (!options.allowedMimeTypes.includes(file.mimetype)) {
        callback(new BadRequestError('Unsupported file type'));
        return;
      }

      callback(null, true);
    }
  });

  return upload.single(options.fieldName);
}
