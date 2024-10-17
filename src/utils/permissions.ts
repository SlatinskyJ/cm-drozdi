import { getSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { UserRole } from "~/enums/UserRole";

export function useIsAdmin(): boolean {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function getRole() {
      const session = await getSession();
      setIsAdmin(session?.user.role === UserRole.ADMIN);
    }

    void getRole();
  }, []);

  return isAdmin;
}
