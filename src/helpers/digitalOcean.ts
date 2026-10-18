/* global Express */
import { S3Client, DeleteObjectCommand, ObjectCannedACL } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import path from 'path';
import fs from 'fs';
import httpStatus from 'http-status';
import ApiError from '../errors/ApiErrors';
import config from '../config';

const endpoint = config.do_space.endpoints;
const bucket = config.do_space.bucket;
const accessKey = config.do_space.access_key;
const secretKey = config.do_space.secret_key;

// Configure S3 Client for DigitalOcean Spaces / MinIO
const s3Client = new S3Client({
  region: 'us-east-1',
  endpoint: endpoint || undefined,
  forcePathStyle: true, // Required for MinIO / Custom S3 backends
  credentials: {
    accessKeyId: accessKey || '',
    secretAccessKey: secretKey || '',
  },
});

const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB

/**
 * Uploads a file to DigitalOcean Space / MinIO
 * @param file Multer file object
 */
export const uploadToDigitalOcean = async (file: Express.Multer.File): Promise<string> => {
  try {
    if (!file) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'No file provided');
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `File size exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`
      );
    }

    const mimeType = file.mimetype || 'application/octet-stream';
    const fileExtension = path.extname(file.originalname) || '';
    const fileName = `uploads/${Date.now()}-${Math.random().toString(36).substring(2, 15)}${fileExtension}`;

    const fileStream = file.path ? fs.createReadStream(file.path) : file.buffer;
    if (!fileStream) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'File content is empty');
    }

    const uploadParams = {
      Bucket: bucket || '',
      Key: fileName,
      Body: fileStream,
      ACL: 'public-read' as ObjectCannedACL,
      ContentType: mimeType,
    };

    const upload = new Upload({ client: s3Client, params: uploadParams });
    const data = await upload.done();

    // Delete temp file from disk if it was stored there
    if (file.path) {
      fs.unlink(file.path, (err) => {
        if (err) console.error('Failed to delete temp file:', err);
      });
    }

    const fileUrlRaw = data.Location || `${endpoint}/${bucket}/${fileName}`;
    return fileUrlRaw.startsWith('http') ? fileUrlRaw : `https://${fileUrlRaw}`;
  } catch (error) {
    console.error('File upload failed:', error);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      error instanceof Error ? `Failed to upload file: ${error.message}` : 'Failed to upload file to Space'
    );
  }
};

/**
 * Deletes a file from DigitalOcean Space / MinIO by its public URL
 * @param fileUrl Public URL of the file
 */
export const deleteFromDigitalOcean = async (fileUrl: string): Promise<void> => {
  try {
    if (!fileUrl) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'File URL is required');
    }

    // Extract the key from the URL
    let cleanUrl = fileUrl.replace(/^https?:\/\//, '');

    // Remove port if exists (like :443)
    const endpointHost = (endpoint || '').replace(/^https?:\/\//, '').replace(/:\d+$/, '');

    // Remove endpoint host
    if (endpointHost && cleanUrl.startsWith(endpointHost)) {
      cleanUrl = cleanUrl.replace(endpointHost, '');
    }

    // Ensure leading slash removed
    cleanUrl = cleanUrl.replace(/^\//, '');

    // Remove bucket name prefix
    if (bucket && cleanUrl.startsWith(bucket + '/')) {
      cleanUrl = cleanUrl.replace(bucket + '/', '');
    }

    const key = cleanUrl;

    if (!key) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Could not extract object key from file URL');
    }

    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: bucket || '',
        Key: key,
      })
    );

    console.log('Deleted successfully from space:', key);
  } catch (error) {
    console.error('File deletion failed:', error);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      error instanceof Error ? `Failed to delete file: ${error.message}` : 'Failed to delete file from Space'
    );
  }
};

/**
 * Uploads a base64 image to DigitalOcean Space / MinIO
 * @param base64Str base64 data URL string (e.g. data:image/png;base64,...)
 */
export const uploadBase64ToDigitalOcean = async (base64Str: string): Promise<string> => {
  const matches = base64Str.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid base64 image format');
  }

  const mimeType = matches[1];
  const buffer = Buffer.from(matches[2], 'base64');
  const fileExtension = mimeType.split('/')[1] === 'jpeg' ? '.jpg' : `.${mimeType.split('/')[1] || 'png'}`;
  
  const file = {
    buffer,
    mimetype: mimeType,
    originalname: `review-upload-${Date.now()}-${Math.floor(Math.random() * 1000)}${fileExtension}`,
    size: buffer.length,
  } as Express.Multer.File;

  return uploadToDigitalOcean(file);
};

