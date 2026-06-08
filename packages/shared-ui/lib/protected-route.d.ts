import { type ReactNode } from 'react';
interface ProtectedRouteProps {
    children: ReactNode;
    allowedRoles: string[];
    requireActive?: boolean;
    requireMunicipalityIdForRoles?: string[];
    loadingFallback?: ReactNode;
    unauthorizedFallback?: ReactNode;
}
export declare function ProtectedRoute({ children, allowedRoles, requireActive, requireMunicipalityIdForRoles, loadingFallback, unauthorizedFallback, }: ProtectedRouteProps): string | number | bigint | boolean | Iterable<ReactNode> | Promise<string | number | bigint | boolean | import("react").ReactPortal | import("react").ReactElement<unknown, string | import("react").JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | import("react/jsx-runtime").JSX.Element | null;
export {};
//# sourceMappingURL=protected-route.d.ts.map