import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';

interface Notification {
  id: string;
  title: string;
  content: string;
  display_locations: string[];
  is_active: boolean;
  show_from: string;
  show_until: string;
  created_at: string;
  updated_at: string;
}

const NotificationManager: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingNotification, setEditingNotification] = useState<Notification | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // 📱 모바일 감지
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 폼 상태
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    display_locations: [] as string[],
    is_active: true,
    show_from: '',
    show_until: ''
  });

  // 노출 위치 옵션
  const displayLocationOptions = [
    { value: 'dashboard', label: isMobile ? '전체공지' : '전체 공지', desc: '메인 화면' },
    { value: 'schedule', label: isMobile ? '위탁직공지' : '위탁직 공지', desc: '일정 등록 페이지' },
    { value: 'weekly_view', label: isMobile ? '스케줄확인' : '스케줄 확인', desc: '주간 스케줄 페이지' },
    { value: 'all', label: isMobile ? '모든페이지' : '모든 페이지', desc: '전체 페이지' }
  ];

  // 공지사항 목록 조회
  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('freelancer_schedule_notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('공지사항 조회 실패:', error);
      alert('공지사항을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  // 폼 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = {
        ...formData,
        show_from: formData.show_from || null,
        show_until: formData.show_until || null
      };

      if (editingNotification) {
        const { error } = await supabase
          .from('freelancer_schedule_notifications')
          .update(data)
          .eq('id', editingNotification.id);
        
        if (error) throw error;
        alert('공지사항이 수정되었습니다.');
      } else {
        const { error } = await supabase
          .from('freelancer_schedule_notifications')
          .insert(data);
        
        if (error) throw error;
        alert('공지사항이 생성되었습니다.');
      }

      resetForm();
      fetchNotifications();
    } catch (error) {
      console.error('저장 실패:', error);
      alert('저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 폼 초기화
  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      display_locations: [],
      is_active: true,
      show_from: '',
      show_until: ''
    });
    setEditingNotification(null);
    setShowCreateModal(false);
  };

  // 수정 시작
  const startEdit = (notification: Notification) => {
    setFormData({
      title: notification.title,
      content: notification.content,
      display_locations: notification.display_locations || [],
      is_active: notification.is_active,
      show_from: notification.show_from || '',
      show_until: notification.show_until || ''
    });
    setEditingNotification(notification);
    setShowCreateModal(true);
  };

  // 삭제
  const deleteNotification = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      const { error } = await supabase
        .from('freelancer_schedule_notifications')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      alert('공지사항이 삭제되었습니다.');
      fetchNotifications();
    } catch (error) {
      console.error('삭제 실패:', error);
      alert('삭제에 실패했습니다.');
    }
  };

  // 체크박스 핸들러
  const handleLocationChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      display_locations: prev.display_locations.includes(value)
        ? prev.display_locations.filter(loc => loc !== value)
        : [...prev.display_locations, value]
    }));
  };

  return (
    <div style={{ 
      minHeight: '100vh',
      background: '#f8fafc',
      padding: isMobile ? '16px' : '24px',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif'
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        {/* 📱 모바일 최적화 헤더 */}
        <div style={{
          background: 'white',
          padding: isMobile ? '20px' : '32px',
          borderRadius: isMobile ? '12px' : '16px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          marginBottom: isMobile ? '20px' : '32px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: isMobile ? 'flex-start' : 'center',
            marginBottom: isMobile ? '20px' : '16px',
            flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? '16px' : '0'
          }}>
            <div style={{ width: isMobile ? '100%' : 'auto' }}>
              <h1 style={{
                fontSize: isMobile ? '24px' : '32px',
                fontWeight: 'bold',
                margin: '0 0 8px 0',
                color: '#1e293b',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>
                공지사항 관리
              </h1>
              <p style={{
                fontSize: isMobile ? '14px' : '16px',
                color: '#64748b',
                margin: 0,
                lineHeight: '1.5'
              }}>
                {isMobile ? '스케줄 앱 공지사항 관리' : '스케줄 앱의 공지사항을 생성하고 관리할 수 있습니다.'}
              </p>
            </div>
            
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                padding: isMobile ? '12px 20px' : '16px 32px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                borderRadius: isMobile ? '8px' : '12px',
                color: 'white',
                fontSize: isMobile ? '14px' : '16px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(16, 185, 129, 0.3)',
                transition: 'all 0.2s ease',
                width: isMobile ? '100%' : 'auto',
                whiteSpace: 'nowrap'
              }}
              onMouseOver={(e) => !isMobile && (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseOut={(e) => !isMobile && (e.currentTarget.style.transform = 'translateY(0)')}
            >
              {isMobile ? '+ 새 공지사항' : '새 공지사항 작성'}
            </button>
          </div>
          
          {/* 📱 모바일 최적화 통계 카드들 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: isMobile ? '12px' : '20px'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              padding: isMobile ? '16px' : '24px',
              borderRadius: isMobile ? '8px' : '12px',
              color: 'white',
              textAlign: 'center'
            }}>
              <div style={{ 
                fontSize: isMobile ? '24px' : '32px', 
                fontWeight: 'bold', 
                marginBottom: isMobile ? '4px' : '8px' 
              }}>
                {notifications.length}
              </div>
              <div style={{ 
                fontSize: isMobile ? '11px' : '14px', 
                opacity: 0.9,
                lineHeight: '1.2'
              }}>
                {isMobile ? '총 공지' : '총 공지사항'}
              </div>
            </div>
            
            <div style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              padding: isMobile ? '16px' : '24px',
              borderRadius: isMobile ? '8px' : '12px',
              color: 'white',
              textAlign: 'center'
            }}>
              <div style={{ 
                fontSize: isMobile ? '24px' : '32px', 
                fontWeight: 'bold', 
                marginBottom: isMobile ? '4px' : '8px' 
              }}>
                {notifications.filter(n => n.is_active).length}
              </div>
              <div style={{ 
                fontSize: isMobile ? '11px' : '14px', 
                opacity: 0.9,
                lineHeight: '1.2'
              }}>
                {isMobile ? '활성' : '활성 공지사항'}
              </div>
            </div>
            
            <div style={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              padding: isMobile ? '16px' : '24px',
              borderRadius: isMobile ? '8px' : '12px',
              color: 'white',
              textAlign: 'center'
            }}>
              <div style={{ 
                fontSize: isMobile ? '24px' : '32px', 
                fontWeight: 'bold', 
                marginBottom: isMobile ? '4px' : '8px' 
              }}>
                {notifications.filter(n => !n.is_active).length}
              </div>
              <div style={{ 
                fontSize: isMobile ? '11px' : '14px', 
                opacity: 0.9,
                lineHeight: '1.2'
              }}>
                {isMobile ? '비활성' : '비활성 공지사항'}
              </div>
            </div>
          </div>
        </div>

        {/* 📱 모바일 최적화 공지사항 목록 */}
        <div style={{
          background: 'white',
          borderRadius: isMobile ? '12px' : '16px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: isMobile ? '20px' : '32px',
            borderBottom: '1px solid #e2e8f0',
            background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)'
          }}>
            <h2 style={{
              fontSize: isMobile ? '18px' : '24px',
              fontWeight: '600',
              margin: '0 0 8px 0',
              color: '#1e293b'
            }}>
              공지사항 목록
            </h2>
            <p style={{
              fontSize: isMobile ? '12px' : '14px',
              color: '#64748b',
              margin: 0
            }}>
              총 {notifications.length}개의 공지사항이 있습니다.
            </p>
          </div>

          <div style={{ padding: isMobile ? '20px' : '32px' }}>
            {loading ? (
              <div style={{
                textAlign: 'center',
                padding: isMobile ? '40px 20px' : '60px 20px',
                color: '#64748b'
              }}>
                <div style={{
                  display: 'inline-block',
                  width: isMobile ? '32px' : '40px',
                  height: isMobile ? '32px' : '40px',
                  border: '4px solid #e2e8f0',
                  borderTop: '4px solid #3b82f6',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  marginBottom: '16px'
                }}></div>
                <div style={{ fontSize: isMobile ? '14px' : '16px' }}>로딩 중...</div>
              </div>
            ) : notifications.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: isMobile ? '40px 20px' : '60px 20px',
                color: '#64748b'
              }}>
                <div style={{ 
                  fontSize: isMobile ? '16px' : '18px', 
                  fontWeight: '600', 
                  marginBottom: '8px' 
                }}>
                  아직 공지사항이 없습니다
                </div>
                <div style={{ fontSize: isMobile ? '13px' : '14px', lineHeight: '1.5' }}>
                  {isMobile ? '새 공지사항 버튼을 눌러 첫 공지를 만들어보세요.' : '새 공지사항 작성 버튼을 눌러 첫 번째 공지사항을 만들어보세요.'}
                </div>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gap: isMobile ? '16px' : '20px'
              }}>
                {notifications.map(notification => (
                  <div
                    key={notification.id}
                    style={{
                      border: '2px solid #e2e8f0',
                      borderRadius: isMobile ? '12px' : '16px',
                      padding: isMobile ? '16px' : '24px',
                      transition: 'all 0.2s ease',
                      background: notification.is_active ? '#f8fafc' : '#fef2f2'
                    }}
                  >
                    {/* 📱 모바일 최적화 카드 내용 */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: isMobile ? '12px' : '16px',
                      flexDirection: isMobile ? 'column' : 'row',
                      gap: isMobile ? '12px' : '0'
                    }}>
                      <div style={{ flex: 1, width: isMobile ? '100%' : 'auto' }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: isMobile ? '8px' : '12px',
                          marginBottom: '8px',
                          flexWrap: 'wrap'
                        }}>
                          <h3 style={{
                            fontSize: isMobile ? '16px' : '20px',
                            fontWeight: '600',
                            margin: 0,
                            color: '#1e293b',
                            lineHeight: '1.3'
                          }}>
                            {notification.title}
                          </h3>
                          
                          <span style={{
                            padding: isMobile ? '2px 8px' : '4px 12px',
                            borderRadius: '20px',
                            fontSize: isMobile ? '10px' : '12px',
                            fontWeight: '600',
                            background: notification.is_active 
                              ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                              : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                            color: 'white'
                          }}>
                            {notification.is_active ? '활성' : '비활성'}
                          </span>
                        </div>
                        
                        <p style={{
                          fontSize: isMobile ? '14px' : '16px',
                          color: '#475569',
                          margin: '0 0 12px 0',
                          lineHeight: '1.5'
                        }}>
                          {isMobile && notification.content.length > 100 
                            ? `${notification.content.substring(0, 100)}...`
                            : notification.content
                          }
                        </p>
                        
                        {/* 📱 노출 위치 태그들 - 모바일 최적화 */}
                        <div style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: isMobile ? '6px' : '8px',
                          marginBottom: isMobile ? '8px' : '12px'
                        }}>
                          {(notification.display_locations || []).map(location => {
                            const option = displayLocationOptions.find(opt => opt.value === location);
                            return option ? (
                              <span
                                key={location}
                                style={{
                                  padding: isMobile ? '4px 8px' : '6px 12px',
                                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                  color: 'white',
                                  borderRadius: isMobile ? '6px' : '8px',
                                  fontSize: isMobile ? '10px' : '12px',
                                  fontWeight: '500'
                                }}
                              >
                                {option.label}
                              </span>
                            ) : null;
                          })}
                        </div>
                        
                        <div style={{
                          fontSize: isMobile ? '11px' : '12px',
                          color: '#64748b',
                          lineHeight: '1.4'
                        }}>
                          생성일: {new Date(notification.created_at).toLocaleDateString('ko-KR')}
                          {notification.show_from && (
                            <span> • 시작: {new Date(notification.show_from).toLocaleDateString('ko-KR')}</span>
                          )}
                          {notification.show_until && (
                            <span> • 종료: {new Date(notification.show_until).toLocaleDateString('ko-KR')}</span>
                          )}
                        </div>
                      </div>
                      
                      {/* 📱 모바일 최적화 버튼 */}
                      <div style={{
                        display: 'flex',
                        gap: isMobile ? '8px' : '12px',
                        width: isMobile ? '100%' : 'auto',
                        justifyContent: isMobile ? 'stretch' : 'flex-start'
                      }}>
                        <button
                          onClick={() => startEdit(notification)}
                          style={{
                            padding: isMobile ? '10px 16px' : '12px 20px',
                            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                            border: 'none',
                            borderRadius: isMobile ? '6px' : '8px',
                            color: 'white',
                            fontSize: isMobile ? '12px' : '14px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            transition: 'transform 0.2s ease',
                            flex: isMobile ? 1 : 'none'
                          }}
                          onMouseOver={(e) => !isMobile && (e.currentTarget.style.transform = 'translateY(-1px)')}
                          onMouseOut={(e) => !isMobile && (e.currentTarget.style.transform = 'translateY(0)')}
                        >
                          수정
                        </button>
                        
                        <button
                          onClick={() => deleteNotification(notification.id)}
                          style={{
                            padding: isMobile ? '10px 16px' : '12px 20px',
                            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                            border: 'none',
                            borderRadius: isMobile ? '6px' : '8px',
                            color: 'white',
                            fontSize: isMobile ? '12px' : '14px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            transition: 'transform 0.2s ease',
                            flex: isMobile ? 1 : 'none'
                          }}
                          onMouseOver={(e) => !isMobile && (e.currentTarget.style.transform = 'translateY(-1px)')}
                          onMouseOut={(e) => !isMobile && (e.currentTarget.style.transform = 'translateY(0)')}
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 📱 모바일 최적화 생성/수정 모달 */}
        {showCreateModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: isMobile ? 'flex-start' : 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: isMobile ? '0' : '20px',
            paddingTop: isMobile ? '20px' : '20px'
          }}>
            <div style={{
              background: 'white',
              borderRadius: isMobile ? '16px 16px 0 0' : '20px',
              padding: isMobile ? '24px' : '40px',
              maxWidth: '600px',
              width: isMobile ? '100%' : '100%',
              maxHeight: isMobile ? '95vh' : '90vh',
              overflow: 'auto',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              position: isMobile ? 'fixed' : 'relative',
              bottom: isMobile ? 0 : 'auto',
              left: isMobile ? 0 : 'auto',
              right: isMobile ? 0 : 'auto'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: isMobile ? '24px' : '32px'
              }}>
                <h2 style={{
                  fontSize: isMobile ? '20px' : '28px',
                  fontWeight: 'bold',
                  margin: 0,
                  color: '#1e293b'
                }}>
                  {editingNotification ? 
                    (isMobile ? '공지사항 수정' : '공지사항 수정') : 
                    (isMobile ? '새 공지사항' : '새 공지사항 작성')
                  }
                </h2>
                
                <button
                  onClick={resetForm}
                  style={{
                    background: '#f1f5f9',
                    border: '2px solid #e2e8f0',
                    borderRadius: '50%',
                    width: isMobile ? '36px' : '40px',
                    height: isMobile ? '36px' : '40px',
                    cursor: 'pointer',
                    fontSize: isMobile ? '16px' : '18px',
                    color: '#64748b'
                  }}
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                {/* 📱 모바일 최적화 폼 필드들 */}
                <div style={{ marginBottom: isMobile ? '20px' : '24px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: isMobile ? '14px' : '16px',
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    제목 *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    required
                    style={{
                      width: '100%',
                      padding: isMobile ? '12px' : '16px',
                      border: '2px solid #e5e7eb',
                      borderRadius: isMobile ? '8px' : '12px',
                      fontSize: isMobile ? '14px' : '16px',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.2s ease'
                    }}
                    placeholder="공지사항 제목을 입력하세요"
                  />
                </div>

                <div style={{ marginBottom: isMobile ? '20px' : '24px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: isMobile ? '14px' : '16px',
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    내용 *
                  </label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                    required
                    rows={isMobile ? 4 : 6}
                    style={{
                      width: '100%',
                      padding: isMobile ? '12px' : '16px',
                      border: '2px solid #e5e7eb',
                      borderRadius: isMobile ? '8px' : '12px',
                      fontSize: isMobile ? '14px' : '16px',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                      fontFamily: 'inherit',
                      lineHeight: '1.5'
                    }}
                    placeholder="공지사항 내용을 입력하세요"
                  />
                </div>

                <div style={{ marginBottom: isMobile ? '20px' : '24px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: isMobile ? '14px' : '16px',
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '12px'
                  }}>
                    노출 위치 *
                  </label>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: isMobile ? '8px' : '12px'
                  }}>
                    {displayLocationOptions.map(option => (
                      <label
                        key={option.value}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: isMobile ? '12px' : '16px',
                          border: '2px solid #e5e7eb',
                          borderRadius: isMobile ? '8px' : '12px',
                          cursor: 'pointer',
                          background: formData.display_locations.includes(option.value) 
                            ? '#f0f9ff' : '#fafbfc',
                          borderColor: formData.display_locations.includes(option.value)
                            ? '#3b82f6' : '#e5e7eb',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={formData.display_locations.includes(option.value)}
                          onChange={() => handleLocationChange(option.value)}
                          style={{
                            marginRight: isMobile ? '8px' : '12px',
                            transform: 'scale(1.2)'
                          }}
                        />
                        <div>
                          <div style={{
                            fontSize: isMobile ? '13px' : '14px',
                            fontWeight: '600',
                            color: '#1e293b',
                            marginBottom: '2px'
                          }}>
                            {option.label}
                          </div>
                          <div style={{
                            fontSize: isMobile ? '11px' : '12px',
                            color: '#64748b'
                          }}>
                            {option.desc}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 📱 모바일 최적화 날짜 필드 */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                  gap: '16px',
                  marginBottom: isMobile ? '20px' : '24px'
                }}>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: isMobile ? '14px' : '16px',
                      fontWeight: '600',
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      시작일 (선택사항)
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.show_from}
                      onChange={(e) => setFormData(prev => ({ ...prev, show_from: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: isMobile ? '12px' : '16px',
                        border: '2px solid #e5e7eb',
                        borderRadius: isMobile ? '8px' : '12px',
                        fontSize: isMobile ? '14px' : '16px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: isMobile ? '14px' : '16px',
                      fontWeight: '600',
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      종료일 (선택사항)
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.show_until}
                      onChange={(e) => setFormData(prev => ({ ...prev, show_until: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: isMobile ? '12px' : '16px',
                        border: '2px solid #e5e7eb',
                        borderRadius: isMobile ? '8px' : '12px',
                        fontSize: isMobile ? '14px' : '16px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: isMobile ? '24px' : '32px' }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    padding: isMobile ? '12px' : '16px',
                    background: '#f8fafc',
                    borderRadius: isMobile ? '8px' : '12px',
                    border: '2px solid #e2e8f0'
                  }}>
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                      style={{
                        marginRight: '12px',
                        transform: 'scale(1.3)'
                      }}
                    />
                    <span style={{
                      fontSize: isMobile ? '14px' : '16px',
                      fontWeight: '600',
                      color: '#1e293b',
                      lineHeight: '1.4'
                    }}>
                      {isMobile ? '활성화 (체크 해제시 비표시)' : '활성화 (체크 해제 시 공지사항이 표시되지 않습니다)'}
                    </span>
                  </label>
                </div>

                {/* 📱 모바일 최적화 버튼들 */}
                <div style={{
                  display: 'flex',
                  gap: '12px',
                  justifyContent: 'flex-end',
                  flexDirection: isMobile ? 'column-reverse' : 'row'
                }}>
                  <button
                    type="button"
                    onClick={resetForm}
                    style={{
                      padding: isMobile ? '14px' : '16px 32px',
                      background: '#f1f5f9',
                      border: '2px solid #e2e8f0',
                      borderRadius: isMobile ? '8px' : '12px',
                      fontSize: isMobile ? '14px' : '16px',
                      fontWeight: '600',
                      color: '#64748b',
                      cursor: 'pointer',
                      width: isMobile ? '100%' : 'auto'
                    }}
                  >
                    취소
                  </button>
                  
                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      padding: isMobile ? '14px' : '16px 32px',
                      background: loading 
                        ? '#9ca3af' 
                        : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      border: 'none',
                      borderRadius: isMobile ? '8px' : '12px',
                      fontSize: isMobile ? '14px' : '16px',
                      fontWeight: '600',
                      color: 'white',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      boxShadow: '0 4px 16px rgba(16, 185, 129, 0.3)',
                      width: isMobile ? '100%' : 'auto'
                    }}
                  >
                    {loading ? '저장 중...' : (editingNotification ? '수정 완료' : '생성하기')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* 로딩 애니메이션 CSS */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default NotificationManager;
