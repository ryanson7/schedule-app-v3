// src/api/userService.ts
import { supabase } from '../utils/supabaseClient';

export const professorAPI = {
  // 카테고리 조회
  async fetchCategories() {
    const { data, error } = await supabase
      .from('professor_categories')
      .select('id, category_name, is_active, created_at')
      .eq('is_active', true)
      .order('category_name');

    if (error) throw error;
    return data || [];
  },

  // 교수 목록 조회 (간단한 방식)
  async fetchProfessors() {
    const { data, error } = await supabase
      .from('users')
      .select(`
        id, name, email, phone, role, status, is_active, created_at, updated_at,
        professors!inner (
          professor_category_id, 
          secondary_category_id
        )
      `)
      .eq('role', 'professor')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;

    // 카테고리 정보 별도 조회
    const categoryIds = [...new Set([
      ...data.filter(u => u.professors[0]?.professor_category_id).map(u => u.professors[0].professor_category_id),
      ...data.filter(u => u.professors[0]?.secondary_category_id).map(u => u.professors[0].secondary_category_id)
    ])];

    let categories = [];
    if (categoryIds.length > 0) {
      const { data: categoriesData } = await supabase
        .from('professor_categories')
        .select('id, category_name')
        .in('id', categoryIds);
      categories = categoriesData || [];
    }

    // 데이터 매핑
    return (data || []).map(user => ({
      ...user,
      phone_display: user.phone ? user.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3') : '',
      phone_raw: user.phone || '',
      professor_category_id: user.professors[0]?.professor_category_id,
      secondary_category_id: user.professors[0]?.secondary_category_id,
      professor_category_name: categories.find(c => c.id === user.professors[0]?.professor_category_id)?.category_name,
      secondary_category_name: categories.find(c => c.id === user.professors[0]?.secondary_category_id)?.category_name,
    }));
  },

  // 교수 생성
  async createProfessor(data) {
    // 1. users 테이블에 삽입
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert([{
        name: data.name,
        phone: data.phone,
        role: 'professor',
        status: data.status || 'active',
        is_active: true
      }])
      .select()
      .single();

    if (userError) throw userError;

    // 2. professors 테이블에 삽입
    const { error: professorError } = await supabase
      .from('professors')
      .insert([{
        user_id: userData.id,
        professor_category_id: data.professor_category_id,
        secondary_category_id: data.secondary_category_id
      }]);

    if (professorError) throw professorError;

    return { userData };
  },

  // 교수 수정
  async updateProfessor(id, data) {
    // users 테이블 업데이트
    if (data.name || data.phone || data.status) {
      const { error: userError } = await supabase
        .from('users')
        .update({
          ...(data.name && { name: data.name }),
          ...(data.phone && { phone: data.phone }),
          ...(data.status && { status: data.status }),
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (userError) throw userError;
    }

    // professors 테이블 업데이트
    if (data.professor_category_id !== undefined || data.secondary_category_id !== undefined) {
      const { error: professorError } = await supabase
        .from('professors')
        .update({
          ...(data.professor_category_id !== undefined && { professor_category_id: data.professor_category_id }),
          ...(data.secondary_category_id !== undefined && { secondary_category_id: data.secondary_category_id })
        })
        .eq('user_id', id);

      if (professorError) throw professorError;
    }
  },

  // 교수 삭제
  async deleteProfessor(id) {
    const { error } = await supabase
      .from('users')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
  }
};
