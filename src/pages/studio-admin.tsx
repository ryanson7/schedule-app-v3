// src/pages/studio-admin.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../contexts/AuthContext";
import StudioAdminPanel from "../components/StudioAdminPanel";
import { safeUserRole } from "../utils/permissions";
import type { UserRoleType } from "../types/users";

export default function StudioAdminPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [hasAccess, setHasAccess] = useState(false);
  const [checked, setChecked] = useState(false);

  // ✅ index 승인대기에서 넘어오는 딥링크 파라미터
  const deepLinkScheduleId = useMemo(() => {
    const q = router.query?.scheduleId;
    const v = q ? Number(Array.isArray(q) ? q[0] : q) : NaN;
    return Number.isFinite(v) ? v : null;
  }, [router.query]);

  const deepLinkDate = useMemo(() => {
    const q = router.query?.date;
    const v = q ? String(Array.isArray(q) ? q[0] : q) : "";
    // 형식은 패널에서 최종 검증 (YYYY-MM-DD)
    return v || null;
  }, [router.query]);

  // ✅ 페이지 접근 허용 역할
  const allowedRoles: UserRoleType[] = [
    "system_admin",
    "schedule_admin",
    "manager",
    "academy_manager",
    "online_manager",
    // "studio_manager",
  ];

  useEffect(() => {
    if (loading) return;

    // ✅ 1순위: localStorage.userRole (schedule_admin 저장되어 있음)
    let rawRole: string | null = null;

    if (typeof window !== "undefined") {
      rawRole = localStorage.getItem("userRole");
    }

    // ✅ localStorage에 없으면 Auth user.role 사용
    if (!rawRole) {
      rawRole = (user as any)?.role ?? null;
    }

    const appRole = safeUserRole(rawRole as any);

    console.log("[StudioAdminPage] 역할 체크:", {
      rawRole,
      appRole,
      allowedRoles,
      deepLinkScheduleId,
      deepLinkDate,
    });

    setHasAccess(!!appRole && allowedRoles.includes(appRole as UserRoleType));
    setChecked(true);
  }, [loading, user, deepLinkScheduleId, deepLinkDate]);

  // 🔄 AuthContext / role 체크 중
  if (loading || !checked) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              border: "4px solid #e5e7eb",
              borderTop: "4px solid #059669",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 12px",
            }}
          />
          <div style={{ color: "#6b7280", fontSize: "14px" }}>
            스튜디오 권한을 확인하는 중입니다...
          </div>
          <style jsx>{`
            @keyframes spin {
              0% {
                transform: rotate(0deg);
              }
              100% {
                transform: rotate(360deg);
              }
            }
          `}</style>
        </div>
      </div>
    );
  }

  // 🚫 권한 없을 때
  if (!hasAccess) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          padding: "40px",
        }}
      >
        <div
          style={{
            textAlign: "center",
            maxWidth: "420px",
            backgroundColor: "#fef2f2",
            borderRadius: "12px",
            padding: "24px 28px",
            border: "1px solid #fecaca",
          }}
        >
          <h3
            style={{
              color: "#b91c1c",
              marginBottom: "12px",
              fontSize: "18px",
              fontWeight: 700,
            }}
          >
            접근 권한이 없습니다
          </h3>
          <p
            style={{
              color: "#4b5563",
              fontSize: "14px",
              lineHeight: 1.6,
              marginBottom: "8px",
            }}
          >
            스튜디오 관리는 <strong>시스템 관리자</strong>,{" "}
            <strong>스케줄 관리자</strong>, <strong>스튜디오 매니저</strong>,{" "}
            <strong>매니저</strong>만 접근할 수 있습니다.
          </p>
          <p
            style={{
              color: "#6b7280",
              fontSize: "13px",
              lineHeight: 1.6,
            }}
          >
            권한이 필요하시면 시스템 관리자에게 문의해주세요.
          </p>
        </div>
      </div>
    );
  }

  // ✅ 접근 허용 시: 패널 렌더링
  return (
    <StudioAdminPanel
      currentUser={{
        id: (user as any)?.numericId ?? null,
        authUserId: user?.id ?? null,
        name: (user as any)?.name ?? user?.email ?? "",
        role:
          (typeof window !== "undefined" && localStorage.getItem("userRole")) ||
          (user as any)?.role ||
          null,
        permissions: (user as any)?.permissions ?? [],
      }}
      // ✅ index에서 넘어오는 값 전달 (패널에서 주간 이동/모달 오픈 처리)
      deepLinkScheduleId={deepLinkScheduleId}
      deepLinkDate={deepLinkDate}
    />
  );
}
