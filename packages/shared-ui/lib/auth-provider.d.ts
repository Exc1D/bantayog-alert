import { type ReactNode } from 'react';
import { type Auth, type User } from 'firebase/auth';
export interface AuthContextValue {
    user: User | null;
    claims: Record<string, unknown> | null;
    loading: boolean;
    signOut: () => Promise<void>;
    refreshClaims: () => Promise<void>;
}
interface AuthProviderProps {
    children: ReactNode;
    auth: Auth;
}
export declare function AuthProvider({ children, auth }: AuthProviderProps): import("react/jsx-runtime").JSX.Element;
export declare function useAuth(): AuthContextValue;
export {};
//# sourceMappingURL=auth-provider.d.ts.map