import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';

// Temporary upload directory (files uploaded to S3/Spaces and then deleted)
const uploadDir = path.join(os.tmpdir(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

// Default: 50MB limit. Override per route as needed.
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

export const fileUploader = {
  /** Single profile image */
  profileImage: upload.single('profileImage'),

  /** Single chat/message image */
  chatImage: upload.single('chatImage'),

  /** User profile + gallery images */
  userImages: upload.fields([
    { name: 'profileImage', maxCount: 1 },
    { name: 'galleryImages', maxCount: 10 },
  ]),

  /** Cover + gallery for service providers / listings */
  coverAndGallery: upload.fields([
    { name: 'coverImage', maxCount: 1 },
    { name: 'galleryImages', maxCount: 10 },
  ]),
};
