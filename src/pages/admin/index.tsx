// pages/admin/index.tsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../utils/supabaseClient";
import { logger } from "../../utils/logger";

interface Stats {
  academySchedules: number;
  studioSchedules: number;
  studioUsage: number;
  shootingPeople: number;
  academyPending: number;
  studioPending: number;
  internal: number;
  academyHours: string;
  studioHours: string;
  totalUsedHours: string;
  totalAvailableHours: number;
  academyPeople: number;
  studioPeople: number;
}

interface TodayTask {
  id: number;
  schedule_type: string;
  content: string;
  shadow_color: string;
}

type PendingType = "academy" | "studio";

interface PendingItem {
  id: string;
  type: PendingType;
  date: string; // shoot_date
  originalId: number;

  // 요약표시용
  start_time?: string | null;
  end_time?: string | null;
  professor_name?: string | null;
  course_name?: string | null;

  // "실제 호실" 표기용
  room_label?: string; // ex) "노량진(1관) - 301호" / "제작센터 - 1번"
  status?: string; // approval_status
}

interface ErrorState {
  context: string;
  message: string;
}

interface AttendanceInfo {
  name: string;
  notes?: string;
}

interface LocationAttendance {
  locationName: string;
  displayOrder: number;
  people: AttendanceInfo[];
}

// ✅ 시간 포맷 함수 (09:00 → 9)
const formatTime = (time: string): string => {
  if (!time) return "";
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const minute = m === "00" ? "" : `:${m}`;
  return `${hour}${minute}`;
};

const hhmm = (t?: string | null) => {
  if (!t) return "";
  return t.length >= 5 ? t.slice(0, 5) : t;
};

const statusLabel = (s?: string | null) => {
  switch (s) {
    case "approval_requested":
      return "승인요청";
    case "modification_requested":
      return "수정요청";
    case "cancellation_requested":
      return "취소요청";
    case "deletion_requested":
      return "삭제요청";
    default:
      return "대기";
  }
};

// ✅ index “승인대기”는 임시저장(pending) 제외
const APPROVAL_WAIT_STATUSES = [
  "approval_requested",
  "modification_requested",
  "cancellation_requested",
  "deletion_requested",
] as const;

/**
 * ✅ Supabase 조인 결과가 객체/배열로 올 수 있어 방어 처리
 * - sub_locations: object | object[] | null
 * - main_locations: object | object[] | null
 */
const buildRoomLabel = (row: any) => {
  const sub = Array.isArray(row?.sub_locations)
    ? row.sub_locations[0]
    : row?.sub_locations;

  const room = sub?.name || "-";

  const main = Array.isArray(sub?.main_locations)
    ? sub?.main_locations?.[0]?.name
    : sub?.main_locations?.name;

  return main ? `${main} - ${room}` : room;
};

