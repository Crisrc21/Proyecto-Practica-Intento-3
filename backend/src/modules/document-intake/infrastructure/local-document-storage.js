export function createLocalDocumentStorage(env) {
  return {
    getPrivatePath() {
      return env.dataPrivatePath;
    }
  };
}
