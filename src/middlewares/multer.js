// import multer from 'multer';
// import path from 'path';
// import { fileURLToPath } from 'url';
// import fs from 'fs';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// const uploadDir = path.join(__dirname, '../../uploads/questions');
// if (!fs.existsSync(uploadDir)) {
//   fs.mkdirSync(uploadDir, { recursive: true });
// }

// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     cb(null, uploadDir);
//   },
//   filename: function (req, file, cb) {
//     const ext = path.extname(file.originalname);
//     const base = path.basename(file.originalname, ext).replace(/\s+/g, '_');
//     const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
//     cb(null, `${base}-${unique}${ext}`);
//   }
// });

// const fileFilter = (req, file, cb) => {
//   const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
//   if (!allowed.includes(file.mimetype)) {
//     return cb(new Error('Only PNG, JPG, JPEG, WEBP images are allowed'), false);
//   }
//   cb(null, true);
// };

// export const uploadQuestionImage = multer({
//   storage,
//   fileFilter,
//   limits: { fileSize: 5 * 1024 * 1024 }
// }).array("files", 40);

import multer from 'multer';
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error('Only PNG, JPG, JPEG, WEBP images are allowed'), false);
  }
  cb(null, true);
};

export const uploadQuestionImage = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
}).array('files', 40);
