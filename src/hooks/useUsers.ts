import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';
import type {
  User,
  UserDetailResponse,
  UserListResponse,
  CreateUserFormData,
  UpdateUserFormData,
  UserFilters,
  UserSortOptions,
  BulkUserOperation,
  BulkOperationResult
} from '../types/users';

// 🔥 useUsers 훅을 named export로 정의
export const useUsers = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  // 사용자 목록 조회
  const fetchUsers = useCallback(async (
    filters?: UserFilters,
    sort?: UserSortOptions,
    page = 1,
    limit = 20
  ) => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('user_profiles')
        .select(`
          id,
          name,
          email,
          role,
          shooter_type,
          team_id,
          created_at,
          updated_at
        `);

      // 필터 적용
      if (filters?.role) {
        query = query.eq('role', filters.role);
      }
      if (filters?.team_id) {
        query = query.eq('team_id', filters.team_id);
      }
      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
      }

      // 정렬 적용
      if (sort) {
        query = query.order(sort.field, { ascending: sort.direction === 'asc' });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      // 페이지네이션
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      setUsers(data || []);
      setTotal(count || 0);
      setCurrentPage(page);
    } catch (err) {
      console.error('사용자 목록 조회 오류:', err);
      setError(err instanceof Error ? err.message : '사용자 목록을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  // 사용자 상세 정보 조회
  const fetchUserDetail = useCallback(async (userId: number): Promise<UserDetailResponse | null> => {
    try {
      const { data: user, error: userError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (userError) throw userError;

      // 역할 정보 조회
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select(`
          role_id,
          assigned_at,
          roles(id, name, description)
        `)
        .eq('user_id', userId);

      if (rolesError) throw rolesError;

      return {
        user,
        roles: roles?.map(r => r.roles) || [],
        team_assignments: []
      };
    } catch (err) {
      console.error('사용자 상세 조회 오류:', err);
      setError(err instanceof Error ? err.message : '사용자 정보를 불러올 수 없습니다.');
      return null;
    }
  }, []);

  // 사용자 생성
  const createUser = useCallback(async (userData: CreateUserFormData): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const { data: newUser, error: createError } = await supabase
        .from('user_profiles')
        .insert({
          name: userData.name,
          email: userData.email,
          username: userData.username,
          role: userData.role,
          shooter_type: userData.shooter_type,
          hourly_rate: userData.hourly_rate,
          specialties: userData.specialties,
          team_id: userData.team_id,
          password_hash: userData.password
        })
        .select()
        .single();

      if (createError) throw createError;

      // 역할 할당
      if (userData.role) {
        const { data: role } = await supabase
          .from('roles')
          .select('id')
          .eq('name', userData.role)
          .single();

        if (role) {
          await supabase
            .from('user_roles')
            .insert({
              user_id: newUser.id,
              role_id: role.id
            });
        }
      }

      await fetchUsers();
      return true;
    } catch (err) {
      console.error('사용자 생성 오류:', err);
      setError(err instanceof Error ? err.message : '사용자를 생성할 수 없습니다.');
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchUsers]);

  // 사용자 수정
  const updateUser = useCallback(async (userData: UpdateUserFormData): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          name: userData.name,
          role: userData.role,
          shooter_type: userData.shooter_type,
          hourly_rate: userData.hourly_rate,
          specialties: userData.specialties,
          team_id: userData.team_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', userData.id);

      if (error) throw error;

      await fetchUsers();
      return true;
    } catch (err) {
      console.error('사용자 수정 오류:', err);
      setError(err instanceof Error ? err.message : '사용자 정보를 수정할 수 없습니다.');
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchUsers]);

  // 사용자 삭제
  const deleteUser = useCallback(async (userId: number): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) throw error;

      await fetchUsers();
      return true;
    } catch (err) {
      console.error('사용자 삭제 오류:', err);
      setError(err instanceof Error ? err.message : '사용자를 삭제할 수 없습니다.');
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchUsers]);

  // 대량 작업
  const bulkOperation = useCallback(async (operation: BulkUserOperation): Promise<BulkOperationResult> => {
    setLoading(true);
    setError(null);

    try {
      let successCount = 0;
      let failedCount = 0;
      const errors: string[] = [];

      for (const userId of operation.user_ids) {
        try {
          switch (operation.operation) {
            case 'activate':
              // 활성화 로직
              break;
            case 'deactivate':
              // 비활성화 로직
              break;
            case 'delete':
              await deleteUser(userId);
              break;
            case 'assign_role':
              // 역할 할당 로직
              break;
          }
          successCount++;
        } catch (err) {
          failedCount++;
          errors.push(`사용자 ${userId}: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
        }
      }

      return { success_count: successCount, failed_count: failedCount, errors };
    } catch (err) {
      console.error('대량 작업 오류:', err);
      setError(err instanceof Error ? err.message : '대량 작업을 수행할 수 없습니다.');
      return { 
        success_count: 0, 
        failed_count: operation.user_ids.length, 
        errors: [err instanceof Error ? err.message : '알 수 없는 오류'] 
      };
    } finally {
      setLoading(false);
    }
  }, [deleteUser]);

  return {
    // 상태
    users,
    loading,
    error,
    total,
    currentPage,
    
    // 함수들
    fetchUsers,
    fetchUserDetail,
    createUser,
    updateUser,
    deleteUser,
    bulkOperation,
    
    // 유틸리티
    setError,
    setCurrentPage
  };
};

// 🔥 useRoles 훅도 named export로 정의
export const useRoles = () => {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .order('name');

      if (error) throw error;
      setRoles(data || []);
    } catch (err) {
      console.error('역할 목록 조회 오류:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  return { roles, loading, fetchRoles };
};
