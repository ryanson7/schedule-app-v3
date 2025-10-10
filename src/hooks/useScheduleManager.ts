import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';

export const useScheduleManager = (scheduleType: string = 'academy') => {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRoles, setUserRoles] = useState<string[]>([]);

  const fetchSchedules = async () => {
    const { data } = await supabase
      .from('schedules')
      .select('*')
      .eq('schedule_type', scheduleType)
      .eq('is_active', true)
      .order('shoot_date')
      .order('start_time');
    setSchedules(data || []);
  };

  const fetchLocations = async () => {
    const { data } = await supabase
      .from('sub_locations')
      .select('*, main_locations(name)')
      .eq('is_active', true);
    
    if (data) {
      let filteredLocations = data;
      
      if (scheduleType === 'academy') {
        filteredLocations = data.filter(location => {
          const locationName = location.name?.toLowerCase() || '';
          const mainLocationName = location.main_locations?.name?.toLowerCase() || '';
          return !locationName.includes('스튜디오') && !mainLocationName.includes('스튜디오');
        });
      } else if (scheduleType === 'studio') {
        filteredLocations = data.filter(location => {
          const locationName = location.name?.toLowerCase() || '';
          const mainLocationName = location.main_locations?.name?.toLowerCase() || '';
          return locationName.includes('스튜디오') || mainLocationName.includes('스튜디오');
        });
      }
      
      setLocations(filteredLocations);
    }
  };

  const getUserRoles = async () => {
    const userRole = localStorage.getItem('userRole');
    if (userRole) {
      setUserRoles([userRole]);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: userRow } = await supabase
        .from('users')
        .select('id')
        .eq('email', user.email)
        .single();
      if (userRow) {
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role_id, roles(name)')
          .eq('user_id', userRow.id);
        setUserRoles(roles?.map((r: any) => r.roles.name) || []);
      }
    }
  };

  const recordHistory = async (scheduleId: number, changeType: string, oldValue: string, newValue: string, description?: string) => {
    await supabase.from('schedule_history').insert([{
      schedule_id: scheduleId,
      changed_by: 1, // 실제 사용자 ID로 변경 필요
      change_type: changeType,
      old_value: oldValue,
      new_value: newValue,
      description: description
    }]);
  };

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchSchedules(), fetchLocations(), getUserRoles()]);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [scheduleType]);

  return {
    schedules,
    locations,
    loading,
    userRoles,
    fetchSchedules,
    fetchLocations,
    recordHistory,
    refetch: fetchData
  };
};
