import type { Request, Response } from 'express';
import { sendSuccess } from '../../common/http/api-response';
import { HttpStatus } from '../../common/http/status-codes';
import { prisma } from '../../database/prisma';

function todayRange(): { start: Date; end: Date } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
}

export class DashboardController {
  stats = async (_request: Request, response: Response): Promise<Response> => {
    const { start, end } = todayRange();

    const [
      totalEmployees,
      presentToday,
      absentToday,
      lateToday,
      pendingLeaves,
      activeJobPosts,
      applicationsCount,
      interviewsScheduled
    ] = await Promise.all([
      prisma.employee.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
      prisma.attendanceRecord.count({
        where: { deletedAt: null, attendanceDate: { gte: start, lt: end }, status: 'PRESENT' }
      }),
      prisma.attendanceRecord.count({
        where: { deletedAt: null, attendanceDate: { gte: start, lt: end }, status: 'ABSENT' }
      }),
      prisma.attendanceRecord.count({
        where: { deletedAt: null, attendanceDate: { gte: start, lt: end }, status: 'LATE' }
      }),
      prisma.leaveRequest.count({
        where: { deletedAt: null, status: { in: ['PENDING_TEAM_LEAD', 'PENDING_HR'] } }
      }),
      prisma.jobPosting.count({ where: { deletedAt: null, status: 'PUBLISHED' } }),
      prisma.jobApplication.count({ where: { deletedAt: null } }),
      prisma.interview.count({ where: { deletedAt: null, status: 'SCHEDULED' } })
    ]);

    return sendSuccess(
      response,
      'Dashboard stats retrieved',
      {
        totalEmployees,
        presentToday,
        absentToday,
        lateToday,
        pendingLeaves,
        activeJobPosts,
        applicationsCount,
        interviewsScheduled,
        attendanceTrend: [],
        recruitmentTrend: []
      },
      HttpStatus.OK
    );
  };
}
