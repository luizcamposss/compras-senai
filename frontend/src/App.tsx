import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Database,
  Factory,
  FileSpreadsheet,
  History,
  Home,
  LogOut,
  Menu,
  PackagePlus,
  Printer,
  RotateCcw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Upload,
  TicketCheck,
  XCircle,
  User,
  Users,
} from 'lucide-react'
import './App.css'
import { ProfileView, type ProfileUser } from './ProfileView'
import { UsersView } from './UsersView'

const API_URL = import.meta.env.VITE_API_URL ?? `http://${window.location.hostname}:3333/api`

type Role = 'professor' | 'coordenacao'
type AppView = 'overview' | 'new-request' | 'requests' | 'catalog' | 'queue' | 'users' | 'profile' | 'settings'

type User = ProfileUser

type CatalogItem = {
  id: number
  code: string
  description: string
  costCenterCode?: string
  costCenterName?: string
}

type CatalogPreview = {
  fileName: string
  found: number
  valid: number
  ignored: number
  preview: Array<{ code: string; description: string }>
}

type CostCenter = {
  id: number
  code: string
  name: string
}

type PurchaseRequest = {
  id: number
  professorName: string
  catalogCode?: string
  catalogDescription?: string
  costCenterCode: string
  costCenterName: string
  item_type: 'catalogo' | 'novo'
  quantity: number
  justification: string
  new_item_name?: string
  new_item_description?: string
  supplier_link?: string
  status: string
  coordinator_response?: string
  created_at: string
  items: PurchaseRequestItem[]
}

type PurchaseRequestItem = {
  id: number
  requestId: number
  item_type: 'catalogo' | 'novo'
  quantity: number
  catalogCode?: string
  catalogDescription?: string
  new_item_name?: string
  new_item_description?: string
  supplier_link?: string
}

type Notification = {
  id: number
  title: string
  message: string
  readAt: string | null
  createdAt: string
}

type RequestTicket = {
  id: number
  items: Array<{ label: string; quantity: string }>
  costCenter: string
  status: 'aguardando_coordenacao' | 'novo_item_pendente'
  submittedAt: string
}

const blockedDomains = ['amazon.', 'shopee.', 'mercadolivre.com', 'mercado-livre.com']

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('compras_token') ?? '')
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('compras_user')
    return stored ? JSON.parse(stored) : null
  })
  const [activeView, setActiveView] = useState<AppView>('overview')

  function handleLogin(nextToken: string, nextUser: User) {
    localStorage.setItem('compras_token', nextToken)
    localStorage.setItem('compras_user', JSON.stringify(nextUser))
    setToken(nextToken)
    setUser(nextUser)
    setActiveView('overview')
  }

  function handleLogout() {
    localStorage.removeItem('compras_token')
    localStorage.removeItem('compras_user')
    setToken('')
    setUser(null)
  }

  const handleSessionUpdate = useCallback((nextUser: User, nextToken = token) => {
    localStorage.setItem('compras_token', nextToken)
    localStorage.setItem('compras_user', JSON.stringify(nextUser))
    setToken(nextToken)
    setUser(nextUser)
  }, [token])

  if (!token || !user) {
    return <LoginPage onLogin={handleLogin} />
  }

  return (
    <Shell activeView={activeView} user={user} token={token} onNavigate={setActiveView} onLogout={handleLogout}>
      {activeView === 'profile' ? (
        <ProfileView
          apiUrl={API_URL}
          token={token}
          user={user}
          onSessionUpdate={handleSessionUpdate}
        />
      ) : activeView === 'settings' ? (
        <AccountFutureView view="settings" />
      ) : activeView === 'users' && user.role === 'coordenacao' ? (
        <UsersView apiUrl={API_URL} currentUserId={user.id} token={token} />
      ) : user.role === 'professor' ? (
        <ProfessorDashboard activeView={activeView} token={token} onNavigate={setActiveView} />
      ) : (
        <CoordinatorDashboard activeView={activeView} token={token} onNavigate={setActiveView} />
      )}
    </Shell>
  )
}

function LoginPage({ onLogin }: { onLogin: (token: string, user: User) => void }) {
  const [email, setEmail] = useState('professor@senai.local')
  const [password, setPassword] = useState('professor123')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message)
      onLogin(data.token, data.user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao entrar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page" id="top">
      <section className="entry-hero">
        <nav className="entry-nav">
          <BrandMark />
          <span className="entry-nav-pill"><FileSpreadsheet size={15} /> Portal de solicitações de compras</span>
        </nav>

        <div className="entry-content">
          <div className="entry-copy">
            <h1>Materiais certos para transformar conhecimento em prática.</h1>
            <p className="entry-subtitle">
              Consulte o catálogo, envie sua solicitação e acompanhe cada retorno da coordenação em um único lugar.
            </p>
            <div className="entry-actions">
              <a className="primary-action hero-action" href="#login">
                Acessar sistema
                <ArrowRight size={18} />
              </a>
            </div>
            <div className="trust-row">
              <span>
                <ShieldCheck size={16} />
                Dados protegidos
              </span>
              <span>
                <Database size={16} />
                Catálogo centralizado
              </span>
            </div>
          </div>
        </div>

        <div className="login-panel" id="login">
          <div className="login-panel-heading">
            <span className="login-icon"><Factory size={20} /></span>
            <div>
            <p className="eyebrow">Acesso restrito</p>
            <h2>Entrar no sistema</h2>
            <p className="muted">Use seu perfil de professor ou coordenação.</p>
            </div>
          </div>
          <form className="form-stack" onSubmit={submit}>
            <label>
              E-mail
              <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
            </label>
            <label>
              Senha
              <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required />
            </label>
            {error && <p className="alert error">{error}</p>}
            <button className="primary-action" disabled={loading} type="submit">
              <Send size={18} />
              {loading ? 'Entrando...' : 'Entrar no painel'}
            </button>
          </form>
          <details className="demo-users">
            <summary>Contas de demonstração</summary>
            <span>Professor: professor@senai.local / professor123</span>
            <span>Coordenação: coordenacao@senai.local / coordenacao123</span>
          </details>
        </div>
      </section>
    </main>
  )
}

