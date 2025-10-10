import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';

export function useAcademySchedules(currentWeek: Date) {
  const [locations, setLocations] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [locRes, schRes] = await Promise.all([
        supabase.from('sub_locations')
                .select('id,name,main_location_id,main_locations(id,name)')
                .eq('is_active', true)
                .eq('main_locations.location_type', 'academy'),
        supabase.from('schedules')
                .select('*,sub_locations(id,main_location_id)')
                .eq('schedule_type', 'academy')
                .eq('is_active', true)
                .gte('shoot_date', weekStart(currentWeek))
                .lte('shoot_date', weekEnd(currentWeek))
      ]);
      setLocations(locRes.data || []);
      setSchedules(schRes.data  || []);
      setLoading(false);
    })();
  }, [currentWeek]);

  return { locations, schedules, loading };
}

const weekStart = (d: Date) => {
  const s = new Date(d); s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
  return s.toISOString().slice(0, 10);
};
const weekEnd = (d: Date) => {
  const e = new Date(d); e.setDate(e.getDate() + (6 - ((e.getDay() + 6) % 7)));
  return e.toISOString().slice(0, 10);
};
