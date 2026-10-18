import { Prisma, UserRole, UserStatus } from '@prisma/client';
import httpStatus from 'http-status';
import ApiError from '../../../errors/ApiErrors';
import {
  uploadToDigitalOcean,
  uploadBase64ToDigitalOcean,
  deleteFromDigitalOcean,
} from '../../../helpers/digitalOcean';
import prisma from '../../../shared/prisma';

// Types
type UserUpdatePayload = {
  fullName?: string | null;
  phoneNumber?: string | null;
  profileImage?: string | null;
  [key: string]: unknown;
};

export interface UserFilters {
  searchTerm?: string;
  role?: string;
  status?: string;
  isVerified?: boolean | string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// UPDATE USER
const updateUser = async (
  id: string,
  payload: UserUpdatePayload,
  profileImage: Express.Multer.File | null,
) => {
  const user = await prisma.user.findUnique({ where: { id } });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  let newProfileImageUrl: string | null = null;
  let oldProfileImageUrl: string | null = null;

  try {
    if (profileImage) {
      if (!profileImage.mimetype.startsWith('image/')) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Uploaded file must be an image');
      }
      if (profileImage.size > 5 * 1024 * 1024) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Image must be under 5MB');
      }

      newProfileImageUrl = await uploadToDigitalOcean(profileImage);

      if (user.profileImage) {
        oldProfileImageUrl = user.profileImage;
      }
    } else if (payload.profileImage !== undefined) {
      if (payload.profileImage === null) {
        oldProfileImageUrl = user.profileImage ?? null;
        newProfileImageUrl = null;
      } else if (
        typeof payload.profileImage === 'string' &&
        payload.profileImage.startsWith('data:')
      ) {
        newProfileImageUrl = await uploadBase64ToDigitalOcean(payload.profileImage);
        oldProfileImageUrl = user.profileImage ?? null;
      } else if (
        typeof payload.profileImage === 'string' &&
        (payload.profileImage.startsWith('http') || payload.profileImage.startsWith('/'))
      ) {
        newProfileImageUrl = payload.profileImage;
        if (user.profileImage?.startsWith('http')) {
          oldProfileImageUrl = user.profileImage;
        }
      }
    }

    const updateData: Record<string, unknown> = {};

    if (payload.fullName !== undefined) updateData.fullName = payload.fullName ?? null;
    if (payload.phoneNumber !== undefined) updateData.phoneNumber = payload.phoneNumber ?? null;
    if (payload.notificationEnabled !== undefined) updateData.notificationEnabled = Boolean(payload.notificationEnabled);
    if (payload.notificationPreferences !== undefined) updateData.notificationPreferences = payload.notificationPreferences;
    if (payload.twoFactorAuth !== undefined) updateData.twoFactorAuth = Boolean(payload.twoFactorAuth);
    if (payload.loginNotifications !== undefined) updateData.loginNotifications = Boolean(payload.loginNotifications);
    if (payload.sessionTimeout !== undefined) updateData.sessionTimeout = String(payload.sessionTimeout);
    if (payload.language !== undefined) updateData.language = String(payload.language);
    if (payload.timezone !== undefined) updateData.timezone = String(payload.timezone);

    if (newProfileImageUrl !== null) {
      updateData.profileImage = newProfileImageUrl;
    } else if (payload.profileImage === null) {
      updateData.profileImage = null;
    }

