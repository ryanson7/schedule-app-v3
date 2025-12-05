// src/pages/academy-schedules.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../utils/supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import AcademyScheduleManager from "../components/AcademyScheduleManager";

export default function AcademySchedulesPage() {
  const router = useRouter();
  const { user, session, authStatus } = useAuth() as any;

  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  // ✅ managers.user_id 와 매칭될 내부 users.id (bigint)
  const [appUserId, setAppUserId] = useState<number | null>(null);

  // 페이지에서 사용할 역할 (선택)
  const [effectiveRole, setEffectiveRole] = useState<string | undefined>(undefined);

  // 1) useAuth user / session 로그
  useEffect(() => {
    console.log("🔎 useAuth user:", user);
    console.log("🔎 useAuth session:", session);
  }, [user, session]);

  // 2) 페이지 접근 시 인증 확인
  useEffect(() => {
    console.log("🔍 페이지 접근 - 인증 확인 시작");

    // AuthContext 내부에서 INITIAL_SESSION 같은 상태를 쓰고 있다면
    if (authStatus === "INITIAL_SESSION") {
      // 아직 세션 확인 중이면 그냥 대기
      return;
    }

    if (!session) {
      console.warn("⚠️ 세션 없음 → 로그인 페이지로 이동");
      setIsCheckingAuth(false);
      router.replace("/login");
      return;
    }

    console.log("✅ 세션 확인 완료:", user?.email);
    setIsCheckingAuth(false);
  }, [session, authStatus, router, user?.email]);

  // 3) localStorage 에서 role / userName 로딩
  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedRole = localStorage.getItem("userRole") || "";
    const storedEmail = localStorage.getItem("email") || "";
    const storedUserName = localStorage.getItem("userName") || "";

    console.log("✅ 로컬스토리지 확인 완료:", {
      role: storedRole,
      email: storedEmail,
      userName: storedUserName,
    });

    if (storedRole) {
      setEffectiveRole(storedRole);
      console.log("✅ 권한 확인 완료:", storedRole);
    } else {
      console.warn("⚠️ userRole 이 로컬스토리지에 없습니다. 기본값 사용.");
    }
  }, []);

  // 4) 내부 users.id 조회 → appUserId 설정
  useEffect(() => {
    const fetchInternalUserId = async () => {
      if (!user?.id) return; // supabase auth uuid

      try {
        console.log("🔎 academy-schedules 내부 사용자 id 조회 시작 (auth user.id):", user.id);

        // ⚠️ 여기서 auth_user_id 컬럼명은 실제 스키마에 맞게 변경해 주세요.
        const { data, error } = await supabase
          .from("users")
          .select("id")
          .eq("auth_id", user.id) // ← 예시: auth_user_id 컬럼
          .eq("is_active", true)
          .single();

        if (error) {
          console.error("⚠️ 내부 users.id 조회 오류:", error);
          setPageError("내부 사용자 정보를 불러오는데 실패했습니다.");
          return;
        }

        if (data?.id) {
          console.log(
            "✅ academy-schedules 내부 appUserId (from users.id):",
            data.id
          );
          setAppUserId(Number(data.id));
        } else {
          console.warn("⚠️ users 테이블에서 id 를 찾지 못했습니다.");
          setPageError("내부 사용자 정보가 존재하지 않습니다.");
        }
      } catch (e) {
        console.error("🔥 내부 사용자 id 조회 중 예외:", e);
        setPageError("내부 사용자 정보를 불러오는데 오류가 발생했습니다.");
      }
    };

    fetchInternalUserId();
  }, [user?.id]);

  // 5) 접근 권한 체크 (academy 페이지 전용 권한)
  const hasAccess = (() => {
    if (!effectiveRole) return false;
    // 필요 시 정책에 맞게 조정 (system_admin, schedule_admin, academy_manager 등)
    const allowedRoles = [
      "system_admin",
      "schedule_admin",
      "academy_manager",
      "manager",
    ];
    return allowedRoles.includes(effectiveRole);
  })();

  if (isCheckingAuth) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "400px",
          backgroundColor: "#f8fafc",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              border: "4px solid #e5e7eb",
              borderTop: "4px solid #2563eb",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 16px",
            }}
          />
          <div
            style={{
              color: "#6b7280",
              fontSize: "14px",
              fontWeight: "500",
            }}
          >
            인증 상태를 확인하는 중입니다...
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

  if (!session) {
    // useEffect 에서 이미 /login 으로 보냈을 것이고, 여기서는 간단 메시지만
    return null;
  }

  if (!hasAccess) {
    return (
      <div
        style={{
          padding: "40px 20px",
          textAlign: "center",
          backgroundColor: "#fef2f2",
        }}
      >
        <h2 style={{ color: "#b91c1c", marginBottom: 8 }}>접근 권한이 없습니다.</h2>
        <p style={{ color: "#6b7280", fontSize: 14 }}>
          학원 스케줄 페이지에 접근할 수 있는 권한이 없습니다.
          관리자에게 권한을 요청해 주세요.
        </p>
      </div>
    );
  }

  if (pageError) {
    return (
      <div
        style={{
          padding: "40px 20px",
          textAlign: "center",
          backgroundColor: "#fef2f2",
        }}
      >
        <h2 style={{ color: "#b91c1c", marginBottom: 8 }}>페이지 로딩 오류</h2>
        <p style={{ color: "#6b7280", fontSize: 14 }}>{pageError}</p>
      </div>
    );
  }

  console.log(
    "🔎 academy-schedules appUserId (internal users.id):",
    appUserId
  );

  return (
    <AcademyScheduleManager
      currentUserRole={effectiveRole}
      currentUserId={appUserId} // 🔥 이제 bigint id 로 managers.user_id 와 매칭됨
    />
  );
}
