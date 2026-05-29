import type { Request, Response } from "express";
import { AttendanceStatus } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { sendSuccess } from "../../common/http/api-response";
import { HttpStatus } from "../../common/http/status-codes";
import { 
  BadRequestError, 
  ConflictError, 
  ForbiddenError,
  NotFoundError 
} from "../../common/errors/app-error";

const parsePagination = (request: Request) => {
  const page = parseInt(request.query.page as string) || 1;
  const limit = parseInt(request.query.limit as string) || 10;
  const search = request.query.search as string || undefined;
  return { page, limit, search };
};

const pageArgs = (query: { page: number; limit: number }) => ({
  skip: (query.page - 1) * query.limit,
  take: query.limit,
});

const paginated = (items: any[], total: number, query: { page: number; limit: number }) => ({
  items,
  meta: {
    total,
    page: query.page,
    limit: query.limit,
    totalPages: Math.ceil(total / query.limit),
  },
});

const currentUser = (request: Request) => request.user;

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const parseTime = (value: string) => {
  const [hours = "0", minutes = "0"] = value.split(":");
  return { hours: Number(hours), minutes: Number(minutes) };
};

const minutesSinceMidnight = (value: Date) => {
  return value.getHours() * 60 + value.getMinutes();
};

const attendanceStatusWithGrace = (checkInTime: Date, setting?: { officeStart: string; graceMinutes: number } | null) => {
  if (!setting) return "PRESENT";
  const officeStart = parseTime(setting.officeStart);
  const lateThreshold = officeStart.hours * 60 + officeStart.minutes + setting.graceMinutes + 15;
  return minutesSinceMidnight(checkInTime) > lateThreshold ? "LATE" : "PRESENT";
};

const calculateWorkHoursStatus = (checkInAt: Date, checkOutAt: Date, setting?: { officeStart: string; officeEnd: string } | null) => {
  const workMinutes = Math.max(0, Math.floor((checkOutAt.getTime() - checkInAt.getTime()) / 60000));
  return { workMinutes, status: workMinutes < 240 ? "HALF_DAY" : "PRESENT" };
};

const buildUserManagementVisibilityWhere = (user: any) => {
  // Simplified version - you can adjust based on your actual implementation
  return { deletedAt: null };
};

export class AttendanceController {
  // GET /attendance
  attendance = async (request: Request, response: Response): Promise<Response> => {
    try {
      console.log("Attendance endpoint called");
      const query = parsePagination(request);
      const user = currentUser(request);
      
      console.log("User:", user?.id, "EmployeeId:", user?.employeeId);
      
      const where: any = { 
        deletedAt: null,
      };
      
      // If regular employee (not admin/hr), filter by their own records
      if (user?.employeeId && 
          !user?.permissions?.includes("employee.visibility.super_admin") && 
          !user?.roles?.some((r: string) => ["HR_MANAGER", "HR_EXECUTIVE", "HR", "PORTAL_ADMIN", "ADMIN", "SUPER_ADMIN"].includes(r))) {
        where.employeeId = user.employeeId;
        console.log("Filtering by employeeId:", user.employeeId);
      }

      console.log("Query params:", { where, ...pageArgs(query) });

      const [items, total] = await Promise.all([
        prisma.attendanceRecord.findMany({
          where,
          ...pageArgs(query),
          orderBy: { attendanceDate: "desc" },
          include: { 
            employee: { 
              select: { 
                employeeId: true, 
                firstName: true, 
                lastName: true, 
                department: true 
              } 
            } 
          },
        }),
        prisma.attendanceRecord.count({ where }),
      ]);

      console.log(`Found ${items.length} attendance records, total: ${total}`);

      return sendSuccess(
        response, 
        "Attendance records retrieved", 
        paginated(items, total, query), 
        HttpStatus.OK
      );
    } catch (error) {
      console.error("Detailed attendance error:", error);
      // Send the actual error in development
      return response.status(500).json({
        success: false,
        message: "Failed to fetch attendance records",
        error: process.env.NODE_ENV === "development" ? error.message : undefined,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined
      });
    }
  };

