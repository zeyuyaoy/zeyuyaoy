"use client";

import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useState,
} from "react";
import type { ProfileTab } from "@/lib/profile-content";

const ProfileTabContext = createContext<{
  selected: ProfileTab;
  setSelected: Dispatch<SetStateAction<ProfileTab>>;
} | null>(null);

export default function ProfileTabProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<ProfileTab>("about");

  return (
    <ProfileTabContext.Provider value={{ selected, setSelected }}>
      {children}
    </ProfileTabContext.Provider>
  );
}

export function useProfileTab() {
  const context = useContext(ProfileTabContext);
  if (!context) {
    throw new Error("Profile tabs and photo marquee require a ProfileTabProvider.");
  }
  return context;
}
