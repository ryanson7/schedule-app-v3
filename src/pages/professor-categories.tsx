"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';

// 타입 정의
interface ProfessorCategory {
  id: number;
  category_code: string;
  category_name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface FormData {
  category_code: string;
  category_name: string;
  description: string;
  is_active: boolean;
}

const ProfessorCategoriesPage: React.FC = (): JSX.Element => {
  // State 정의
  const [categories, setCategories] = useState<ProfessorCategory[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<ProfessorCategory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingCategory, setEditingCategory] = useState<ProfessorCategory | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // 검색 및 필터 상태
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  const [formData, setFormData] = useState<FormData>({
    category_code: '',
    category_name: '',
    description: '',
    is_active: true
  });

  // Effect Hooks
  useEffect(() => {
    fetchCategories();
  }, []);

  // 필터링 로직
  useEffect(() => {
    let filtered = categories;

    // 검색어 필터
    if (searchTerm) {
      filtered = filtered.filter(category => 
        category.category_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        category.category_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (category.description && category.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // 상태 필터
    if (statusFilter !== 'all') {
      filtered = filtered.filter(category => 
        statusFilter === 'active' ? category.is_active : !category.is_active
      );
    }

    setFilteredCategories(filtered);
  }, [categories, searchTerm, statusFilter]);

  // 카테고리 목록 조회
  const fetchCategories = async (): Promise<void> => {
    try {
      setLoading(true);
      console.log('📚 카테고리 데이터 조회 시작...');
      
      const { data, error } = await supabase
        .from('professor_categories')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setCategories(data || []);
      console.log('✅ 카테고리 데이터 조회 성공:', data?.length || 0, '개');
      
    } catch (error) {
      console.error('❌ fetchCategories 오류:', error);
      alert(`카테고리 조회 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
      setCategories([]);
    } finally {
      setLoading(false);
      console.log('📚 카테고리 데이터 조회 완료');
    }
  };

  // 카테고리 코드 중복 확인
  const checkDuplicateCode = async (code: string, excludeId?: number): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('professor_categories')
        .select('id')
        .eq('category_code', code)
        .neq('id', excludeId || 0);
        
      if (error) throw error;
      return data && data.length > 0;
    } catch (error) {
      console.error('중복 확인 오류:', error);
      return false;
    }
  };

  // 카테고리 추가/수정
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    
    if (!formData.category_code.trim() || !formData.category_name.trim()) {
      alert('카테고리 코드와 이름은 필수입니다.');
      return;
    }

    // 카테고리 코드 형식 검증
    const codeRegex = /^[A-Z_]+$/;
    if (!codeRegex.test(formData.category_code)) {
      alert('카테고리 코드는 대문자와 언더스코어만 사용 가능합니다. (예: REAL_ESTATE)');
      return;
    }

    try {
      setSubmitting(true);
      
      // 중복 확인 (수정 시에는 자기 자신 제외)
      const isDuplicate = await checkDuplicateCode(
        formData.category_code, 
        editingCategory?.id
      );
      
      if (isDuplicate) {
        alert('이미 존재하는 카테고리 코드입니다.');
        return;
      }

      if (editingCategory) {
        // 수정
        const { error } = await supabase
          .from('professor_categories')
          .update({
            category_code: formData.category_code.trim(),
            category_name: formData.category_name.trim(),
            description: formData.description.trim() || null,
            is_active: formData.is_active,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingCategory.id);
          
        if (error) throw error;
        alert('카테고리가 성공적으로 수정되었습니다.');
      } else {
        // 추가
        const { error } = await supabase
          .from('professor_categories')
          .insert([{
            category_code: formData.category_code.trim(),
            category_name: formData.category_name.trim(),
            description: formData.description.trim() || null,
            is_active: formData.is_active
          }]);
          
        if (error) throw error;
        alert('새 카테고리가 성공적으로 추가되었습니다.');
      }
      
      closeModal();
      fetchCategories();
    } catch (error) {
      console.error('저장 실패:', error);
      alert(`저장 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setSubmitting(false);
    }
  };

  // 카테고리 삭제 (소프트 삭제)
  const handleDelete = async (id: number, name: string): Promise<void> => {
    if (!confirm(`"${name}" 카테고리를 비활성화하시겠습니까?\n\n⚠️ 이 카테고리를 사용하는 교수가 있을 수 있습니다.`)) return;

    try {
      const { error } = await supabase
        .from('professor_categories')
        .update({ 
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
        
      if (error) throw error;
      alert('카테고리가 비활성화되었습니다.');
      fetchCategories();
    } catch (error) {
      alert(`삭제 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  };

  // 카테고리 활성화/비활성화 토글
  const toggleStatus = async (id: number, currentStatus: boolean, name: string): Promise<void> => {
    const newStatus = !currentStatus;
    const action = newStatus ? '활성화' : '비활성화';
    
    if (!confirm(`"${name}" 카테고리를 ${action}하시겠습니까?`)) return;

    try {
      const { error } = await supabase
        .from('professor_categories')
        .update({ 
          is_active: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
        
      if (error) throw error;
      alert(`카테고리가 ${action}되었습니다.`);
      fetchCategories();
    } catch (error) {
      alert(`상태 변경 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  };

  // 수정 모달 열기
  const openEditModal = (category: ProfessorCategory): void => {
    setEditingCategory(category);
    setFormData({
      category_code: category.category_code,
      category_name: category.category_name,
      description: category.description || '',
      is_active: category.is_active
    });
    setShowModal(true);
  };

  // 모달 닫기
  const closeModal = (): void => {
    setShowModal(false);
    setEditingCategory(null);
    setFormData({
      category_code: '',
      category_name: '',
      description: '',
      is_active: true
    });
  };

  // 필터 초기화
  const resetFilters = (): void => {
    setSearchTerm('');
    setStatusFilter('all');
  };

  // 카테고리 코드 자동 생성 (카테고리명에서)
  const generateCategoryCode = (name: string): string => {
    return name
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '_')
      .replace(/[^A-Z_]/g, '')
      .substring(0, 50);
  };

  // 카테고리명 변경시 코드 자동 생성
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const name = e.target.value;
    setFormData({
      ...formData,
      category_name: name,
      // 신규 추가시에만 자동 생성
      category_code: !editingCategory ? generateCategoryCode(name) : formData.category_code
    });
  };

  if (loading) return <div className="loading">카테고리 목록 로딩 중...</div>;

  return (
    <div className="container">
      {/* 헤더 */}
      <div className="header">
        <h1>📚 교수 카테고리 관리 ({filteredCategories.length}/{categories.length}개)</h1>
        <div className="header-actions">
          <button className="btn-add" onClick={() => setShowModal(true)}>
            + 카테고리 추가
          </button>
        </div>
      </div>

      {/* 검색 및 필터 섹션 */}
      <div className="search-filter-section">
        <div className="search-filters">
          <div className="filter-group">
            <label>🔍 검색</label>
            <input
              type="text"
              placeholder="카테고리명, 코드, 설명 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          
          <div className="filter-group">
            <label>📊 상태</label>
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">전체</option>
              <option value="active">활성</option>
              <option value="inactive">비활성</option>
            </select>
          </div>
          
          <div className="filter-group">
            <button className="btn-reset" onClick={resetFilters}>
              🔄 초기화
            </button>
          </div>
        </div>
      </div>

      {/* 안내 정보 */}
      <div className="info-notice">
        <p>📝 <strong>카테고리 코드:</strong> 대문자와 언더스코어만 사용 가능합니다 (예: REAL_ESTATE, PUBLIC_OFFICIAL)</p>
        <p>🔄 <strong>자동 생성:</strong> 카테고리명을 입력하면 코드가 자동으로 생성됩니다.</p>
        <p>⚠️ <strong>삭제 주의:</strong> 이미 사용 중인 카테고리는 비활성화만 가능합니다.</p>
      </div>

      {/* 테이블 */}
      <div className="table-wrapper">
        <table className="table" style={{tableLayout: 'fixed'}}>
          <thead>
            <tr>
              <th style={{width: '150px', textAlign: 'center'}}>카테고리 코드</th>
              <th style={{width: '200px', textAlign: 'center'}}>카테고리명</th>
              <th style={{width: '300px', textAlign: 'center'}}>설명</th>
              <th style={{width: '80px', textAlign: 'center'}}>상태</th>
              <th style={{width: '120px', textAlign: 'center'}}>생성일</th>
              <th style={{width: '200px', textAlign: 'center'}}>관리</th>
            </tr>
          </thead>
          <tbody>
            {filteredCategories.map(category => (
              <tr key={category.id}>
                <td style={{ textAlign: 'center' }}>
                  <code className="category-code">{category.category_code}</code>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <strong>{category.category_name}</strong>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <div className="description-cell">
                    {category.description || '-'}
                  </div>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <button
                    className={`status-btn ${category.is_active ? 'active' : 'inactive'}`}
                    onClick={() => toggleStatus(category.id, category.is_active, category.category_name)}
                    title="클릭하여 상태 변경"
                  >
                    {category.is_active ? '활성' : '비활성'}
                  </button>
                </td>
                <td style={{ textAlign: 'center' }}>
                  {new Date(category.created_at).toLocaleDateString('ko-KR')}
                </td>
                <td style={{ textAlign: 'center' }}>
                  <div className="action-buttons">
                    <button className="btn-edit" onClick={() => openEditModal(category)}>
                      수정
                    </button>
                    <button 
                      className="btn-delete" 
                      onClick={() => handleDelete(category.id, category.category_name)}
                    >
                      비활성화
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 빈 결과 메시지 */}
        {filteredCategories.length === 0 && categories.length > 0 && (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <h3>검색 결과가 없습니다</h3>
            <p>다른 검색어나 필터를 시도해보세요.</p>
            <button className="btn-reset-search" onClick={resetFilters}>
              필터 초기화
            </button>
          </div>
        )}

        {categories.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">📚</div>
            <h3>등록된 카테고리가 없습니다</h3>
            <p>새 카테고리를 추가해보세요.</p>
            <button className="btn-add-first" onClick={() => setShowModal(true)}>
              첫 번째 카테고리 추가
            </button>
          </div>
        )}
      </div>

      {/* 카테고리 추가/수정 모달 */}
      {showModal && (
        <div className="modal" onClick={closeModal}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingCategory ? '카테고리 수정' : '새 카테고리 추가'}</h2>
              <button className="close-btn" onClick={closeModal}>×</button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>카테고리명 *</label>
                <input 
                  type="text"
                  value={formData.category_name}
                  onChange={handleNameChange}
                  required 
                  placeholder="예: 공인중개사"
                  maxLength={100}
                />
              </div>

              <div className="form-group">
                <label>카테고리 코드 * <small>(대문자, 언더스코어만)</small></label>
                <input 
                  type="text"
                  value={formData.category_code}
                  onChange={e => setFormData({...formData, category_code: e.target.value.toUpperCase()})}
                  required 
                  placeholder="예: REAL_ESTATE_BROKER"
                  maxLength={50}
                  pattern="[A-Z_]+"
                />
                <small className="form-hint">
                  영문 대문자와 언더스코어만 사용 가능합니다.
                </small>
              </div>
              
              <div className="form-group">
                <label>설명</label>
                <textarea 
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  placeholder="카테고리에 대한 상세 설명을 입력하세요"
                  rows={3}
                  maxLength={500}
                />
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={e => setFormData({...formData, is_active: e.target.checked})}
                  />
                  활성 상태
                </label>
              </div>
              
              <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={closeModal}>
                  취소
                </button>
                <button 
                  type="submit" 
                  className="btn-submit"
                  disabled={submitting}
                >
                  {submitting ? '저장 중...' : (editingCategory ? '수정' : '추가')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 스타일 */}
      <style jsx>{`
        .container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        
        .loading {
          text-align: center;
          padding: 60px;
          font-size: 18px;
          color: #666;
        }
        
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        
        .header h1 {
          margin: 0;
          font-size: 32px;
          font-weight: 700;
          color: #2c3e50;
        }
        
        .header-actions {
          display: flex;
          gap: 12px;
        }
        
        .btn-add {
          padding: 12px 24px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          transition: all 0.2s;
          background: #007bff;
          color: white;
        }
        
        .btn-add:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }
        
        /* 검색/필터 섹션 */
        .search-filter-section {
          background: white;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 20px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .search-filters {
          display: flex;
          gap: 16px;
          align-items: end;
          flex-wrap: wrap;
        }
        
        .filter-group {
          display: flex;
          flex-direction: column;
          min-width: 200px;
        }
        
        .filter-group label {
          font-weight: 600;
          color: #2c3e50;
          margin-bottom: 8px;
          font-size: 14px;
        }
        
        .search-input, .filter-select {
          padding: 10px 14px;
          border: 2px solid #e9ecef;
          border-radius: 8px;
          font-size: 14px;
          transition: border-color 0.2s;
        }
        
        .search-input:focus, .filter-select:focus {
          outline: none;
          border-color: #007bff;
        }
        
        .btn-reset {
          padding: 10px 16px;
          background: #6c757d;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
        }
        
        .btn-reset:hover {
          background: #5a6268;
          transform: translateY(-1px);
        }
        
        .info-notice {
          background: #e8f4f8;
          border: 1px solid #bee5eb;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 20px;
        }
        
        .info-notice p {
          margin: 0 0 8px 0;
          color: #0c5460;
          font-size: 14px;
        }
        
        .table-wrapper {
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        
        .table {
          width: 100%;
          border-collapse: collapse;
        }
        
        .table th, .table td {
          padding: 16px;
          text-align: center;
          border-bottom: 1px solid #f1f3f4;
        }
        
        .table th {
          background: #f8f9fa;
          font-weight: 600;
          color: #495057;
          font-size: 14px;
        }
        
        .table tr:hover {
          background: #f8f9fa;
        }
        
        .category-code {
          background: #f8f9fa;
          padding: 4px 8px;
          border-radius: 4px;
          font-family: 'Monaco', 'Consolas', monospace;
          font-size: 13px;
          color: #007bff;
          border: 1px solid #dee2e6;
        }
        
        .description-cell {
          max-width: 300px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #6c757d;
          font-size: 14px;
        }
        
        .status-btn {
          padding: 6px 12px;
          border: none;
          border-radius: 14px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .status-btn.active {
          background: #28a745;
          color: white;
        }
        
        .status-btn.inactive {
          background: #6c757d;
          color: white;
        }
        
        .status-btn:hover {
          transform: scale(1.05);
        }
        
        .action-buttons {
          display: flex;
          gap: 6px;
          justify-content: center;
          flex-wrap: wrap;
        }
        
        .btn-edit, .btn-delete {
          padding: 6px 12px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 11px;
          font-weight: 500;
          transition: all 0.2s;
        }
        
        .btn-edit {
          background: #007bff;
          color: white;
        }
        
        .btn-delete {
          background: #dc3545;
          color: white;
        }
        
        .btn-edit:hover, .btn-delete:hover {
          transform: translateY(-1px);
        }
        
        .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: #666;
        }
        
        .empty-icon {
          font-size: 64px;
          margin-bottom: 20px;
        }
        
        .btn-reset-search, .btn-add-first {
          background: #007bff;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          margin-top: 16px;
        }
        
        .modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        
        .modal-box {
          background: white;
          border-radius: 12px;
          width: 90%;
          max-width: 500px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        }
        
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px 24px 0;
          margin-bottom: 20px;
        }
        
        .modal-header h2 {
          margin: 0;
          color: #2c3e50;
          font-size: 20px;
          font-weight: 700;
        }
        
        .close-btn {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #999;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .close-btn:hover {
          background: #f1f3f4;
          color: #333;
        }
        
        form {
          padding: 0 24px 24px;
        }
        
        .form-group {
          margin-bottom: 20px;
        }
        
        .form-group label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          color: #2c3e50;
          font-size: 14px;
        }
        
        .form-group label small {
          font-weight: normal;
          color: #666;
          font-size: 12px;
        }
        
        .form-group input, .form-group textarea, .form-group select {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #e9ecef;
          border-radius: 8px;
          font-size: 14px;
          transition: border-color 0.2s;
          box-sizing: border-box;
        }
        
        .form-group input:focus, .form-group textarea:focus, .form-group select:focus {
          outline: none;
          border-color: #007bff;
        }
        
        .form-hint {
          display: block;
          margin-top: 4px;
          font-size: 12px;
          color: #6c757d;
        }
        
        .checkbox-label {
          display: flex !important;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }
        
        .checkbox-label input[type="checkbox"] {
          width: auto !important;
          margin: 0;
        }
        
        .form-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e9ecef;
        }
        
        .btn-cancel, .btn-submit {
          padding: 12px 24px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          transition: all 0.2s;
        }
        
        .btn-cancel {
          background: #6c757d;
          color: white;
        }
        
        .btn-submit {
          background: #007bff;
          color: white;
        }
        
        .btn-submit:disabled {
          background: #6c757d;
          cursor: not-allowed;
        }
        
        .btn-cancel:hover, .btn-submit:hover:not(:disabled) {
          transform: translateY(-1px);
        }
        
        @media (max-width: 768px) {
          .container {
            padding: 16px;
          }
          
          .header {
            flex-direction: column;
            gap: 16px;
            text-align: center;
          }
          
          .search-filters {
            flex-direction: column;
            align-items: stretch;
          }
          
          .filter-group {
            min-width: auto;
          }
          
          .table-wrapper {
            overflow-x: auto;
          }
          
          .modal-box {
            width: 95%;
            margin: 20px;
          }
          
          .action-buttons {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
};

export default ProfessorCategoriesPage;
