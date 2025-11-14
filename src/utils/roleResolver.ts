//src/utils/roleResolver.ts
import { normalizeUserRole, UserRoleType } from '../types/users';

type ManagerRelation =
  | { manager_type?: string | null; managerType?: string | null; role?: string | null }
  | null
  | undefined;

const extractManagerType = (relation: ManagerRelation | ManagerRelation[]): string | undefined => {
  if (!relation) {
    return undefined;
  }

  if (Array.isArray(relation)) {
    for (const entry of relation) {
      const candidate = extractManagerType(entry);
      if (candidate) {
        return candidate;
      }
    }
    return undefined;
  }

  const candidate =
    relation.manager_type ?? relation.managerType ?? relation.role ?? undefined;

  if (typeof candidate === 'string' && candidate.trim().length > 0) {
    return candidate;
  }

  return undefined;
};

export const resolveEffectiveRole = (
  baseRole: string | null | undefined,
  managerRelation?: ManagerRelation | ManagerRelation[]
): UserRoleType => {
  const normalizedBase = normalizeUserRole(baseRole || 'staff');

  if (normalizedBase !== 'manager') {
    return normalizedBase;
  }

  const derived = extractManagerType(managerRelation);

  if (!derived) {
    return normalizedBase;
  }

  const normalizedDerived = normalizeUserRole(derived);

  return normalizedDerived === 'manager' ? normalizedBase : normalizedDerived;
};
