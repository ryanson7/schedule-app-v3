// components/dashboard/AttendanceCard.tsx
import React from 'react';

interface AttendanceInfo {
  name: string;
  notes?: string;
}

interface LocationAttendance {
  locationName: string;
  displayOrder: number;
  people: AttendanceInfo[];
}

interface AttendanceCardProps {
  attendance: LocationAttendance[];
}

const AttendanceCard: React.FC<AttendanceCardProps> = ({ attendance }) => {
  const defaultLocations = [
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
    <div className="stats-card attendance-card">
      <div className="card-header">
        <h3>근태 현황</h3>
      </div>
      <div className="attendance-content">
        {defaultLocations.map((locationName, index) => {
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
                            <span className="staff-note">({person.notes})</span>
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
      </div>
    </div>
  );
};

export default AttendanceCard;
