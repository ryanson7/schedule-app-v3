"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useRouter } from 'next/router';

const internalLocationTypes = [
  { id: 1, name: 'Helper' },
  { id: 2, name: '행사' },
  { id: 3, name: '기타' },
  { id: 4, name: '장비/스튜디오대여' },
  { id: 5, name: '당직' },
  { id: 6, name: '근무' },
  { id: 7, name: '고정휴무' },
  { id: 8, name: '개인휴무' }
];

const TodayInternalTasksWidget = () => {
  const [todayTasks, setTodayTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchTodayInternalTasks();
  }, []);

  const fetchTodayInternalTasks = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const locationNames = internalLocationTypes.map(loc => loc.name);

      const { data, error } = await supabase
        .from('internal_schedules')
        .select('id, schedule_date, schedule_type, content, shadow_color, created_at')
        .in('schedule_type', locationNames)
        .eq('is_active', true)
        .eq('schedule_date', today)
        .order('created_at');
      
      if (error) {
        console.error('내부업무 조회 실패:', error);
        setTodayTasks([]);
      } else {
        setTodayTasks(data || []);
      }
    } catch (error) {
      console.error('내부업무 조회 오류:', error);
      setTodayTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const getTaskTypeIcon = (type) => {
    const iconMap = {
      'Helper': '🤝',
      '행사': '🎉',
      '기타': '📋',
      '장비/스튜디오대여': '📷',
      '당직': '🔒',
      '근무': '💼',
      '고정휴무': '🚫',
      '개인휴무': '🏖️'
    };
    return iconMap[type] || '📋';
  };

  const getTasksByType = () => {
    const grouped = {};
    todayTasks.forEach(task => {
      if (!grouped[task.schedule_type]) {
        grouped[task.schedule_type] = [];
      }
      grouped[task.schedule_type].push(task);
    });
    return grouped;
  };

  const getContrastColor = (hexColor) => {
    if (!hexColor || hexColor === 'transparent' || hexColor === 'null') {
      return 'var(--text-primary)';
    }
    const hex = hexColor.replace('#', '');
    if (hex.length !== 6) return 'var(--text-primary)';
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 140 ? '#1F2937' : '#FFFFFF';
  };

  if (loading) {
    return (
      <div className="internal-tasks-widget loading">
        <div className="widget-header">
          <h4>📋 오늘의 내부업무</h4>
        </div>
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <span>로딩 중...</span>
        </div>
      </div>
    );
  }

  const tasksByType = getTasksByType();
  const totalTasks = todayTasks.length;

  return (
    <div className="internal-tasks-widget">
      <div className="widget-header">
        <h4>📋 오늘의 내부업무</h4>
        <button 
          className="btn-link"
          onClick={() => router.push('/internal-schedules')}
        >
          전체보기 →
        </button>
      </div>

      <div className="widget-content">
        {totalTasks === 0 ? (
          <div className="no-tasks">
            <div className="no-tasks-icon">📅</div>
            <p>오늘 예정된 내부업무가 없습니다.</p>
          </div>
        ) : (
          <>
            {/* 요약 통계 */}
            <div className="task-summary">
              <div className="summary-item">
                <span className="summary-number">{totalTasks}</span>
                <span className="summary-label">총 업무</span>
              </div>
              <div className="summary-item">
                <span className="summary-number">{Object.keys(tasksByType).length}</span>
                <span className="summary-label">업무 유형</span>
              </div>
            </div>

            {/* 업무 유형별 목록 */}
            <div className="tasks-by-type">
              {Object.entries(tasksByType).map(([type, tasks]) => (
                <div key={type} className="task-type-group">
                  <div className="task-type-header">
                    <span className="type-icon">{getTaskTypeIcon(type)}</span>
                    <span className="type-name">{type}</span>
                    <span className="type-count">{tasks.length}</span>
                  </div>
                  
                  <div className="task-items">
                    {tasks.slice(0, 2).map(task => ( // 최대 2개만 표시
                      <div 
                        key={task.id} 
                        className="task-item-mini"
                        style={{
                          backgroundColor: task.shadow_color || 'var(--bg-secondary)',
                          color: getContrastColor(task.shadow_color),
                          border: task.shadow_color ? `1px solid ${task.shadow_color}` : '1px solid var(--border-color)'
                        }}
                      >
                        <div className="task-content">
                          {task.content || '내용 없음'}
                        </div>
                      </div>
                    ))}
                    
                    {tasks.length > 2 && (
                      <div className="more-tasks">
                        +{tasks.length - 2}개 더
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TodayInternalTasksWidget;
