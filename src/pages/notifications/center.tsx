// pages/notifications/center.tsx (기존 테이블 활용)
"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

interface PushNotification {
  id: number;
  recipient_id: number;
  title: string;
  message: string;
  notification_type: string;
  schedule_id?: number;
  is_read: boolean;
  sent_at: string;
  sender_id?: number;
  read_at?: string;
}

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState<PushNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  // 기존 push_notifications 테이블에서 알림 로딩
  const loadNotifications = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('push_notifications')
        .select('*')
        .eq('recipient_id', parseInt(user.id)) // recipient_id는 integer이므로 변환
        .order('sent_at', { ascending: false })
        .limit(50);

      if (fetchError) throw fetchError;

      setNotifications(data || []);
    } catch (err: any) {
      console.error('알림 로딩 실패:', err);
      setError('알림을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // 실시간 알림 구독 (기존 테이블)
  useEffect(() => {
    if (!user?.id) return;

    loadNotifications();

    // 실시간 구독 설정
    const channel = supabase
      .channel('push_notifications_channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'push_notifications',
          filter: `recipient_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('실시간 알림 업데이트:', payload);
          
          if (payload.eventType === 'INSERT') {
            setNotifications(prev => [payload.new as PushNotification, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setNotifications(prev => 
              prev.map(n => n.id === payload.new.id ? payload.new as PushNotification : n)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, loadNotifications]);

  // 알림 읽음 처리 (read_at 필드 활용)
  const markAsRead = async (notificationId: number) => {
    try {
      const { error } = await supabase
        .from('push_notifications')
        .update({ 
          is_read: true, 
          read_at: new Date().toISOString() 
        })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? 
          { ...n, is_read: true, read_at: new Date().toISOString() } : n
        )
      );
    } catch (err) {
      console.error('알림 읽음 처리 실패:', err);
    }
  };

  // 모두 읽음 처리
  const markAllAsRead = async () => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('push_notifications')
        .update({ 
          is_read: true, 
          read_at: new Date().toISOString() 
        })
        .eq('recipient_id', parseInt(user.id))
        .eq('is_read', false);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );
    } catch (err) {
      console.error('모두 읽음 처리 실패:', err);
    }
  };

  // 스케줄로 이동 (schedule_id 활용)
  const goToSchedule = (scheduleId?: number) => {
    if (scheduleId) {
      window.location.href = `/schedules/${scheduleId}`;
    }
  };

  // 알림 유형별 색상/아이콘
  const getNotificationStyle = (type: string) => {
    switch (type.toLowerCase()) {
      case 'schedule_assigned':
        return { color: '#3b82f6', icon: '📅' };
      case 'schedule_changed':
        return { color: '#f59e0b', icon: '⚠️' };
      case 'schedule_cancelled':
        return { color: '#ef4444', icon: '❌' };
      case 'system':
        return { color: '#6b7280', icon: '⚙️' };
      default:
        return { color: '#3b82f6', icon: '🔔' };
    }
  };

  if (loading) {
    return (
      <div style={{
        padding: '20px',
        background: 'var(--bg-primary)',
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid var(--accent-color)',
          borderTop: '4px solid transparent',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2 style={{ color: '#ef4444' }}>오류 발생</h2>
        <p>{error}</p>
        <button 
          onClick={() => loadNotifications()}
          style={{
            padding: '12px 24px',
            background: 'var(--accent-color)',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          다시 시도
        </button>
      </div>
    );
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div style={{
      padding: '20px',
      background: 'var(--bg-primary)',
      minHeight: '100vh'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h1 style={{
            fontSize: '24px',
            fontWeight: '600',
            color: 'var(--text-primary)'
          }}>
            알림 센터 
            {unreadCount > 0 && (
              <span style={{ 
                background: '#ef4444', 
                color: 'white', 
                padding: '2px 8px', 
                borderRadius: '12px',
                fontSize: '14px',
                marginLeft: '8px'
              }}>
                {unreadCount}
              </span>
            )}
          </h1>
          
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              style={{
                padding: '8px 16px',
                background: 'var(--accent-color)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              모두 읽음
            </button>
          )}
        </div>
        
        {notifications.length === 0 ? (
          <div style={{
            background: 'var(--bg-secondary)',
            padding: '40px',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔔</div>
            <h2 style={{
              fontSize: '20px',
              fontWeight: '600',
              color: 'var(--text-primary)',
              marginBottom: '12px'
            }}>
              새로운 알림이 없습니다
            </h2>
            <p style={{ 
              color: 'var(--text-secondary)',
              fontSize: '16px'
            }}>
              새로운 알림이 있으면 여기에 표시됩니다.
            </p>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {notifications.map((notification) => {
              const style = getNotificationStyle(notification.notification_type);
              
              return (
                <div
                  key={notification.id}
                  style={{
                    background: notification.is_read ? 'var(--bg-secondary)' : 'rgba(59, 130, 246, 0.05)',
                    border: `1px solid ${notification.is_read ? 'var(--border-color)' : 'rgba(59, 130, 246, 0.2)'}`,
                    borderRadius: '12px',
                    padding: '16px',
                    cursor: notification.schedule_id ? 'pointer' : 'default'
                  }}
                  onClick={() => {
                    if (!notification.is_read) {
                      markAsRead(notification.id);
                    }
                    if (notification.schedule_id) {
                      goToSchedule(notification.schedule_id);
                    }
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '8px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '16px' }}>{style.icon}</span>
                      <h3 style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        color: 'var(--text-primary)',
                        margin: 0
                      }}>
                        {notification.title}
                      </h3>
                      {!notification.is_read && (
                        <span style={{
                          fontSize: '12px',
                          background: '#ef4444',
                          color: 'white',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}>
                          NEW
                        </span>
                      )}
                    </div>
                    
                    {!notification.is_read && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(notification.id);
                        }}
                        style={{
                          padding: '4px 8px',
                          fontSize: '12px',
                          background: 'transparent',
                          border: '1px solid var(--border-color)',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          color: 'var(--text-secondary)'
                        }}
                      >
                        읽음
                      </button>
                    )}
                  </div>
                  
                  <p style={{
                    color: 'var(--text-secondary)',
                    fontSize: '14px',
                    margin: '0 0 8px 24px'
                  }}>
                    {notification.message}
                  </p>
                  
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    marginLeft: '24px'
                  }}>
                    <span>
                      {new Date(notification.sent_at).toLocaleString('ko-KR')}
                    </span>
                    {notification.schedule_id && (
                      <span style={{ 
                        background: 'var(--accent-color)', 
                        color: 'white', 
                        padding: '2px 6px', 
                        borderRadius: '4px' 
                      }}>
                        스케줄 #{notification.schedule_id}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
