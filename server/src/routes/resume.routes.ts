import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import {
  getMyResumes,
  getResumeById,
  generateResume,
  getResumeProvenance,
  downloadResumePdf,
  uploadAndAnalyzeResume,
  updateResumeClaim,
  linkEvidenceToClaim,
  deleteResumeClaim,
  deleteResume,
  listResumeClaims,
  verifyResumeClaim,
} from '../controllers/resume.controller';
import { requireAuth, requireStudent, requireRole } from '../middleware/auth.middleware';

const router = Router();

// Configure multer for secure PDF uploads (max 5MB, PDF only)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type: Only PDF documents are supported'));
    }
  },
});

router.use(requireAuth);

/**
 * @route   GET /api/resumes/claims
 * @desc    Placement officer: list resume claims for verification review
 * @access  Private (Placement Officer, Admin)
 */
router.get('/claims', requireRole('placement_officer', 'admin'), listResumeClaims);

/**
 * @route   POST /api/resumes/claims/:id/verify
 * @desc    Placement officer: verify or unverify a resume claim
 * @access  Private (Placement Officer, Admin)
 */
router.post('/claims/:id/verify', requireRole('placement_officer', 'admin'), verifyResumeClaim);

/**
 * @route   GET /api/resumes/me
 * @desc    Get all resumes created by the authenticated student
 * @access  Private (Student)
 */
router.get('/me', requireStudent, getMyResumes);

/**
 * @route   POST /api/resumes/generate
 * @desc    Generate a tailored resume backed by verified skills & evidence
 * @access  Private (Student)
 */
router.post('/generate', requireStudent, generateResume);

/**
 * @route   POST /api/resumes/upload-and-analyze
 * @desc    Upload & analyze resume PDF (or text) against verified evidence vault
 * @access  Private (Student)
 */
router.post(
  '/upload-and-analyze',
  requireStudent,
  (req: Request, res: Response, next: NextFunction) => {
    upload.single('file')(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'File size exceeds maximum permitted limit of 5MB.',
          });
        }
        return res.status(400).json({ success: false, message: err.message });
      } else if (err instanceof Error) {
        return res.status(400).json({ success: false, message: err.message });
      } else if (err) {
        return res.status(400).json({ success: false, message: String(err) });
      }
      next();
    });
  },
  uploadAndAnalyzeResume
);

/**
 * @route   GET /api/resumes/:id/pdf
 * @desc    Download or preview selectable-text ATS resume PDF
 * @access  Private (Student owner, Placement Officer, Admin, Recruiter)
 */
router.get('/:id/pdf', downloadResumePdf);

/**
 * @route   GET /api/resumes/:id/provenance
 * @desc    Get bullet-level evidence provenance and exclusions explanation
 * @access  Private (Student owner, Placement Officer, Admin, Recruiter)
 */
router.get('/:id/provenance', getResumeProvenance);

/**
 * @route   PATCH /api/resumes/claims/:id
 * @desc    Student: correct an extracted claim's text
 * @access  Private (Student)
 */
router.patch('/claims/:id', requireStudent, updateResumeClaim);

/**
 * @route   POST /api/resumes/claims/:id/link-evidence
 * @desc    Student: link evidence from vault to substantiate an unsupported claim
 * @access  Private (Student)
 */
router.post('/claims/:id/link-evidence', requireStudent, linkEvidenceToClaim);

/**
 * @route   DELETE /api/resumes/claims/:id
 * @desc    Student: remove an inaccurate or unwanted claim
 * @access  Private (Student)
 */
router.delete('/claims/:id', requireStudent, deleteResumeClaim);

/**
 * @route   GET /api/resumes/:id
 * @desc    Get resume details along with associated factual claims
 * @access  Private
 */
router.get('/:id', getResumeById);

/**
 * @route   DELETE /api/resumes/:id
 * @desc    Delete a resume and its claims
 * @access  Private (Student)
 */
router.delete('/:id', requireStudent, deleteResume);

export default router;
