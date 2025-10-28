// components/dashboard/EventCard.tsx
import React from 'react';

interface TodayTask {
  id: number;
  schedule_type: string;
  content: string;
  shadow_color: string;
}

interface EventCardProps {
  events: TodayTask[];
}

const EventCard: React.FC<EventCardProps> = ({ events }) => {
  return (
    <div className="stats-card today-tasks">
      <div className="card-header">
        <h3>오늘의 업무</h3>
      </div>
      <div className="tasks-content">
        {events && events.length > 0 ? (
          events.map((task) => (
            <div 
              key={task.id} 
              className="task-item"
              style={{ borderLeft: `4px solid ${task.shadow_color}` }}
            >
              <span className="task-type">[{task.schedule_type}]</span>
              <span className="task-content">{task.content}</span>
            </div>
          ))
        ) : (
          <p className="no-tasks">등록된 업무가 없습니다</p>
        )}
      </div>
    </div>
  );
};

export default EventCard;
