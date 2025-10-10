"use client";
import React, { createContext, useContext, useState } from 'react';

interface WeekContextType {
  currentWeek: Date;
  navigateWeek: (direction: 'prev' | 'next' | number) => void;
}

const WeekContext = createContext<WeekContextType | undefined>(undefined);

export function WeekProvider({ children }: { children: React.ReactNode }) {
  const [currentWeek, setCurrentWeek] = useState(new Date());

  const navigateWeek = (direction: 'prev' | 'next' | number) => {
    let weekDirection: number;
    
    if (direction === 'prev') {
      weekDirection = -1;
    } else if (direction === 'next') {
      weekDirection = 1;
    } else {
      weekDirection = direction;
    }
    
    // 🔥 안전한 날짜 계산
    const currentDate = new Date(currentWeek);
    
    // 현재 날짜가 유효한지 확인
    if (isNaN(currentDate.getTime())) {
      console.warn('⚠️ currentWeek이 유효하지 않음, 현재 날짜로 초기화');
      setCurrentWeek(new Date());
      return;
    }
    
    // 새로운 날짜 계산
    const newWeek = new Date(currentDate);
    newWeek.setDate(currentDate.getDate() + (weekDirection * 7));
    
    // 계산된 날짜가 유효한지 확인
    if (isNaN(newWeek.getTime())) {
      console.error('❌ 새로운 주차 계산 실패, 현재 날짜 유지');
      return;
    }
    
    console.log('📅 주차 이동:', {
      이전: currentDate.toISOString().split('T')[0],
      이후: newWeek.toISOString().split('T')[0],
      방향: weekDirection
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
    throw new Error('useWeek must be used within WeekProvider');
  }
  return context;
}
