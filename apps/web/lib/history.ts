export type LocalSettings = {
  autoSaveHistory: boolean;
  saveRequestBody: boolean;
  saveResponseMeta: boolean;
  saveCookies: boolean;
};

export const defaultSettings: LocalSettings = {
  autoSaveHistory: false,
  saveRequestBody: true,
  saveResponseMeta: true,
  saveCookies: true,
};
