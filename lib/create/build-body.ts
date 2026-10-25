// Port of ContentPublishService.buildPostBody. Contract: posts-store -> postService.createPost.
import { hashtagsOf, slideshowJson, type ContentDraft } from "./types";

const num = (s: string | null | undefined) => {
  const n = Number(s);
  return s && Number.isFinite(n) ? n : 0;
};
const int = (s: string | null | undefined) => {
  const n = parseInt(s ?? "", 10);
  return Number.isFinite(n) ? n : null;
};

export interface BodyOptions {
  media: Record<string, unknown>[];
  imageCount: number;
  clientRequestId: string;
  audioAssetId?: number | null;
  audioConfig?: Record<string, unknown> | null;
}

export function buildPostBody(d: ContentDraft, o: BodyOptions): Record<string, unknown> {
  const slideshowActive = o.imageCount > 1 && d.slideshow.enabled;
  const audio = {
    ...(o.audioAssetId != null ? { audio_asset_id: o.audioAssetId } : {}),
    ...(o.audioConfig ? { audio: o.audioConfig } : {}),
  };

  if (d.kind === "listing") {
    return {
      type: "listing",
      allow_comments: d.allowComments,
      ...(d.allowStorySharing !== null ? { allow_story_sharing: d.allowStorySharing } : {}),
      client_request_id: o.clientRequestId,
      listing_type: d.listingType,
      subtype: d.subtype,
      caption: d.caption,
      price: num(d.price),
      price_type: d.priceType,
      contact_preference: d.contactPreference,
      ...(d.condition ? { condition: d.condition } : {}),
      ...(d.pickupInfo ? { pickup_info: d.pickupInfo } : {}),
      ...(d.locationInfo ? { location_info: d.locationInfo } : {}),
      ...(d.contactPhone ? { contact_phone: d.contactPhone } : {}),
      ...(d.quantity ? { quantity: int(d.quantity) ?? 1 } : {}),
      ...(d.businessName ? { business_name: d.businessName } : {}),
      ...(d.businessDescription ? { business_description: d.businessDescription } : {}),
      ...(d.acceptingOrders !== null ? { accepting_orders: d.acceptingOrders } : {}),
      delivery_available: d.deliveryAvailable,
      ...(d.fulfillmentType ? { fulfillment_type: d.fulfillmentType } : {}),
      ...(d.serviceRadiusKm !== null ? { service_radius_km: d.serviceRadiusKm } : {}),
      ...(d.estimatedDelivery !== null ? { estimated_delivery: d.estimatedDelivery } : {}),
      ...(d.minimumOrderPrice ? { minimum_order_price: num(d.minimumOrderPrice) } : {}),
      ...(d.openingHours && Object.keys(d.openingHours).length ? { opening_hours: d.openingHours } : {}),
      media: o.media,
      ...(slideshowActive ? { slideshow: slideshowJson(d.slideshow) } : {}),
      ...audio,
    };
  }

  return {
    type: d.kind === "story" ? "story" : "post",
    client_request_id: o.clientRequestId,
    caption: d.caption,
    hashtags: hashtagsOf(d.caption),
    visibility: d.visibility,
    ...(d.location ? { location: d.location } : {}),
    ...(d.taggedUsernames.length ? { tagged_usernames: d.taggedUsernames } : {}),
    media: o.media,
    ...(slideshowActive ? { slideshow: slideshowJson(d.slideshow) } : {}),
    ...audio,
    ...(d.kind !== "story"
      ? {
          allow_comments: d.allowComments,
          ...(d.allowStorySharing !== null ? { allow_story_sharing: d.allowStorySharing } : {}),
        }
      : {}),
  };
}
