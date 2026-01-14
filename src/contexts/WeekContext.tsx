"use client";
import React, { createContext, useContext, useEffect, useState } from "react";

interface WeekContextType {
  currentWeek: Date;
  navigateWeek: (direction: "prev" | "next" | number) => void;
}

const WeekContext = createContext<WeekContextType | undefined>(undefined);

const STORAGE_KEY = "currentWeek";

/** ✅ localStorage 값(YYYY-MM-DD)을 Date로 안전하게 변환 */
const parseStoredWeek = (value: string | null): Date | null => {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
};

/** ✅ Date -> YYYY-MM-DD */
const toYMD = (date: Date) => date.toISOString().split("T")[0];

export function WeekProvider({ children }: { children: React.ReactNode }) {
  // ✅ Date 타입으로 유지 (중요)
  const [currentWeek, setCurrentWeek] = useState<Date>(() => {
    // SSR 안전 처리
    if (typeof window === "undefined") return new Date();

    const saved = parseStoredWeek(localStorage.getItem(STORAGE_KEY));
    if (saved) return saved;

    // 저장값 없으면 오늘로 초기화 + 저장
    const today = new Date();
    localStorage.setItem(STORAGE_KEY, toYMD(today));
    return today;
  });

  // ✅ currentWeek가 바뀔 때마다 저장 (새로고침해도 유지)
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, toYMD(currentWeek));
  }, [currentWeek]);

  const navigateWeek = (direction: "prev" | "next" | number) => {
    const weekDirection =
      direction === "prev" ? -1 : direction === "next" ? 1 : direction;

    // 🔥 안전한 날짜 계산
    const currentDate = new Date(currentWeek);

    if (isNaN(currentDate.getTime())) {
      console.warn("⚠️ currentWeek이 유효하지 않음, 오늘로 초기화");
      setCurrentWeek(new Date());
      return;
    }

    const newWeek = new Date(currentDate);
    newWeek.setDate(currentDate.getDate() + weekDirection * 7);

    if (isNaN(newWeek.getTime())) {
      console.error("❌ 새로운 주차 계산 실패, 현재 날짜 유지");
      return;
    }

    console.log("📅 주차 이동:", {
      이전: toYMD(currentDate),
      이후: toYMD(newWeek),
      방향: weekDirection,
    });

    setCurrentWeek(newWeek);
  };

  return (
    <WeekContext.Provider value={{ currentWeek, navigateWeek }}>
      {children}
    </WeekContext.Provider>
  );
}

export function useWeek() {
  const context = useContext(WeekContext);
  if (!context) {
    throw new Error("useWeek must be used within WeekProvider");
  }
  return context;
}
