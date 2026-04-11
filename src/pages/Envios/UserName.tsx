import React, { useEffect, useState } from "react";
import { userService } from "../../services/user.service";

const userNameCache = new Map<string, string>();

export const UserName: React.FC<{ userId: string }> = ({ userId }) => {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    // Si ya parece un nombre legible (no un UID largo), mostrarlo directo
    if (userId.length < 20 || userId.includes(' ') || userId.includes('@')) {
      setName(userId);
      return;
    }
    if (userNameCache.has(userId)) {
      setName(userNameCache.get(userId)!);
      return;
    }
    userService.getByUid(userId).then(profile => {
      const displayName = profile?.displayName || profile?.email || userId.slice(0, 8) + '...';
      userNameCache.set(userId, displayName);
      setName(displayName);
    }).catch(() => setName(userId.slice(0, 8) + '...'));
  }, [userId]);

  return <>{name ?? userId.slice(0, 8) + '...'}</>;
};
