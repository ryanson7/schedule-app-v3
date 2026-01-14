// pages/_app.tsx (중복 실행 방지 버전)
import type { AppProps } from "next/app";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import type { Session } from "@supabase/supabase-js";
import { WeekProvider } from "../contexts/WeekContext";
import DynamicNavigation from "../components/DynamicNavigation";
import { supabase } from "../utils/supabaseClient";
import "../styles/globals.css";

// AuthProvider를 브라우저에서만 로드
const AuthProviderNoSSR = dynamic(
  () => import("../contexts/AuthContext").then((m) => m.AuthProvider),
  { ssr: false }
);

function MyApp({ Component, pageProps }: AppProps) {
  const [initialSession, setInitialSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [isClient, setIsClient] = useState(false);

  const initialized = useRef(false);
  const router = useRouter();

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient || !router.isReady || initialized.current) return;
    initialized.current = true;

    const initializeApp = async () => {
      try {
        console.log("🔍 앱 초기화 시작");

        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error("세션 조회 오류:", error);
        } else {
          setInitialSession(session);
        }

        const isAuthenticated = localStorage.getItem("isAuthenticated") === "true";
        const userRole = localStorage.getItem("userRole");
        const currentPath = router.pathname;

        const safeReplace = (to: string) => {
          if (router.asPath !== to) {
            console.log(`🔄 페이지 이동: ${router.asPath} → ${to}`);
            router.replace(to);
          }
        };

        if (
          currentPath !== "/login" &&
          currentPath !== "/auth/first-login" &&
          (!isAuthenticated || !userRole)
        ) {
          console.warn("❌ 인증되지 않은 접근:", currentPath);
          safeReplace("/login");
        }
      } catch (e) {
        console.error("앱 초기화 예외:", e);
      } finally {
        setLoading(false);
        setAuthChecked(true);
        console.log("✅ 앱 초기화 완료");
      }
    };

    initializeApp();
  }, [isClient, router.isReady]);

  useEffect(() => {
    if (!isClient) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event) => {
      console.log("🔄 인증 상태 변경:", event);

      if (event === "SIGNED_OUT") {
        console.log("🚪 로그아웃 감지 - 완전 클리어");

        localStorage.clear();
        sessionStorage.clear();

        initialized.current = false;
        setAuthChecked(false);
        setInitialSession(null);

        if (window.location.pathname !== "/login") {
          window.location.replace("/login");
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [isClient]);

  const excludeNavPages = ["/login", "/register", "/auth/first-login"];
  const showNavigation =
    isClient && !excludeNavPages.includes(router.pathname) && authChecked && !loading;

  if (!isClient || loading || !authChecked) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          flexDirection: "column",
          gap: 16,
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        }}
      >
        <div
          style={{
            width: 50,
            height: 50,
            border: "5px solid rgba(255,255,255,0.3)",
            borderTop: "5px solid white",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
          }}
        />
        <p style={{ color: "white", fontSize: 16, fontWeight: 500, textAlign: "center" }}>
          앱을 준비하는 중...
        </p>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <AuthProviderNoSSR initialSession={initialSession}>
      <WeekProvider>
        {showNavigation && <DynamicNavigation />}

        {/* ✅ 핵심: 네비(고정 70px) 아래로 컨텐츠 밀기
            - body 전역 padding이 아니라 "앱 컨텐츠"에만 적용
            - 스크롤 이중화 다시 안 생김 */}
        <div
          style={{
            paddingTop: showNavigation ? 70 : 0,
          }}
        >
          <Component {...pageProps} />
        </div>
      </WeekProvider>
    </AuthProviderNoSSR>
  );
}

export default MyApp;
