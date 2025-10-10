"use client";
import { useEffect, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { isHoliday } from "../utils/holidays";

export default function StudioScheduleManager() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [currentWeek, setCurrentWeek] = useState(new Date());

  useEffect(() => {
    fetchData();
  }, [currentWeek]);

  const fetchData = async () => {
    await Promise.all([fetchSchedules(), fetchLocations()]);
  };

  const fetchSchedules = async () => {
    const { data } = await supabase
      .from('schedules')
      .select('*')
      .eq('schedule_type', 'studio')
      .eq('is_active', true);
    setSchedules(data || []);
  };

  const fetchLocations = async () => {
    const { data } = await supabase
      .from('sub_locations')
      .select('*, main_locations(name)')
      .eq('is_active', true);
    
    if (data) {
      const studioLocations = data.filter(location => {
        const locationName = location.name?.toLowerCase() || '';
        const mainLocationName = location.main_locations?.name?.toLowerCase() || '';
        return locationName.includes('스튜디오') || mainLocationName.includes('스튜디오');
      });
      setLocations(studioLocations);
    }
  };

  return (
    <div style={{ padding: 20, textAlign: 'center' }}>
      <h2>스튜디오 스케줄 관리</h2>
      <p>스튜디오 스케줄 관리 기능이 곧 추가됩니다.</p>
      <div style={{ marginTop: 20 }}>
        <p>현재 스튜디오 스케줄: {schedules.length}개</p>
        <p>사용 가능한 스튜디오: {locations.length}개</p>
      </div>
    </div>
  );
}
