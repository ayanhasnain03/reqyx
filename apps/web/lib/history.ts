export type LocalSettings = {
  autoSaveHistory: boolean;
  saveRequestBody: boolean;
  saveResponseMeta: boolean;
};

export const defaultSettings: LocalSettings = {
  autoSaveHistory: false,
  saveRequestBody: true,
  saveResponseMeta: true,
};