    if (Object.keys(updateData).length === 0) {
      return user;
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    if (oldProfileImageUrl && newProfileImageUrl !== null) {
      deleteFromDigitalOcean(oldProfileImageUrl).catch((err) => {
        console.error('Failed to delete old profile image:', err);
      });
    }

    return updatedUser;
  } catch (error) {
    if (newProfileImageUrl) {
      deleteFromDigitalOcean(newProfileImageUrl).catch((err) => {
        console.error('Failed to rollback uploaded image:', err);
      });
    }

    if (error instanceof ApiError) throw error;

    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to update user: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};

// DELETE USER (Self or Admin)
const deleteUser = async (id: string): Promise<void> => {
  const user = await prisma.user.findUnique({ where: { id } });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (user.profileImage) {
    deleteFromDigitalOcean(user.profileImage).catch(() => {});
  }

  // Cascade cleanup child relations to avoid orphan/foreign key errors
  await prisma.oTP.deleteMany({ where: { userId: id } }).catch(() => {});
  await prisma.enrollment.deleteMany({ where: { userId: id } }).catch(() => {});
  await prisma.certificate.deleteMany({ where: { userId: id } }).catch(() => {});
  await prisma.review.deleteMany({ where: { userId: id } }).catch(() => {});
  await prisma.order.deleteMany({ where: { userId: id } }).catch(() => {});

  await prisma.user.delete({ where: { id } });
};

// GET USER BY ID
const getUserById = async (id: string) => {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          enrollments: true,
          certificates: true,
          orders: true,
        },
      },
    },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  return user;
};

// STATUS UPDATE (Admin)
const statusUpdate = async (id: string, status: UserStatus) => {
  const user = await prisma.user.findUnique({ where: { id } });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  return prisma.user.update({ where: { id }, data: { status } });
};

// ROLE UPDATE (Admin)
const roleUpdate = async (id: string, role: UserRole) => {
  const user = await prisma.user.findUnique({ where: { id } });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  return prisma.user.update({ where: { id }, data: { role } });
};

// GET USER STATS OVERVIEW
const getUserStats = async () => {
  const [totalUsers, activeUsers, studentUsers, adminUsers, verifiedUsers] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: 'ACTIVE' } }),
    prisma.user.count({ where: { role: 'USER' } }),
    prisma.user.count({ where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } } }),
    prisma.user.count({ where: { isVerified: true } }),
  ]);

  return {
    totalUsers,
    activeUsers,
    studentUsers,
    adminUsers,
    verifiedUsers,
  };
};

// GET USERS LIST WITH PAGINATION, SEARCH, AND FILTERS (Admin)
const getUsers = async (
  filters: UserFilters,
  page = 1,
  limit = 20,
) => {
  const safePage = Math.max(1, page);
  const safeLimit = Math.max(1, limit);
  const skip = (safePage - 1) * safeLimit;

  const whereCondition: Prisma.UserWhereInput = {};

  if (filters.role && filters.role !== 'ALL') {
    whereCondition.role = filters.role as UserRole;
  }

  if (filters.status && filters.status !== 'ALL') {
    whereCondition.status = filters.status as UserStatus;
  }

  if (filters.isVerified !== undefined && filters.isVerified !== '' && filters.isVerified !== 'ALL') {
    whereCondition.isVerified = filters.isVerified === true || filters.isVerified === 'true';
  }

  if (filters.searchTerm && filters.searchTerm.trim() !== '') {
    const term = filters.searchTerm.trim();
    whereCondition.OR = [
      { fullName: { contains: term, mode: 'insensitive' } },
      { email: { contains: term, mode: 'insensitive' } },
      { phoneNumber: { contains: term, mode: 'insensitive' } },
    ];
  }

  const orderBy: Prisma.UserOrderByWithRelationInput = {};
  if (filters.sortBy && ['createdAt', 'fullName', 'email', 'role', 'status'].includes(filters.sortBy)) {
    orderBy[filters.sortBy as keyof Prisma.UserOrderByWithRelationInput] =
      filters.sortOrder === 'asc' ? 'asc' : 'desc';
  } else {
    orderBy.createdAt = 'desc';
  }

  const [users, total, stats] = await Promise.all([
    prisma.user.findMany({
      where: whereCondition,
      select: {
        id: true,
        email: true,
        fullName: true,
        phoneNumber: true,
        profileImage: true,
        role: true,
        status: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            enrollments: true,
            certificates: true,
            orders: true,
          },
        },
      },
      skip,
      take: safeLimit,
      orderBy,
    }),
    prisma.user.count({ where: whereCondition }),
    getUserStats(),
  ]);

  return {
    data: users,
    meta: {
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1,
      stats,
    },
  };
};

export const UserService = {
  updateUser,
  deleteUser,
  getUserById,
  statusUpdate,
  roleUpdate,
  getUserStats,
  getUsers,
};
