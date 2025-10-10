import { useState, useCallback } from 'react';

export type ModalType = 'registration' | 'edit' | 'detail' | 'reassign';

interface ModalData {
  open: boolean;
  data?: any;
}

export const useStudioModal = () => {
  const [modals, setModals] = useState<Record<ModalType, ModalData>>({
    registration: { open: false, data: null },
    edit: { open: false, data: null },
    detail: { open: false, data: null },
    reassign: { open: false, data: null }
  });

  const openModal = useCallback((type: ModalType, data?: any) => {
    setModals(prev => ({
      ...prev,
      [type]: { open: true, data }
    }));
  }, []);

  const closeModal = useCallback((type: ModalType) => {
    setModals(prev => ({
      ...prev,
      [type]: { open: false, data: null }
    }));
  }, []);

  const closeAllModals = useCallback(() => {
    setModals({
      registration: { open: false, data: null },
      edit: { open: false, data: null },
      detail: { open: false, data: null },
      reassign: { open: false, data: null }
    });
  }, []);

  return {
    modals,
    openModal,
    closeModal,
    closeAllModals
  };
};
