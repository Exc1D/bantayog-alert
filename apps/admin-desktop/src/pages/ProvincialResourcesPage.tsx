import { useState, useEffect } from 'react'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'
import { db } from '../app/firebase'
import { callables } from '../services/callables'

// ── Styles ────────────────────────────────────────────────────────────────────

const PAGE_STYLE: React.CSSProperties = {
  padding: '24px',
  maxWidth: '1200px',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '24px',
}

const CARD_STYLE: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  padding: '16px 20px',
}

const SECTION_TITLE_STYLE: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: '#6b7280',
  marginBottom: '12px',
}

const TABLE_STYLE: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '13px',
}

const TH_STYLE: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 12px',
  borderBottom: '2px solid #e5e7eb',
  fontWeight: 600,
  color: '#374151',
  background: '#f9fafb',
  whiteSpace: 'nowrap',
}

const TD_STYLE: React.CSSProperties = {
  padding: '8px 12px',
  borderBottom: '1px solid #e5e7eb',
  color: '#111827',
  verticalAlign: 'middle',
}

const BTN_STYLE: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: '12px',
  borderRadius: '4px',
  border: '1px solid #d1d5db',
  background: '#f9fafb',
  cursor: 'pointer',
}

const BTN_PRIMARY_STYLE: React.CSSProperties = {
  padding: '8px 16px',
  fontSize: '13px',
  borderRadius: '6px',
  border: 'none',
  background: '#2563eb',
  color: '#fff',
  cursor: 'pointer',
}

const MODAL_OVERLAY_STYLE: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
}

const MODAL_STYLE: React.CSSProperties = {
  background: '#fff',
  borderRadius: '10px',
  padding: '24px',
  width: '420px',
  maxWidth: '90vw',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
}

const FORM_LABEL_STYLE: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: '#374151',
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
}

const INPUT_STYLE: React.CSSProperties = {
  padding: '7px 10px',
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  fontSize: '13px',
  fontWeight: 400,
}

const CHECKBOX_ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '13px',
  color: '#374151',
}

const BADGE_STYLE = (available: boolean): React.CSSProperties => ({
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: '9999px',
  fontSize: '11px',
  fontWeight: 600,
  background: available ? '#d1fae5' : '#f3f4f6',
  color: available ? '#065f46' : '#6b7280',
})

// ── Types ─────────────────────────────────────────────────────────────────────

interface ResourceRow {
  id: string
  name: string
  type: string
  quantity: number
  unit: string
  location: string
  available: boolean
  archived: boolean
}

interface FormState {
  name: string
  type: string
  quantity: string
  unit: string
  location: string
  available: boolean
}

