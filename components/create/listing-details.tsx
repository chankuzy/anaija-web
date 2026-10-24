"use client";

import type { ReactNode } from "react";
import { CONDITIONS, CONTACT, LISTING_TYPES, SUBTYPES, needsCondition } from "@/lib/create/listing";
import type { Composer } from "@/lib/create/use-composer";
import { Switch } from "./ui";

const inputCls = "h-12 w-full rounded-input bg-surface-interactive px-4 text-[15px] font-medium text-fg outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-brand/60";

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3.5 py-2 text-secondary ${on ? "bg-brand font-extrabold text-brand-fg" : "bg-surface-interactive font-bold text-fg"}`}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-micro font-semibold uppercase tracking-[0.08em] text-muted">{label}</p>
      {children}
    </div>
  );
}

export function ListingDetails({ c }: { c: Composer }) {
  const d = c.draft;
  const set = c.update;
  const contact = d.contactPreference ?? "chat";
  return (
    <div className="space-y-5 px-5 pb-5 pt-1">
      <Field label="Type">
        <div className="flex flex-wrap gap-2">
          {LISTING_TYPES.map(([v, l]) => (
            <Chip key={v} on={d.listingType === v} onClick={() => set({ listingType: v })}>
              {l}
            </Chip>
          ))}
        </div>
      </Field>

      <Field label="Category">
        <div className="flex flex-wrap gap-2">
          {SUBTYPES.map(([v, l]) => (
            <Chip key={v} on={d.subtype === v} onClick={() => set({ subtype: v })}>
              {l}
            </Chip>
          ))}
        </div>
      </Field>

      {d.listingType === "business" && (
        <Field label="Business name">
          <input className={inputCls} value={d.businessName ?? ""} onChange={(e) => set({ businessName: e.target.value })} placeholder="e.g. Fatima Snacks" />
        </Field>
      )}

      <Field label={d.listingType === "business" ? "Starting price" : d.listingType === "wanted" ? "Budget" : "Price"}>
        <div className="relative">
          <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[15px] text-muted">₦</span>
          <input
            className={`${inputCls} pl-10`}
            inputMode="decimal"
            placeholder="Enter amount"
            value={d.price ?? ""}
            onChange={(e) => set({ price: e.target.value.replace(/[^\d.]/g, "") })}
          />
        </div>
        <div className="mt-3 flex items-center justify-between text-[15px] text-fg">
          Negotiable
          <Switch on={d.priceType !== "fixed"} label="Negotiable" onChange={(v) => set({ priceType: v ? "negotiable" : "fixed" })} />
        </div>
      </Field>

      {needsCondition(d) && (
        <>
          <Field label="Condition">
            <div className="flex flex-wrap gap-2">
              {CONDITIONS.map(([v, l]) => (
                <Chip key={v} on={d.condition === v} onClick={() => set({ condition: v })}>
                  {l}
                </Chip>
              ))}
            </div>
          </Field>
          <Field label="Quantity available">
            <input className={inputCls} inputMode="numeric" value={d.quantity ?? ""} onChange={(e) => set({ quantity: e.target.value.replace(/\D/g, "") })} />
          </Field>
        </>
      )}

      <Field label="Pickup / location (optional)">
        <input className={inputCls} value={d.pickupInfo ?? ""} onChange={(e) => set({ pickupInfo: e.target.value })} placeholder="Where can the buyer get it?" />
      </Field>

      <Field label="Preferred contact">
        <div className="flex flex-wrap gap-2">
          {CONTACT.map(([v, l]) => (
            <Chip key={v} on={contact === v} onClick={() => set({ contactPreference: v })}>
              {l}
            </Chip>
          ))}
        </div>
        {contact !== "chat" && (
          <input className={`${inputCls} mt-3`} type="tel" value={d.contactPhone ?? ""} onChange={(e) => set({ contactPhone: e.target.value })} placeholder="Phone number" />
        )}
      </Field>
    </div>
  );
}
