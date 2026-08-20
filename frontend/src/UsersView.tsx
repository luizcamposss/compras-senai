import { Pencil, Save, Search, UserCheck, UserPlus, Users, UserX, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

type UserRole = 'professor' | 'coordenacao'

type ManagedUser = {
  id: number
  name: string
  email: string
  role: UserRole
  active: boolean
}

type UserForm = {
  name: string
  email: string
  role: UserRole
  password: string
}

type UsersViewProps = {
  apiUrl: string
  currentUserId: number
  token: string
}

const emptyForm: UserForm = { name: '', email: '', role: 'professor', password: '' }

export function UsersView({ apiUrl, currentUserId, token }: UsersViewProps) {
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [modalUser, setModalUser] = useState<ManagedUser | null | undefined>(undefined)

  useEffect(() => {
    let active = true
    request<ManagedUser[]>(apiUrl, token, '/users')
      .then((data) => {
        if (active) setUsers(data)
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar os usuários.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [apiUrl, token])

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    if (!term) return users
    return users.filter((user) => (
      user.name.toLocaleLowerCase('pt-BR').includes(term) || user.email.toLocaleLowerCase('pt-BR').includes(term)
    ))
  }, [search, users])

  function showMessage(nextMessage: string) {
    setMessage(nextMessage)
    setError('')
  }

  async function saveUser(form: UserForm, user: ManagedUser | null) {
    const path = user ? `/users/${user.id}` : '/users'
    const options: RequestInit = {
      method: user ? 'PATCH' : 'POST',
      body: JSON.stringify(user ? { name: form.name, email: form.email, role: form.role } : form),
    }
    const data = await request<{ message: string; user: ManagedUser }>(apiUrl, token, path, options)
    setUsers((current) => sortUsers(user
      ? current.map((item) => item.id === data.user.id ? data.user : item)
      : [...current, data.user]))
    showMessage(data.message)
    setModalUser(undefined)
  }

  async function changeStatus(user: ManagedUser) {
    const data = await request<{ message: string; user: ManagedUser }>(apiUrl, token, `/users/${user.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ active: !user.active }),
    })
    setUsers((current) => current.map((item) => item.id === data.user.id ? data.user : item))
    showMessage(data.message)
    setModalUser(undefined)
  }

  return (
    <section className="users-page">
      <p className="users-intro">Gerencie as contas e os perfis de acesso ao sistema.</p>

      <div className="users-toolbar">
        <label className="users-search">
          <Search size={18} />
          <input
            aria-label="Buscar usuários por nome ou e-mail"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome ou e-mail"
            value={search}
          />
        </label>
        <button className="primary-action" onClick={() => setModalUser(null)} type="button">
          <UserPlus size={18} /> Novo usuário
        </button>
      </div>

      {error && <p className="alert error users-feedback">{error}</p>}
      {message && <p className="alert success users-feedback">{message}</p>}

      <div className="users-table-card">
        <div className="users-table-heading">
          <div>
            <Users size={20} />
            <strong>Contas cadastradas</strong>
          </div>
          <span>{filteredUsers.length} usuário{filteredUsers.length === 1 ? '' : 's'}</span>
        </div>

        <div className="users-table" role="table" aria-label="Usuários cadastrados">
          <div className="users-table-head" role="row">
            <span role="columnheader">Nome</span>
            <span role="columnheader">E-mail</span>
            <span role="columnheader">Perfil</span>
            <span role="columnheader">Status</span>
            <span role="columnheader">Ações</span>
          </div>
          {loading && <p className="users-empty">Carregando usuários...</p>}
          {!loading && filteredUsers.length === 0 && (
            <p className="users-empty">Nenhum usuário encontrado.</p>
          )}
          {!loading && filteredUsers.map((managedUser) => {
            const isCurrentUser = Number(managedUser.id) === Number(currentUserId)
            return (
              <div className="users-table-row" key={managedUser.id} role="row">
                <strong data-label="Nome">{managedUser.name}</strong>
                <span data-label="E-mail">{managedUser.email}</span>
                <span data-label="Perfil">
                  <span className={`user-role-badge role-${managedUser.role}`}>
                    {managedUser.role === 'professor' ? 'Professor' : 'Coordenação'}
                  </span>
                </span>
                <span data-label="Status">
                  <span className={managedUser.active ? 'user-status-badge active' : 'user-status-badge inactive'}>
                    {managedUser.active ? 'Ativo' : 'Inativo'}
                  </span>
                </span>
                <span data-label="Ações">
                  <button
                    className="users-edit-button"
                    disabled={isCurrentUser}
                    onClick={() => setModalUser(managedUser)}
                    title={isCurrentUser ? 'Use Meu perfil para editar sua conta' : 'Editar usuário'}
                    type="button"
                  >
                    <Pencil size={15} /> Editar
                  </button>
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {modalUser !== undefined && (
        <UserFormModal
          currentUserId={currentUserId}
          onClose={() => setModalUser(undefined)}
          onSave={saveUser}
          onStatusChange={changeStatus}
          user={modalUser}
        />
      )}
    </section>
  )
}

function UserFormModal({
  currentUserId,
  user,
  onClose,
  onSave,
  onStatusChange,
}: {
  currentUserId: number
  user: ManagedUser | null
  onClose: () => void
  onSave: (form: UserForm, user: ManagedUser | null) => Promise<void>
  onStatusChange: (user: ManagedUser) => Promise<void>
}) {
  const [form, setForm] = useState<UserForm>(user
    ? { name: user.name, email: user.email, role: user.role, password: '' }
    : emptyForm)
  const [saving, setSaving] = useState(false)
  const [changingStatus, setChangingStatus] = useState(false)
  const [error, setError] = useState('')
  const isCurrentUser = user ? Number(user.id) === Number(currentUserId) : false

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !saving && !changingStatus) onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [changingStatus, onClose, saving])

  function update<K extends keyof UserForm>(field: K, value: UserForm[K]) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onSave(form, user)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível salvar o usuário.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleStatus() {
    if (!user) return
    setChangingStatus(true)
    setError('')
    try {
      await onStatusChange(user)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível alterar o status.')
    } finally {
      setChangingStatus(false)
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && !saving && !changingStatus && onClose()}
    >
      <section aria-labelledby="user-modal-title" aria-modal="true" className="user-modal" role="dialog">
        <header className="user-modal-header">
          <div>
            <span>{user ? <Pencil size={19} /> : <UserPlus size={19} />}</span>
            <div>
              <h2 id="user-modal-title">{user ? 'Editar usuário' : 'Novo usuário'}</h2>
              <p>{user ? 'Atualize os dados e o perfil de acesso.' : 'Cadastre uma nova conta de acesso.'}</p>
            </div>
          </div>
          <button aria-label="Fechar" disabled={saving || changingStatus} onClick={onClose} type="button">
            <X size={20} />
          </button>
        </header>

        <form className="user-modal-form" onSubmit={submit}>
          <div className="user-modal-fields">
            <label>
              Nome
              <input maxLength={120} onChange={(event) => update('name', event.target.value)} required value={form.name} />
            </label>
            <label>
              E-mail
              <input maxLength={160} onChange={(event) => update('email', event.target.value)} required type="email" value={form.email} />
            </label>
            <label>
              Perfil
              <select onChange={(event) => update('role', event.target.value as UserRole)} value={form.role}>
                <option value="professor">Professor</option>
                <option value="coordenacao">Coordenação</option>
              </select>
            </label>
            {!user && (
              <label>
                Senha inicial
                <input minLength={8} onChange={(event) => update('password', event.target.value)} required type="password" value={form.password} />
              </label>
            )}
          </div>
          {error && <p className="alert error">{error}</p>}
          <footer className="user-modal-actions">
            {user && !isCurrentUser && (
              <button
                className={user.active ? 'status-action deactivate' : 'status-action activate'}
                disabled={saving || changingStatus}
                onClick={toggleStatus}
                type="button"
              >
                {user.active ? <UserX size={17} /> : <UserCheck size={17} />}
                {changingStatus ? 'Alterando...' : user.active ? 'Desativar usuário' : 'Ativar usuário'}
              </button>
            )}
            <span className="user-modal-primary-actions">
              <button className="secondary-action" disabled={saving || changingStatus} onClick={onClose} type="button">Cancelar</button>
              <button className="primary-action" disabled={saving || changingStatus} type="submit">
                {user ? <Save size={17} /> : <UserPlus size={17} />}
                {saving ? 'Salvando...' : user ? 'Salvar alterações' : 'Criar usuário'}
              </button>
            </span>
          </footer>
        </form>
      </section>
    </div>
  )
}

function sortUsers(users: ManagedUser[]) {
  return [...users].sort((first, second) => first.name.localeCompare(second.name, 'pt-BR'))
}

async function request<T>(apiUrl: string, token: string, path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers)
  headers.set('Authorization', `Bearer ${token}`)
  headers.set('Content-Type', 'application/json')
  const response = await fetch(`${apiUrl}${path}`, { ...options, headers })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message ?? 'Erro na requisição.')
  return data as T
}
