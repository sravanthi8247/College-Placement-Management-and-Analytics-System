import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED_EXTENSIONS = ['.csv', '.xlsx', '.xls'];

const ALLOWED_MIMES = [
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'application/octet-stream',
];

const storage = multer.memoryStorage();

export const uploadStudentSpreadsheet = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const isExtAllowed = ALLOWED_EXTENSIONS.includes(ext);
    const isMimeAllowed = ALLOWED_MIMES.includes(file.mimetype) || file.mimetype.includes('sheet') || file.mimetype.includes('excel');

    if (isExtAllowed || isMimeAllowed) {
      return cb(null, true);
    }

    return cb(
      new Error('Invalid file type. Only CSV (.csv) and Excel (.xlsx, .xls) files are supported.')
    );
  },
});

// Resume upload configuration (deterministic server/uploads/resumes directory for legacy local fallback)
export const RESUME_UPLOAD_DIR = path.resolve(__dirname, '..', 'uploads', 'resumes');
if (!fs.existsSync(RESUME_UPLOAD_DIR)) {
  fs.mkdirSync(RESUME_UPLOAD_DIR, { recursive: true });
}

export const uploadResume = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB strict limit
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.pdf') {
      return cb(new Error('Invalid file type. Only PDF documents (.pdf) are allowed.'));
    }
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Invalid MIME type. Only application/pdf files are supported.'));
    }
    return cb(null, true);
  },
});

export const handleResumeUpload = (req, res, next) => {
  uploadResume.single('resume')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File size exceeds the 2 MB limit.' });
      }
      return res.status(400).json({ message: `Upload error: ${err.message}` });
    }
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};

