import type { Request } from "express";
import { paginationSchema, type PaginationQuery } from "./pagination";
import type { AuthenticatedUser } from "../../types/authenticated-user";

export function parsePagination(request: Request): PaginationQuery {
  return paginationSchema.parse(request.query);
}

export function paginated<T>(items: T[], total: number, query: PaginationQuery) {
  return {
    items,
    meta: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export function pageArgs(query: PaginationQuery) {
  return {
    skip: (query.page - 1) * query.limit,
    take: query.limit,
  };
}

export function currentUser(request: Request): AuthenticatedUser {
  return request.user as AuthenticatedUser;
}

export function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function parseTime(value: string) { 
  const [hours = "0", minutes = "0"] = value.split(":");
  return { hours: Number(hours), minutes: Number(minutes) };
}

export function minutesSinceMidnight(value: Date): number {
  return value.getHours() * 60 + value.getMinutes();
}

export function attendanceStatusWithGrace(checkInTime: Date, setting?: { officeStart: string; graceMinutes: number } | null) {
  if (!setting) return "PRESENT";
  const officeStart = parseTime(setting.officeStart);
  const lateThreshold = officeStart.hours * 60 + officeStart.minutes + setting.graceMinutes + 15;
  return minutesSinceMidnight(checkInTime) > lateThreshold ? "LATE" : "PRESENT";
}

export function calculateWorkHoursStatus(checkInAt: Date, checkOutAt: Date, setting?: { officeStart: string; officeEnd: string } | null) {
  const workMinutes = Math.max(0, Math.floor((checkOutAt.getTime() - checkInAt.getTime()) / 60000));
  return { workMinutes, status: workMinutes < 240 ? "HALF_DAY" : "PRESENT" };
}