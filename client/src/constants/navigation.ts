import {
  Activity,
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarCheck,
  ClipboardCheck,
  FileBadge,
  FileClock,
  FileText,
  Fingerprint,
  Gauge,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  LucideIcon,
  Settings,
  ShieldCheck,
  Sparkles,
  UserCircle,
  UserCog,
  UserRoundCog,
  UsersRound,
  CheckSquare  
} from 'lucide-react';
import { permissions } from './permissions';

export type NavigationItem = {
  label: string;
  path: string;
  icon: LucideIcon;
  permissions: string[];
  keywords: string[];
};

export const navigationItems: NavigationItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, permissions: [], keywords: ['home', 'analytics', 'kpi'] },
  { label: 'Employee Directory', path: '/employee-directory', icon: UsersRound, permissions: [permissions.employeeDirectoryRead], keywords: ['directory', 'people', 'profile', 'public'] },
  { label: 'User Management', path: '/user-management', icon: UserCog, permissions: [permissions.employeeUserManage], keywords: ['employees', 'hrms', 'sensitive', 'accounts'] },
  { label: 'Attendance', path: '/attendance', icon: CalendarCheck, permissions: [permissions.attendanceRead], keywords: ['check in', 'geo', 'calendar'] },
  { label: 'Leaves', path: '/leaves', icon: ClipboardCheck, permissions: [permissions.leaveRead], keywords: ['approval', 'balance', 'calendar'] },
  { label: 'Leave Approvals', path: '/leave-approvals', icon: CheckSquare, permissions: [permissions.leaveApprove], keywords: ['pending', 'approve', 'reject', 'manager'] },
  { label: 'Recruitment', path: '/recruitment', icon: BriefcaseBusiness, permissions: [permissions.jobRead, permissions.applicationRead], keywords: ['ats', 'jobs', 'candidates'] },
  { label: 'Interviews', path: '/interviews', icon: FileClock, permissions: [permissions.interviewManage], keywords: ['schedule', 'feedback'] },
  { label: 'Onboarding', path: '/onboarding', icon: Sparkles, permissions: [permissions.employeeWrite], keywords: ['stepper', 'approval'] },
  { label: 'Offer Letters', path: '/offer-letters', icon: FileBadge, permissions: [permissions.jobWrite], keywords: ['offer', 'pdf', 'generator'] },
  { label: 'Templates', path: '/templates', icon: FileText, permissions: [permissions.jobWrite], keywords: ['html', 'editor'] },
  { label: 'Roles', path: '/roles', icon: ShieldCheck, permissions: [permissions.rbacManage], keywords: ['rbac', 'assignment'] },
  { label: 'Permissions', path: '/permissions', icon: KeyRound, permissions: [permissions.rbacManage], keywords: ['matrix', 'policy'] },
  { label: 'Notifications', path: '/notifications', icon: Bell, permissions: [], keywords: ['alerts', 'preferences'] },
  { label: 'Settings', path: '/settings', icon: Settings, permissions: [permissions.rbacManage], keywords: ['office', 'geo fencing', 'system'] },
  { label: 'Activity Logs', path: '/activity-logs', icon: Activity, permissions: [permissions.rbacManage], keywords: ['changes', 'events'] },
  { label: 'Audit Logs', path: '/audit-logs', icon: Fingerprint, permissions: [permissions.rbacManage], keywords: ['login', 'security'] },
  { label: 'Profile', path: '/profile', icon: UserCircle, permissions: [], keywords: ['account', 'security'] }
];

export const quickActions = [
  { label: 'Add employee', path: '/user-management/new', icon: UserRoundCog, permission: permissions.employeeUserManage },
  { label: 'Publish job', path: '/recruitment/jobs/new', icon: Building2, permission: permissions.jobWrite },
  { label: 'Review leaves', path: '/leaves?status=pending', icon: ListChecks, permission: permissions.leaveApprove },
  { label: 'Open dashboard', path: '/dashboard', icon: Gauge, permission: '' }
];
