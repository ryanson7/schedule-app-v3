"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { Notification, NotificationType } from '../../types/shooter';

interface NotificationCenterProps {
  userId: number;
  userRole: string;
  maxNotifications?: number;
  autoMarkRead?: boolean;
  showUnreadOnly?: boolean;
}

interface NotificationWithSender extends Notification {
  sender_name?: string;
  schedule_course_name?: string;
  time_ago?: string;
}

export default function NotificationCenter({
  userId,
  userRole,
  maxNotifications = 50,
  autoMarkRead = false,
  showUnreadOnly = false
}: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<NotificationWithSender[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | NotificationType>('all');
  const [selectedNotifications, setSelectedNotifications] = useState<number[]>([]);

  useEffect(() => {
    loadNotifications();
    
    // 실시간 알림 구독
    const subscription = supabase
      .channel('notifications')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'push_notifications',
          filter: `user_id=eq.${userId}`
        }, 
        (payload) => {
          console.log('새 알림 수신:', payload);
          loadNotifications();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [userId, filter, typeFilter]);

  const loadNotifications = async () => {
    try {
      let query = supabase
        .from('push_notifications')
        .select(`
          *,
          sender:users!sender_id(name),
          schedule:schedules!related_schedule_id(course_name, professor_name)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(maxNotifications);

      // 필터 적용
      if (filter === 'unread') {
        query = query.eq('is_read', false);
      } else if (filter === 'read') {
        query = query.eq('is_read', true);
      }

      if (typeFilter !== 'all') {
        query = query.eq('notification_type', typeFilter);
      }

      const { data, error } = await query;

      if (error) {
        console.error('알림 조회 오류:', error);
        return;
      }

      // 데이터 가공
      const processedNotifications = data?.map(notification => ({
        ...notification,
        sender_name: notification.sender?.name,
        schedule_course_name: notification.schedule?.course_name,
        time_ago: getTimeAgo(notification.created_at)
      })) || [];

      setNotifications(processedNotifications);

      // 읽지 않은 알림 수 계산
      const unreadNotifications = processedNotifications.filter(n => !n.is_read);
      setUnreadCount(unreadNotifications.length);

    } catch (error) {
      console.error('알림 로딩 오류:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async (notificationIds: number[]) => {
    try {
      const { error } = await supabase
        .from('push_notifications')
        .update({ 
          is_read: true,
          read_at: new Date().toISOString()
        })
        .in('id', notificationIds);

      if (!error) {
        setNotifications(prev => 
          prev.map(notification => 
            notificationIds.includes(notification.id)
              ? { ...notification, is_read: true, read_at: new Date().toISOString() }
              : notification
          )
        );
        
        setUnreadCount(prev => Math.max(0, prev - notificationIds.length));
      }
    } catch (error) {
      console.error('알림 읽음 처리 오류:', error);
    }
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length > 0) {
      await markAsRead(unreadIds);
    }
  };

  const deleteNotifications = async (notificationIds: number[]) => {
    try {
      const { error } = await supabase
        .from('push_notifications')
        .delete()
        .in('id', notificationIds);

      if (!error) {
        setNotifications(prev => 
          prev.filter(notification => !notificationIds.includes(notification.id))
        );
        setSelectedNotifications([]);
      }
    } catch (error) {
      console.error('알림 삭제 오류:', error);
    }
  };

  const handleNotificationClick = (notification: NotificationWithSender) => {
    if (!notification.is_read && autoMarkRead) {
      markAsRead([notification.id]);
    }

    // 관련 페이지로 이동 (선택적)
    if (notification.related_schedule_id) {
      // 스케줄 관련 페이지로 이동
      window.location.href = `/schedules/${notification.related_schedule_id}`;
    }
  };

  const getTimeAgo = (dateString: string): string => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return '방금 전';
    } else if (diffInSeconds < 3600) {
      return `${Math.floor(diffInSeconds / 60)}분 전`;
    } else if (diffInSeconds < 86400) {
      return `${Math.floor(diffInSeconds / 3600)}시간 전`;
    } else if (diffInSeconds < 604800) {
      return `${Math.floor(diffInSeconds / 86400)}일 전`;
    } else {
      return date.toLocaleDateString('ko-KR');
    }
  };

  const getNotificationIcon = (type: NotificationType): string => {
    const icons = {
      'shooter_schedule_check': '📋',
      'shooter_departure': '🚗',
      'shooter_arrival': '📍',
      'shooter_start': '🎬',
      'shooter_end': '✅',
      'shooter_completion': '🎉',
      'shooter_overdue_schedule_check': '⚠️',
      'shooter_overdue_departure': '⚠️',
      'shooter_overdue_arrival': '⚠️',
      'professor_schedule_request': '📝',
      'professor_schedule_approved': '✅',
      'professor_schedule_rejected': '❌',
      'manager_approval_request': '📋',
      'admin_response_approved': '✅',
      'admin_response_rejected': '❌'
    };
    return icons[type] || '📢';
  };

  const getNotificationColor = (type: NotificationType): string => {
    if (type.includes('overdue')) return '#ef4444';
    if (type.includes('completion') || type.includes('approved')) return '#10b981';
    if (type.includes('rejected')) return '#ef4444';
    if (type.includes('departure')) return '#f59e0b';
    if (type.includes('arrival')) return '#10b981';
    return '#3b82f6';
  };

  const toggleSelectAll = () => {
    if (selectedNotifications.length === notifications.length) {
      setSelectedNotifications([]);
    } else {
      setSelectedNotifications(notifications.map(n => n.id));
    }
  };

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '200px',
        fontSize: '16px',
        color: '#64748b'
      }}>
        알림을 불러오는 중...
      </div>
    );
  }

  return (
    <div style={{
      background: 'white',
      borderRadius: '8px',
      border: '1px solid #e2e8f0',
      overflow: 'hidden'
    }}>
      {/* 헤더 */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #e2e8f0',
        background: '#f8fafc'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px'
        }}>
          <h3 style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: '600',
            color: '#1e293b'
          }}>
            알림 센터
            {unreadCount > 0 && (
              <span style={{
                marginLeft: '8px',
                background: '#ef4444',
                color: 'white',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: '600'
              }}>
                {unreadCount}
              </span>
            )}
          </h3>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
              style={{
                padding: '6px 12px',
                background: unreadCount > 0 ? '#10b981' : '#f3f4f6',
                color: unreadCount > 0 ? 'white' : '#9ca3af',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: unreadCount > 0 ? 'pointer' : 'not-allowed'
              }}
            >
              모두 읽음
            </button>

            <button
              onClick={toggleSelectAll}
              style={{
                padding: '6px 12px',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              {selectedNotifications.length === notifications.length ? '전체해제' : '전체선택'}
            </button>

            {selectedNotifications.length > 0 && (
              <button
                onClick={() => deleteNotifications(selectedNotifications)}
                style={{
                  padding: '6px 12px',
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                삭제 ({selectedNotifications.length})
              </button>
            )}
          </div>
        </div>

        {/* 필터 */}
        <div style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center'
        }}>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            style={{
              padding: '4px 8px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '12px'
            }}
          >
            <option value="all">전체</option>
            <option value="unread">읽지 않음</option>
            <option value="read">읽음</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            style={{
              padding: '4px 8px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '12px'
            }}
          >
            <option value="all">모든 유형</option>
            <option value="shooter_schedule_check">스케줄 확인</option>
            <option value="shooter_departure">출발</option>
            <option value="shooter_arrival">도착</option>
            <option value="professor_schedule_request">교수 요청</option>
            <option value="admin_response_approved">관리자 승인</option>
          </select>
        </div>
      </div>

      {/* 알림 목록 */}
      <div style={{
        maxHeight: '500px',
        overflowY: 'auto'
      }}>
        {notifications.length === 0 ? (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            color: '#64748b'
          }}>
            알림이 없습니다.
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              onClick={() => handleNotificationClick(notification)}
              style={{
                padding: '12px 20px',
                borderBottom: '1px solid #f1f5f9',
                cursor: 'pointer',
                backgroundColor: notification.is_read ? 'white' : '#f8fafc',
                transition: 'background-color 0.2s',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f0f9ff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = notification.is_read ? 'white' : '#f8fafc';
              }}
            >
              {/* 체크박스 */}
              <input
                type="checkbox"
                checked={selectedNotifications.includes(notification.id)}
                onChange={(e) => {
                  e.stopPropagation();
                  if (e.target.checked) {
                    setSelectedNotifications([...selectedNotifications, notification.id]);
                  } else {
                    setSelectedNotifications(selectedNotifications.filter(id => id !== notification.id));
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                style={{ marginTop: '2px' }}
              />

              {/* 아이콘 */}
              <div style={{
                fontSize: '20px',
                flexShrink: 0,
                marginTop: '2px'
              }}>
                {getNotificationIcon(notification.notification_type)}
              </div>

              {/* 알림 내용 */}
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '14px',
                  fontWeight: notification.is_read ? '500' : '600',
                  color: '#1e293b',
                  marginBottom: '4px',
                  lineHeight: 1.4
                }}>
                  {notification.title}
                </div>

                <div style={{
                  fontSize: '13px',
                  color: '#64748b',
                  marginBottom: '6px',
                  lineHeight: 1.4
                }}>
                  {notification.message}
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{
                    fontSize: '11px',
                    color: '#94a3b8'
                  }}>
                    {notification.time_ago}
                    {notification.sender_name && ` • ${notification.sender_name}`}
                    {notification.schedule_course_name && ` • ${notification.schedule_course_name}`}
                  </div>

                  {!notification.is_read && (
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: getNotificationColor(notification.notification_type)
                    }} />
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
