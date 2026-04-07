export interface AppResponse {
  packageName: string;
  name: string;
}

const api = {
  apps: {
    publish: async (packageName: string) => {
      return Promise.resolve(true);
    },
    getByPackageName: async (packageName: string): Promise<AppResponse> => {
      return Promise.resolve({
        packageName,
        name: 'Mock App'
      });
    }
  }
};

export default api;
