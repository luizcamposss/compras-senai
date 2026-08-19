import { KeyRound, Save, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'

export type ProfileUser = {
  id: number
  name: string
  email: string
  role: 'professor' | 'coordenacao'
}

type ProfileResponse = {
  message: string
  user: ProfileUser
  token: string
}

type ProfileViewProps = {
  apiUrl: string
  token: string
  user: ProfileUser
  onSessionUpdate: (user: ProfileUser, token?: string) => void
}

export function ProfileView({ apiUrl, token, user, onSessionUpdate }: ProfileViewProps) {
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [profileMessage, setProfileMessage] = useState('')
  const [profileError, setProfileError] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordError, setPasswordError] = useState('')

  useEffect(() => {
    let active = true

    request<{ user: ProfileUser }>(apiUrl, token, '/me')
      .then(({ user: currentUser }) => {
        if (!active) return
        setName(currentUser.name)
        setEmail(currentUser.email)
        onSessionUpdate(currentUser)
      })
      .catch((error) => {
        if (active) setProfileError(error instanceof Error ? error.message : 'Não foi possível carregar o perfil.')
      })
      .finally(() => {
        if (active) setLoadingProfile(false)
      })

    return () => {
      active = false
    }
  }, [apiUrl, onSessionUpdate, token])

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault()
    setSavingProfile(true)
    setProfileMessage('')
    setProfileError('')

    try {
      const data = await request<ProfileResponse>(apiUrl, token, '/me', {
        method: 'PATCH',
        body: JSON.stringify({ name, email }),
      })
      setName(data.user.name)
      setEmail(data.user.email)
      onSessionUpdate(data.user, data.token)
      setProfileMessage(data.message)
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Não foi possível atualizar o perfil.')
    } finally {
      setSavingProfile(false)
    }
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault()
    setPasswordMessage('')
    setPasswordError('')

    if (newPassword !== confirmPassword) {
      setPasswordError('As senhas não coincidem.')
      return
    }
    if (newPassword.length < 8) {
      setPasswordError('A nova senha deve ter no mínimo 8 caracteres.')
      return
    }

    setChangingPassword(true)
    try {
      const data = await request<{ message: string }>(apiUrl, token, '/me/password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordMessage(data.message)
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'Não foi possível alterar a senha.')
    } finally {
      setChangingPassword(false)
    }
  }

  const roleLabel = user.role === 'professor' ? 'Professor' : 'Coordenação'

  return (
    <div className="profile-page">
      <p className="profile-intro">Gerencie suas informações pessoais e sua senha.</p>

      <section className="workspace-section profile-card">
        <header className="section-heading profile-section-heading">
          <UserRound size={21} />
          <div>
            <h2>Informações pessoais</h2>
            <p>Atualize os dados usados para identificar você no sistema.</p>
          </div>
        </header>
        <form className="profile-form" onSubmit={saveProfile}>
          <div className="profile-fields">
            <label>
              Nome
              <input
                disabled={loadingProfile}
                maxLength={120}
                onChange={(event) => setName(event.target.value)}
                required
                value={name}
              />
            </label>
            <label>
              E-mail
              <input
                disabled={loadingProfile}
                maxLength={160}
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </label>
            <label>
              Perfil
              <input className="readonly-field" readOnly value={roleLabel} />
            </label>
          </div>
          {profileError && <p className="alert error">{profileError}</p>}
          {profileMessage && <p className="alert success">{profileMessage}</p>}
          <div className="profile-actions">
            <button className="primary-action" disabled={loadingProfile || savingProfile} type="submit">
              <Save size={17} />
              {savingProfile ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </section>

      <section className="workspace-section profile-card">
        <header className="section-heading profile-section-heading">
          <KeyRound size={21} />
          <div>
            <h2>Segurança</h2>
            <p>Use sua senha atual para definir uma nova senha de acesso.</p>
          </div>
        </header>
        <form className="profile-form" onSubmit={changePassword}>
          <div className="profile-password-fields">
            <label>
              Senha atual
              <input
                autoComplete="current-password"
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
                type="password"
                value={currentPassword}
              />
            </label>
            <label>
              Nova senha
              <input
                autoComplete="new-password"
                minLength={8}
                onChange={(event) => setNewPassword(event.target.value)}
                required
                type="password"
                value={newPassword}
              />
            </label>
            <label>
              Confirmar nova senha
              <input
                autoComplete="new-password"
                minLength={8}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                type="password"
                value={confirmPassword}
              />
            </label>
          </div>
          {passwordError && <p className="alert error">{passwordError}</p>}
          {passwordMessage && <p className="alert success">{passwordMessage}</p>}
          <div className="profile-actions">
            <button className="primary-action" disabled={changingPassword} type="submit">
              <KeyRound size={17} />
              {changingPassword ? 'Alterando...' : 'Alterar senha'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

async function request<T>(apiUrl: string, token: string, path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers)
  headers.set('Authorization', `Bearer ${token}`)
  headers.set('Content-Type', 'application/json')

  const response = await fetch(`${apiUrl}${path}`, { ...options, headers })
  const data = await response.json()
  if (!response.ok) throw new Error(data.message ?? 'Erro na requisição.')
  return data as T
}