  // POST /attendance/check-in
  checkIn = async (request: Request, response: Response): Promise<Response> => {
    try {
      const user = currentUser(request);
      
      if (!user?.employeeId) {
        throw new ForbiddenError("Only linked employee accounts can check in");
      }

      const now = new Date();
      const attendanceDate = startOfToday();
      
      const setting = await prisma.attendanceSetting.findFirst({ 
        where: { isActive: true, deletedAt: null }, 
        select: { officeStart: true, graceMinutes: true } 
      });
      
      const existing = await prisma.attendanceRecord.findUnique({ 
        where: { 
          employeeId_attendanceDate: { 
            employeeId: user.employeeId, 
            attendanceDate 
          } 
        } 
      });
      
      if (existing?.checkInAt && !existing.deletedAt) {
        throw new ConflictError("Employee is already checked in for today");
      }

      const attendance = await prisma.attendanceRecord.upsert({
        where: { 
          employeeId_attendanceDate: { 
            employeeId: user.employeeId, 
            attendanceDate 
          } 
        },
        create: { 
          employeeId: user.employeeId, 
          attendanceDate, 
          checkInAt: now, 
          status: attendanceStatusWithGrace(now, setting), 
          checkInMeta: { 
            deviceInfo: request.body.deviceInfo, 
            ipAddress: request.ip, 
            userAgent: request.headers["user-agent"] 
          } 
        },
        update: { 
          deletedAt: null, 
          checkInAt: now, 
          status: attendanceStatusWithGrace(now, setting), 
          checkInMeta: { 
            deviceInfo: request.body.deviceInfo, 
            ipAddress: request.ip, 
            userAgent: request.headers["user-agent"] 
          } 
        },
        include: { 
          employee: { 
            select: { 
              employeeId: true, 
              firstName: true, 
              lastName: true, 
              department: true 
            } 
          } 
        },
      });

      return sendSuccess(response, "Check-in recorded", attendance, HttpStatus.CREATED);
    } catch (error) {
      console.error("Check-in error:", error);
      throw error;
    }
  };

  // POST /attendance/check-out
  checkOut = async (request: Request, response: Response): Promise<Response> => {
    try {
      const user = currentUser(request);
      
      if (!user?.employeeId) {
        throw new ForbiddenError("Only linked employee accounts can check out");
      }

      const attendanceDate = startOfToday();
      const existing = await prisma.attendanceRecord.findUnique({ 
        where: { 
          employeeId_attendanceDate: { 
            employeeId: user.employeeId, 
            attendanceDate 
          } 
        } 
      });
      
      if (!existing?.checkInAt || existing.deletedAt) {
        throw new BadRequestError("Check-out requires an active check-in for today");
      }
      
      if (existing.checkOutAt) {
        throw new ConflictError("Employee is already checked out for today");
      }

      const now = new Date();
      const setting = await prisma.attendanceSetting.findFirst({ 
        where: { isActive: true, deletedAt: null }, 
        select: { officeStart: true, officeEnd: true } 
      });
      
      const { workMinutes, status } = calculateWorkHoursStatus(existing.checkInAt, now, setting);

      const attendance = await prisma.attendanceRecord.update({
        where: { id: existing.id },
        data: { 
          checkOutAt: now, 
          workMinutes, 
          status, 
          checkOutMeta: { 
            deviceInfo: request.body.deviceInfo, 
            ipAddress: request.ip, 
            userAgent: request.headers["user-agent"] 
          } 
        },
        include: { 
          employee: { 
            select: { 
              employeeId: true, 
              firstName: true, 
              lastName: true, 
              department: true 
            } 
          } 
        },
      });

      return sendSuccess(response, "Check-out recorded", attendance, HttpStatus.OK);
    } catch (error) {
      console.error("Check-out error:", error);
      throw error;
    }
  };

  // GET /attendance/regularizations
  getRegularizations = async (request: Request, response: Response): Promise<Response> => {
    try {
      const query = parsePagination(request);
      const user = currentUser(request);
      
      const where: any = { deletedAt: null };
      
      if (user?.employeeId && 
          !user?.permissions?.includes("employee.visibility.super_admin") && 
          !user?.roles?.some((r: string) => ["HR_MANAGER", "HR_EXECUTIVE", "HR", "PORTAL_ADMIN", "ADMIN"].includes(r))) {
        where.employeeId = user.employeeId;
      }

      const [items, total] = await Promise.all([
        prisma.attendanceRegularization.findMany({
          where,
          ...pageArgs(query),
          orderBy: { createdAt: "desc" },
          include: { 
            employee: { 
              select: { 
                employeeId: true, 
                firstName: true, 
                lastName: true, 
                department: true 
              } 
            }, 
            reviewedBy: { 
              select: { firstName: true, lastName: true } 
            } 
          },
        }),
        prisma.attendanceRegularization.count({ where }),
      ]);

      return sendSuccess(response, "Regularizations retrieved", paginated(items, total, query), HttpStatus.OK);
    } catch (error) {
      console.error("Get regularizations error:", error);
      throw error;
    }
  };

