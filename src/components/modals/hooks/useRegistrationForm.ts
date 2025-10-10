import { useState, useEffect } from "react";

export interface FormData {
  id?: number;
  shoot_date: string;
  start_time: string;
  end_time: string;
  professor_name: string;
  course_name: string;
  course_code: string;
  shooting_type: string;
  notes: string;
  sub_location_id: number;
  location_name?: string;
  _delete?: boolean;
  _adminDirectEdit?: boolean;
  _requestApproval?: boolean;
}

const defaultForm: FormData = {
  shoot_date: "",
  start_time: "",
  end_time: "",
  professor_name: "",
  course_name: "",
  course_code: "",
  shooting_type: "",
  notes: "",
  sub_location_id: 0,
  location_name: ""
};

export const useRegistrationForm = ({
  type,
  initial,
  onSave
}: {
  type: "studio" | "academy";
  initial?: FormData;
  onSave: (data: FormData) => void;
}) => {
  const [form, setForm] = useState<FormData>(initial || defaultForm);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    setForm(initial || defaultForm);
  }, [initial]);

  const set = (key: keyof FormData, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // 시간 옵션 생성 (7:00 ~ 21:50, 10분 간격)
  const timeOptions = [];
  for (let hour = 7; hour < 22; hour++) {
    for (let min = 0; min < 60; min += 10) {
      const h = hour.toString().padStart(2, "0");
      const m = min.toString().padStart(2, "0");
      timeOptions.push(`${h}:${m}`);
    }
  }

  const academyTypes = ["촬영", "중계", "본사", "라이브", "부아"];
  const studioTypes = ["PPT", "일반칠판", "전자칠판", "크로마키", "PC와콤", "PC"];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 기본 검증
    if (!form.start_time || !form.end_time) {
      alert('시작 시간과 종료 시간을 선택해주세요.');
      return;
    }
    
    if (!form.professor_name) {
      alert(type === 'studio' ? '교수명을 입력해주세요.' : '강사명을 입력해주세요.');
      return;
    }
    
    if (type === 'academy' && !form.course_name) {
      alert('강의명을 입력해주세요.');
      return;
    }
    
    if (!form.shooting_type) {
      alert('촬영형식을 선택해주세요.');
      return;
    }

    setIsProcessing(true);
    try {
      await onSave(form);
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    form,
    set,
    timeOptions,
    academyTypes,
    studioTypes,
    handleSubmit,
    isProcessing
  };
};
