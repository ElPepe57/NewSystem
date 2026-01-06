import { useState, useEffect, useCallback, useRef } from 'react';
import { userService } from '../services/user.service';

// Cache global para nombres de usuario (persiste entre renders y componentes)
const userNameCache: Map<string, string> = new Map();
const pendingRequests: Map<string, Promise<string>> = new Map();

/**
 * Hook para resolver un ID de usuario a su displayName
 * Incluye caché global para evitar llamadas duplicadas
 */
export function useUserName(userId: string | undefined | null): string {
  const [displayName, setDisplayName] = useState<string>(() => {
    if (!userId) return '';
    return userNameCache.get(userId) || '';
  });

  useEffect(() => {
    if (!userId) {
      setDisplayName('');
      return;
    }

    // Si ya está en caché, usar el valor cacheado
    if (userNameCache.has(userId)) {
      setDisplayName(userNameCache.get(userId)!);
      return;
    }

    // Si ya hay una petición pendiente para este usuario, esperar
    if (pendingRequests.has(userId)) {
      pendingRequests.get(userId)!.then(name => {
        setDisplayName(name);
      });
      return;
    }

    // Crear nueva petición
    const request = userService.getByUid(userId)
      .then(user => {
        const name = user?.displayName || userId;
        userNameCache.set(userId, name);
        pendingRequests.delete(userId);
        return name;
      })
      .catch(() => {
        const name = userId; // En caso de error, mostrar el ID
        userNameCache.set(userId, name);
        pendingRequests.delete(userId);
        return name;
      });

    pendingRequests.set(userId, request);

    request.then(name => {
      setDisplayName(name);
    });
  }, [userId]);

  return displayName || userId || '';
}

/**
 * Hook para resolver múltiples IDs de usuario a sus displayNames
 */
export function useUserNames(userIds: (string | undefined | null)[]): Map<string, string> {
  const [names, setNames] = useState<Map<string, string>>(() => {
    const initialMap = new Map<string, string>();
    userIds.forEach(id => {
      if (id && userNameCache.has(id)) {
        initialMap.set(id, userNameCache.get(id)!);
      }
    });
    return initialMap;
  });

  useEffect(() => {
    const validIds = userIds.filter((id): id is string => !!id);
    const idsToFetch = validIds.filter(id => !userNameCache.has(id) && !pendingRequests.has(id));

    if (idsToFetch.length === 0) {
      // Todos los IDs ya están en caché
      const newMap = new Map<string, string>();
      validIds.forEach(id => {
        if (userNameCache.has(id)) {
          newMap.set(id, userNameCache.get(id)!);
        }
      });
      setNames(newMap);
      return;
    }

    // Fetch de todos los IDs que faltan
    Promise.all(
      idsToFetch.map(async id => {
        if (pendingRequests.has(id)) {
          return { id, name: await pendingRequests.get(id)! };
        }

        const request = userService.getByUid(id)
          .then(user => {
            const name = user?.displayName || id;
            userNameCache.set(id, name);
            pendingRequests.delete(id);
            return name;
          })
          .catch(() => {
            userNameCache.set(id, id);
            pendingRequests.delete(id);
            return id;
          });

        pendingRequests.set(id, request);
        return { id, name: await request };
      })
    ).then(() => {
      const newMap = new Map<string, string>();
      validIds.forEach(id => {
        if (userNameCache.has(id)) {
          newMap.set(id, userNameCache.get(id)!);
        }
      });
      setNames(newMap);
    });
  }, [userIds.join(',')]);

  return names;
}

/**
 * Función auxiliar para obtener el nombre de usuario de forma síncrona (si está en caché)
 * Retorna el ID si no está en caché
 */
export function getUserNameSync(userId: string | undefined | null): string {
  if (!userId) return '';
  return userNameCache.get(userId) || userId;
}

/**
 * Función para precargar nombres de usuario en el caché
 */
export async function preloadUserNames(userIds: string[]): Promise<void> {
  const idsToFetch = userIds.filter(id => !userNameCache.has(id));

  await Promise.all(
    idsToFetch.map(async id => {
      if (pendingRequests.has(id)) {
        await pendingRequests.get(id);
        return;
      }

      try {
        const user = await userService.getByUid(id);
        userNameCache.set(id, user?.displayName || id);
      } catch {
        userNameCache.set(id, id);
      }
    })
  );
}

/**
 * Limpiar el caché de nombres de usuario
 */
export function clearUserNameCache(): void {
  userNameCache.clear();
  pendingRequests.clear();
}
