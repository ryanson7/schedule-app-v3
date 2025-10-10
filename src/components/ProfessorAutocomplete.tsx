'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';

interface Professor {
  id: number;
  name: string;
  phone?: string;
  category_name?: string;
  secondary_category_name?: string;
  subject_name?: string;
  organization_name?: string;
  category_type?: 'main' | 'secondary';
}

interface ProfessorAutocompleteProps {
  value: string;
  onChange: (value: string, professor?: Professor) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const ProfessorAutocomplete: React.FC<ProfessorAutocompleteProps> = ({
  value,
  onChange,
  placeholder = "교수명을 입력하세요",
  disabled = false,
  required = false,
  className = "",
  style = {}
}) => {
  const [inputValue, setInputValue] = useState(value);
  const [suggestions, setSuggestions] = useState<Professor[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [allProfessors, setAllProfessors] = useState<Professor[]>([]);
  const [loading, setLoading] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadProfessors();
  }, []);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const loadProfessors = async () => {
    try {
      setLoading(true);
      console.log('📋 교수 데이터 로딩 시작...');
      
      const { data: professorsData, error: professorsError } = await supabase
        .from('professors')
        .select(`
          *,
          users!inner(id, name, phone, role, status, is_active),
          professor_categories:professor_category_id(id, category_name),
          secondary_categories:secondary_category_id(id, category_name)
        `)
        .eq('is_active', true)
        .eq('users.role', 'professor')
        .eq('users.is_active', true);

      if (professorsError) {
        console.error('❌ 교수 데이터 조회 오류:', professorsError);
        setAllProfessors([]);
        return;
      }

      if (!professorsData || professorsData.length === 0) {
        setAllProfessors([]);
        return;
      }

      // ✅ 카테고리별로 분리된 자동완성 항목 생성
      const categoryBasedProfessors: Professor[] = [];
      
      professorsData.forEach(prof => {
        const baseInfo = {
          id: prof.users.id,
          name: prof.users.name,
          phone: prof.users.phone || '',
          subject_name: '',
          organization_name: ''
        };

        // 메인 카테고리 항목
        if (prof.professor_categories?.category_name) {
          categoryBasedProfessors.push({
            ...baseInfo,
            id: parseInt(`${prof.users.id}1${prof.professor_categories.id || 0}`),
            category_name: prof.professor_categories.category_name,
            secondary_category_name: '',
            category_type: 'main'
          });
        }

        // 보조 카테고리 항목 (별도 항목으로)
        if (prof.secondary_categories?.category_name) {
          categoryBasedProfessors.push({
            ...baseInfo,
            id: parseInt(`${prof.users.id}2${prof.secondary_categories.id || 0}`),
            category_name: prof.secondary_categories.category_name,
            secondary_category_name: '',
            category_type: 'secondary'
          });
        }
      });

      // ✅ 중복 제거 및 정렬
      const uniqueProfessors = categoryBasedProfessors
        .filter((prof, index, self) => 
          index === self.findIndex(p => 
            p.name === prof.name && 
            p.category_name === prof.category_name &&
            p.category_type === prof.category_type
          )
        )
        .sort((a, b) => {
          const nameCompare = a.name.localeCompare(b.name);
          if (nameCompare !== 0) return nameCompare;
          return a.category_name.localeCompare(b.category_name);
        });

      setAllProfessors(uniqueProfessors);
      console.log('✅ 카테고리별 교수 데이터 조합 완료:', uniqueProfessors.length, '항목');
      
    } catch (error) {
      console.error('❌ 교수 데이터 로딩 오류:', error);
      setAllProfessors([]);
    } finally {
      setLoading(false);
    }
  };

  const searchProfessors = (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setSuggestions([]);
      return;
    }

    const filtered = allProfessors.filter(professor =>
      professor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      professor.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      professor.category_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      professor.secondary_category_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      professor.subject_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    setSuggestions(filtered.slice(0, 10));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setSelectedIndex(-1);
    
    searchProfessors(newValue);
    setShowSuggestions(true);
    
    onChange(newValue);
  };

