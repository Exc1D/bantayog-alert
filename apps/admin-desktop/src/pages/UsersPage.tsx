import { useState, useMemo } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { useDataStore } from '@/stores/dataStore'
import { useUIStore } from '@/stores/uiStore'
import { StatusBadge } from '@/components/common/StatusBadge'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import type { User, Role, AccountStatus } from '@/types'
import {
  Search,
  Plus,
  Download,
  Eye,
  Pencil,
  Pause,
  Play,
  ClipboardList,
  X,
  ChevronLeft,
  ChevronRight,
  Users,
  Shield,
  Phone,
  Mail,
  MapPin,
  Filter,
  ChevronDown,
} from 'lucide-react'

const ROLE_OPTIONS: { value: Role | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All Roles' },
  { value: 'SUPERADMIN', label: 'Superadmin' },
  { value: 'PROVINCIAL_ADMIN', label: 'Provincial Admin' },
  { value: 'MUNICIPAL_ADMIN', label: 'Municipal Admin' },
  { value: 'AGENCY_ADMIN', label: 'Agency Admin' },
  { value: 'RESPONDER', label: 'Responder' },
  { value: 'CITIZEN', label: 'Citizen' },
]

const STATUS_OPTIONS: { value: AccountStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'PENDING_VERIFICATION', label: 'Pending' },
]

const ROLE_COLORS: Record<Role, { bg: string; text: string; border: string }> = {
  SUPERADMIN: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  PROVINCIAL_ADMIN: { bg: 'bg-accent/10', text: 'text-accent', border: 'border-accent/30' },
  MUNICIPAL_ADMIN: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  AGENCY_ADMIN: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  RESPONDER: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  CITIZEN: { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border' },
}

function RoleBadge({ role }: { role: Role }) {
  const styles = ROLE_COLORS[role]
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
        styles.bg,
        styles.text,
        styles.border,
      )}
    >
      {role.replace('_', ' ')}
    </span>
  )
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return (
    <div
      className="rounded-full bg-muted flex items-center justify-center text-foreground font-medium shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials}
    </div>
  )
}

