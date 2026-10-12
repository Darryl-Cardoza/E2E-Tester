/** Application adapters: only these explicitly configured collections support owned data. */
export const dataResources: Readonly<Record<string, { path: string }>> = {
  'test-users': { path: '/api/test-users' },
  'test-records': { path: '/api/test-records' },
};
