import httpStatus from 'http-status';
import sendResponse from '../../../shared/sendResponse';
import { UserService } from './user.service';
import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';

// UPDATE USER
const updateUser = catchAsync(async (req: Request, res: Response) => {
  const profileImage =
    req.files && (req.files as Record<string, Express.Multer.File[]>).profileImage
      ? (req.files as Record<string, Express.Multer.File[]>).profileImage[0]
      : null;

  const result = await UserService.updateUser(req.user.id, req.body, profileImage);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Profile updated successfully',
    data: result,
  });
});

// GET USER BY ID
const getUserById = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.getUserById(req.params.id as string);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User fetched successfully',
    data: result,
  });
});

// STATUS UPDATE (Admin)
const statusUpdate = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.statusUpdate(req.params.id as string, req.body.status);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User status updated successfully',
    data: result,
  });
});

// ROLE UPDATE (Admin)
const roleUpdate = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.roleUpdate(req.params.id as string, req.body.role);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User role updated successfully',
    data: result,
  });
});

// GET USER STATS (Admin)
const getUserStats = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.getUserStats();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User stats fetched successfully',
    data: result,
  });
});

// DELETE USER (Self)
const deleteUser = catchAsync(async (req: Request, res: Response) => {
  await UserService.deleteUser(req.user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Account deleted successfully',
    data: null,
  });
});

// DELETE USER (Admin)
const deleteUserAsAdmin = catchAsync(async (req: Request, res: Response) => {
  await UserService.deleteUser(req.params.id as string);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User deleted successfully',
    data: null,
  });
});

// GET ALL USERS (Admin)
const getAllUsers = catchAsync(async (req: Request, res: Response) => {
  const page = req.query.page ? Number(req.query.page) : 1;
  const limit = req.query.limit ? Number(req.query.limit) : 20;
  const filters = {
    searchTerm: req.query.searchTerm as string | undefined,
    role: req.query.role as string | undefined,
    status: req.query.status as string | undefined,
    isVerified: req.query.isVerified as string | undefined,
    sortBy: req.query.sortBy as string | undefined,
    sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined,
  };

  const result = await UserService.getUsers(filters, page, limit);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Users fetched successfully',
    data: result.data,
    meta: result.meta,
  });
});

export const UserController = {
  updateUser,
  getUserById,
  statusUpdate,
  roleUpdate,
  getUserStats,
  deleteUser,
  deleteUserAsAdmin,
  getAllUsers,
};
