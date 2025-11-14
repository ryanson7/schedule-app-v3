// components/admin/AttendanceSection.tsx
import React from 'react';
import { LocationAttendance } from './types';

interface AttendanceSectionProps {
  attendance: LocationAttendance[];
  dayOff: string[];
  formattedDate: string;
  onDateChange: (direction: 'prev' | 'next' | 'today') => void;
}

export default function AttendanceSection({
  attendance,
  dayOff,
  formattedDate,
  onDateChange
}: AttendanceSectionProps) {
  const locations = [
    '제작센터',
    '노량진(1관) 학원',
    '노량진(3관) 학원',
    '수원학원',
    '노원학원',
    '부평학원',
    '신촌학원',
    '강남학원',
    '서면학원'
  ];

  return (
    <div className="panel attendance-panel">
      <div className="panel-header">
        <h3>📍 {formattedDate} 직원 촬영 및 근태 현황</h3>
        <div className="date-navigation">
          <button className="date-nav-btn" onClick={() => onDateChange('prev')}>
            ◀
          </button>
          <button className="date-nav-btn today" onClick={() => onDateChange('today')}>
            오늘
          </button>
          <button className="date-nav-btn" onClick={() => onDateChange('next')}>
            ▶
          </button>
        </div>
      </div>
      
      <div className="attendance-content">
        <div className="attendance-list">
          {locations.map((locationName, index) => {
            const locationData = attendance.find(loc => loc.locationName === locationName);
            const people = locationData?.people || [];
            
            return (
              <div key={index} className="attendance-row">
                <span className="location-number">{String(index + 1).padStart(2, '0')})</span>
                <span className="location-name">{locationName}</span>
                <span className="location-staff">
                  {people.length === 0 ? (
                    <span className="no-staff">없음</span>
                  ) : (
                    people.map((person, idx) => (
                      <React.Fragment key={idx}>
                        {person.name === '위탁직' ? (
                          <span className="outsourced-tag">{person.name}</span>
                        ) : (
                          <>
                            {person.name}
                            {person.notes && (
                              <span className="staff-note"> ({person.notes})</span>
                            )}
                          </>
                        )}
                        {idx < people.length - 1 && ', '}
                      </React.Fragment>
                    ))
                  )}
                </span>
              </div>
            );
          })}
          
          {/* 10) 휴무자 */}
          <div className="attendance-row">
            <span className="location-number">10)</span>
            <span className="location-name">휴무자</span>
            <span className="location-staff">
              {dayOff.length === 0 ? (
                <span className="no-staff">없음</span>
              ) : (
                dayOff.join(', ')
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
