// components/admin/EventSection.tsx
import React from 'react';
import { TodayTask } from './types';

interface EventSectionProps {
  events: TodayTask[];
}

export default function EventSection({ events }: EventSectionProps) {
  return (
    <div className="panel">
      <div className="panel-header">
        <h3>📅 오늘의 업무</h3>
      </div>
      {events.length === 0 ? (
        <div className="empty-state small">
          <p>등록된 업무가 없습니다</p>
        </div>
      ) : (
        <div className="task-list compact">
          {events.map(task => (
            <div key={task.id} className="task-item">
              <div 
                className="task-dot"
                style={{ backgroundColor: task.shadow_color }}
              />
              <div className="task-info">
                <span className="task-type">[{task.schedule_type}]</span>
                <span className="task-content">{task.content}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
