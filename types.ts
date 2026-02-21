export enum UserRole {
  NURSE = 'NURSE', // General staff filling the form
  HEAD_NURSE = 'HEAD_NURSE',
  SUPERVISOR = 'SUPERVISOR',
  MANAGER = 'MANAGER', // Nursing Manager (Ms. Bagheri / Ms. Khosravani)
  QUALITY_MANAGER = 'QUALITY_MANAGER', // Quality Improvement Manager (Modir Behbood - Ms. Khosravani)
  DEVELOPER = 'DEVELOPER' // Developer / Admin (Hassan Shamloo)
}

export enum PDPStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED', // Waiting for Head Nurse
  APPROVED_BY_HN = 'APPROVED_BY_HN', // Waiting for Supervisor
  APPROVED_BY_SUP = 'APPROVED_BY_SUP', // Finalized/Visible to Manager
  APPROVED_BY_MANAGER = 'APPROVED_BY_MANAGER', // Final Approval by Nursing Manager
  APPROVED_BY_QM = 'APPROVED_BY_QM', // Finalized by Quality Manager (for Non-clinical)
  REJECTED = 'REJECTED'
}

export enum WardType {
  CLINICAL = 'CLINICAL',
  NON_CLINICAL = 'NON_CLINICAL'
}

export enum JobCategory {
  SET_9_MANAGEMENT = 'SET_9_MANAGEMENT', // Head Nurse, Supervisor
  SET_10_CLINICAL = 'SET_10_CLINICAL',   // Nurse, Midwife, OR, Anesthesia
  SET_11_ASSISTANT = 'SET_11_ASSISTANT', // Assistant Nurse
  SET_12_SECRETARY = 'SET_12_SECRETARY', // Secretary
  SET_13_SUPPORT = 'SET_13_SUPPORT'      // Admin, Support, Other
}

export interface User {
  id: string;
  username: string;
  password?: string;
  name: string;
  role: UserRole;
  ward?: string; // For Head Nurses
  wardType?: WardType; // For Head Nurses
  floor?: string; // Floor level
}

export interface BioData {
  fullName: string;
  nationalId: string;
  education: string;
  formDate: string;
  hireDate: string;
  mobile: string;
  personnelId: string;
  orgPost: string; // Now acts as the key for logic
}

export interface QuestionResponse {
  questionId: string;
  questionText: string;
  section: string;
  answer: string;
  
  // Head Nurse Review
  hnApproved?: boolean;
  hnOverride?: string; // The corrected answer if rejected
  hnReason?: string;   // Reason for rejection/comment

  // Supervisor Review
  supApproved?: boolean;
  supOverride?: string; // The corrected answer if rejected
  supReason?: string;   // Reason for rejection/comment

  // Manager Review
  managerApproved?: boolean;
  managerOverride?: string;
  managerReason?: string; // Reason for rejection/comment
}

export interface PDPForm {
  id: string;
  userId: string;
  nurseName: string;
  ward: string;
  submissionDate: string;
  status: PDPStatus;
  
  // New fields
  bioData: BioData;
  jobCategory: JobCategory;
  responses: QuestionResponse[];

  headNurseComment?: string;
  supervisorComment?: string;
  managerComment?: string;
  qualityManagerComment?: string;
}

export interface QuestionDefinition {
  id: string;
  text: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  allowMultiple?: boolean;
  type?: 'text' | 'select' | 'textarea';
}

export interface QuestionSection {
  title: string;
  questions: QuestionDefinition[];
}

export interface JobCategoryConfig {
  id: JobCategory;
  title: string;
  sections: QuestionSection[];
}