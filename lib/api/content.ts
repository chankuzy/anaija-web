import { api } from "./client";

export interface PublishingCapabilities {
  ready: boolean;
  kinds: { poll: boolean; document: boolean; article: boolean; announcement: boolean };
  publishers: { id: number; name: string; type: string }[];
}

export const contentApi = {
  capabilities: () => api.get<PublishingCapabilities>("publishing-capabilities"),
};
