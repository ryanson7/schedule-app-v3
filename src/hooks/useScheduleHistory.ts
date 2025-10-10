import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabaseClient';

export interface HistoryRow {
  id: number;
  schedule_id: number;
  changed_at: string;
  change_type: string;
  description: string | null;
  users?: { display_name: string };
}

export function useScheduleHistory(scheduleId: number) {
  const [logs, setLogs] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!scheduleId) return;

    supabase
      .from('schedule_history')
      .select(
        `id, schedule_id, changed_at, change_type, description,
         users:changed_by ( display_name )`
      )
      .eq('schedule_id', scheduleId)
      .order('changed_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error) setLogs(data as HistoryRow[]);
        setLoading(false);
      });
  }, [scheduleId]);

  return { logs, loading };
}