export default function AdminDashboard(): JSX.Element {
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [errorState, setErrorState] = useState<ErrorState | null>(null);

  const [stats, setStats] = useState<Stats>({
    academySchedules: 0,
    studioSchedules: 0,
    studioUsage: 0,
    shootingPeople: 0,
    academyPending: 0,
    studioPending: 0,
    internal: 0,
    academyHours: "0.0",
    studioHours: "0.0",
    totalUsedHours: "0.0",
    totalAvailableHours: 150,
    academyPeople: 0,
    studioPeople: 0,
  });

  const [todayTasks, setTodayTasks] = useState<TodayTask[]>([]);
  const [pendingList, setPendingList] = useState<PendingItem[]>([]);
  const [attendanceData, setAttendanceData] = useState<LocationAttendance[]>([]);
  const [dayOffPeople, setDayOffPeople] = useState<string[]>([]);
  const [eventTasks, setEventTasks] = useState<TodayTask[]>([]);
  const [earlyLeavePeople, setEarlyLeavePeople] = useState<string[]>([]);

  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  const router = useRouter();

  const formattedDate = useMemo(() => {
    const date = new Date(selectedDate);
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const weekday = weekdays[date.getDay()];
    return `${month}/${day}(${weekday})`;
  }, [selectedDate]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loading) loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, loading]);

  const checkAuth = useCallback(() => {
    try {
      const userRole = localStorage.getItem("userRole");
      if (!["system_admin", "admin", "schedule_admin"].includes(userRole || "")) {
        logger.auth.warn("권한 없는 접근 시도", { userRole });
        alert("관리자 권한이 필요합니다.");
        router.push("/");
        return;
      }
      logger.auth.info("관리자 인증 완료", { userRole });
      setLoading(false);
      loadDashboardData();
    } catch (error) {
      logger.auth.error("인증 확인 오류", error);
      router.push("/");
    }
  }, [router]);

  const handleError = useCallback((error: any, context: string) => {
    logger.error(`${context} 오류`, error);
    const userMessage = error?.message?.includes("network")
      ? "네트워크 연결을 확인해주세요."
      : "일시적인 오류가 발생했습니다.";
    setErrorState({ context, message: userMessage });
    setTimeout(() => setErrorState(null), 5000);
  }, []);

  const safeCalculateDuration = useCallback((startTime: string, endTime: string): number => {
    try {
      if (!startTime || !endTime) return 0;
      const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
      if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) return 0;

      const [startHour, startMinute] = startTime.split(":").map(Number);
      const [endHour, endMinute] = endTime.split(":").map(Number);

      const startTotalMinutes = startHour * 60 + startMinute;
      const endTotalMinutes = endHour * 60 + endMinute;
      const durationMinutes = endTotalMinutes - startTotalMinutes;

      return durationMinutes > 0 ? durationMinutes / 60 : 0;
    } catch {
      return 0;
    }
  }, []);

  const validateScheduleData = useCallback((data: any[]): boolean => {
    if (!Array.isArray(data)) return false;
    return data.every(
      (item) =>
        item &&
        typeof item.start_time === "string" &&
        typeof item.end_time === "string"
    );
  }, []);

  const isShootingEmployee = useCallback((user: any, shootingManagerIds: Set<number>): boolean => {
    if (!user) return false;
    if (user.role === "schedule_admin") return true;
    if (user.role === "manager") return shootingManagerIds.has(user.id);
    return false;
  }, []);

  // ✅ 근태 현황 조회 (원본 유지)
  const getAttendanceData = useCallback(
    async (dateString: string) => {
      try {
        logger.info("근태 현황 조회 시작", { date: dateString });

        const { data: managerRows, error: managerError } = await supabase
          .from("managers")
          .select("user_id, manager_type")
          .eq("manager_type", "shooting_manager");
        if (managerError) throw managerError;

        const shootingManagerIds = new Set<number>();
        (managerRows || []).forEach((row: any) => {
          if (row.user_id) shootingManagerIds.add(row.user_id);
        });

        const { data: schedules, error: scheduleError } = await supabase
          .from("schedules")
          .select(
            `
            id,
            assigned_shooter_id,
            schedule_type,
            sub_locations!inner (main_location_id),
            shooter_user:assigned_shooter_id (
              id,
              name,
              email,
              role,
              shooters:shooters_user_id_fkey (
                shooter_type
              )
            )
          `
          )
          .eq("shoot_date", dateString)
          .not("assigned_shooter_id", "is", null);
        if (scheduleError) throw scheduleError;

        const { data: allEmployees, error: usersError } = await supabase
          .from("users")
          .select(
            `
            id,
            name,
            email,
            role
          `
          )
          .in("role", ["schedule_admin", "manager"])
          .neq("email", "schedule@eduwill.net")
          .neq("id", 2)
          .eq("is_active", true);
        if (usersError) throw usersError;

        const assignedEmployeeIds = new Set<number>();

        const { data: internalTasks, error: internalError } = await supabase
          .from("internal_schedules")
          .select("*")
          .eq("schedule_date", dateString)
          .eq("is_active", true);
        if (internalError) throw internalError;

        const dayOffList: string[] = [];
        const eventList: TodayTask[] = [];
        const earlyLeaveList: string[] = [];
        const earlyArrivalMap = new Map<number, string>();
        const dayOffEmployeeIds = new Set<number>();
        const halfDayOffEmployeeIds = new Set<number>();

        internalTasks?.forEach((task: any) => {
          if (task.schedule_type === "개인휴무") {
            const leaveType = task.leave_type || "";
            const content = task.content || "";
            dayOffList.push(content);

            if (task.user_id) {
              if (leaveType === "반차") halfDayOffEmployeeIds.add(task.user_id);
              else dayOffEmployeeIds.add(task.user_id);
            }
          } else if (task.schedule_type === "Helper") {
            if (task.helper_type === "early_arrival" && task.user_id) {
              const timeStr = task.helper_time ? formatTime(task.helper_time) : "";
              earlyArrivalMap.set(task.user_id, `${timeStr}출`);
            } else if (task.helper_type === "early_leave") {
              const reason = task.helper_reason ? ` (${task.helper_reason})` : "";
              earlyLeaveList.push(`${task.content || ""}${reason}`);
            }
          } else if (task.schedule_type === "기타" || task.schedule_type === "행사") {
            eventList.push({
              id: task.id,
              schedule_type: task.schedule_type,
              content: task.content || "",
              shadow_color: task.shadow_color || "#e0e0e0",
            });
          }
        });

        const attendanceMap = new Map<string, AttendanceInfo[]>();
        const hasDispatchMap = new Map<string, boolean>();
        const hasFreelancerMap = new Map<string, boolean>();

        const locations = [
          "제작센터",
          "노량진(1관) 학원",
          "노량진(3관) 학원",
          "수원학원",
          "노원학원",
          "부평학원",
          "신촌학원",
          "강남학원",
          "서면학원",
        ];

        locations.forEach((loc) => {
          attendanceMap.set(loc, []);
          hasDispatchMap.set(loc, false);
          hasFreelancerMap.set(loc, false);
        });

        schedules?.forEach((schedule: any) => {
          const shooterUser = schedule.shooter_user as any;
          const userId = schedule.assigned_shooter_id as number;
          const shooterType = shooterUser?.shooters?.shooter_type as
            | "dispatch"
            | "freelancer"
            | null;

          if (dayOffEmployeeIds.has(userId) && !halfDayOffEmployeeIds.has(userId)) return;

          let locationName = "";

          if (schedule.schedule_type === "studio") {
            locationName = "제작센터";
          } else if (schedule.schedule_type === "academy") {
            const mainLocationId = schedule.sub_locations?.main_location_id;
            const mapping: Record<number, string> = {
              1: "노량진(1관) 학원",
              2: "노량진(3관) 학원",
              3: "수원학원",
              4: "노원학원",
              5: "부평학원",
              6: "신촌학원",
              7: "강남학원",
              9: "서면학원",
            };
            locationName = mapping[mainLocationId] || "";
          }

          if (!locationName) return;

          const isEmployee = isShootingEmployee(shooterUser, shootingManagerIds);
          const userName = shooterUser?.name as string | undefined;

          if (isEmployee && userName) {
            const people = attendanceMap.get(locationName) || [];
            if (!people.find((p) => p.name === userName)) {
              const earlyNote = earlyArrivalMap.get(userId);
              people.push({ name: userName, notes: earlyNote });
              attendanceMap.set(locationName, people);
            }
            assignedEmployeeIds.add(userId);
          } else {
            if (shooterType === "dispatch") hasDispatchMap.set(locationName, true);
            else if (shooterType === "freelancer") hasFreelancerMap.set(locationName, true);
          }
        });

        internalTasks?.forEach((task: any) => {
          if (task.schedule_type === "당직") {
            const people = attendanceMap.get("제작센터") || [];
            if (!people.find((p) => p.name === task.content)) {
              people.push({ name: task.content, notes: "당직" });
              attendanceMap.set("제작센터", people);
            }
          }
        });

        const selectedDay = new Date(dateString).getDay();
        const isWeekend = selectedDay === 0 || selectedDay === 6;

        (allEmployees || [])
          .filter((emp: any) => isShootingEmployee(emp, shootingManagerIds))
          .forEach((emp: any) => {
            const isAssigned = assignedEmployeeIds.has(emp.id);
            const isDayOff =
              dayOffEmployeeIds.has(emp.id) && !halfDayOffEmployeeIds.has(emp.id);

            if (!isAssigned && !isDayOff) {
              if (isWeekend) {
                if (!dayOffList.includes(emp.name)) dayOffList.push(emp.name);
              } else {
                const people = attendanceMap.get("제작센터") || [];
                if (!people.find((p) => p.name === emp.name)) {
                  const earlyNote = earlyArrivalMap.get(emp.id);
                  people.push({ name: emp.name, notes: earlyNote });
                  attendanceMap.set("제작센터", people);
                }
              }
            }
          });

        const result = locations.map((loc, idx) => {
          const people = attendanceMap.get(loc) || [];
          const hasDispatch = hasDispatchMap.get(loc) || false;
          const hasFreelancer = hasFreelancerMap.get(loc) || false;

          let finalPeople: AttendanceInfo[] = [];
          if (people.length > 0) finalPeople = people;
          else if (hasDispatch) finalPeople = [{ name: "파견직" }];
          else if (hasFreelancer) finalPeople = [{ name: "위탁직" }];

          return { locationName: loc, displayOrder: idx + 1, people: finalPeople };
        });

        return { attendance: result, dayOff: dayOffList, events: eventList, earlyLeave: earlyLeaveList };
      } catch (error: any) {
        console.error("❌ 근태 조회 에러:", error);
        handleError(error, "근태 현황 조회");
        return { attendance: [], dayOff: [], events: [], earlyLeave: [] };
      }
    },
    [handleError, isShootingEmployee]
  );

  const getScheduleCountWithShooters = useCallback(
    async (dateString: string) => {
      try {
        const [academyResult, studioResult] = await Promise.all([
          supabase
            .from("schedules")
            .select("id, assigned_shooter_id, start_time, end_time, schedule_type")
            .eq("shoot_date", dateString)
            .not("assigned_shooter_id", "is", null)
            .eq("schedule_type", "academy"),
          supabase
            .from("schedules")
            .select("id, assigned_shooter_id, start_time, end_time, schedule_type")
            .eq("shoot_date", dateString)
            .not("assigned_shooter_id", "is", null)
            .eq("schedule_type", "studio"),
        ]);

        if (academyResult.error) throw academyResult.error;
        if (studioResult.error) throw studioResult.error;

        const academyData = academyResult.data || [];
        const studioData = studioResult.data || [];

        if (!validateScheduleData(academyData) || !validateScheduleData(studioData)) {
          throw new Error("Invalid schedule data format");
        }

        let academyTotalHours = 0;
        academyData.forEach((schedule: any) => {
          academyTotalHours += safeCalculateDuration(schedule.start_time, schedule.end_time);
        });

        let studioTotalHours = 0;
        studioData.forEach((schedule: any) => {
          studioTotalHours += safeCalculateDuration(schedule.start_time, schedule.end_time);
        });

        return {
          academyCount: academyData.length,
          studioCount: studioData.length,
          academyHours: academyTotalHours.toFixed(1),
          studioHours: studioTotalHours.toFixed(1),
          totalUsedHours: (academyTotalHours + studioTotalHours).toFixed(1),
          academyData,
          studioData,
        };
      } catch (error) {
        handleError(error, "스케줄 카운팅");
        return {
          academyCount: 0,
          studioCount: 0,
          academyHours: "0.0",
          studioHours: "0.0",
          totalUsedHours: "0.0",
          academyData: [],
          studioData: [],
        };
      }
    },
    [safeCalculateDuration, validateScheduleData, handleError]
  );

  const calculateStudioUsageRate = useCallback((totalUsedHours: string) => {
    try {
      const operatingHours = 10;
      const studioCount = 15;
      const totalAvailableHours = operatingHours * studioCount;

      const usedHours = parseFloat(totalUsedHours) || 0;
      const usageRate = Math.round((usedHours / totalAvailableHours) * 100);
      const finalRate = Math.min(usageRate, 100);

      return { rate: finalRate, totalAvailable: totalAvailableHours, totalUsed: usedHours };
    } catch {
      return { rate: 0, totalAvailable: 150, totalUsed: 0 };
    }
  }, []);

  const getShootingPeopleCount = useCallback((academyData: any[], studioData: any[]) => {
    try {
      const academyPeople = academyData?.length || 0;
      const studioPeople = studioData?.length || 0;
      return { academyPeople, studioPeople, totalPeople: academyPeople + studioPeople };
    } catch {
      return { academyPeople: 0, studioPeople: 0, totalPeople: 0 };
    }
  }, []);

  /**
   * ✅ 승인대기 목록(임시저장 제외)
   * - 학원/스튜디오 동일하게 요청상태만
   * - 강의실/룸은 실제 호실명(조인) -> buildRoomLabel()
   */
  const getPendingApprovalList = useCallback(async (): Promise<PendingItem[]> => {
    try {
      const [academyResult, studioResult] = await Promise.all([
        supabase
          .from("schedules")
          .select(
            `
            id,
            approval_status,
            professor_name,
            course_name,
            shoot_date,
            start_time,
            end_time,
            sub_location_id,
            sub_locations (
              id,
              name,
              main_location_id,
              main_locations (
                id,
                name,
                location_type
              )
            )
          `
          )
          .eq("schedule_type", "academy")
          .in("approval_status", [...APPROVAL_WAIT_STATUSES])
          .order("shoot_date", { ascending: true })
          .order("start_time", { ascending: true })
          .limit(20),

        supabase
          .from("schedules")
          .select(
            `
            id,
            approval_status,
            professor_name,
            course_name,
            shoot_date,
            start_time,
            end_time,
            sub_location_id,
            sub_locations (
              id,
              name,
              main_location_id,
              main_locations (
                id,
                name,
                location_type
              )
            )
          `
          )
          .eq("schedule_type", "studio")
          .in("approval_status", [...APPROVAL_WAIT_STATUSES])
          .order("shoot_date", { ascending: true })
          .order("start_time", { ascending: true })
          .limit(20),
      ]);

      if (academyResult.error) throw academyResult.error;
      if (studioResult.error) throw studioResult.error;

      const combined: PendingItem[] = [];

      (academyResult.data || []).forEach((item: any) => {
        combined.push({
          id: `academy_${item.id}`,
          type: "academy",
          date: item.shoot_date,
          originalId: item.id,
          start_time: item.start_time,
          end_time: item.end_time,
          professor_name: item.professor_name,
          course_name: item.course_name,
          room_label: buildRoomLabel(item), // ✅ 여기!
          status: item.approval_status,
        });
      });

      (studioResult.data || []).forEach((item: any) => {
        combined.push({
          id: `studio_${item.id}`,
          type: "studio",
          date: item.shoot_date,
          originalId: item.id,
          start_time: item.start_time,
          end_time: item.end_time,
          professor_name: item.professor_name,
          course_name: item.course_name,
          room_label: buildRoomLabel(item), // ✅ 여기!
          status: item.approval_status,
        });
      });

      return combined.sort((a, b) => {
        const ad = new Date(a.date).getTime();
        const bd = new Date(b.date).getTime();
        if (ad !== bd) return ad - bd;
        const aStart = (a.start_time || "").localeCompare(b.start_time || "");
        if (aStart !== 0) return aStart;
        return a.originalId - b.originalId;
      });
    } catch (error) {
      handleError(error, "승인 대기 목록 조회");
      return [];
    }
  }, [handleError]);

  const loadDashboardData = useCallback(async () => {
    try {
      logger.info("대시보드 데이터 로딩 시작", { date: selectedDate });

      const [internalResult, scheduleResult, pendingResult, attendanceResult] = await Promise.all([
        supabase.from("internal_schedules").select("*").eq("schedule_date", selectedDate).eq("is_active", true),
        getScheduleCountWithShooters(selectedDate),
        getPendingApprovalList(),
        getAttendanceData(selectedDate),
      ]);

      if (internalResult.error) throw internalResult.error;

      const usageData = calculateStudioUsageRate(scheduleResult.totalUsedHours);
      const peopleData = getShootingPeopleCount(scheduleResult.academyData, scheduleResult.studioData);

      setTodayTasks(internalResult.data || []);
      setStats({
        academySchedules: scheduleResult.academyCount,
        studioSchedules: scheduleResult.studioCount,
        shootingPeople: peopleData.totalPeople,
        academyHours: scheduleResult.academyHours,
        studioHours: scheduleResult.studioHours,
        totalUsedHours: scheduleResult.totalUsedHours,
        totalAvailableHours: usageData.totalAvailable,
        academyPeople: peopleData.academyPeople,
        studioPeople: peopleData.studioPeople,
        studioUsage: usageData.rate,
        academyPending: 0,
        studioPending: 0,
        internal: internalResult.data?.length || 0,
      });

      setPendingList(pendingResult);

      setAttendanceData(attendanceResult.attendance);
      setDayOffPeople(attendanceResult.dayOff);
      setEventTasks(attendanceResult.events);
      setEarlyLeavePeople(attendanceResult.earlyLeave);

      logger.info("대시보드 데이터 로딩 완료");
    } catch (error) {
      handleError(error, "대시보드 데이터 로딩");
    }
  }, [
    selectedDate,
    getScheduleCountWithShooters,
    calculateStudioUsageRate,
    getShootingPeopleCount,
    getPendingApprovalList,
    getAttendanceData,
    handleError,
  ]);

  const handleStatCardClick = useCallback(
    (type: string) => {
      if (type === "academy") router.push("/academy-schedules");
      if (type === "studio") router.push("/studio-admin");
    },
    [router]
  );

  const handleTodayScheduleClick = useCallback(() => {
    router.push("/daily");
  }, [router]);

  const handlePendingClick = useCallback(
    (item: PendingItem) => {
      if (item.type === "academy") {
        router.push(`/academy-schedules?scheduleId=${item.originalId}&date=${item.date}`);
      } else {
        router.push(`/studio-admin?scheduleId=${item.originalId}&date=${item.date}`);
      }
    },
    [router]
  );

  const handleDateChange = useCallback(
    (direction: "prev" | "next" | "today") => {
      const currentDate = new Date(selectedDate);

      if (direction === "prev") currentDate.setDate(currentDate.getDate() - 1);
      else if (direction === "next") currentDate.setDate(currentDate.getDate() + 1);
      else if (direction === "today") {
        setSelectedDate(new Date().toISOString().split("T")[0]);
        return;
      }

      setSelectedDate(currentDate.toISOString().split("T")[0]);
    },
    [selectedDate]
  );

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          backgroundColor: "#f8fafc",
        }}
      >
        <div
          style={{
            width: "40px",
            height: "40px",
            border: "4px solid #e5e7eb",
            borderTop: "4px solid #3b82f6",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
          }}
        >
          <style jsx>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  const academyApprovalList = pendingList.filter((p) => p.type === "academy");
  const studioApprovalList = pendingList.filter((p) => p.type === "studio");

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f8fafc",
        padding: isMobile ? "16px" : "20px",
      }}
    >
      {errorState && (
        <div
          style={{
            position: "fixed",
            top: "20px",
            right: "20px",
            background: "#ef4444",
            color: "white",
            padding: "12px 16px",
            borderRadius: "8px",
            zIndex: 1000,
            maxWidth: "300px",
            fontSize: "14px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
        >
          <strong>{errorState.context}</strong>
          <br />
          {errorState.message}
        </div>
      )}

      <div className="admin-dashboard">
        {/* ===== 헤더 ===== */}
        <div className="header">
          <div className="header-content">
            <div className="header-left">
              <h1>관리자 대시보드</h1>
              <span className="date">
                {new Date().toLocaleDateString("ko-KR", {
                  month: isMobile ? "short" : "long",
                  day: "numeric",
                  weekday: "short",
                })}
              </span>

              <div className="date-navigation">
                <button className="date-nav-btn" onClick={() => handleDateChange("prev")}>
                  <span>◀</span>
                </button>
                <div className="selected-date">{formattedDate}</div>
                <button className="date-nav-btn" onClick={() => handleDateChange("next")}>
                  <span>▶</span>
                </button>
                <button className="date-nav-btn today" onClick={() => handleDateChange("today")}>
                  오늘
                </button>
              </div>
            </div>

            <button className="today-schedule-btn" onClick={handleTodayScheduleClick}>
              {isMobile ? "📅 오늘 스케줄" : "📅 오늘 스케줄 보기"}
            </button>
          </div>
        </div>

        {/* ===== 상단 통계 ===== */}
        <div className="stats-row">
          <div className="stat-card academy clickable" onClick={() => handleStatCardClick("academy")}>
            <div className="stat-content">
              <div className="stat-number">{stats.academySchedules}</div>
              <div className="stat-label">{isMobile ? "학원" : "학원 스케줄"}</div>
              <div className="stat-hours">{stats.academyHours}h</div>
            </div>
          </div>

          <div className="stat-card studio clickable" onClick={() => handleStatCardClick("studio")}>
            <div className="stat-content">
              <div className="stat-number">{stats.studioSchedules}</div>
              <div className="stat-label">{isMobile ? "스튜디오" : "스튜디오 스케줄"}</div>
              <div className="stat-hours">{stats.studioHours}h</div>
            </div>
          </div>

          <div className="stat-card usage">
            <div className="stat-content">
              <div className="stat-number">{stats.studioUsage}%</div>
              <div className="stat-label">{isMobile ? "가동률" : "스튜디오 가동률"}</div>
              <div className="stat-hours">
                {stats.totalUsedHours}/{stats.totalAvailableHours}h
              </div>
            </div>
          </div>

          <div className="stat-card people">
            <div className="stat-content">
              <div className="stat-number">{stats.shootingPeople}</div>
              <div className="stat-label">{isMobile ? "촬영인원" : "촬영 인원"}</div>
              <div className="stat-hours">
                {stats.academyPeople} + {stats.studioPeople}
              </div>
            </div>
          </div>
        </div>

        <div className="main-content-grid">
          {/* 왼쪽 상단: 근태 */}
          <div className="panel">
            <h3>👥 직원 촬영 및 근태 현황</h3>
            <div className="attendance-content">
              <div className="attendance-list compact">
                {[
                  "제작센터",
                  "노량진(1관) 학원",
                  "노량진(3관) 학원",
                  "수원학원",
                  "노원학원",
                  "부평학원",
                  "신촌학원",
                  "강남학원",
                  "서면학원",
                ].map((locationName, index) => {
                  const locationData = attendanceData.find((loc) => loc.locationName === locationName);
                  const people = locationData?.people || [];

                  return (
                    <div key={index} className="attendance-row">
                      <span className="location-number">{String(index + 1).padStart(2, "0")}</span>
                      <span className="location-name">{locationName}</span>
                      <span className="location-staff">
                        {people.length === 0 ? (
                          <span className="no-staff">없음</span>
                        ) : (
                          people.map((person, idx) => (
                            <React.Fragment key={idx}>
                              {person.name === "위탁직" || person.name === "파견직" ? (
                                <span className="outsourced-tag">{person.name}</span>
                              ) : (
                                person.name
                              )}
                              {person.notes && <span className="staff-note">({person.notes})</span>}
                              {idx < people.length - 1 && ((idx + 1) % 6 === 0 ? <br /> : ", ")}
                            </React.Fragment>
                          ))
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 오른쪽 상단: 오늘의 업무 */}
          <div className="panel">
            <div className="panel-header">
              <h3>📝 오늘의 업무</h3>
              <button className="link-btn" onClick={() => router.push("/internal-schedules")}>
                {isMobile ? "➕" : "업무 관리"}
              </button>
            </div>

            <div className="task-list compact">
              {dayOffPeople.length > 0 && (
                <div className="task-section">
                  <div className="task-section-title">🏖️ 휴무자</div>
                  <div className="task-single-line">{dayOffPeople.join(", ")}</div>
                </div>
              )}

              {earlyLeavePeople.length > 0 && (
                <div className="task-section">
                  <div className="task-section-title">🚪 조기퇴근</div>
                  {earlyLeavePeople.map((person, idx) => (
                    <div key={`leave-${idx}`} className="task-item small">
                      <div className="task-dot leave"></div>
                      <span className="task-content">{person}</span>
                    </div>
                  ))}
                </div>
              )}

              {eventTasks.length > 0 && (
                <div className="task-section">
                  <div className="task-section-title">📋 기타 업무</div>
                  {eventTasks.map((task) => (
                    <div key={task.id} className="task-item">
                      <div className="task-dot" style={{ backgroundColor: task.shadow_color || "#666" }}></div>
                      <div className="task-info">
                        <span className="task-type">{task.schedule_type}</span>
                        <span className="task-content">{task.content}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {eventTasks.length === 0 && dayOffPeople.length === 0 && earlyLeavePeople.length === 0 && (
                <div className="empty-state small">
                  <p>오늘 등록된 업무가 없습니다.</p>
                </div>
              )}
            </div>
          </div>

          {/* 학원 승인대기 */}
          <div className="panel">
            <h3>🏫 학원 승인대기 ({academyApprovalList.length})</h3>

            {academyApprovalList.length === 0 ? (
              <div className="empty-state small">
                <p>승인 대기(요청) 중인 학원 스케줄이 없습니다.</p>
              </div>
            ) : (
              <div className="approval-list compact">
                {academyApprovalList.map((item) => (
                  <div
                    key={item.id}
                    className="approval-item compact academy"
                    onClick={() => handlePendingClick(item)}
                    title="클릭 시 해당 주간으로 이동 후 스케줄이 열립니다."
                  >
                    <div className="approval-content">
                      <div className="approval-title">
                        <div style={{ fontWeight: 800, fontSize: 13, color: "#1f2937" }}>
                          [{statusLabel(item.status)}] {item.professor_name || "-"} · {item.course_name || "-"}
                        </div>
                        <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280", fontWeight: 700 }}>
                          {item.room_label || "-"} · {hhmm(item.start_time)}~{hhmm(item.end_time)}
                        </div>
                      </div>
                      <div className="approval-date">{item.date}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 스튜디오 승인대기 */}
          <div className="panel">
            <h3>🎥 스튜디오 승인대기 ({studioApprovalList.length})</h3>

            {studioApprovalList.length === 0 ? (
              <div className="empty-state small">
                <p>승인 대기(요청) 중인 스튜디오 스케줄이 없습니다.</p>
              </div>
            ) : (
              <div className="approval-list compact">
                {studioApprovalList.map((item) => (
                  <div
                    key={item.id}
                    className="approval-item compact studio"
                    onClick={() => handlePendingClick(item)}
                    title="클릭 시 해당 주간으로 이동 후 스케줄이 열립니다."
                  >
                    <div className="approval-content">
                      <div className="approval-title">
                        <div style={{ fontWeight: 800, fontSize: 13, color: "#1f2937" }}>
                          [{statusLabel(item.status)}] {item.professor_name || "-"} · {item.course_name || "-"}
                        </div>
                        <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280", fontWeight: 700 }}>
                          {item.room_label || "-"} · {hhmm(item.start_time)}~{hhmm(item.end_time)}
                        </div>
                      </div>
                      <div className="approval-date">{item.date}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx global>{`
        .admin-dashboard { max-width: 1200px; margin: 0 auto; }
        .header { margin-bottom: ${isMobile ? "20px" : "24px"}; padding-bottom: ${isMobile ? "12px" : "16px"}; border-bottom: 2px solid #e9ecef; }
        .header-content { display: flex; justify-content: space-between; align-items: center; ${isMobile ? "flex-direction: column; gap: 12px;" : ""} }
        .header-left { display: flex; ${isMobile ? "flex-direction: column; align-items: center; gap: 8px;" : "align-items: center; gap: 16px; flex-wrap: wrap;"} }
        .header h1 { font-size: ${isMobile ? "22px" : "28px"}; font-weight: 700; color: #2c3e50; margin: 0; }
        .date { color: #6c757d; font-size: ${isMobile ? "13px" : "14px"}; font-weight: 500; }
        .date-navigation { display: flex; gap: 10px; align-items: center; background: white; padding: 6px 12px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08); }
        .date-nav-btn { background: white; border: 1px solid #dee2e6; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600; color: #495057; transition: all 0.2s ease; min-width: 36px; display: flex; align-items: center; justify-content: center; }
        .date-nav-btn:hover { background: #f8f9fa; border-color: #adb5bd; transform: scale(1.05); }
        .date-nav-btn.today { background: #007bff; color: white; border-color: #007bff; }
        .date-nav-btn.today:hover { background: #0056b3; }
        .selected-date { font-size: 14px; font-weight: 700; color: #2c3e50; min-width: 90px; text-align: center; padding: 0 8px; }
        .today-schedule-btn { background: #007bff; color: white; border: none; padding: ${isMobile ? "8px 16px" : "10px 18px"}; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; transition: all 0.2s ease; box-shadow: 0 2px 8px rgba(0, 123, 255, 0.3); }
        .today-schedule-btn:hover { background: #0056b3; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0, 123, 255, 0.4); }
        .stats-row { display: grid; grid-template-columns: ${isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)"}; gap: ${isMobile ? "12px" : "16px"}; margin-bottom: ${isMobile ? "20px" : "24px"}; }
        .stat-card { background: white; border-radius: 10px; padding: ${isMobile ? "16px" : "18px"}; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08); border-left: 4px solid var(--color); transition: all 0.2s ease; cursor: pointer; text-align: center; }
        .stat-card:hover { transform: ${isMobile ? "scale(0.98)" : "translateY(-3px)"}; box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12); }
        .stat-card.academy { --color: #007bff; }
        .stat-card.studio { --color: #28a745; }
        .stat-card.usage { --color: #17a2b8; }
        .stat-card.people { --color: #ffc107; }
        .stat-number { font-size: ${isMobile ? "28px" : "32px"}; font-weight: 700; color: #2c3e50; margin-bottom: 6px; }
        .stat-label { color: #6c757d; font-size: 14px; font-weight: 600; margin-bottom: 6px; }
        .stat-hours { font-size: 12px; color: var(--color); font-weight: 600; }
        .main-content-grid { display: grid; grid-template-columns: ${isMobile ? "1fr" : "1fr 1fr"}; gap: ${isMobile ? "16px" : "20px"}; }
        .panel { background: white; border-radius: 12px; padding: ${isMobile ? "16px" : "20px"}; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08); }
        .panel h3 { margin: 0 0 16px 0; font-size: ${isMobile ? "16px" : "17px"}; font-weight: 600; color: #2c3e50; }
        .panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .panel-header h3 { margin: 0; }
        .link-btn { background: none; border: none; color: #007bff; cursor: pointer; font-size: 13px; font-weight: 600; }
        .link-btn:hover { color: #0056b3; text-decoration: underline; }
        .attendance-list.compact { display: flex; flex-direction: column; gap: 4px; max-height: 400px; overflow-y: auto; }
        .attendance-row { display: flex; gap: 10px; padding: 5px 8px; background: #f8f9fa; border-radius: 6px; font-size: 14px; line-height: 1.6; }
        .location-number { font-weight: 700; color: #495057; min-width: 24px; flex-shrink: 0; }
        .location-name { font-weight: 600; color: #2c3e50; min-width: ${isMobile ? "80px" : "120px"}; flex-shrink: 0; }
        .location-staff { flex: 1; color: #495057; line-height: 1.8; }
        .staff-note { color: #6c757d; font-size: 13px; margin-left: 3px; }
        .no-staff { color: #adb5bd; }
        .outsourced-tag { color: #6c757d; font-style: italic; }
        .task-list.compact { display: flex; flex-direction: column; gap: 12px; max-height: 400px; overflow-y: auto; }
        .task-section { margin-bottom: 8px; }
        .task-section-title { font-size: 13px; font-weight: 600; color: #2c3e50; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #e9ecef; }
        .task-single-line { font-size: 14px; color: #495057; padding: 6px 0; line-height: 1.6; }
        .task-item { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid #f3f4f6; }
        .task-item.small { padding: 4px 0; }
        .task-item:last-child { border-bottom: none; }
        .task-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
        .task-dot.leave { background: #ffc107; }
        .task-info { flex: 1; display: flex; align-items: center; gap: 8px; }
        .task-type { font-size: 11px; font-weight: 600; color: #495057; background: #e9ecef; padding: 2px 8px; border-radius: 12px; }
        .task-content { font-size: 13px; color: #6c757d; }
        .approval-list.compact { display: flex; flex-direction: column; gap: 8px; max-height: 350px; overflow-y: auto; }
        .approval-item.compact { padding: 10px 12px; background: #f8f9fa; border-radius: 8px; border-left: 3px solid var(--type-color); cursor: pointer; transition: all 0.2s; }
        .approval-item.compact:hover { background: #e9ecef; transform: translateX(3px); }
        .approval-item.academy { --type-color: #007bff; }
        .approval-item.studio { --type-color: #28a745; }
        .approval-content { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
        .approval-title { flex: 1; font-weight: 500; color: #2c3e50; font-size: 13px; min-width: 0; }
        .approval-date { font-size: 11px; color: #6c757d; white-space: nowrap; font-weight: 800; }
        .empty-state.small { text-align: center; padding: 40px 20px; color: #6c757d; font-size: 13px; }
      `}</style>
    </div>
  );
}
