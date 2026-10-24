import type { Metadata } from "next";
import { GuestSwitch } from "@/components/auth/guest-switch";
import { ProfileView } from "@/components/profile/profile-view";
import { PublicProfileView } from "@/components/profile/public-profile";
import { getPublicProfile } from "@/lib/server/public";
import { profileMetadata, unavailable } from "@/lib/share/meta";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const u = decodeURIComponent(username);
  const p = await getPublicProfile(u);
  if (p) return profileMetadata(p);
  return p === null ? unavailable("Profile") : { title: `@${u}` };
}

export default async function UserPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const u = decodeURIComponent(username);
  const p = await getPublicProfile(u);
  return (
    <GuestSwitch
      guest={
        p ? (
          <PublicProfileView p={p} />
        ) : (
          <div className="grid h-dvh place-items-center px-6 text-center">
            <p className="text-[17px] font-bold text-fg">{p === null ? "This profile isn't available" : "Couldn't load this profile"}</p>
          </div>
        )
      }
    >
      <ProfileView key={u} username={u} />
    </GuestSwitch>
  );
}