export default function UsersPage() {
  const { users, municipalities, auditLog, agencies } = useDataStore()
  const { addToast } = useUIStore()

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<Role | 'ALL'>('ALL')
  const [muniFilter, setMuniFilter] = useState<string>('ALL')
  const [statusFilter, setStatusFilter] = useState<AccountStatus | 'ALL'>('ALL')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [detailUser, setDetailUser] = useState<User | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [suspendModalOpen, setSuspendModalOpen] = useState(false)
  const [suspendUser, setSuspendUser] = useState<User | null>(null)
  const [suspendReason, setSuspendReason] = useState('')
  const [sortField, setSortField] = useState<keyof User>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const [newUser, setNewUser] = useState<Partial<User>>({
    role: 'MUNICIPAL_ADMIN',
    status: 'ACTIVE',
    phone: '+63',
  })

  const filteredUsers = useMemo(() => {
    let result = [...users]
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.phone.includes(q) ||
          u.id.toLowerCase().includes(q),
      )
    }
    if (roleFilter !== 'ALL') result = result.filter((u) => u.role === roleFilter)
    if (muniFilter !== 'ALL') result = result.filter((u) => u.municipality === muniFilter)
    if (statusFilter !== 'ALL') result = result.filter((u) => u.status === statusFilter)

    result.sort((a, b) => {
      const av = a[sortField] ?? ''
      const bv = b[sortField] ?? ''
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })

    return result
  }, [users, search, roleFilter, muniFilter, statusFilter, sortField, sortDir])

  const pagedUsers = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredUsers.slice(start, start + pageSize)
  }, [filteredUsers, page, pageSize])

  const totalPages = Math.ceil(filteredUsers.length / pageSize) || 1

  const stats = useMemo(() => {
    const total = filteredUsers.length
    const active = filteredUsers.filter((u) => u.status === 'ACTIVE').length
    const suspended = filteredUsers.filter((u) => u.status === 'SUSPENDED').length
    const byRole = filteredUsers.reduce<Record<string, number>>((acc, u) => {
      acc[u.role] = (acc[u.role] ?? 0) + 1
      return acc
    }, {})
    return { total, active, suspended, byRole }
  }, [filteredUsers])

  const toggleSort = (field: keyof User) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const toggleRow = (id: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedRows.size === pagedUsers.length) {
      setSelectedRows(new Set())
    } else {
      setSelectedRows(new Set(pagedUsers.map((u) => u.id)))
    }
  }

  const handleSuspend = () => {
    if (suspendUser) {
      addToast({
        title: 'User suspended',
        message: `${suspendUser.name} has been suspended. Reason: ${suspendReason || 'No reason provided'}`,
        type: 'warning',
      })
      setSuspendModalOpen(false)
      setSuspendUser(null)
      setSuspendReason('')
    }
  }

  const handleCreateUser = () => {
    addToast({
      title: 'User created',
      message: `New ${newUser.role?.replace('_', ' ') ?? ''} account created successfully.`,
      type: 'success',
    })
    setCreateModalOpen(false)
    setNewUser({ role: 'MUNICIPAL_ADMIN', status: 'ACTIVE', phone: '+63' })
  }

  const handleBulkSuspend = () => {
    addToast({
      title: 'Bulk action completed',
      message: `${String(selectedRows.size)} users suspended.`,
      type: 'warning',
    })
    setSelectedRows(new Set())
  }

  const userAudit = useMemo(() => {
    if (!detailUser) return []
    return auditLog
      .filter((a) => a.actorId === detailUser.id || a.targetId === detailUser.id)
      .slice(0, 20)
  }, [detailUser, auditLog])

  const activeFiltersCount =
    (roleFilter !== 'ALL' ? 1 : 0) +
    (muniFilter !== 'ALL' ? 1 : 0) +
    (statusFilter !== 'ALL' ? 1 : 0) +
    (search ? 1 : 0)

  return (
    <AppShell>
      <div className="p-6 max-w-[1400px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6"
        >
          <div>
            <h1 className="text-2xl font-semibold text-foreground">User Management</h1>
            <p className="text-body-sm text-muted-foreground mt-1">
              Manage all users across Camarines Norte
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setCreateModalOpen(true)
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-white text-body-sm font-medium hover:bg-accent-hover transition-all"
            >
              <Plus className="w-4 h-4" />
              Create User
            </button>
            <button className="flex items-center gap-2 px-4 py-2 rounded-md border border-border text-body-sm text-foreground hover:bg-muted transition-colors">
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
        >
          <div className="metric-card">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Users</p>
            <p className="text-display-md text-foreground font-mono mt-1">{stats.total}</p>
          </div>
          <div className="metric-card">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Active</p>
            <p className="text-display-md text-green-700 font-mono mt-1">{stats.active}</p>
          </div>
          <div className="metric-card">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Suspended</p>
            <p className="text-display-md text-red-700 font-mono mt-1">{stats.suspended}</p>
          </div>
          <div className="metric-card">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">By Role</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {Object.entries(stats.byRole)
                .slice(0, 4)
                .map(([role, count]) => (
                  <span
                    key={role}
                    className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded"
                  >
                    {role.replace('_', ' ')}: {count}
                  </span>
                ))}
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white border border-border rounded-lg p-4 mb-4"
        >
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                placeholder="Search by name, email, phone..."
                className="w-[280px] pl-9 pr-8 py-2 bg-white border border-border rounded-md text-body-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-all"
              />
              {search && (
                <button
                  onClick={() => {
                    setSearch('')
                    setPage(1)
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                >
                  <X className="w-4 h-4 text-muted-foreground/70 hover:text-foreground" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground/70" />
              <select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value as Role | 'ALL')
                  setPage(1)
                }}
                className="px-3 py-2 bg-white border border-border rounded-md text-body-sm text-foreground focus:outline-none focus:border-accent"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <select
                value={muniFilter}
                onChange={(e) => {
                  setMuniFilter(e.target.value)
                  setPage(1)
                }}
                className="px-3 py-2 bg-white border border-border rounded-md text-body-sm text-foreground focus:outline-none focus:border-accent"
              >
                <option value="ALL">All Municipalities</option>
                {municipalities.map((m) => (
                  <option key={m.id} value={m.name}>
                    {m.name}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as AccountStatus | 'ALL')
                  setPage(1)
                }}
                className="px-3 py-2 bg-white border border-border rounded-md text-body-sm text-foreground focus:outline-none focus:border-accent"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {activeFiltersCount > 0 && (
              <button
                onClick={() => {
                  setSearch('')
                  setRoleFilter('ALL')
                  setMuniFilter('ALL')
                  setStatusFilter('ALL')
                  setPage(1)
                }}
                className="text-body-sm text-accent hover:underline"
              >
                Clear all
              </button>
            )}

            <div className="ml-auto text-xs text-muted-foreground/70">
              {filteredUsers.length} result{filteredUsers.length !== 1 ? 's' : ''}
            </div>
          </div>
        </motion.div>

        <AnimatePresence>
          {selectedRows.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-muted border border-accent/30 rounded-lg p-3 mb-4 flex items-center justify-between"
            >
              <span className="text-body-sm text-foreground">
                <span className="text-accent font-medium">{selectedRows.size}</span> user
                {selectedRows.size !== 1 ? 's' : ''} selected
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBulkSuspend}
                  className="px-3 py-1.5 rounded-md text-xs font-medium bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
                >
                  Suspend Selected
                </button>
                <button
                  onClick={() => {
                    setSelectedRows(new Set())
                  }}
                  className="px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white border border-border rounded-lg overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="data-table-header w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        pagedUsers.length > 0 && pagedUsers.every((u) => selectedRows.has(u.id))
                      }
                      onChange={toggleAll}
                      className="accent-accent"
                    />
                  </th>
                  <th
                    className="data-table-header text-left cursor-pointer hover:text-foreground"
                    onClick={() => {
                      toggleSort('name')
                    }}
                  >
                    <div className="flex items-center gap-1">
                      User{' '}
                      {sortField === 'name' && (
                        <ChevronDown
                          className={cn('w-3 h-3', sortDir === 'desc' && 'rotate-180')}
                        />
                      )}
                    </div>
                  </th>
                  <th
                    className="data-table-header text-left cursor-pointer hover:text-foreground"
                    onClick={() => {
                      toggleSort('role')
                    }}
                  >
                    <div className="flex items-center gap-1">
                      Role{' '}
                      {sortField === 'role' && (
                        <ChevronDown
                          className={cn('w-3 h-3', sortDir === 'desc' && 'rotate-180')}
                        />
                      )}
                    </div>
                  </th>
                  <th
                    className="data-table-header text-left cursor-pointer hover:text-foreground"
                    onClick={() => {
                      toggleSort('municipality')
                    }}
                  >
                    <div className="flex items-center gap-1">
                      Municipality{' '}
                      {sortField === 'municipality' && (
                        <ChevronDown
                          className={cn('w-3 h-3', sortDir === 'desc' && 'rotate-180')}
                        />
                      )}
                    </div>
                  </th>
                  <th
                    className="data-table-header text-left cursor-pointer hover:text-foreground"
                    onClick={() => {
                      toggleSort('agency')
                    }}
                  >
                    <div className="flex items-center gap-1">
                      Agency{' '}
                      {sortField === 'agency' && (
                        <ChevronDown
                          className={cn('w-3 h-3', sortDir === 'desc' && 'rotate-180')}
                        />
                      )}
                    </div>
                  </th>
                  <th
                    className="data-table-header text-center cursor-pointer hover:text-foreground"
                    onClick={() => {
                      toggleSort('status')
                    }}
                  >
                    <div className="flex items-center gap-1 justify-center">
                      Status{' '}
                      {sortField === 'status' && (
                        <ChevronDown
                          className={cn('w-3 h-3', sortDir === 'desc' && 'rotate-180')}
                        />
                      )}
                    </div>
                  </th>
                  <th
                    className="data-table-header text-right cursor-pointer hover:text-foreground"
                    onClick={() => {
                      toggleSort('lastLoginAt')
                    }}
                  >
                    <div className="flex items-center gap-1 justify-end">
                      Last Login{' '}
                      {sortField === 'lastLoginAt' && (
                        <ChevronDown
                          className={cn('w-3 h-3', sortDir === 'desc' && 'rotate-180')}
                        />
                      )}
                    </div>
                  </th>
                  <th className="data-table-header text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedUsers.map((user, idx) => (
                  <motion.tr
                    key={user.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className={cn(
                      'data-table-row group',
                      selectedRows.has(user.id) && 'bg-muted border-l-2 border-l-accent',
                    )}
                    onClick={() => {
                      setDetailUser(user)
                    }}
                  >
                    <td
                      className="py-3 px-3 text-center"
                      onClick={(e) => {
                        e.stopPropagation()
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedRows.has(user.id)}
                        onChange={() => {
                          toggleRow(user.id)
                        }}
                        className="accent-accent"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={user.name} />
                        <div>
                          <p className="text-body-sm text-foreground font-medium">{user.name}</p>
                          <p className="text-xs text-muted-foreground/70">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <RoleBadge role={user.role} />
                    </td>
                    <td className="py-3 px-4 text-body-sm text-muted-foreground">
                      {user.municipality ?? '\u2014'}
                    </td>
                    <td className="py-3 px-4 text-body-sm text-muted-foreground">
                      {user.agency ?? '\u2014'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={user.status} />
                    </td>
                    <td className="py-3 px-4 text-right text-xs text-muted-foreground/70 font-mono">
                      {user.lastLoginAt
                        ? formatDistanceToNow(new Date(user.lastLoginAt), { addSuffix: true })
                        : 'Never'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setDetailUser(user)
                          }}
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-accent transition-colors"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditUser(user)
                            setEditModalOpen(true)
                          }}
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-accent transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSuspendUser(user)
                            setSuspendModalOpen(true)
                          }}
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-amber-700 transition-colors"
                          title="Suspend"
                        >
                          {user.status === 'SUSPENDED' ? (
                            <Play className="w-4 h-4" />
                          ) : (
                            <Pause className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setDetailUser(user)
                          }}
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-accent transition-colors"
                          title="Audit"
                        >
                          <ClipboardList className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
                {pagedUsers.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-10 text-center">
                      <Users className="w-12 h-12 text-muted-foreground/70 mx-auto mb-3" />
                      <p className="text-body-md text-muted-foreground">
                        No users match your filters
                      </p>
                      <button
                        onClick={() => {
                          setSearch('')
                          setRoleFilter('ALL')
                          setMuniFilter('ALL')
                          setStatusFilter('ALL')
                        }}
                        className="text-body-sm text-accent hover:underline mt-2"
                      >
                        Clear filters
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground/70">Show</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setPage(1)
                }}
                className="px-2 py-1 bg-white border border-border rounded text-xs text-foreground"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <span className="text-xs text-muted-foreground/70">per page</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setPage((p) => Math.max(1, p - 1))
                }}
                disabled={page === 1}
                className="p-1.5 rounded hover:bg-muted text-muted-foreground disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => {
                  setPage((p) => Math.min(totalPages, p + 1))
                }}
                disabled={page === totalPages}
                className="p-1.5 rounded hover:bg-muted text-muted-foreground disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {createModalOpen && (
          <Modal
            onClose={() => {
              setCreateModalOpen(false)
            }}
            title="Create New User"
            maxWidth="560px"
          >
            <div className="space-y-4">
              <div>
                <span className="text-body-sm text-muted-foreground block mb-2">Full Name</span>
                <input
                  type="text"
                  value={newUser.name ?? ''}
                  onChange={(e) => {
                    setNewUser((p) => ({ ...p, name: e.target.value }))
                  }}
                  placeholder="Enter full name"
                  className="w-full px-3 py-2 bg-white border border-border rounded-md text-body-md text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <span className="text-body-sm text-muted-foreground block mb-2">Email</span>
                <input
                  type="email"
                  value={newUser.email ?? ''}
                  onChange={(e) => {
                    setNewUser((p) => ({ ...p, email: e.target.value }))
                  }}
                  placeholder="user@example.gov.ph"
                  className="w-full px-3 py-2 bg-white border border-border rounded-md text-body-md text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <span className="text-body-sm text-muted-foreground block mb-2">Phone</span>
                <div className="flex items-center bg-white border border-border rounded-md overflow-hidden focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15">
                  <span className="px-3 py-2 text-body-md text-muted-foreground border-r border-border select-none">
                    +63
                  </span>
                  <input
                    type="tel"
                    value={(newUser.phone ?? '').replace('+63', '')}
                    onChange={(e) => {
                      setNewUser((p) => ({ ...p, phone: '+63' + e.target.value }))
                    }}
                    placeholder="9XX XXX XXXX"
                    className="flex-1 px-3 py-2 bg-transparent text-body-md text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-body-sm text-muted-foreground block mb-2">Role</span>
                  <select
                    value={newUser.role}
                    onChange={(e) => {
                      setNewUser((p) => ({ ...p, role: e.target.value as Role }))
                    }}
                    className="w-full px-3 py-2 bg-white border border-border rounded-md text-body-md text-foreground focus:outline-none focus:border-accent"
                  >
                    <option value="MUNICIPAL_ADMIN">Municipal Admin</option>
                    <option value="AGENCY_ADMIN">Agency Admin</option>
                    <option value="RESPONDER">Responder</option>
                    <option value="PROVINCIAL_ADMIN">Provincial Admin</option>
                  </select>
                </div>
                <div>
                  <span className="text-body-sm text-muted-foreground block mb-2">Status</span>
                  <select
                    value={newUser.status}
                    onChange={(e) => {
                      setNewUser((p) => ({ ...p, status: e.target.value as AccountStatus }))
                    }}
                    className="w-full px-3 py-2 bg-white border border-border rounded-md text-body-md text-foreground focus:outline-none focus:border-accent"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="PENDING_VERIFICATION">Pending</option>
                  </select>
                </div>
              </div>
              {(newUser.role === 'MUNICIPAL_ADMIN' || newUser.role === 'RESPONDER') && (
                <div>
                  <span className="text-body-sm text-muted-foreground block mb-2">
                    Municipality
                  </span>
                  <select
                    value={newUser.municipality ?? ''}
                    onChange={(e) => {
                      setNewUser((p) => ({ ...p, municipality: e.target.value }))
                    }}
                    className="w-full px-3 py-2 bg-white border border-border rounded-md text-body-md text-foreground focus:outline-none focus:border-accent"
                  >
                    <option value="">Select municipality</option>
                    {municipalities.map((m) => (
                      <option key={m.id} value={m.name}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {(newUser.role === 'AGENCY_ADMIN' || newUser.role === 'RESPONDER') && (
                <div>
                  <span className="text-body-sm text-muted-foreground block mb-2">Agency</span>
                  <select
                    value={newUser.agency ?? ''}
                    onChange={(e) => {
                      setNewUser((p) => ({ ...p, agency: e.target.value }))
                    }}
                    className="w-full px-3 py-2 bg-white border border-border rounded-md text-body-md text-foreground focus:outline-none focus:border-accent"
                  >
                    <option value="">Select agency</option>
                    {agencies.map((a) => (
                      <option key={a.id} value={a.code}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {newUser.role === 'RESPONDER' && (
                <div>
                  <span className="text-body-sm text-muted-foreground block mb-2">
                    Specializations
                  </span>
                  <input
                    type="text"
                    placeholder="e.g. Water Rescue, First Aid, HAZMAT"
                    className="w-full px-3 py-2 bg-white border border-border rounded-md text-body-md text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-accent"
                  />
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Comma-separated list of specializations
                  </p>
                </div>
              )}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  onClick={() => {
                    setCreateModalOpen(false)
                  }}
                  className="px-4 py-2 rounded-md text-body-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateUser}
                  className="px-4 py-2 rounded-md bg-accent text-white text-body-sm font-medium hover:bg-accent-hover transition-all"
                >
                  Create User
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editModalOpen && editUser && (
          <Modal
            onClose={() => {
              setEditModalOpen(false)
            }}
            title="Edit User"
            maxWidth="480px"
          >
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <Avatar name={editUser.name} size={48} />
                <div>
                  <p className="text-body-md text-foreground font-medium">{editUser.name}</p>
                  <p className="text-xs text-muted-foreground/70">{editUser.id}</p>
                </div>
              </div>
              <div>
                <span className="text-body-sm text-muted-foreground block mb-2">Email</span>
                <input
                  type="email"
                  defaultValue={editUser.email}
                  className="w-full px-3 py-2 bg-white border border-border rounded-md text-body-md text-foreground focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <span className="text-body-sm text-muted-foreground block mb-2">Phone</span>
                <input
                  type="tel"
                  defaultValue={editUser.phone}
                  className="w-full px-3 py-2 bg-white border border-border rounded-md text-body-md text-foreground focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <span className="text-body-sm text-muted-foreground block mb-2">Role</span>
                <select
                  defaultValue={editUser.role}
                  className="w-full px-3 py-2 bg-white border border-border rounded-md text-body-md text-foreground focus:outline-none focus:border-accent"
                >
                  {ROLE_OPTIONS.filter((r) => r.value !== 'ALL').map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  onClick={() => {
                    setEditModalOpen(false)
                  }}
                  className="px-4 py-2 rounded-md text-body-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    addToast({
                      title: 'User updated',
                      message: `${editUser.name}'s profile has been updated.`,
                      type: 'success',
                    })
                    setEditModalOpen(false)
                  }}
                  className="px-4 py-2 rounded-md bg-accent text-white text-body-sm font-medium hover:bg-accent-hover transition-all"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {suspendModalOpen && suspendUser && (
          <Modal
            onClose={() => {
              setSuspendModalOpen(false)
            }}
            title={suspendUser.status === 'SUSPENDED' ? 'Activate User' : 'Suspend User'}
            maxWidth="480px"
          >
            <div className="space-y-4">
              <p className="text-body-md text-foreground">
                {suspendUser.status === 'SUSPENDED'
                  ? `Are you sure you want to reactivate ${suspendUser.name}?`
                  : `Are you sure you want to suspend ${suspendUser.name}?`}
              </p>
              {suspendUser.status !== 'SUSPENDED' && (
                <div>
                  <span className="text-body-sm text-muted-foreground block mb-2">
                    Reason for suspension
                  </span>
                  <textarea
                    value={suspendReason}
                    onChange={(e) => {
                      setSuspendReason(e.target.value)
                    }}
                    placeholder="Enter reason..."
                    rows={3}
                    className="w-full px-3 py-2 bg-white border border-border rounded-md text-body-md text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-accent resize-none"
                  />
                </div>
              )}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  onClick={() => {
                    setSuspendModalOpen(false)
                  }}
                  className="px-4 py-2 rounded-md text-body-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSuspend}
                  className={cn(
                    'px-4 py-2 rounded-md text-body-sm font-medium transition-all',
                    suspendUser.status === 'SUSPENDED'
                      ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                      : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100',
                  )}
                >
                  {suspendUser.status === 'SUSPENDED' ? 'Activate User' : 'Confirm Suspend'}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {detailUser && (
          <div className="fixed inset-0 z-[100] flex justify-end">
            <div
              className="absolute inset-0 bg-black/50"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setDetailUser(null)
              }}
              onClick={() => {
                setDetailUser(null)
              }}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{
                duration: 0.3,
                ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
              }}
              className="relative w-[480px] max-w-full bg-white border-l border-border shadow-xl h-full overflow-y-auto"
            >
              <div className="sticky top-0 z-10 bg-muted border-b border-border p-5 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">User Profile</h2>
                <button
                  onClick={() => {
                    setDetailUser(null)
                  }}
                  className="p-1.5 rounded hover:bg-white text-muted-foreground/70 hover:text-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-6">
                <div className="flex items-center gap-4">
                  <Avatar name={detailUser.name} size={64} />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-foreground truncate">
                      {detailUser.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <RoleBadge role={detailUser.role} />
                      <StatusBadge status={detailUser.status} />
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setEditUser(detailUser)
                      setEditModalOpen(true)
                    }}
                    className="px-3 py-1.5 rounded-md bg-muted border border-border text-xs text-foreground hover:bg-white transition-colors"
                  >
                    Edit
                  </button>
                </div>

                <div className="bg-white border border-border rounded-lg p-4 space-y-3">
                  <h4 className="text-lg font-semibold text-foreground">Contact Information</h4>
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-muted-foreground/70" />
                    <span className="text-body-sm text-muted-foreground font-mono">
                      {detailUser.phone}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-muted-foreground/70" />
                    <span className="text-body-sm text-muted-foreground">{detailUser.email}</span>
                  </div>
                  {detailUser.municipality && (
                    <div className="flex items-center gap-3">
                      <MapPin className="w-4 h-4 text-muted-foreground/70" />
                      <span className="text-body-sm text-muted-foreground">
                        {detailUser.municipality}
                      </span>
                    </div>
                  )}
                  {detailUser.agency && (
                    <div className="flex items-center gap-3">
                      <Shield className="w-4 h-4 text-muted-foreground/70" />
                      <span className="text-body-sm text-muted-foreground">
                        {detailUser.agency}
                      </span>
                    </div>
                  )}
                </div>

                <div className="bg-white border border-border rounded-lg p-4 space-y-3">
                  <h4 className="text-lg font-semibold text-foreground">Activity</h4>
                  <div className="flex justify-between text-body-sm">
                    <span className="text-muted-foreground">Last Login</span>
                    <span className="text-foreground font-mono">
                      {detailUser.lastLoginAt
                        ? new Date(detailUser.lastLoginAt).toLocaleString()
                        : 'Never'}
                    </span>
                  </div>
                  <div className="flex justify-between text-body-sm">
                    <span className="text-muted-foreground">Account Created</span>
                    <span className="text-foreground font-mono">
                      {new Date(detailUser.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-body-sm">
                    <span className="text-muted-foreground">User ID</span>
                    <span className="text-foreground font-mono">{detailUser.id}</span>
                  </div>
                </div>

                <div className="bg-white border border-border rounded-lg p-4 space-y-3">
                  <h4 className="text-lg font-semibold text-foreground">Recent Audit Trail</h4>
                  {userAudit.length === 0 ? (
                    <p className="text-body-sm text-muted-foreground/70">
                      No audit entries for this user.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {userAudit.map((entry) => (
                        <div
                          key={entry.id}
                          className="flex items-start gap-3 p-2 rounded hover:bg-muted"
                        >
                          <div
                            className={cn(
                              'w-2 h-2 rounded-full mt-1.5 shrink-0',
                              entry.privateDataAccessed ? 'bg-red-700' : 'bg-accent',
                            )}
                          />
                          <div className="min-w-0">
                            <p className="text-xs text-foreground">{entry.action}</p>
                            <p className="text-xs text-muted-foreground/70">{entry.details}</p>
                            <p className="text-xs text-muted-foreground/70 font-mono mt-0.5">
                              {new Date(entry.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => {
                      setSuspendUser(detailUser)
                      setSuspendModalOpen(true)
                    }}
                    className={cn(
                      'flex-1 px-4 py-2 rounded-md text-body-sm font-medium border transition-all',
                      detailUser.status === 'SUSPENDED'
                        ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                        : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
                    )}
                  >
                    {detailUser.status === 'SUSPENDED' ? 'Activate Account' : 'Suspend Account'}
                  </button>
                  <button className="flex-1 px-4 py-2 rounded-md bg-muted border border-border text-body-sm text-foreground hover:bg-white transition-colors">
                    Reset Password
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppShell>
  )
}

function Modal({
  children,
  onClose,
  title,
  maxWidth = '560px',
}: {
  children: React.ReactNode
  onClose: () => void
  title: string
  maxWidth?: string
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="relative bg-white border border-border rounded-xl w-full mx-4 shadow-xl overflow-hidden"
        style={{ maxWidth }}
      >
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <button
            onClick={onClose}
            className="text-muted-foreground/70 hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </motion.div>
    </div>
  )
}
