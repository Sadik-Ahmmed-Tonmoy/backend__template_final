import express, { RequestHandler } from 'express';
import auth from '../../middlewares/auth';
import { UserController } from './user.controller';
import { UserRole } from '@prisma/client';
import { fileUploader } from '../../../helpers/fileUploader';
import { parseBody } from '../../middlewares/parseBody';

const router = express.Router();

const conditionalMulter: RequestHandler = (req, res, next) => {
  const contentType = req.headers['content-type'] ?? '';
  if (contentType.includes('multipart/form-data')) {
    return fileUploader.userImages(req, res, (err) => {
      if (err) return next(err);
      return parseBody(req, res, next);
    });
  }
  return next();
};

// User Profile Routes
router.patch('/me', conditionalMulter, auth(), UserController.updateUser);
router.delete('/me', auth(), UserController.deleteUser);

// Admin Governance Routes
router.get('/all', auth(UserRole.SUPER_ADMIN, UserRole.ADMIN), UserController.getAllUsers);
router.get('/stats/overview', auth(UserRole.SUPER_ADMIN, UserRole.ADMIN), UserController.getUserStats);
router.get('/:id', auth(UserRole.SUPER_ADMIN, UserRole.ADMIN), UserController.getUserById);

router.patch(
  '/:id/status',
  auth(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  UserController.statusUpdate,
);

router.patch(
  '/:id/role',
  auth(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  UserController.roleUpdate,
);

router.delete(
  '/:id',
  auth(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  UserController.deleteUserAsAdmin,
);

export const UserRouters = router;
