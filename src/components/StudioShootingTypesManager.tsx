// src/components/StudioShootingTypesManager.tsx
"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../utils/supabaseClient';
import { UserRoleType } from '../types/users';
// 🔧 import 제거
// import { safeUserRole } from '../utils/simplePermissions';

interface StudioShootingType {
  studio_id: number;
  studio_name: string;
  primary_type: string;
  secondary_types: string[];
  all_types: Array<{
    id: number;
    name: string;
    is_primary: boolean;
  }>;
}

interface ShootingType {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
}

export default function StudioShootingTypesManager() {
  const router = useRouter();
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [studioShootingTypes, setStudioShootingTypes] = useState<StudioShootingType[]>([]);
  const [allShootingTypes, setAllShootingTypes] = useState<ShootingType[]>([]);
  const [studios, setStudios] = useState<any[]>([]);
  
  // 새 항목 추가 모달 상태
  const [showAddStudio, setShowAddStudio] = useState(false);
  const [showAddShootingType, setShowAddShootingType] = useState(false);
  const [newStudioName, setNewStudioName] = useState('');
  const [newShootingType, setNewShootingType] = useState({ name: '', description: '' });

  // 권한 체크
  useEffect(() => {
    checkAccess();
  }, []);

  // 🔧 간단한 권한 체크로 변경
  const checkAccess = () => {
    const userRole = localStorage.getItem('userRole');
    const allowedRoles = ['system_admin', 'schedule_admin', 'studio_manager']; // 🔧 스튜디오 매니저도 추가
    
    if (!userRole || !allowedRoles.includes(userRole)) {
      console.warn('⚠️ 스튜디오 촬영 타입 관리 접근 권한 없음:', userRole);
      router.push('/');
      return;
    }
    
    console.log('✅ 스튜디오 촬영 타입 관리 접근 권한 확인:', userRole);
    setHasAccess(true);
    setLoading(false);
  };

  // 데이터 로딩
  useEffect(() => {
    if (hasAccess) {
      loadData();
    }
  }, [hasAccess]);

  const loadData = async () => {
    await Promise.all([
      loadStudioShootingTypes(),
      loadAllShootingTypes(),
      loadStudios()
    ]);
  };

  // 스튜디오별 촬영형식 데이터 로딩 (순서 문제 해결)
  const loadStudioShootingTypes = async () => {
    try {
      const { data: mappingData, error: mappingError } = await supabase
        .from('sub_location_shooting_types')
        .select(`
          sub_location_id,
          is_primary,
          shooting_types!inner(
            id,
            name,
            description
          ),
          sub_locations!inner(
            id,
            name
          )
        `)
        .eq('shooting_types.is_active', true)
        .eq('sub_locations.is_active', true)
        .order('is_primary', { ascending: false }); // Primary 먼저, Secondary 나중에

      if (mappingError) throw mappingError;

      // 스튜디오별로 그룹핑
      const studioMap = new Map<number, any>();
      
      mappingData?.forEach(item => {
        const studioId = item.sub_location_id;
        const studioName = item.sub_locations.name;
        
        // 숫자 이름인 스튜디오만 처리
        if (!/^\d+$/.test(studioName)) return;
        
        if (!studioMap.has(studioId)) {
          studioMap.set(studioId, {
            studio_id: studioId,
            studio_name: studioName,
            primary_type: '',
            secondary_types: [],
            all_types: []
          });
        }
        
        const studio = studioMap.get(studioId);
        const shootingType = {
          id: item.shooting_types.id,
          name: item.shooting_types.name,
          is_primary: item.is_primary
        };
        
        studio.all_types.push(shootingType);
        
        // Primary와 Secondary 구분하여 저장
        if (item.is_primary) {
          studio.primary_type = item.shooting_types.name;
        } else {
          studio.secondary_types.push(item.shooting_types.name);
        }
      });

      // Secondary 타입들을 데이터베이스 저장 순서대로 정렬
      studioMap.forEach(studio => {
        // Secondary 타입들을 원래 순서대로 정렬 (DB에서 가져온 순서 유지)
        const secondaryFromDB = studio.all_types
          .filter((type: any) => !type.is_primary)
          .map((type: any) => type.name);
        
        studio.secondary_types = secondaryFromDB;
      });

      // 배열로 변환 및 숫자 순서로 정렬
      const studioArray = Array.from(studioMap.values()).sort((a, b) => 
        parseInt(a.studio_name) - parseInt(b.studio_name)
      );

      setStudioShootingTypes(studioArray);
      
    } catch (error) {
      console.error('스튜디오 촬영형식 로딩 오류:', error);
    }
  };

  // 모든 촬영형식 로딩
  const loadAllShootingTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('shooting_types')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setAllShootingTypes(data || []);
    } catch (error) {
      console.error('촬영형식 로딩 오류:', error);
    }
  };

  // 스튜디오 목록 로딩
  const loadStudios = async () => {
    try {
      const { data, error } = await supabase
        .from('sub_locations')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      
      // 숫자 이름인 스튜디오만 필터링
      const studioList = data?.filter(loc => /^\d+$/.test(loc.name || '')) || [];
      setStudios(studioList);
    } catch (error) {
      console.error('스튜디오 로딩 오류:', error);
    }
  };

  // Primary 촬영형식 변경 핸들러 (Secondary 중복 제거)
  const handlePrimaryChange = (studioId: number, value: string) => {
    setStudioShootingTypes(prev => prev.map(studio => {
      if (studio.studio_id !== studioId) return studio;
      
      // Primary 변경 시 Secondary에서 같은 값 제거
      const filteredSecondaryTypes = studio.secondary_types.filter(
        secondary => secondary !== value && secondary !== ''
      );
      
      return { 
        ...studio, 
        primary_type: value,
        secondary_types: filteredSecondaryTypes
      };
    }));
  };

  // Secondary 촬영형식 변경 핸들러
  const handleSecondaryChange = (studioId: number, value: string, index: number) => {
    setStudioShootingTypes(prev => prev.map(studio => {
      if (studio.studio_id !== studioId) return studio;
      
      const newSecondaryTypes = [...studio.secondary_types];
      
      // 빈 값이 아닌 경우에만 배열에 추가/수정
      if (value !== '') {
        if (index >= newSecondaryTypes.length) {
          newSecondaryTypes.push(value);
        } else {
          newSecondaryTypes[index] = value;
        }
      } else {
        // 빈 값인 경우 해당 인덱스 제거
        if (index < newSecondaryTypes.length) {
          newSecondaryTypes.splice(index, 1);
        }
      }
      
      return { ...studio, secondary_types: newSecondaryTypes };
    }));
  };

  // Secondary 촬영형식 제거
  const removeSecondaryType = (studioId: number, index: number) => {
    setStudioShootingTypes(prev => prev.map(studio => {
      if (studio.studio_id !== studioId) return studio;
      const newSecondaryTypes = studio.secondary_types.filter((_, i) => i !== index);
      return { ...studio, secondary_types: newSecondaryTypes };
    }));
  };

  // Secondary 순서 변경
  const moveSecondaryType = (studioId: number, fromIndex: number, toIndex: number) => {
    setStudioShootingTypes(prev => prev.map(studio => {
      if (studio.studio_id !== studioId) return studio;
      
      const newSecondaryTypes = [...studio.secondary_types];
      const [movedItem] = newSecondaryTypes.splice(fromIndex, 1);
      newSecondaryTypes.splice(toIndex, 0, movedItem);
      
      return { ...studio, secondary_types: newSecondaryTypes };
    }));
  };

  // 개별 스튜디오 저장
  const saveStudioShootingTypes = async (studioId: number) => {
    try {
      const studio = studioShootingTypes.find(s => s.studio_id === studioId);
      if (!studio) return;

      // 1. 기존 매핑 삭제
      await supabase
        .from('sub_location_shooting_types')
        .delete()
        .eq('sub_location_id', studioId);

      // 2. 새 매핑 추가
      const mappings = [];
      
      // Primary 촬영형식
      if (studio.primary_type) {
        const primaryType = allShootingTypes.find(t => t.name === studio.primary_type);
        if (primaryType) {
          mappings.push({
            sub_location_id: studioId,
            shooting_type_id: primaryType.id,
            is_primary: true
          });
        }
      }
      
      // Secondary 촬영형식들
      studio.secondary_types.forEach(typeName => {
        if (typeName && typeName !== studio.primary_type) {
          const secondaryType = allShootingTypes.find(t => t.name === typeName);
          if (secondaryType) {
            mappings.push({
              sub_location_id: studioId,
              shooting_type_id: secondaryType.id,
              is_primary: false
            });
          }
        }
      });

      if (mappings.length > 0) {
        const { error } = await supabase
          .from('sub_location_shooting_types')
          .insert(mappings);

        if (error) throw error;
      }

      alert(`${studio.studio_name}번 스튜디오 촬영형식이 저장되었습니다.`);
      
      // 저장 후 데이터 다시 로딩하여 순서 유지
      await loadStudioShootingTypes();
      
    } catch (error) {
      console.error('저장 오류:', error);
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  // 전체 스튜디오 일괄저장
  const saveAllStudioShootingTypes = async () => {
    try {
      const confirmSave = window.confirm('모든 스튜디오의 촬영형식을 일괄저장하시겠습니까?');
      if (!confirmSave) return;

      for (const studio of studioShootingTypes) {
        // 1. 기존 매핑 삭제
        await supabase
          .from('sub_location_shooting_types')
          .delete()
          .eq('sub_location_id', studio.studio_id);

        // 2. 새 매핑 추가
        const mappings = [];
        
        // Primary 촬영형식
        if (studio.primary_type) {
          const primaryType = allShootingTypes.find(t => t.name === studio.primary_type);
          if (primaryType) {
            mappings.push({
              sub_location_id: studio.studio_id,
              shooting_type_id: primaryType.id,
              is_primary: true
            });
          }
        }
        
        // Secondary 촬영형식들
        studio.secondary_types.forEach(typeName => {
          if (typeName && typeName !== studio.primary_type) {
            const secondaryType = allShootingTypes.find(t => t.name === typeName);
            if (secondaryType) {
              mappings.push({
                sub_location_id: studio.studio_id,
                shooting_type_id: secondaryType.id,
                is_primary: false
              });
            }
          }
        });

        if (mappings.length > 0) {
          const { error } = await supabase
            .from('sub_location_shooting_types')
            .insert(mappings);

          if (error) throw error;
        }
      }

      alert('모든 스튜디오의 촬영형식이 일괄저장되었습니다.');
      
      // 저장 후 데이터 다시 로딩하여 순서 유지
      await loadStudioShootingTypes();
      
    } catch (error) {
      console.error('일괄저장 오류:', error);
      alert('일괄저장 중 오류가 발생했습니다.');
    }
  };

  // 새 스튜디오 추가
  const addNewStudio = async () => {
    if (!newStudioName.trim()) {
      alert('스튜디오 번호를 입력하세요.');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('sub_locations')
        .insert([{
          name: newStudioName,
          main_location_id: 8,
          is_active: true
        }])
        .select()
        .single();

      if (error) throw error;

      alert(`${newStudioName}번 스튜디오가 추가되었습니다.`);
      setNewStudioName('');
      setShowAddStudio(false);
      loadData();
      
    } catch (error) {
      console.error('스튜디오 추가 오류:', error);
      alert('스튜디오 추가 중 오류가 발생했습니다.');
    }
  };

  // 새 촬영형식 추가
  const addNewShootingType = async () => {
    if (!newShootingType.name.trim()) {
      alert('촬영형식 이름을 입력하세요.');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('shooting_types')
        .insert([{
          name: newShootingType.name,
          description: newShootingType.description,
          is_active: true
        }])
        .select()
        .single();

      if (error) throw error;

      alert(`${newShootingType.name} 촬영형식이 추가되었습니다.`);
      setNewShootingType({ name: '', description: '' });
      setShowAddShootingType(false);
      loadData();
      
    } catch (error) {
      console.error('촬영형식 추가 오류:', error);
      alert('촬영형식 추가 중 오류가 발생했습니다.');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        로딩 중...
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <h3 style={{ color: '#dc2626' }}>접근 권한이 없습니다</h3>
        <p style={{ color: '#6b7280', marginTop: '8px' }}>
          스튜디오 촬영 타입 관리는 시스템 관리자, 스케줄 관리자, 스튜디오 매니저만 접근할 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '20px', 
      maxWidth: '1200px', 
      margin: '0 auto',
      paddingBottom: '50px',
      minHeight: '100vh',
      height: 'auto',
      overflow: 'auto',
      position: 'relative',
      display: 'block',
      width: '100%'
    }}>
      {/* 나머지 JSX는 동일... */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '24px' 
      }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>
          🎬 스튜디오 촬영형식 관리
        </h1>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => setShowAddStudio(true)}
            style={{
              padding: '8px 16px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            + 스튜디오 추가
          </button>
          
          <button
            onClick={() => setShowAddShootingType(true)}
            style={{
              padding: '8px 16px',
              backgroundColor: '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            + 촬영형식 추가
          </button>
          
          <button
            onClick={saveAllStudioShootingTypes}
            style={{
              padding: '8px 16px',
              backgroundColor: '#22c55e',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            전체 일괄저장
          </button>
        </div>
      </div>

      {/* 메인 테이블 */}
      <div style={{ 
        backgroundColor: 'white', 
        borderRadius: '8px', 
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        overflow: 'visible',
        width: '100%',
        maxHeight: 'none',
        height: 'auto',
        display: 'block',
        position: 'relative'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f9fafb' }}>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                스튜디오
              </th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                Primary 촬영형식
              </th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                Secondary 촬영형식
              </th>
              <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>
                액션
              </th>
            </tr>
          </thead>
          <tbody>
            {studioShootingTypes.map(studio => (
              <React.Fragment key={`studio-group-${studio.studio_id}`}>
                <tr key={`studio-row-${studio.studio_id}`} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '12px', fontWeight: '600' }}>
                    {studio.studio_name}번
                  </td>
                  
                  <td style={{ padding: '12px' }}>
                    <select
                      value={studio.primary_type}
                      onChange={(e) => handlePrimaryChange(studio.studio_id, e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                    >
                      <option value="">Primary 선택</option>
                      {allShootingTypes.map(type => (
                        <option key={`primary-option-${studio.studio_id}-${type.id}`} value={type.name}>
                          {type.name} {studio.secondary_types.includes(type.name) ? '(현재 Secondary에 있음)' : ''}
                        </option>
                      ))}
                    </select>
                  </td>
                  
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {studio.secondary_types.map((secondaryType, index) => (
                        <div key={`secondary-row-${studio.studio_id}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <select
                            value={secondaryType}
                            onChange={(e) => {
                              const newValue = e.target.value;
                              // Primary와 같은 값 선택 시 경고
                              if (newValue === studio.primary_type) {
                                alert('Primary 촬영형식과 동일한 값은 선택할 수 없습니다.');
                                return;
                              }
                              handleSecondaryChange(studio.studio_id, newValue, index);
                            }}
                            style={{
                              flex: 1,
                              padding: '8px',
                              border: secondaryType === studio.primary_type ? '2px solid #ef4444' : '1px solid #d1d5db',
                              borderRadius: '4px',
                              fontSize: '14px',
                              backgroundColor: secondaryType === studio.primary_type ? '#fef2f2' : 'white'
                            }}
                          >
                            <option value="">Secondary 선택</option>
                            {allShootingTypes
                              .filter(type => type.name !== studio.primary_type)
                              .map(type => (
                                <option key={`secondary-option-${studio.studio_id}-${index}-${type.id}`} value={type.name}>
                                  {type.name}
                                </option>
                              ))}
                          </select>
                          
                          {/* 순서 표시 */}
                          <span style={{ 
                            fontSize: '12px', 
                            color: '#6b7280',
                            minWidth: '40px'
                          }}>
                            #{index + 2}
                          </span>
                          
                          {/* 순서 변경 버튼 */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {index > 0 && (
                              <button
                                onClick={() => moveSecondaryType(studio.studio_id, index, index - 1)}
                                style={{ 
                                  padding: '2px 6px', 
                                  fontSize: '10px',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '2px',
                                  cursor: 'pointer'
                                }}
                              >
                                ↑
                              </button>
                            )}
                            {index < studio.secondary_types.length - 1 && (
                              <button
                                onClick={() => moveSecondaryType(studio.studio_id, index, index + 1)}
                                style={{ 
                                  padding: '2px 6px', 
                                  fontSize: '10px',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '2px',
                                  cursor: 'pointer'
                                }}
                              >
                                ↓
                              </button>
                            )}
                          </div>
                          
                          {/* 제거 버튼 */}
                          <button
                            onClick={() => removeSecondaryType(studio.studio_id, index)}
                            style={{
                              padding: '4px 8px',
                              backgroundColor: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            ×
                          </button>
                          
                          {/* 중복 경고 표시 */}
                          {secondaryType === studio.primary_type && (
                            <span style={{ 
                              fontSize: '12px', 
                              color: '#ef4444',
                              fontWeight: 'bold'
                            }}>
                              ⚠️ 중복
                            </span>
                          )}
                        </div>
                      ))}
                      
                      {/* Secondary가 없을 때 기본 선택창 표시 */}
                      {studio.secondary_types.length === 0 && (
                        <select
                          value=""
                          onChange={(e) => handleSecondaryChange(studio.studio_id, e.target.value, 0)}
                          style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #d1d5db',
                            borderRadius: '4px',
                            fontSize: '14px'
                          }}
                        >
                          <option value="">Secondary 선택</option>
                          {allShootingTypes
                            .filter(type => type.name !== studio.primary_type)
                            .map(type => (
                              <option key={`empty-secondary-option-${studio.studio_id}-${type.id}`} value={type.name}>
                                {type.name}
                              </option>
                            ))}
                        </select>
                      )}
                    </div>
                  </td>
                  
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <button
                      onClick={() => saveStudioShootingTypes(studio.studio_id)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#22c55e',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      저장
                    </button>
                  </td>
                </tr>
                
                {/* 현재 순서 미리보기 */}
                <tr key={`studio-preview-${studio.studio_id}`}>
                  <td colSpan={4} style={{ 
                    padding: '8px 12px', 
                    backgroundColor: '#f9fafb', 
                    fontSize: '12px',
                    borderBottom: '1px solid #e5e7eb'
                  }}>
                    <strong>현재 순서:</strong> 
                    {studio.primary_type && (
                      <span style={{ color: '#dc2626', fontWeight: 'bold', marginLeft: '8px' }}>
                        1. {studio.primary_type} (Primary)
                      </span>
                    )}
                    {studio.secondary_types.map((type, index) => type && (
                      <span key={`secondary-display-${studio.studio_id}-${index}-${type}`} style={{ color: '#2563eb', marginLeft: '12px' }}>
                        {index + 2}. {type} (Secondary)
                      </span>
                    ))}
                    {!studio.primary_type && studio.secondary_types.length === 0 && (
                      <span style={{ color: '#6b7280', marginLeft: '8px' }}>
                        설정된 촬영형식이 없습니다.
                      </span>
                    )}
                  </td>
                </tr>
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* 새 스튜디오 추가 모달 */}
      {showAddStudio && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '8px',
            width: '400px'
          }}>
            <h3 style={{ marginBottom: '16px' }}>새 스튜디오 추가</h3>
            
            <input
              type="text"
              placeholder="스튜디오 번호 (예: 16)"
              value={newStudioName}
              onChange={(e) => setNewStudioName(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                marginBottom: '16px'
              }}
            />
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowAddStudio(false)}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                취소
              </button>
              
              <button
                onClick={addNewStudio}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 새 촬영형식 추가 모달 */}
      {showAddShootingType && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '8px',
            width: '400px'
          }}>
            <h3 style={{ marginBottom: '16px' }}>새 촬영형식 추가</h3>
            
            <input
              type="text"
              placeholder="촬영형식 이름 (예: VR촬영)"
              value={newShootingType.name}
              onChange={(e) => setNewShootingType(prev => ({ ...prev, name: e.target.value }))}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                marginBottom: '12px'
              }}
            />
            
            <textarea
              placeholder="설명 (선택사항)"
              value={newShootingType.description}
              onChange={(e) => setNewShootingType(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                marginBottom: '16px',
                resize: 'vertical'
              }}
            />
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowAddShootingType(false)}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                취소
              </button>
              
              <button
                onClick={addNewShootingType}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#8b5cf6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