  const handleInputFocus = () => {
    if (inputValue) {
      searchProfessors(inputValue);
    }
    setShowSuggestions(true);
  };

  const handleInputBlur = () => {
    setTimeout(() => {
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }, 200);
  };

  const handleSuggestionClick = (professor: Professor) => {
    const displayValue = professor.name;
    setInputValue(displayValue);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    
    onChange(displayValue, professor);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSuggestionClick(suggestions[selectedIndex]);
        }
        break;
      
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const getInputStyle = () => {
    const baseStyle = {
      width: '100%',
      padding: '8px 12px',
      fontSize: '14px',
      outline: 'none',
      transition: 'all 0.2s ease',
      backgroundColor: disabled ? '#f9fafb' : 'white',
      ...style
    };

    if (showSuggestions && suggestions.length > 0) {
      return {
        ...baseStyle,
        border: '1px solid #3b82f6',
        borderTopLeftRadius: '6px',
        borderTopRightRadius: '6px',
        borderBottomLeftRadius: '0px',
        borderBottomRightRadius: '0px'
      };
    } else {
      return {
        ...baseStyle,
        border: '1px solid #d1d5db',
        borderRadius: '6px'
      };
    }
  };

  return (
    <React.Fragment>
      <style jsx>{`
        @keyframes spin {
          0% { transform: translateY(-50%) rotate(0deg); }
          100% { transform: translateY(-50%) rotate(360deg); }
        }
      `}</style>
      
      <div style={{ position: 'relative', width: '100%' }}>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          placeholder={loading ? "교수 데이터 로딩 중..." : placeholder}
          disabled={disabled || loading}
          required={required}
          className={className}
          style={getInputStyle()}
        />
        
        {showSuggestions && suggestions.length > 0 && (
          <div
            ref={suggestionsRef}
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              backgroundColor: 'white',
              border: '1px solid #3b82f6',
              borderTop: 'none',
              borderBottomLeftRadius: '6px',
              borderBottomRightRadius: '6px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              zIndex: 1000,
              maxHeight: '200px',
              overflowY: 'auto'
            }}
          >
            {suggestions.map((professor, index) => (
              <div
                key={`${professor.id}-${professor.category_type}`}
                onClick={() => handleSuggestionClick(professor)}
                style={{
                  padding: '12px',
                  cursor: 'pointer',
                  backgroundColor: selectedIndex === index ? '#f1f5f9' : 'white',
                  borderBottom: index < suggestions.length - 1 ? '1px solid #e5e7eb' : 'none',
                  transition: 'background-color 0.1s ease'
                }}
                onMouseEnter={(e) => {
                  if (selectedIndex !== index) {
                    e.currentTarget.style.backgroundColor = '#f8fafc';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedIndex !== index) {
                    e.currentTarget.style.backgroundColor = 'white';
                  }
                }}
              >
                {/* 교수명 */}
                <div style={{ 
                  fontWeight: '600', 
                  fontSize: '14px',
                  color: '#1f2937',
                  marginBottom: '6px'
                }}>
                  {professor.name}
                </div>
                
                {/* 카테고리 (단일 표시) */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span style={{
                    fontSize: '11px',
                    backgroundColor: professor.category_type === 'main' ? '#dcfce7' : '#ede9fe',
                    color: professor.category_type === 'main' ? '#166534' : '#7c2d12',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontWeight: '500'
                  }}>
                    {professor.category_name}
                  </span>
                  
                  {/* 보조 문구 삭제됨 */}
                </div>

              </div>
            ))}
          </div>
        )}
        
        {loading && (
          <div style={{
            position: 'absolute',
            right: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '16px',
            height: '16px',
            border: '2px solid #e5e7eb',
            borderTop: '2px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
        )}
      </div>
    </React.Fragment>
  );
};
