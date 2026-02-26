// Branch ID to name mapping
export const branchIdToName: { [id: string]: string } = {
  'cml46do4q0000ob5g27krklqe': 'Downtown',
  'cml46do4s0001ob5gs267tqmu': 'Airport',
};

// Helper function to get branch name by ID
export function getBranchName(branchId?: string): string {
  if (!branchId) return 'Unknown Branch';
  return branchIdToName[branchId] || branchId;
}

// Export as default object with hardcoded branches (temporary - will be replaced by API call)
export const defaultBranches = [
  { id: 'cml46do4q0000ob5g27krklqe', name: 'Downtown' },
  { id: 'cml46do4s0001ob5gs267tqmu', name: 'Airport' },
];
