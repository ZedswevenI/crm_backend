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