function Shell({
  activeView,
  user,
  token,
  children,
  onNavigate,
  onLogout,
}: {
  activeView: AppView
  user: User
  token: string
  children: React.ReactNode
  onNavigate: (view: AppView) => void
  onLogout: () => void
}) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [notificationsError, setNotificationsError] = useState('')
  const [notificationActionId, setNotificationActionId] = useState<number | null>(null)
  const [markingAllNotifications, setMarkingAllNotifications] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const notificationsRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)

  const loadNotifications = useCallback(async () => {
    setNotificationsLoading(true)
    setNotificationsError('')
    try {
      setNotifications(await api<Notification[]>(token, '/notifications'))
    } catch {
      setNotificationsError('Não foi possível carregar as notificações.')
    } finally {
      setNotificationsLoading(false)
    }
  }, [token])

  useEffect(() => {
    void loadNotifications()
  }, [loadNotifications])

  useEffect(() => {
    function closeHeaderMenus(event: MouseEvent) {
      const target = event.target as Node
      if (!notificationsRef.current?.contains(target)) setNotificationsOpen(false)
      if (!userMenuRef.current?.contains(target)) setUserMenuOpen(false)
    }
    document.addEventListener('mousedown', closeHeaderMenus)
    return () => document.removeEventListener('mousedown', closeHeaderMenus)
  }, [])

  const unread = notifications.filter((item) => !item.readAt).length
  const pageTitle = getPageTitle(activeView, user.role)
  const roleLabel = user.role === 'professor' ? 'Professor' : 'Coordenação'
  const navigationItems: Array<{ view: AppView; label: string; icon: React.ReactNode }> = user.role === 'professor'
    ? [
        { view: 'overview', label: 'Visão geral', icon: <Home size={18} /> },
        { view: 'new-request', label: 'Nova solicitação', icon: <PackagePlus size={18} /> },
        { view: 'requests', label: 'Minhas solicitações', icon: <History size={18} /> },
      ]
    : [
        { view: 'overview', label: 'Visão geral', icon: <Home size={18} /> },
        { view: 'catalog', label: 'Catálogo', icon: <FileSpreadsheet size={18} /> },
        { view: 'queue', label: 'Fila de solicitações', icon: <ClipboardList size={18} /> },
        { view: 'users', label: 'Usuários', icon: <Users size={18} /> },
      ]

  async function markNotificationRead(id: number) {
    setNotificationActionId(id)
    setNotificationsError('')
    try {
      await api(token, `/notifications/${id}/read`, { method: 'PATCH' })
      setNotifications((current) => current.map((item) => (
        item.id === id ? { ...item, readAt: new Date().toISOString() } : item
      )))
      return true
    } catch {
      setNotificationsError('Não foi possível marcar a notificação como lida.')
      return false
    } finally {
      setNotificationActionId(null)
    }
  }

  async function markAllNotificationsRead() {
    setMarkingAllNotifications(true)
    setNotificationsError('')
    try {
      await api(token, '/notifications/read-all', { method: 'PATCH' })
      const readAt = new Date().toISOString()
      setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? readAt })))
    } catch {
      setNotificationsError('Não foi possível marcar as notificações como lidas.')
    } finally {
      setMarkingAllNotifications(false)
    }
  }

  async function openNotification(notification: Notification) {
    if (!notification.readAt && !(await markNotificationRead(notification.id))) return
    if (user.role === 'professor') navigate('requests')
  }

  function navigate(view: AppView) {
    onNavigate(view)
    setNotificationsOpen(false)
    setUserMenuOpen(false)
    setMobileMenuOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <main className="app-shell">
      <header className="site-header">
        <div className="site-header-inner">
          <BrandMark compact onClick={() => navigate('overview')} />
          <button
            aria-controls="primary-navigation"
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
            className="menu-toggle"
            onClick={() => {
              setMobileMenuOpen((open) => !open)
              setUserMenuOpen(false)
              setNotificationsOpen(false)
            }}
            type="button"
          >
            <Menu size={22} />
          </button>
          <nav
            aria-label="Navegação principal"
            className={mobileMenuOpen ? 'top-nav open' : 'top-nav'}
            id="primary-navigation"
          >
            {navigationItems.map((item) => (
              <button
                className={activeView === item.view ? 'active' : ''}
                key={item.view}
                onClick={() => navigate(item.view)}
                type="button"
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>
          <div className="header-actions">
            <div className="notifications-menu" ref={notificationsRef}>
              <button
                aria-expanded={notificationsOpen}
                aria-haspopup="true"
                aria-label={unread > 0 ? `Notificações: ${unread} não lidas` : 'Notificações'}
                className={notificationsOpen ? 'notification-trigger active' : 'notification-trigger'}
                onClick={() => {
                  const willOpen = !notificationsOpen
                  setNotificationsOpen(willOpen)
                  setUserMenuOpen(false)
                  setMobileMenuOpen(false)
                  if (willOpen) void loadNotifications()
                }}
                title="Notificações"
                type="button"
              >
                <Bell size={18} />
                {unread > 0 && <span>{unread}</span>}
              </button>
              {notificationsOpen && (
                <NotificationsDropdown
                  actionId={notificationActionId}
                  error={notificationsError}
                  loading={notificationsLoading}
                  markingAll={markingAllNotifications}
                  notifications={notifications}
                  onMarkAllRead={markAllNotificationsRead}
                  onNotificationClick={openNotification}
                />
              )}
            </div>
            <div className="user-menu" ref={userMenuRef}>
              <button
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                className={userMenuOpen ? 'user-menu-trigger active' : 'user-menu-trigger'}
                onClick={() => {
                  setUserMenuOpen((open) => !open)
                  setNotificationsOpen(false)
                }}
                type="button"
              >
                <span className="avatar">{user.name.charAt(0).toUpperCase()}</span>
                <span className="user-menu-copy">
                  <strong>{user.name}</strong>
                  <small>{roleLabel}</small>
                </span>
                <ChevronDown className="user-menu-chevron" size={16} />
              </button>
              {userMenuOpen && (
                <div className="user-menu-dropdown" role="menu">
                  <button onClick={() => navigate('profile')} role="menuitem" type="button">
                    <User size={17} />
                    <span>Meu perfil</span>
                  </button>
                  <button onClick={() => navigate('settings')} role="menuitem" type="button">
                    <Settings size={17} />
                    <span>Configurações</span>
                  </button>
                  <div className="user-menu-separator" />
                  <button
                    className="user-menu-logout"
                    onClick={() => {
                      setUserMenuOpen(false)
                      onLogout()
                    }}
                    role="menuitem"
                    type="button"
                  >
                    <LogOut size={17} />
                    <span>Sair</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      <div className="shell-content">
        <header className="page-header">
          <div>
            <p className="eyebrow">Sistema de compras</p>
            <h1>{pageTitle}</h1>
          </div>
        </header>
        <div className="page-content">{children}</div>
      </div>
    </main>
  )
}

function BrandMark({ compact = false, onClick }: { compact?: boolean; onClick?: () => void }) {
  return (
    <a className={compact ? 'brand-mark compact' : 'brand-mark'} href={compact ? '#/overview' : '#top'} onClick={onClick} aria-label="SENAI - ir para o início">
      <img
        alt="SENAI - Serviço Nacional de Aprendizagem Industrial"
        height="156"
        src="/senai-logo-white.png"
        width="824"
      />
    </a>
  )
}

function AccountFutureView({ view }: { view: 'profile' | 'settings' }) {
  const isProfile = view === 'profile'

  return (
    <section className="workspace-section account-future-page">
      <span className="account-future-icon">
        {isProfile ? <User size={24} /> : <Settings size={24} />}
      </span>
      <div>
        <h2>{isProfile ? 'Meu perfil' : 'Configurações'}</h2>
        <p>Esta área está preparada para uma próxima etapa do projeto.</p>
      </div>
    </section>
  )
}

function ProfessorDashboard({
  activeView,
  token,
  onNavigate,
}: {
  activeView: AppView
  token: string
  onNavigate: (view: AppView) => void
}) {
  const [costCenters, setCostCenters] = useState<CostCenter[]>([])
  const [requests, setRequests] = useState<PurchaseRequest[]>([])
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    api<CostCenter[]>(token, '/cost-centers').then(setCostCenters)
  }, [token])

  useEffect(() => {
    api<PurchaseRequest[]>(token, '/requests').then(setRequests)
  }, [token, refreshKey])

  if (activeView === 'new-request') {
    return (
      <PurchaseForm
        token={token}
        costCenters={costCenters}
        onCreated={() => setRefreshKey((value) => value + 1)}
        onViewRequests={() => onNavigate('requests')}
      />
    )
  }

  if (activeView === 'requests') {
    return <RequestList title="Minhas solicitações" requests={requests} />
  }

  return <DashboardOverview onNavigate={onNavigate} requests={requests} role="professor" />
}

function DashboardOverview({
  requests,
  role,
  onNavigate,
}: {
  requests: PurchaseRequest[]
  role: Role
  onNavigate: (view: AppView) => void
}) {
  const pending = requests.filter((request) => request.status.includes('aguardando') || request.status.includes('pendente')).length
  const approved = requests.filter((request) => request.status === 'aprovada').length
  const adjustments = requests.filter((request) => request.status === 'ajuste_solicitado').length
  const refused = requests.filter((request) => request.status === 'recusada').length
  const recentRequests = requests.slice(0, 4)
  const statusDistribution = [
    { key: 'pending', label: 'Em análise', value: pending },
    { key: 'approved', label: 'Aprovadas', value: approved },
    { key: 'adjustments', label: 'Ajustes solicitados', value: adjustments },
    { key: 'refused', label: 'Recusadas', value: refused },
  ]

  return (
    <div className="overview-page">
      <section className="metrics-grid" aria-label="Resumo das solicitações">
        <article><span>Total de solicitações</span><strong>{requests.length}</strong></article>
        <article><span>Aguardando análise</span><strong>{pending}</strong></article>
        <article><span>Aprovadas</span><strong>{approved}</strong></article>
      </section>

      <div className="overview-main-grid">
        <section className="overview-section status-chart">
          <div className="overview-section-head">
            <div>
              <h2>Solicitações por status</h2>
              <p>Distribuição atual dos pedidos.</p>
            </div>
          </div>
          <div className="status-chart-body">
            {statusDistribution.map((item) => {
              const percentage = requests.length ? Math.round((item.value / requests.length) * 100) : 0
              return (
                <div className="chart-row" key={item.key}>
                  <div className="chart-label">
                    <span><i className={`chart-dot chart-${item.key}`} />{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                  <div className="chart-track" aria-label={`${item.label}: ${item.value}`} aria-valuemax={requests.length || 1} aria-valuemin={0} aria-valuenow={item.value} role="progressbar">
                    <span className={`chart-bar chart-${item.key}`} style={{ width: `${percentage}%` }} />
                  </div>
                  <small>{percentage}%</small>
                </div>
              )
            })}
          </div>
        </section>

        <section className="overview-section">
          <div className="overview-section-head">
            <div>
              <h2>{role === 'professor' ? 'Solicitações recentes' : 'Fila recente'}</h2>
              <p>Últimas movimentações registradas no sistema.</p>
            </div>
            <button className="text-button" onClick={() => onNavigate(role === 'professor' ? 'requests' : 'queue')} type="button">
              Ver todas <ArrowRight size={16} />
            </button>
          </div>
          <div className="compact-request-list">
            {recentRequests.length === 0 && <p className="empty-state">Nenhuma solicitação registrada.</p>}
            {recentRequests.map((request) => {
              const summary = getRequestSummary(request)
              return (
                <article key={request.id}>
                  <div>
                    <strong>#{request.id} · {summary.code}</strong>
                    <span>{summary.name}</span>
                  </div>
                  <StatusBadge status={request.status} />
                </article>
              )
            })}
          </div>
        </section>
      </div>

      <div className="overview-actions">
        <button className="primary-action" onClick={() => onNavigate(role === 'professor' ? 'new-request' : 'catalog')} type="button">
          {role === 'professor' ? <PackagePlus size={18} /> : <Upload size={18} />}
          {role === 'professor' ? 'Nova solicitação' : 'Importar catálogo'}
        </button>
      </div>
    </div>
  )
}

function PurchaseForm({
  token,
  costCenters,
  onCreated,
  onViewRequests,
}: {
  token: string
  costCenters: CostCenter[]
  onCreated: () => void
  onViewRequests: () => void
}) {
  const [reviewing, setReviewing] = useState(false)
  const [mode, setMode] = useState<'catalog' | 'new'>('catalog')
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<CatalogItem[]>([])
  const [searchingItems, setSearchingItems] = useState(false)
  const [selectedItems, setSelectedItems] = useState<Array<CatalogItem & { quantity: string }>>([])
  const [form, setForm] = useState({
    quantity: '1',
    justification: '',
    costCenterId: '',
    newItemName: '',
    newItemDescription: '',
    supplierLink: '',
  })
  const [technicalFile, setTechnicalFile] = useState<File | null>(null)
  const [photo, setPhoto] = useState<File | null>(null)
  const [ticket, setTicket] = useState<RequestTicket | null>(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!search.trim()) {
      setItems([])
      setSearchingItems(false)
      return
    }
    const timeout = window.setTimeout(() => {
      setSearchingItems(true)
      api<CatalogItem[]>(token, `/catalog?search=${encodeURIComponent(search)}`)
        .then(setItems)
        .catch(() => setItems([]))
        .finally(() => setSearchingItems(false))
    }, 250)
    return () => window.clearTimeout(timeout)
  }, [search, token])

  const linkBlocked = useMemo(() => isBlockedLink(form.supplierLink), [form.supplierLink])
  const selectedCostCenter = costCenters.find((center) => String(center.id) === form.costCenterId)

  function validateForm() {
    if (mode === 'catalog' && selectedItems.length === 0) return 'Adicione pelo menos um item do catálogo.'
    if (mode === 'catalog' && selectedItems.some((item) => !isValidRequestQuantity(item.quantity))) {
      return 'A quantidade de cada produto deve estar entre 1 e 50.'
    }
    if (mode === 'new' && (!form.newItemName.trim() || !form.newItemDescription.trim() || !form.supplierLink.trim())) {
      return 'Preencha nome, descrição e link do novo produto.'
    }
    if (mode === 'new' && linkBlocked) return 'Links de Amazon, Shopee e Mercado Livre não são permitidos.'
    if (mode === 'new' && !isValidRequestQuantity(form.quantity)) return 'A quantidade deve estar entre 1 e 50.'
    if (!form.costCenterId || !form.justification.trim()) return 'Preencha centro de custo e justificativa.'
    return ''
  }

  function addCatalogItem(item: CatalogItem) {
    if (selectedItems.some((selected) => selected.id === item.id)) return
    if (selectedItems.length >= 50) {
      setError('Um pedido pode conter no máximo 50 produtos.')
      return
    }
    setSelectedItems((current) => [...current, { ...item, quantity: '1' }])
    setError('')
  }

  function updateCatalogItemQuantity(id: number, quantity: string) {
    setSelectedItems((current) => current.map((item) => item.id === id ? { ...item, quantity } : item))
  }

  function reviewRequest() {
    const validationError = validateForm()
    setError(validationError)
    if (!validationError) setReviewing(true)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      setReviewing(false)
      return
    }

    setError('')
    setSubmitting(true)

    try {
      let requestId: number
      if (mode === 'catalog') {
        const response = await api<{ id: number; message: string }>(token, '/requests/catalog', {
          method: 'POST',
          body: JSON.stringify({
            items: selectedItems.map((item) => ({ catalogItemId: item.id, quantity: item.quantity })),
            costCenterId: form.costCenterId,
            justification: form.justification,
          }),
        })
        requestId = response.id
      } else {
        if (linkBlocked) throw new Error('Links de Amazon, Shopee e Mercado Livre nao sao permitidos.')
        const payload = new FormData()
        Object.entries(form).forEach(([key, value]) => payload.append(key, value))
        if (technicalFile) payload.append('technicalFile', technicalFile)
        if (photo) payload.append('photo', photo)
        const response = await api<{ id: number; message: string }>(token, '/requests/new-item', {
          method: 'POST',
          body: payload,
          isFormData: true,
        })
        requestId = response.id
      }

      setTicket({
        id: requestId,
        items: mode === 'catalog'
          ? selectedItems.map((item) => ({ label: `${item.code} · ${item.description}`, quantity: item.quantity }))
          : [{ label: form.newItemName, quantity: form.quantity }],
          costCenter: selectedCostCenter ? `${selectedCostCenter.code} · ${selectedCostCenter.name}` : '-',
          status: mode === 'catalog' ? 'aguardando_coordenacao' : 'novo_item_pendente',
          submittedAt: new Date().toISOString(),
      })

      setForm({
        quantity: '1',
        justification: '',
        costCenterId: '',
        newItemName: '',
        newItemDescription: '',
        supplierLink: '',
      })
      setSearch('')
      setSelectedItems([])
      setTechnicalFile(null)
      setPhoto(null)
      setReviewing(false)
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel enviar a solicitacao.')
    } finally {
      setSubmitting(false)
    }
  }

  if (ticket) {
    return (
      <RequestTicketView
        ticket={ticket}
        onNewRequest={() => setTicket(null)}
        onViewRequests={onViewRequests}
      />
    )
  }

  return (
    <section className="request-form-page page-section">
      <form className="wizard-form" onSubmit={submit}>
        <header className="wizard-heading">
          <span>{reviewing ? 'Revisão final' : 'Formulário de compra'}</span>
          <h2>{reviewing ? 'Revise antes de enviar' : 'Informe os dados da solicitação'}</h2>
          <p>{reviewing ? 'Confira os dados abaixo. Se precisar, volte para corrigir o formulário.' : 'Escolha o item, informe a quantidade, o destino e o motivo da compra.'}</p>
        </header>

        <div className="wizard-body">
          {!reviewing ? (
            <div className="request-form-content">
              <section className="request-form-section">
                <div className="request-form-section-heading">
                  <span>1</span>
                  <div><h3>Item solicitado</h3><p>Selecione um produto do catálogo ou cadastre uma sugestão.</p></div>
                </div>
              <div className="segmented">
                  <button className={mode === 'catalog' ? 'active' : ''} onClick={() => { setMode('catalog'); setError('') }} type="button">Item do catálogo</button>
                  <button className={mode === 'new' ? 'active' : ''} onClick={() => { setMode('new'); setError('') }} type="button">Item novo</button>
              </div>
              {mode === 'catalog' ? (
                <div className="step-fields">
                  <label>
                    Código ou nome
                    <div className="search-box">
                      <Search size={18} />
                        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Digite para consultar o catálogo" />
                    </div>
                  </label>
                    {selectedItems.length > 0 && (
                      <div className="selected-items-card" aria-live="polite">
                        <header><div><CheckCircle2 size={19} /><strong>Itens do pedido</strong></div><span>{selectedItems.length} {selectedItems.length === 1 ? 'produto' : 'produtos'}</span></header>
                        {selectedItems.map((item) => (
                          <div className="selected-order-item" key={item.id}>
                            <div><strong>{item.code}</strong><span>{item.description}</span></div>
                            <label>Quantidade<input aria-label={`Quantidade de ${item.description}`} max="50" min="1" onChange={(event) => updateCatalogItemQuantity(item.id, event.target.value)} type="number" value={item.quantity} /></label>
                            <button aria-label={`Remover ${item.description}`} onClick={() => setSelectedItems((current) => current.filter((selected) => selected.id !== item.id))} title="Remover item" type="button"><XCircle size={18} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                    {searchingItems && <p className="field-hint">Buscando itens...</p>}
                    {!searchingItems && search.trim() && items.length === 0 && <p className="catalog-search-empty">Nenhum item encontrado.</p>}
                  {items.length > 0 && (
                    <div className="results-list">
                      {items.map((item) => (
                        <button className={selectedItems.some((selected) => selected.id === item.id) ? 'result-row selected' : 'result-row'} key={item.id} onClick={() => addCatalogItem(item)} type="button">
                          <span className="selection-indicator" />
                          <span><strong>{item.code}</strong><small>{item.description}</small></span>
                          <small>{selectedItems.some((selected) => selected.id === item.id) ? 'Adicionado' : 'Adicionar'}</small>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="step-fields">
                  <label>Nome do produto<input value={form.newItemName} onChange={(event) => setFormValue(setForm, 'newItemName', event.target.value)} /></label>
                  <label>Descrição<textarea value={form.newItemDescription} onChange={(event) => setFormValue(setForm, 'newItemDescription', event.target.value)} /></label>
                  <label>Link do fornecedor<input className={linkBlocked ? 'invalid-input' : ''} value={form.supplierLink} onChange={(event) => setFormValue(setForm, 'supplierLink', event.target.value)} placeholder="https://fornecedor.com/produto" /></label>
                  {linkBlocked && <p className="alert error">Amazon, Shopee e Mercado Livre não são permitidos.</p>}
                </div>
              )}
              </section>

              <section className="request-form-section">
                <div className="request-form-section-heading">
                  <span>2</span>
                  <div><h3>Detalhes da compra</h3><p>Informe quanto precisa, o centro de custo e a justificativa.</p></div>
                </div>
                <div className="step-fields">
              <div className={mode === 'new' ? 'two-columns' : 'step-fields'}>
                {mode === 'new' && <label>Quantidade<input max="50" min="1" value={form.quantity} onChange={(event) => setFormValue(setForm, 'quantity', event.target.value)} type="number" /></label>}
                <label>Centro de custo<select value={form.costCenterId} onChange={(event) => setFormValue(setForm, 'costCenterId', event.target.value)}><option value="">Selecione</option>{costCenters.map((center) => <option key={center.id} value={center.id}>{center.code} - {center.name}</option>)}</select></label>
              </div>
              <label>Justificativa<textarea value={form.justification} onChange={(event) => setFormValue(setForm, 'justification', event.target.value)} placeholder="Explique como o item será utilizado" /></label>
              {mode === 'new' && (
                <div className="two-columns">
                  <label>Ficha técnica<input accept=".pdf,.doc,.docx,.xlsx,.csv,image/*" onChange={(event) => setTechnicalFile(event.target.files?.[0] ?? null)} type="file" /></label>
                  <label>Foto do produto<input accept="image/*" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} type="file" /></label>
                </div>
              )}
                </div>
              </section>
            </div>
          ) : (
            <div className="review-summary">
              <dl>
                <div className="full"><dt>{mode === 'catalog' ? 'Itens do pedido' : 'Item'}</dt><dd>
                  {mode === 'catalog' ? (
                    <span className="review-items-list">{selectedItems.map((item) => <span key={item.id}><strong>{item.quantity}×</strong> {item.code} · {item.description}</span>)}</span>
                  ) : form.newItemName}
                </dd></div>
                {mode === 'new' && <div><dt>Quantidade</dt><dd>{form.quantity}</dd></div>}
                <div><dt>Centro de custo</dt><dd>{selectedCostCenter ? `${selectedCostCenter.code} · ${selectedCostCenter.name}` : '-'}</dd></div>
                <div className="full"><dt>Justificativa</dt><dd>{form.justification}</dd></div>
                {mode === 'new' && <div className="full"><dt>Fornecedor</dt><dd>{form.supplierLink}</dd></div>}
                {mode === 'new' && technicalFile && <div><dt>Ficha técnica</dt><dd>{technicalFile.name}</dd></div>}
                {mode === 'new' && photo && <div><dt>Foto</dt><dd>{photo.name}</dd></div>}
              </dl>
              <p><CheckCircle2 size={17} /> A solicitação será encaminhada para análise da coordenação.</p>
            </div>
          )}

          {error && <p className="alert error">{error}</p>}
        </div>

        <footer className="wizard-actions">
          {reviewing ? (
            <>
              <button className="secondary-action" disabled={submitting} onClick={() => { setError(''); setReviewing(false) }} type="button"><ChevronLeft size={17} /> Editar formulário</button>
              <button className="primary-action" disabled={submitting} type="submit"><Send size={17} /> {submitting ? 'Enviando...' : 'Enviar solicitação'}</button>
            </>
          ) : (
            <button className="primary-action" onClick={reviewRequest} type="button">Revisar solicitação <ChevronRight size={17} /></button>
          )}
        </footer>
      </form>
    </section>
  )
}

function RequestTicketView({
  ticket,
  onNewRequest,
  onViewRequests,
}: {
  ticket: RequestTicket
  onNewRequest: () => void
  onViewRequests: () => void
}) {
  const protocol = `SOL-${new Date(ticket.submittedAt).getFullYear()}-${String(ticket.id).padStart(6, '0')}`

  return (
    <section className="ticket-page page-section">
      <div className="ticket-success-icon"><Check size={32} /></div>
      <p className="ticket-kicker">Solicitação registrada</p>
      <h2>Seu ticket foi criado com sucesso</h2>
      <p className="ticket-subtitle">Guarde o protocolo para acompanhar o retorno da coordenação.</p>

      <div className="ticket-code">
        <span>Número do protocolo</span>
        <strong>{protocol}</strong>
      </div>

      <dl className="ticket-details">
        <div><dt>Data de envio</dt><dd>{formatDateTime(ticket.submittedAt)}</dd></div>
        <div><dt>{ticket.items.length === 1 ? 'Item solicitado' : 'Itens solicitados'}</dt><dd className="ticket-items-list">{ticket.items.map((item, index) => <span key={`${item.label}-${index}`}><strong>{item.quantity}×</strong> {item.label}</span>)}</dd></div>
        <div><dt>Centro de custo</dt><dd>{ticket.costCenter}</dd></div>
        <div><dt>Status</dt><dd><StatusBadge status={ticket.status} /></dd></div>
      </dl>

      <div className="ticket-actions">
        <button className="secondary-action" onClick={() => window.print()} type="button"><Printer size={17} /> Imprimir</button>
        <button className="secondary-action" onClick={onNewRequest} type="button"><PackagePlus size={17} /> Nova solicitação</button>
        <button className="primary-action" onClick={onViewRequests} type="button"><TicketCheck size={17} /> Ver histórico</button>
      </div>
    </section>
  )
}

function CoordinatorDashboard({
  activeView,
  token,
  onNavigate,
}: {
  activeView: AppView
  token: string
  onNavigate: (view: AppView) => void
}) {
  const [requests, setRequests] = useState<PurchaseRequest[]>([])
  const [importMessage, setImportMessage] = useState('')
  const [importError, setImportError] = useState('')
  const [catalogFile, setCatalogFile] = useState<File | null>(null)
  const [catalogPreview, setCatalogPreview] = useState<CatalogPreview | null>(null)
  const [analyzingCatalog, setAnalyzingCatalog] = useState(false)
  const [importingCatalog, setImportingCatalog] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const catalogFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api<PurchaseRequest[]>(token, '/requests').then(setRequests)
  }, [token, refreshKey])

  async function analyzeCatalog(file: File) {
    setCatalogFile(file)
    setCatalogPreview(null)
    setImportMessage('')
    setImportError('')
    setAnalyzingCatalog(true)
    const payload = new FormData()
    payload.append('file', file)
    try {
      const result = await api<CatalogPreview>(token, '/catalog/import/preview', {
        method: 'POST',
        body: payload,
        isFormData: true,
      })
      setCatalogPreview(result)
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Não foi possível analisar o arquivo.')
    } finally {
      setAnalyzingCatalog(false)
    }
  }

  function cancelCatalogImport() {
    setCatalogFile(null)
    setCatalogPreview(null)
    setImportError('')
    if (catalogFileInputRef.current) catalogFileInputRef.current.value = ''
  }

  async function confirmCatalogImport() {
    if (!catalogFile || !catalogPreview) return
    setImportingCatalog(true)
    setImportError('')
    setImportMessage('')
    const payload = new FormData()
    payload.append('file', catalogFile)
    try {
      const result = await api<{ message: string; imported: number; ignored: number }>(token, '/catalog/import', {
        method: 'POST',
        body: payload,
        isFormData: true,
      })
      setImportMessage(
        `Catálogo importado com sucesso. ${result.imported} ${result.imported === 1 ? 'item importado' : 'itens importados'}. `
        + `${result.ignored} ${result.ignored === 1 ? 'linha ignorada' : 'linhas ignoradas'}.`,
      )
      setCatalogFile(null)
      setCatalogPreview(null)
      setRefreshKey((value) => value + 1)
      if (catalogFileInputRef.current) catalogFileInputRef.current.value = ''
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Erro ao importar catálogo.')
    } finally {
      setImportingCatalog(false)
    }
  }

  if (activeView === 'overview') {
    return <DashboardOverview onNavigate={onNavigate} requests={requests} role="coordenacao" />
  }

  if (activeView === 'catalog') {
    return (
      <div className="catalog-page">
        <section className="workspace-section catalog-import-card">
          <div className="section-heading">
            <Upload size={22} />
            <div>
              <h2>Importar catálogo</h2>
              <p className="muted">Envie uma planilha XLSX ou CSV com código e descrição.</p>
            </div>
          </div>
          <div className="form-stack catalog-import-form">
            <input
              accept=".xlsx,.csv"
              disabled={analyzingCatalog || importingCatalog}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) analyzeCatalog(file)
              }}
              ref={catalogFileInputRef}
              type="file"
            />
            {analyzingCatalog && <p className="catalog-analysis-state">Analisando arquivo...</p>}
            {importError && <p className="alert error">{importError}</p>}
            {importMessage && <p className="alert success">{importMessage}</p>}

            {catalogPreview && (
              <div className="catalog-preview">
                <div className="catalog-preview-file">
                  <CheckCircle2 size={20} />
                  <div>
                    <strong>{catalogPreview.fileName}</strong>
                    <span>Arquivo analisado com sucesso.</span>
                  </div>
                </div>
                <div className="catalog-preview-stats">
                  <span><strong>{catalogPreview.found}</strong> {catalogPreview.found === 1 ? 'registro' : 'registros'}</span>
                  <span><strong>{catalogPreview.valid}</strong> {catalogPreview.valid === 1 ? 'válido' : 'válidos'}</span>
                  <span className={catalogPreview.ignored > 0 ? 'has-ignored' : ''}>
                    <strong>{catalogPreview.ignored}</strong> {catalogPreview.ignored === 1 ? 'ignorado' : 'ignorados'}
                  </span>
                </div>
                <div className="catalog-preview-table">
                  <h3>Pré-visualização</h3>
                  <div className="catalog-preview-head"><span>Código</span><span>Descrição</span></div>
                  {catalogPreview.preview.map((item, index) => (
                    <div className="catalog-preview-row" key={`${item.code}-${index}`}>
                      <strong>{item.code}</strong><span>{item.description}</span>
                    </div>
                  ))}
                </div>
                <div className="catalog-preview-actions">
                  <button className="secondary-action" disabled={importingCatalog} onClick={cancelCatalogImport} type="button">
                    Cancelar
                  </button>
                  <button className="primary-action" disabled={importingCatalog} onClick={confirmCatalogImport} type="button">
                    <Upload size={18} />
                    {importingCatalog ? 'Importando...' : 'Confirmar importação'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
        <section className="workspace-section catalog-future-panel">
          <div className="section-heading">
            <Database size={22} />
            <div>
              <h2>Itens do catálogo</h2>
              <p className="muted">Consulte os produtos atualmente disponíveis no banco.</p>
            </div>
          </div>
          <CatalogBrowser refreshKey={refreshKey} token={token} />
        </section>
      </div>
    )
  }

  return (
      <section className="workspace-section queue-page">
        <div className="section-heading">
          <ClipboardList size={22} />
          <div>
            <h2>Fila de solicitacoes</h2>
            <p className="muted">Analise itens do catalogo e sugestoes de novos produtos.</p>
          </div>
        </div>
        <div className="request-stack">
          {requests.length === 0 && <p className="empty-state">Nenhuma solicitação na fila no momento.</p>}
          {requests.map((request) => (
            <ReviewCard key={request.id} request={request} token={token} onReviewed={() => setRefreshKey((value) => value + 1)} />
          ))}
        </div>
      </section>
  )
}

function CatalogBrowser({ token, refreshKey }: { token: string; refreshKey: number }) {
  const pageSize = 80
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState('')

  const loadItems = useCallback(async (offset: number, replace: boolean) => {
    setLoading(true)
    setError('')
    try {
      const result = await api<CatalogItem[]>(
        token,
        `/catalog?search=${encodeURIComponent(search.trim())}&offset=${offset}&limit=${pageSize}`,
      )
      setItems((current) => replace ? result : [...current, ...result])
      setHasMore(result.length === pageSize)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar o catálogo.')
    } finally {
      setLoading(false)
    }
  }, [search, token])

  useEffect(() => {
    setItems([])
    setHasMore(true)
    const timeout = window.setTimeout(() => loadItems(0, true), 250)
    return () => window.clearTimeout(timeout)
  }, [loadItems, refreshKey])

  function handleScroll(event: React.UIEvent<HTMLDivElement>) {
    const container = event.currentTarget
    const nearEnd = container.scrollHeight - container.scrollTop - container.clientHeight < 90
    if (nearEnd && hasMore && !loading) loadItems(items.length, false)
  }

  return (
    <div className="catalog-browser">
      <label className="catalog-browser-search">
        <Search size={17} />
        <input aria-label="Buscar no catálogo" onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por código ou descrição" value={search} />
      </label>

      <div className="catalog-items-table">
        <div className="catalog-items-head"><span>Código</span><span>Descrição</span></div>
        <div className="catalog-items-scroll" onScroll={handleScroll} tabIndex={0}>
          {items.map((item) => (
            <article className="catalog-item-row" key={item.id}>
              <strong>{item.code}</strong>
              <span>{item.description}</span>
            </article>
          ))}
          {!loading && !error && items.length === 0 && (
            <div className="catalog-items-empty"><FileSpreadsheet size={25} /><strong>Nenhum item encontrado</strong><span>Importe um catálogo ou altere a busca.</span></div>
          )}
          {error && <div className="catalog-items-feedback error"><span>{error}</span><button onClick={() => loadItems(0, true)} type="button">Tentar novamente</button></div>}
          {loading && <p className="catalog-items-loading">Carregando itens...</p>}
          {!loading && !error && items.length > 0 && !hasMore && <p className="catalog-items-end">Fim do catálogo · {items.length} itens exibidos</p>}
        </div>
      </div>
      <p className="catalog-scroll-hint">Role a lista para carregar mais produtos.</p>
    </div>
  )
}

function ReviewCard({ request, token, onReviewed }: { request: PurchaseRequest; token: string; onReviewed: () => void }) {
  const [response, setResponse] = useState(request.coordinator_response ?? '')
  const [error, setError] = useState('')
  const requestItems = getRequestItems(request)

  async function review(status: 'aprovada' | 'recusada' | 'ajuste_solicitado') {
    setError('')
    try {
      await api(token, `/requests/${request.id}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ status, response }),
      })
      onReviewed()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao registrar retorno.')
    }
  }

  return (
    <article className="request-card">
      <div className="request-card-head">
        <div>
          <strong>#{request.id} - {requestItems.length} {requestItems.length === 1 ? 'produto' : 'produtos'}</strong>
          <span>{request.professorName} | {request.costCenterCode} - {request.costCenterName}</span>
        </div>
        <StatusBadge status={request.status} />
      </div>
      <div className="request-items-display">
        {requestItems.map((item) => {
          const display = getRequestItemDisplay(item, request.id)
          return <div key={item.id}><strong>{item.quantity}× {display.code}</strong><span>{display.name}</span>{item.supplier_link && <a href={item.supplier_link} rel="noreferrer" target="_blank">Link do fornecedor</a>}</div>
        })}
      </div>
      <p className="muted">Justificativa: {request.justification}</p>
      <textarea value={response} onChange={(event) => setResponse(event.target.value)} placeholder="Resposta da coordenacao" />
      {error && <p className="alert error">{error}</p>}
      <div className="review-actions">
        <button onClick={() => review('aprovada')} title="Aprovar" type="button">
          <CheckCircle2 size={18} />
          Aprovar
        </button>
        <button onClick={() => review('ajuste_solicitado')} title="Solicitar ajuste" type="button">
          <ClipboardList size={18} />
          Ajuste
        </button>
        <button onClick={() => review('recusada')} title="Recusar" type="button">
          <XCircle size={18} />
          Recusar
        </button>
      </div>
    </article>
  )
}

function RequestList({ title, requests }: { title: string; requests: PurchaseRequest[] }) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [type, setType] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const filteredRequests = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    const start = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null
    const end = dateTo ? new Date(`${dateTo}T23:59:59`) : null

    return requests.filter((request) => {
      const requestItems = getRequestItems(request)
      const itemSearchValues = requestItems.flatMap((item) => {
        const display = getRequestItemDisplay(item, request.id)
        return [display.code, display.name]
      })
      const matchesSearch = !normalizedSearch || [request.id, request.costCenterCode, ...itemSearchValues]
        .some((value) => String(value ?? '').toLowerCase().includes(normalizedSearch))
      const createdAt = new Date(request.created_at)
      return matchesSearch
        && (status === 'all' || request.status === status)
        && (type === 'all' || requestItems.some((item) => item.item_type === type))
        && (!start || createdAt >= start)
        && (!end || createdAt <= end)
    })
  }, [dateFrom, dateTo, requests, search, status, type])

  function clearFilters() {
    setSearch('')
    setStatus('all')
    setType('all')
    setDateFrom('')
    setDateTo('')
  }

  return (
    <section className="history-page">
      <header className="history-heading">
        <div>
          <h2>{title}</h2>
          <p>Acompanhe protocolos, status e retornos da coordenação.</p>
        </div>
        <span>{filteredRequests.length} de {requests.length} solicitações</span>
      </header>

      <div className="history-filters">
        <label className="history-search">
          <Search size={17} />
          <input aria-label="Buscar solicitações" onChange={(event) => setSearch(event.target.value)} placeholder="Buscar protocolo, item ou centro" value={search} />
        </label>
        <select aria-label="Filtrar por status" onChange={(event) => setStatus(event.target.value)} value={status}>
          <option value="all">Todos os status</option>
          <option value="aguardando_coordenacao">Aguardando coordenação</option>
          <option value="novo_item_pendente">Novo item pendente</option>
          <option value="aprovada">Aprovada</option>
          <option value="recusada">Recusada</option>
          <option value="ajuste_solicitado">Ajuste solicitado</option>
        </select>
        <select aria-label="Filtrar por tipo" onChange={(event) => setType(event.target.value)} value={type}>
          <option value="all">Todos os tipos</option>
          <option value="catalogo">Item do catálogo</option>
          <option value="novo">Item novo</option>
        </select>
        <label className="date-filter"><span>De</span><input aria-label="Data inicial" onChange={(event) => setDateFrom(event.target.value)} type="date" value={dateFrom} /></label>
        <label className="date-filter"><span>Até</span><input aria-label="Data final" onChange={(event) => setDateTo(event.target.value)} type="date" value={dateTo} /></label>
        <button className="clear-filter" onClick={clearFilters} title="Limpar filtros" type="button"><RotateCcw size={17} /></button>
      </div>

      <div className="history-table" role="table" aria-label="Histórico de solicitações">
        <div className="history-table-head" role="row">
          <span>Data</span><span>Protocolo</span><span>Item</span><span>Status</span><span />
        </div>
        {filteredRequests.length === 0 && <p className="empty-state">Nenhuma solicitação encontrada com esses filtros.</p>}
        {filteredRequests.map((request) => {
          const expanded = expandedId === request.id
          const protocol = `SOL-${new Date(request.created_at).getFullYear()}-${String(request.id).padStart(6, '0')}`
          const summary = getRequestSummary(request)
          const requestItems = getRequestItems(request)
          return (
            <article className={expanded ? 'history-entry expanded' : 'history-entry'} key={request.id}>
              <button className="history-row" onClick={() => setExpandedId(expanded ? null : request.id)} type="button">
                <span className="history-date"><strong>{formatShortDate(request.created_at)}</strong><small>{formatShortTime(request.created_at)}</small></span>
                <strong className="history-protocol">{protocol}</strong>
                <span className="history-item"><strong>{summary.code}</strong><small>{summary.name}</small></span>
                <StatusBadge status={request.status} />
                <ChevronRight className="history-chevron" size={18} />
              </button>
              {expanded && (
                <div className="history-details">
                  <dl>
                    <div className="full"><dt>Itens do pedido</dt><dd className="history-items-list">{requestItems.map((item) => { const display = getRequestItemDisplay(item, request.id); return <span key={item.id}><strong>{item.quantity}× {display.code}</strong> {display.name}</span> })}</dd></div>
                    <div><dt>Centro de custo</dt><dd>{request.costCenterCode} · {request.costCenterName}</dd></div>
                    <div className="full"><dt>Justificativa</dt><dd>{request.justification}</dd></div>
                    {request.coordinator_response && <div className="full response"><dt>Retorno da coordenação</dt><dd>{request.coordinator_response}</dd></div>}
                  </dl>
                </div>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}

function NotificationsDropdown({
  actionId,
  error,
  loading,
  markingAll,
  notifications,
  onNotificationClick,
  onMarkAllRead,
}: {
  actionId: number | null
  error: string
  loading: boolean
  markingAll: boolean
  notifications: Notification[]
  onNotificationClick: (notification: Notification) => Promise<void>
  onMarkAllRead: () => Promise<void>
}) {
  const unread = notifications.filter((notification) => !notification.readAt).length

  return (
    <section aria-busy={loading} className="notifications-dropdown" aria-label="Notificações">
      <header>
        <div>
          <strong>Notificações</strong>
          <span>{loading ? 'Atualizando...' : unread > 0 ? `${unread} não lida${unread > 1 ? 's' : ''}` : 'Tudo em dia'}</span>
        </div>
        {unread > 0 && (
          <button disabled={markingAll} onClick={onMarkAllRead} type="button">
            <CheckCheck size={16} /> {markingAll ? 'Marcando...' : 'Marcar todas como lidas'}
          </button>
        )}
      </header>
      {error && <p className="notifications-error">{error}</p>}
      <div className="notifications-scroll">
        {!loading && notifications.length === 0 && !error && (
          <div className="notifications-empty">
            <strong>Nenhuma notificação</strong>
            <span>Você está em dia.</span>
          </div>
        )}
        {notifications.map((notification) => (
          <button
            className={notification.readAt ? 'notification-row read' : 'notification-row'}
            disabled={actionId === notification.id}
            key={notification.id}
            onClick={() => onNotificationClick(notification)}
            type="button"
          >
            <span className="notification-dot" />
            <span className="notification-copy">
              <strong>{notification.title}</strong>
              <span>{notification.message}</span>
              <time>{formatNotificationDate(notification.createdAt)}</time>
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

function getPageTitle(view: AppView, role: Role) {
  const titles: Record<AppView, string> = {
    overview: 'Visão geral',
    'new-request': 'Nova solicitação',
    requests: 'Minhas solicitações',
    catalog: 'Catálogo',
    queue: 'Fila de solicitações',
    users: 'Usuários',
    profile: 'Meu perfil',
    settings: 'Configurações',
  }
  if (role === 'professor' && (view === 'catalog' || view === 'queue' || view === 'users')) return 'Visão geral'
  if (role === 'coordenacao' && (view === 'new-request' || view === 'requests')) return 'Visão geral'
  return titles[view]
}

function formatNotificationDate(value: string) {
  const date = new Date(value)
  const now = new Date()
  const elapsed = now.getTime() - date.getTime()
  if (elapsed >= 0 && elapsed < 60_000) return 'Agora'

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const notificationDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dayDifference = Math.round((today.getTime() - notificationDay.getTime()) / 86_400_000)
  const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date)
  if (dayDifference === 0) return `Hoje, ${time}`
  if (dayDifference === 1) return `Ontem, ${time}`

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

function formatShortTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function getRequestItems(request: PurchaseRequest) {
  if (request.items?.length) return request.items
  return [{
    id: 0,
    requestId: request.id,
    item_type: request.item_type,
    quantity: request.quantity,
    catalogCode: request.catalogCode,
    catalogDescription: request.catalogDescription,
    new_item_name: request.new_item_name,
    new_item_description: request.new_item_description,
    supplier_link: request.supplier_link,
  }]
}

function getRequestItemDisplay(item: PurchaseRequestItem, requestId: number) {
  return {
    code: item.item_type === 'catalogo' ? item.catalogCode ?? 'Sem código' : `NOVO-${requestId}`,
    name: item.item_type === 'catalogo' ? item.catalogDescription ?? 'Item removido do catálogo' : item.new_item_name ?? 'Novo item',
  }
}

function getRequestSummary(request: PurchaseRequest) {
  const items = getRequestItems(request)
  const first = getRequestItemDisplay(items[0], request.id)
  return {
    code: items.length > 1 ? `${first.code} +${items.length - 1}` : first.code,
    name: items.length > 1 ? `${first.name} e mais ${items.length - 1} ${items.length === 2 ? 'produto' : 'produtos'}` : first.name,
  }
}

function isValidRequestQuantity(value: string | number) {
  const quantity = Number(value)
  return Number.isInteger(quantity) && quantity >= 1 && quantity <= 50
}

function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    aguardando_coordenacao: 'Em analise',
    novo_item_pendente: 'Novo item pendente',
    aprovada: 'Aprovada',
    recusada: 'Recusada',
    ajuste_solicitado: 'Ajuste solicitado',
  }

  return <span className={`status status-${status}`}>{labels[status] ?? status.replaceAll('_', ' ')}</span>
}

function setFormValue<T extends Record<string, string>>(
  setState: React.Dispatch<React.SetStateAction<T>>,
  key: keyof T,
  value: string,
) {
  setState((current) => ({ ...current, [key]: value }))
}

function isBlockedLink(link: string) {
  if (!link.trim()) return false
  try {
    const hostname = new URL(link).hostname.toLowerCase().replace(/^www\./, '')
    return blockedDomains.some((domain) => hostname.includes(domain))
  } catch {
    return true
  }
}

async function api<T = unknown>(
  token: string,
  path: string,
  options: RequestInit & { isFormData?: boolean } = {},
): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set('Authorization', `Bearer ${token}`)
  if (!options.isFormData) headers.set('Content-Type', 'application/json')

  const response = await fetch(`${API_URL}${path}`, { ...options, headers })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message ?? 'Erro na requisicao.')
  return data
}

export default App