const EMPTY_FORM: FormState = {
  name: '',
  type: '',
  quantity: '',
  unit: '',
  location: '',
  available: true,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toStr(val: unknown, fallback = '—'): string {
  return typeof val === 'string' ? val : fallback
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ProvincialResourcesPage() {
  const [resources, setResources] = useState<ResourceRow[]>([])
  const [showArchived, setShowArchived] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [archivingId, setArchivingId] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(db, 'provincial_resources'), orderBy('name'))
    return onSnapshot(q, (snap) => {
      setResources(
        snap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            name: toStr(data.name),
            type: toStr(data.type),
            quantity: typeof data.quantity === 'number' ? data.quantity : 0,
            unit: toStr(data.unit),
            location: toStr(data.location),
            available: data.available === true,
            archived: data.archived === true,
          }
        }),
      )
    })
  }, [])

  const visible = resources.filter((r) => showArchived || !r.archived)

  const handleSubmit = async () => {
    const quantity = Number(form.quantity)
    if (!form.name || !form.type || isNaN(quantity)) return
    setSubmitting(true)
    try {
      await callables.upsertProvincialResource({
        ...(editingId !== null ? { id: editingId } : {}),
        name: form.name,
        type: form.type,
        quantity,
        unit: form.unit,
        location: form.location,
        available: form.available,
      })
      setForm(EMPTY_FORM)
      setEditingId(null)
      setShowModal(false)
    } catch (err) {
      console.error('upsertProvincialResource failed', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (r: ResourceRow) => {
    setEditingId(r.id)
    setForm({
      name: r.name,
      type: r.type,
      quantity: String(r.quantity),
      unit: r.unit,
      location: r.location,
      available: r.available,
    })
    setShowModal(true)
  }

  const handleArchive = async (id: string) => {
    setArchivingId(id)
    try {
      await callables.archiveProvincialResource({ id })
    } catch (err) {
      console.error('archiveProvincialResource failed', err)
    } finally {
      setArchivingId(null)
    }
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  return (
    <div style={PAGE_STYLE}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', margin: 0 }}>
          Provincial Resources
        </h1>
        <button
          style={BTN_PRIMARY_STYLE}
          onClick={() => {
            setShowModal(true)
          }}
        >
          + Add Resource
        </button>
      </div>

      <div style={CARD_STYLE}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
          }}
        >
          <div style={SECTION_TITLE_STYLE}>Resources ({visible.length})</div>
          <label style={CHECKBOX_ROW_STYLE}>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => {
                setShowArchived(e.target.checked)
              }}
            />
            Show archived
          </label>
        </div>

        {visible.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#6b7280' }}>No resources found.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={TABLE_STYLE}>
              <thead>
                <tr>
                  <th style={TH_STYLE}>Name</th>
                  <th style={TH_STYLE}>Type</th>
                  <th style={TH_STYLE}>Quantity</th>
                  <th style={TH_STYLE}>Unit</th>
                  <th style={TH_STYLE}>Location</th>
                  <th style={TH_STYLE}>Available</th>
                  <th style={TH_STYLE}>Archived</th>
                  <th style={TH_STYLE}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id} style={{ opacity: r.archived ? 0.6 : 1 }}>
                    <td style={TD_STYLE}>{r.name}</td>
                    <td style={TD_STYLE}>{r.type}</td>
                    <td style={TD_STYLE}>{r.quantity}</td>
                    <td style={TD_STYLE}>{r.unit}</td>
                    <td style={TD_STYLE}>{r.location}</td>
                    <td style={TD_STYLE}>
                      <span style={BADGE_STYLE(r.available)}>{r.available ? 'Yes' : 'No'}</span>
                    </td>
                    <td style={TD_STYLE}>{r.archived ? 'Yes' : 'No'}</td>
                    <td style={TD_STYLE}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {!r.archived && (
                          <button
                            style={BTN_STYLE}
                            onClick={() => {
                              handleEdit(r)
                            }}
                          >
                            Edit
                          </button>
                        )}
                        {!r.archived && (
                          <button
                            style={BTN_STYLE}
                            disabled={archivingId === r.id}
                            onClick={() => {
                              void handleArchive(r.id)
                            }}
                          >
                            {archivingId === r.id ? 'Archiving…' : 'Archive'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- overlay backdrop dismiss is supplementary; close button is the primary close action
        <div
          style={MODAL_OVERLAY_STYLE}
          onClick={closeModal}
          onKeyDown={(e) => {
            if (e.key === 'Escape') closeModal()
          }}
        >
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- modal panel stops propagation; role=dialog is interactive but plugin requires onKeyDown pair */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label={editingId !== null ? 'Edit Resource' : 'Add Resource'}
            style={MODAL_STYLE}
            onClick={(e) => {
              e.stopPropagation()
            }}
            onKeyDown={(e) => {
              e.stopPropagation()
            }}
          >
            <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
              {editingId !== null ? 'Edit Resource' : 'Add Resource'}
            </h2>

            <label style={FORM_LABEL_STYLE}>
              Name
              <input
                style={INPUT_STYLE}
                value={form.name}
                onChange={(e) => {
                  setForm((f) => ({ ...f, name: e.target.value }))
                }}
              />
            </label>

            <label style={FORM_LABEL_STYLE}>
              Type
              <input
                style={INPUT_STYLE}
                value={form.type}
                onChange={(e) => {
                  setForm((f) => ({ ...f, type: e.target.value }))
                }}
              />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <label style={FORM_LABEL_STYLE}>
                Quantity
                <input
                  style={INPUT_STYLE}
                  type="number"
                  min={0}
                  value={form.quantity}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, quantity: e.target.value }))
                  }}
                />
              </label>
              <label style={FORM_LABEL_STYLE}>
                Unit
                <input
                  style={INPUT_STYLE}
                  value={form.unit}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, unit: e.target.value }))
                  }}
                />
              </label>
            </div>

            <label style={FORM_LABEL_STYLE}>
              Location
              <input
                style={INPUT_STYLE}
                value={form.location}
                onChange={(e) => {
                  setForm((f) => ({ ...f, location: e.target.value }))
                }}
              />
            </label>

            <label style={CHECKBOX_ROW_STYLE}>
              <input
                type="checkbox"
                checked={form.available}
                onChange={(e) => {
                  setForm((f) => ({ ...f, available: e.target.checked }))
                }}
              />
              Available
            </label>

            <div
              style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}
            >
              <button
                style={{ ...BTN_STYLE, padding: '8px 14px', fontSize: '13px' }}
                onClick={closeModal}
              >
                Cancel
              </button>
              <button
                style={BTN_PRIMARY_STYLE}
                disabled={submitting}
                onClick={() => {
                  void handleSubmit()
                }}
              >
                {submitting ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
