import { PDPForm, PDPStatus, User } from '../types';

// Use relative URL so it works on localhost or production automatically
const API_URL = '/api/pdps';

export const getAllPDPs = async (): Promise<PDPForm[]> => {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error('Failed to fetch data');
    return await response.json();
  } catch (error) {
    console.error("Error fetching PDPs:", error);
    return [];
  }
};

export const getPDPById = async (id: string): Promise<PDPForm | undefined> => {
  const pdps = await getAllPDPs();
  return pdps.find(p => p.id === id);
};

export const savePDP = async (pdp: PDPForm): Promise<void> => {
  await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pdp)
  });
};

export const updatePDP = async (pdp: PDPForm): Promise<void> => {
  // Using POST logic in server handles both insert and update for full object,
  // but let's be semantically correct or just reuse savePDP since server logic handles ID check.
  await savePDP(pdp);
};

// Users API
const USERS_API = '/api/users';

export const getAllUsers = async (): Promise<User[]> => {
  try {
    const response = await fetch(USERS_API);
    if (!response.ok) throw new Error('Failed to fetch users');
    return await response.json();
  } catch (error) {
    console.error("Error fetching users:", error);
    return [];
  }
};

export const saveUser = async (user: User): Promise<void> => {
  await fetch(USERS_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user)
  });
};

export const deleteUser = async (id: string): Promise<void> => {
  await fetch(`${USERS_API}/${id}`, {
    method: 'DELETE'
  });
};

export const updatePDPStatus = async (
  id: string, 
  status: PDPStatus, 
  comment?: string, 
  commentType?: 'headNurse' | 'supervisor' | 'manager' | 'qualityManager'
): Promise<void> => {
  // We need to fetch, update locally, then save back OR send partial update.
  // The server PUT expects the full object or partial? My server implementation 
  // currently merges fields: data[index] = { ...data[index], ...updatedFields };
  
  const payload: any = { status };
  if (comment && commentType) {
      if (commentType === 'headNurse') payload.headNurseComment = comment;
      if (commentType === 'supervisor') payload.supervisorComment = comment;
      if (commentType === 'manager') payload.managerComment = comment;
      if (commentType === 'qualityManager') payload.qualityManagerComment = comment;
  }

  await fetch(`${API_URL}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
};

export const deletePDP = async (id: string): Promise<void> => {
    await fetch(`${API_URL}/${id}`, {
        method: 'DELETE'
    });
};

export const resetPDPReview = async (id: string): Promise<void> => {
    // 1. Get current
    const pdp = await getPDPById(id);
    if (!pdp) return;

    // 2. Reset fields
    pdp.status = PDPStatus.SUBMITTED;
    pdp.headNurseComment = undefined;
    pdp.supervisorComment = undefined;
    pdp.managerComment = undefined;
    pdp.qualityManagerComment = undefined;
    
    pdp.responses = pdp.responses.map(r => ({
        ...r,
        hnApproved: undefined,
        hnOverride: undefined,
        supApproved: undefined,
        supOverride: undefined,
        managerApproved: undefined,
        managerOverride: undefined
    }));

    // 3. Save
    await savePDP(pdp);
};

export const restoreDatabase = async (fileContent: string): Promise<boolean> => {
  try {
    const data = JSON.parse(fileContent);
    if (Array.isArray(data)) {
      const res = await fetch('/api/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return res.ok;
    }
    return false;
  } catch (e) {
    return false;
  }
};