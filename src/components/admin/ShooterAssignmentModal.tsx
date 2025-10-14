"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { Schedule, Shooter, ShootingType } from '../../types/shooter';

interface ShooterAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: Schedule | null;
  onAssignmentComplete: (scheduleId: number, shooterId: number) => void;
}

interface ShooterWithAvailability extends Shooter {
  is_available: boolean;
  conflict_reason?: string;
  distance_score?: number;
  specialty_match?: boolean;
  current_workload?: number;
  recommendation_score?: number;
  availability_score?: number;
  work_type_bonus?: number;
  work_type_match?: boolean;
  shooter_type?: string;
}

export default function ShooterAssignmentModal({
  isOpen,
  onClose,
  schedule,
  onAssignmentComplete
}: ShooterAssignmentModalProps) {
  const [availableShooters, setAvailableShooters] = useState<ShooterWithAvailability[]>([]);
  const [selectedShooter, setSelectedShooter] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignmentNotes, setAssignmentNotes] = useState('');
  const [filterCriteria, setFilterCriteria] = useState({
    showOnlyAvailable: true,
    sortBy: 'recommendation' as 'recommendation' | 'specialty' | 'workload' | 'availability'
  });

  useEffect(() => {
    if (isOpen && schedule) {
      loadAvailableShooters();
    }
  }, [isOpen, schedule, filterCriteria]);

  const getWeekStart = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // 월요일을 주 시작으로
    d.setDate(diff);
    return d;
  };

  const checkShooterAvailability = async (
    shooter: Shooter, 
    schedule: Schedule
  ): Promise<{ 
    is_available: boolean; 
    conflict_reason?: string; 
    availability_score?: number;
    work_type_match?: boolean;
  }> => {
    try {
      // 1. 촬영자 유형별 기본 가용성 확인
      const { data: shooterInfo } = await supabase
        .from('users')
        .select('shooter_type, work_schedule_type')
        .eq('id', shooter.id)
        .single();

      // 2. 해당 주의 근무 가능 시간 확인
      const scheduleDate = new Date(schedule.shoot_date);
      const weekStart = getWeekStart(scheduleDate);
      const dayOfWeek = scheduleDate.getDay() === 0 ? 6 : scheduleDate.getDay() - 1; // 월요일=0

      const { data: weeklyAvailability, error: availError } = await supabase
        .from('shooter_weekly_availability')
        .select('*')
        .eq('shooter_id', shooter.id)
        .eq('week_start_date', weekStart.toISOString().split('T')[0])
        .eq('day_of_week', dayOfWeek)
        .eq('is_available', true);

      if (availError || !weeklyAvailability || weeklyAvailability.length === 0) {
        return { 
          is_available: false, 
          conflict_reason: '해당 요일에 근무 등록 안됨',
          availability_score: 0,
          work_type_match: false
        };
      }

      // 3. 시간대 매칭 확인
      const scheduleStart = new Date(`2000-01-01T${schedule.start_time}`);
      const scheduleEnd = new Date(`2000-01-01T${schedule.end_time}`);
      
      let timeMatch = false;
      let bestTimeScore = 0;

      for (const avail of weeklyAvailability) {
        const availStart = new Date(`2000-01-01T${avail.start_time}`);
        const availEnd = new Date(`2000-01-01T${avail.end_time}`);

        // 완전히 포함되는지 확인
        if (scheduleStart >= availStart && scheduleEnd <= availEnd) {
          timeMatch = true;
          
          // 여유 시간 계산 (앞뒤 버퍼 시간)
          const frontBuffer = (scheduleStart.getTime() - availStart.getTime()) / (1000 * 60);
          const backBuffer = (availEnd.getTime() - scheduleEnd.getTime()) / (1000 * 60);
          const totalBuffer = frontBuffer + backBuffer;
          
          // 버퍼 시간이 많을수록 높은 점수 (최대 30점)
          bestTimeScore = Math.max(bestTimeScore, Math.min(30, totalBuffer / 2));
        }
      }

      if (!timeMatch) {
        return { 
          is_available: false, 
          conflict_reason: '근무 가능 시간과 불일치',
          availability_score: 0,
          work_type_match: false
        };
      }

      // 4. 장소 선호도 확인
      const { data: locationPref } = await supabase
        .from('shooter_location_preferences')
        .select('*')
        .eq('shooter_id', shooter.id)
        .eq('main_location_id', schedule.main_location_id || 1)
        .single();

      let locationScore = 0;
      let locationAvailable = true;

      if (locationPref) {
        if (locationPref.is_preferred) {
          locationScore = 25; // 선호 장소
        } else {
          locationAvailable = false;
        }
      } else {
      // ✅ main_location_id가 없으면 기본 점수 부여
      locationScore = 15;
      locationAvailable = true;
      console.log('ℹ️ main_location_id 없음 - 기본 점수 부여');
    }

      if (!locationAvailable) {
        return { 
          is_available: false, 
          conflict_reason: '근무 불가능 장소',
          availability_score: 0,
          work_type_match: false
        };
      }

      // 5. 기존 스케줄 충돌 확인
      const { data: conflicts } = await supabase
        .from('schedules')
        .select('id, start_time, end_time, course_name')
        .eq('assigned_shooter_id', shooter.id)
        .eq('shoot_date', schedule.shoot_date)
        .eq('is_active', true)
        .neq('approval_status', 'cancelled');

      for (const conflict of conflicts || []) {
        const conflictStart = new Date(`2000-01-01T${conflict.start_time}`);
        const conflictEnd = new Date(`2000-01-01T${conflict.end_time}`);

        if (scheduleStart < conflictEnd && scheduleEnd > conflictStart) {
          return {
            is_available: false,
            conflict_reason: `${conflict.start_time}-${conflict.end_time} ${conflict.course_name}와 충돌`,
            availability_score: 0,
            work_type_match: false
          };
        }
      }

      // 6. 촬영자 유형별 추가 점수
      let workTypeScore = 0;
      let workTypeMatch = false;

      if (shooterInfo) {
        switch (shooterInfo.shooter_type) {
          case 'employee': // 직원(관리자)
            workTypeScore = 15; // 안정성 높음
            workTypeMatch = true;
            break;
          case 'dispatch': // 파견직
            workTypeScore = 10; // 기본 근로시간 준수
            workTypeMatch = true;
            break;
          case 'freelance': // 위탁직
            workTypeScore = 5; // 유연하지만 변동성 있음
            workTypeMatch = true;
            break;
          default:
            workTypeScore = 0;
        }
      }

      // 7. 최종 가용성 점수 계산
      const totalScore = bestTimeScore + locationScore + workTypeScore;

      return { 
        is_available: true, 
        availability_score: totalScore,
        work_type_match: workTypeMatch
      };

    } catch (error) {
      console.error('가용성 확인 오류:', error);
      return { 
        is_available: false, 
        conflict_reason: '시스템 오류', 
        availability_score: 0,
        work_type_match: false
      };
    }
  };

  const calculateRecommendationScore = async (
    shooter: Shooter,
    schedule: Schedule
  ): Promise<{
    distance_score: number;
    specialty_match: boolean;
    current_workload: number;
    recommendation_score: number;
    availability_score: number;
    work_type_bonus: number;
  }> => {
    try {
      let score = 0;
      
      // 1. 가용성 점수 (40점) - 가장 중요
      const availability = await checkShooterAvailability(shooter, schedule);
      const availabilityScore = availability.availability_score || 0;
      score += availabilityScore;

      // 2. 전문 분야 매칭 (25점)
      const specialtyMatch = shooter.specialties?.includes(schedule.shooting_type) || 
                            shooter.preferred_shooting_type === schedule.shooting_type;
      if (specialtyMatch) score += 25;

      // 3. 현재 업무량 (20점)
      const { count: currentWorkload } = await supabase
        .from('schedules')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_shooter_id', shooter.id)
        .eq('shoot_date', schedule.shoot_date)
        .eq('is_active', true);

      const workloadScore = Math.max(0, 20 - (currentWorkload || 0) * 5);
      score += workloadScore;

      // 4. 촬영자 유형별 보너스 (10점)
      const { data: shooterInfo } = await supabase
        .from('users')
        .select('shooter_type')
        .eq('id', shooter.id)
        .single();

      let workTypeBonus = 0;
      if (shooterInfo) {
        switch (shooterInfo.shooter_type) {
          case 'employee': workTypeBonus = 10; break;
          case 'dispatch': workTypeBonus = 7; break;
          case 'freelance': workTypeBonus = 5; break;
        }
      }
      score += workTypeBonus;

      // 5. 평점 (5점)
      const ratingScore = (shooter.rating || 5) * 1;
      score += ratingScore;

      return {
        distance_score: 0, // 현재는 미사용
        specialty_match: specialtyMatch,
        current_workload: currentWorkload || 0,
        recommendation_score: Math.min(100, score), // 최대 100점
        availability_score: availabilityScore,
        work_type_bonus: workTypeBonus
      };

    } catch (error) {
      console.error('추천 점수 계산 오류:', error);
      return {
        distance_score: 0,
        specialty_match: false,
        current_workload: 0,
        recommendation_score: 0,
        availability_score: 0,
        work_type_bonus: 0
      };
    }
  };

  const loadAvailableShooters = async () => {
    if (!schedule) return;

    setIsLoading(true);
    try {
      // 모든 활성 shooter 조회
      const { data: shooters, error: shootersError } = await supabase
        .from('users')
        .select('*, shooter_type, work_schedule_type')
        .eq('role', 'shooter')
        .eq('deleted_at', null)
        .order('name');

      if (shootersError) {
        console.error('Shooter 조회 오류:', shootersError);
        return;
      }

      // 각 shooter의 가용성 및 추천 점수 계산
      const shootersWithAvailability = await Promise.all(
        (shooters || []).map(async (shooter) => {
          const availability = await checkShooterAvailability(shooter, schedule);
          const recommendation = await calculateRecommendationScore(shooter, schedule);
          
          return {
            ...shooter,
            ...availability,
            ...recommendation
          };
        })
      );

      // 필터링 및 정렬
      let filteredShooters = shootersWithAvailability;
      
      if (filterCriteria.showOnlyAvailable) {
        filteredShooters = filteredShooters.filter(s => s.is_available);
      }

      // 정렬
      filteredShooters.sort((a, b) => {
        switch (filterCriteria.sortBy) {
          case 'recommendation':
            return (b.recommendation_score || 0) - (a.recommendation_score || 0);
          case 'specialty':
            return (b.specialty_match ? 1 : 0) - (a.specialty_match ? 1 : 0);
          case 'workload':
            return (a.current_workload || 0) - (b.current_workload || 0);
          case 'availability':
            return (b.availability_score || 0) - (a.availability_score || 0);
          default:
            return 0;
        }
      });

      setAvailableShooters(filteredShooters);

    } catch (error) {
      console.error('가용 shooter 조회 오류:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const assignShooter = async () => {
    if (!schedule || !selectedShooter) return;

    setIsAssigning(true);
    try {
      // 스케줄에 shooter 배정
      const { error: updateError } = await supabase
        .from('schedules')
        .update({
          assigned_shooter_id: selectedShooter,
          shooter_assigned_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', schedule.id);

      if (updateError) {
        throw updateError;
      }

      // 배정 완료 알림 발송
      await sendAssignmentNotification(schedule.id, selectedShooter);

      // 성공 처리
      onAssignmentComplete(schedule.id, selectedShooter);
      onClose();
      setSelectedShooter(null);
      setAssignmentNotes('');

    } catch (error) {
      console.error('Shooter 배정 오류:', error);
      alert('Shooter 배정 중 오류가 발생했습니다.');
    } finally {
      setIsAssigning(false);
    }
  };

  const sendAssignmentNotification = async (scheduleId: number, shooterId: number) => {
    try {
      await fetch('/api/notifications/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_ids: [shooterId],
          sender_id: 1, // 관리자 ID
          schedule_id: scheduleId,
          notification_type: 'shooter_assignment',
          title: '새로운 촬영 스케줄 배정',
          message: `새로운 촬영 스케줄이 배정되었습니다. 스케줄을 확인해주세요.`,
          priority: 'high'
        })
      });
    } catch (error) {
      console.error('배정 알림 발송 오류:', error);
    }
  };

  const getRecommendationBadge = (score: number): { color: string; text: string } => {
    if (score >= 80) return { color: '#10b981', text: '최적' };
    if (score >= 60) return { color: '#3b82f6', text: '적합' };
    if (score >= 40) return { color: '#f59e0b', text: '보통' };
    return { color: '#ef4444', text: '부적합' };
  };

  const getShooterTypeText = (type: string): string => {
    const types = {
      'employee': '직원',
      'dispatch': '파견직',
      'freelance': '위탁직'
    };
    return types[type as keyof typeof types] || '미분류';
  };

  if (!isOpen || !schedule) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        maxWidth: '800px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        {/* 헤더 */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid #e2e8f0',
          background: '#f8fafc'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '12px'
          }}>
            <div>
              <h2 style={{
                margin: '0 0 8px 0',
                fontSize: '20px',
                fontWeight: '600',
                color: '#1e293b'
              }}>
                Shooter 배정 (가용성 기반)
              </h2>
              <div style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#3b82f6',
                marginBottom: '4px'
              }}>
                {schedule.course_name}
              </div>
              <div style={{ fontSize: '14px', color: '#64748b' }}>
                {schedule.shoot_date} • {schedule.start_time.substring(0, 5)} - {schedule.end_time.substring(0, 5)} 
              </div>
            </div>
            
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '24px',
                color: '#64748b',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              ×
            </button>
          </div>

          {/* 필터 옵션 */}
          <div style={{
            display: 'flex',
            gap: '16px',
            alignItems: 'center'
          }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '14px'
            }}>
              <input
                type="checkbox"
                checked={filterCriteria.showOnlyAvailable}
                onChange={(e) => setFilterCriteria(prev => ({
                  ...prev,
                  showOnlyAvailable: e.target.checked
                }))}
              />
              가능한 Shooter만 표시
            </label>

            <select
              value={filterCriteria.sortBy}
              onChange={(e) => setFilterCriteria(prev => ({
                ...prev,
                sortBy: e.target.value as any
              }))}
              style={{
                padding: '6px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            >
              <option value="recommendation">추천 순</option>
              <option value="availability">가용성 순</option>
              <option value="specialty">전문성 순</option>
              <option value="workload">업무량 순</option>
            </select>

            <button
              onClick={loadAvailableShooters}
              disabled={isLoading}
              style={{
                padding: '6px 12px',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              {isLoading ? '조회 중...' : '새로고침'}
            </button>
          </div>
        </div>

        {/* Shooter 목록 */}
        <div style={{
          padding: '24px',
          maxHeight: '400px',
          overflowY: 'auto'
        }}>
          {isLoading ? (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: '#64748b'
            }}>
              가능한 Shooter를 조회하는 중...
            </div>
          ) : availableShooters.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: '#64748b'
            }}>
              조건에 맞는 Shooter가 없습니다.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {availableShooters.map((shooter) => {
                const badge = getRecommendationBadge(shooter.recommendation_score || 0);
                
                return (
                  <div
                    key={shooter.id}
                    onClick={() => setSelectedShooter(shooter.id)}
                    style={{
                      padding: '16px',
                      border: selectedShooter === shooter.id ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background: selectedShooter === shooter.id ? '#f0f9ff' : 'white',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '8px'
                    }}>
                      <div>
                        <div style={{
                          fontSize: '16px',
                          fontWeight: '600',
                          color: '#1e293b',
                          marginBottom: '4px'
                        }}>
                          {shooter.name}
                        </div>
                        <div style={{
                          fontSize: '13px',
                          color: '#64748b'
                        }}>
                          {shooter.email}
                        </div>
                      </div>

                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <div style={{
                          background: badge.color,
                          color: 'white',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '600'
                        }}>
                          {badge.text} ({shooter.recommendation_score}점)
                        </div>

                        {!shooter.is_available && (
                          <div style={{
                            background: '#ef4444',
                            color: 'white',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: '600'
                          }}>
                            불가능
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                      gap: '8px',
                      fontSize: '12px',
                      color: '#64748b'
                    }}>
                      <div>
                        전문분야: {shooter.specialty_match ? '✅ 일치' : '❌ 불일치'}
                      </div>
                      <div>
                        당일 업무: {shooter.current_workload}건
                      </div>
                      <div>
                        가용성: {shooter.availability_score}점
                      </div>
                      <div>
                        유형: {getShooterTypeText(shooter.shooter_type)}
                      </div>
                    </div>

                    {!shooter.is_available && shooter.conflict_reason && (
                      <div style={{
                        marginTop: '8px',
                        padding: '8px',
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: '#dc2626'
                      }}>
                        충돌: {shooter.conflict_reason}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 메모 및 액션 */}
        <div style={{
          padding: '24px',
          borderTop: '1px solid #e2e8f0',
          background: '#f8fafc'
        }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151'
            }}>
              배정 메모 (선택사항)
            </label>
            <textarea
              value={assignmentNotes}
              onChange={(e) => setAssignmentNotes(e.target.value)}
              placeholder="배정 사유나 특별 지시사항을 입력하세요..."
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                minHeight: '80px',
                resize: 'vertical',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px'
          }}>
            <button
              onClick={onClose}
              disabled={isAssigning}
              style={{
                padding: '10px 20px',
                background: '#f3f4f6',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: isAssigning ? 'not-allowed' : 'pointer'
              }}
            >
              취소
            </button>
            
            <button
              onClick={assignShooter}
              disabled={!selectedShooter || isAssigning}
              style={{
                padding: '10px 20px',
                background: selectedShooter && !isAssigning ? '#10b981' : '#9ca3af',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: selectedShooter && !isAssigning ? 'pointer' : 'not-allowed'
              }}
            >
              {isAssigning ? '배정 중...' : 'Shooter 배정'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
