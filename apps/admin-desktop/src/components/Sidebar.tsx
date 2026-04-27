import { NavLink } from 'react-router-dom'
import { useAuth } from '@bantayog/shared-ui'

const COLOR_PROVINCE = '#7c3aed'
const COLOR_DANGER = '#dc2626'

const BASE_LINK_STYLE: React.CSSProperties = {
  display: 'block',
  padding: '8px 16px',
  textDecoration: 'none',
  color: 'inherit',
  borderRadius: '4px',
  fontSize: '14px',
}

const ACTIVE_STYLE: React.CSSProperties = {
  fontWeight: 600,
  background: 'rgba(0,0,0,0.08)',
}

function SidebarLink({ to, label, color }: { to: string; label: string; color?: string }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        ...BASE_LINK_STYLE,
        ...(isActive ? ACTIVE_STYLE : {}),
        ...(color ? { color } : {}),
      })}
    >
      {label}
    </NavLink>
  )
}

export function Sidebar() {
  const { claims } = useAuth()
  const role = typeof claims?.role === 'string' ? claims.role : ''
  const isProvinceAdmin = role === 'provincial_superadmin'

  return (
    <nav
      aria-label="Main navigation"
      style={{
        width: '220px',
        minHeight: '100vh',
        borderRight: '1px solid #e0e0e0',
        padding: '16px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        background: '#fafafa',
        flexShrink: 0,
      }}
    >
      {/* Municipal / shared routes */}
      <p
        style={{
          fontSize: '11px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: '#888',
          padding: '4px 16px',
          margin: 0,
        }}
      >
        Operations
      </p>
      <SidebarLink to="/" label="Triage Queue" />
      <SidebarLink to="/analytics" label="Analytics" />
      <SidebarLink to="/agency" label="Agency Queue" />
      <SidebarLink to="/roster" label="Roster" />

      {/* Province section — only for provincial_superadmin */}
      {isProvinceAdmin && (
        <>
          <hr
            style={{
              border: 'none',
              borderTop: '1px solid #e0e0e0',
              margin: '12px 8px',
            }}
          />
          <p
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: COLOR_PROVINCE,
              padding: '4px 16px',
              margin: 0,
            }}
          >
            Province
          </p>
          <SidebarLink to="/province/dashboard" label="Province Dashboard" color={COLOR_PROVINCE} />
          <SidebarLink to="/province/map" label="Province Map" color={COLOR_PROVINCE} />
          <SidebarLink to="/province/users" label="User Management" color={COLOR_PROVINCE} />
          <SidebarLink to="/province/resources" label="Resources" color={COLOR_PROVINCE} />
          <SidebarLink to="/province/system-health" label="System Health" color={COLOR_PROVINCE} />
          <hr
            style={{
              border: 'none',
              borderTop: '1px solid #e0e0e0',
              margin: '12px 8px',
            }}
          />
          <SidebarLink to="/province/break-glass" label="Break Glass" color={COLOR_DANGER} />
        </>
      )}
    </nav>
  )
}