  // POST /attendance/regularizations
  createRegularization = async (request: Request, response: Response): Promise<Response> => {
    try {
      const user = currentUser(request);
      
      if (!user?.employeeId) {
        throw new ForbiddenError("Only employees can submit regularization requests");
      }

      const { date, reason, requestedCheckIn, requestedCheckOut } = request.body;
      
      if (!date || !reason) {
        throw new BadRequestError("Date and reason are required");
      }

      const settings = await prisma.appConfig.findUnique({ 
        where: { key: "attendance.regularization.limit" } 
      });
      
      const monthlyLimit = (settings?.value as number) ?? 5;
      const startOfMonth = new Date(); 
      startOfMonth.setDate(1); 
      startOfMonth.setHours(0, 0, 0, 0);
      
      const monthlyCount = await prisma.attendanceRegularization.count({ 
        where: { 
          employeeId: user.employeeId, 
          createdAt: { gte: startOfMonth }, 
          status: { in: ["PENDING", "APPROVED"] } 
        } 
      });
      
      if (monthlyCount >= monthlyLimit) {
        throw new BadRequestError(`You have reached the monthly limit of ${monthlyLimit} regularization requests`);
      }

      const regularization = await prisma.$transaction(async (tx) => {
        const record = await tx.attendanceRegularization.create({
          data: { 
            employeeId: user.employeeId, 
            attendanceDate: new Date(date), 
            requestedCheckIn: requestedCheckIn ? new Date(requestedCheckIn) : null, 
            requestedCheckOut: requestedCheckOut ? new Date(requestedCheckOut) : null, 
            reason, 
            status: "PENDING" 
          },
          include: { 
            employee: { 
              include: { reportingManager: true } 
            } 
          },
        });
        
        if (record.employee.reportingManager) {
          const employeeUser = await tx.user.findFirst({ 
            where: { employeeId: record.employee.reportingManager.id } 
          });
          
          if (employeeUser) {
            await tx.notification.create({ 
              data: { 
                userId: employeeUser.id, 
                channel: "IN_APP", 
                title: "Attendance Regularization Request", 
                body: `${record.employee.firstName} ${record.employee.lastName} has requested attendance regularization`, 
                data: { regularizationId: record.id, type: "regularization" } 
              } 
            });
          }
        }
        return record;
      });

      return sendSuccess(response, "Regularization request submitted", regularization, HttpStatus.CREATED);
    } catch (error) {
      console.error("Create regularization error:", error);
      throw error;
    }
  };

  // PATCH /attendance/regularizations/:id
  reviewRegularization = async (request: Request, response: Response): Promise<Response> => {
    try {
      const user = currentUser(request);
      const { id } = request.params;
      const { status, remarks } = request.body;
      
      if (!["APPROVED", "REJECTED"].includes(status)) {
        throw new BadRequestError("Status must be APPROVED or REJECTED");
      }

      const regularization = await prisma.$transaction(async (tx) => {
        const record = await tx.attendanceRegularization.update({
          where: { id },
          data: { 
            status, 
            remarks: remarks || null, 
            reviewedById: user?.employeeId, 
            reviewedAt: new Date() 
          },
          include: { 
            employee: { 
              include: { user: true } 
            } 
          },
        });

        if (status === "APPROVED" && record.requestedCheckIn) {
          const attendanceDate = new Date(record.attendanceDate); 
          attendanceDate.setHours(0, 0, 0, 0);
          
          const workMinutes = record.requestedCheckIn && record.requestedCheckOut 
            ? Math.max(0, Math.floor((record.requestedCheckOut.getTime() - record.requestedCheckIn.getTime()) / 60000)) 
            : 0;
          
          await tx.attendanceRecord.upsert({
            where: { 
              employeeId_attendanceDate: { 
                employeeId: record.employeeId, 
                attendanceDate 
              } 
            },
            update: { 
              checkInAt: record.requestedCheckIn, 
              checkOutAt: record.requestedCheckOut, 
              workMinutes, 
              status: workMinutes < 240 ? "HALF_DAY" : "PRESENT" 
            },
            create: { 
              employeeId: record.employeeId, 
              attendanceDate, 
              checkInAt: record.requestedCheckIn, 
              checkOutAt: record.requestedCheckOut, 
              workMinutes, 
              status: workMinutes < 240 ? "HALF_DAY" : "PRESENT" 
            },
          });
        }

        if (record.employee.user) {
          await tx.notification.create({ 
            data: { 
              userId: record.employee.user.id, 
              channel: "IN_APP", 
              title: `Regularization Request ${status === "APPROVED" ? "Approved" : "Rejected"}`, 
              body: `Your regularization request has been ${status.toLowerCase()}`, 
              data: { regularizationId: record.id } 
            } 
          });
        }
        return record;
      });

      return sendSuccess(response, `Regularization ${status.toLowerCase()}`, regularization, HttpStatus.OK);
    } catch (error) {
      console.error("Review regularization error:", error);
      throw error;
    }
  };
}