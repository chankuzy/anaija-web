import { api } from "./client";
import { normPost } from "./feed";
import type { ListingDetail, Post } from "./feed-types";
import { mediaUrl } from "./feed";
import type { LocationInfo } from "@/lib/location/types";

export interface DayHours {
  open: string;
  close: string;
  closed?: boolean;
}
export interface ListingDetailFull extends ListingDetail {
  contact_preference?: string;
  contact_phone?: string | null;
  pickup_info?: string | null;
  location_info?: LocationInfo | null;
  quantity?: number;
  views_count?: number;
  inquiries_count?: number;
  has_inquired?: boolean;
  business_description?: string | null;
  fulfillment_type?: string | null;
  accepting_orders?: boolean | null;
  delivery_available?: boolean;
  opening_hours?: Record<string, DayHours> | null;
  estimated_delivery?: number | null;
  service_radius_km?: number | null;
  minimum_order_price?: number | null; // minor units
  verification_status?: string;
}
export type ListingFull = Omit<Post, "listing"> & {
  listing: ListingDetailFull | null;
  has_inquired?: boolean;
};

export interface Inquiry {
  id: number;
  status: string;
  message: string | null;
  created_at: string;
  conversation_id: number | null;
  buyer: { id: number; name: string | null; username: string | null; avatar: string | null } | null;
}

export type ListingStatus = "available" | "reserved" | "sold";
const STATUS_FN: Record<ListingStatus, string> = {
  available: "marketplace-available",
  reserved: "marketplace-reserve",
  sold: "marketplace-sold",
};

// Contracts read from marketplace-show / -inquire / -inquiries / -sold / -reserve / -available.
export const listingApi = {
  show: async (id: number, signal?: AbortSignal): Promise<ListingFull> =>
    normPost(await api.get<Post>(`marketplace-show/${id}`, undefined, signal)) as unknown as ListingFull,
  // 201 { conversation_id }; 409 = already inquired.
  inquire: (id: number, message: string) => api.post<{ conversation_id: number }>(`marketplace-inquire/${id}`, { message }),
  setStatus: (id: number, s: ListingStatus) => api.post<{ message: string }>(`${STATUS_FN[s]}/${id}`, {}),
  inquiries: async (id: number) =>
    ((await api.get<{ data?: Inquiry[] }>(`marketplace-inquiries/${id}`)).data ?? []).map((i) => ({
      ...i,
      buyer: i.buyer ? { ...i.buyer, avatar: mediaUrl(i.buyer.avatar) } : null,
    })),
};
