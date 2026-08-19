import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  CheckCheck,
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
  ShieldCheck,
  Upload,
  TicketCheck,
  XCircle,
} from 'lucide-react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL ?? `http://${window.location.hostname}:3333/api`

type Role = 'professor' | 'coordenacao'
type AppView = 'overview' | 'new-request' | 'requests' | 'catalog' | 'queue'

type User = {
  id: number
  name: string
  email: string
  role: Role
}

type CatalogItem = {
  id: number
  code: string
  description: string
  costCenterCode?: string
  costCenterName?: string
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
  item: string
  quantity: string
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

  if (!token || !user) {
    return <LoginPage onLogin={handleLogin} />
  }

  return (
    <Shell activeView={activeView} user={user} token={token} onNavigate={setActiveView} onLogout={handleLogout}>
      {user.role === 'professor' ? (
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const notificationsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api<Notification[]>(token, '/notifications').then(setNotifications).catch(() => setNotifications([]))
  }, [token])

  useEffect(() => {
    function closeNotifications(event: MouseEvent) {
      if (!notificationsRef.current?.contains(event.target as Node)) setNotificationsOpen(false)
    }
    document.addEventListener('mousedown', closeNotifications)
    return () => document.removeEventListener('mousedown', closeNotifications)
  }, [])

  const unread = notifications.filter((item) => !item.readAt).length
  const pageTitle = getPageTitle(activeView, user.role)
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
      ]

  async function markNotificationRead(id: number) {
    await api(token, `/notifications/${id}/read`, { method: 'PATCH' })
    setNotifications((current) => current.map((item) => (
      item.id === id ? { ...item, readAt: new Date().toISOString() } : item
    )))
  }

  async function markAllNotificationsRead() {
    await api(token, '/notifications/read-all', { method: 'PATCH' })
    const readAt = new Date().toISOString()
    setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? readAt })))
  }

  function navigate(view: AppView) {
    onNavigate(view)
    setNotificationsOpen(false)
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
            onClick={() => setMobileMenuOpen((open) => !open)}
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
                className={notificationsOpen ? 'notification-trigger active' : 'notification-trigger'}
                onClick={() => setNotificationsOpen((open) => !open)}
                title="Notificações"
                type="button"
              >
                <Bell size={18} />
                {unread > 0 && <span>{unread}</span>}
              </button>
              {notificationsOpen && (
                <NotificationsDropdown
                  notifications={notifications}
                  onMarkAllRead={markAllNotificationsRead}
                  onMarkRead={markNotificationRead}
                />
              )}
            </div>
            <div className="user-summary">
              <span className="avatar">{user.name.charAt(0).toUpperCase()}</span>
              <div>
                <strong>{user.name}</strong>
                <span>{user.role === 'professor' ? 'Professor' : 'Coordenação'}</span>
              </div>
            </div>
            <button className="logout-button" onClick={onLogout} title="Sair" type="button">
              <LogOut size={18} />
              <span>Sair</span>
            </button>
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
            {recentRequests.map((request) => (
              <article key={request.id}>
                <div>
                  <strong>#{request.id} · {request.item_type === 'catalogo' ? request.catalogCode : request.new_item_name}</strong>
                  <span>{request.item_type === 'catalogo' ? request.catalogDescription : request.new_item_description}</span>
                </div>
                <StatusBadge status={request.status} />
              </article>
            ))}
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
  const [step, setStep] = useState(1)
  const [mode, setMode] = useState<'catalog' | 'new'>('catalog')
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<CatalogItem[]>([])
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null)
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

  useEffect(() => {
    if (!search.trim()) {
      setItems([])
      return
    }
    const timeout = window.setTimeout(() => {
      api<CatalogItem[]>(token, `/catalog?search=${encodeURIComponent(search)}`).then(setItems).catch(() => setItems([]))
    }, 250)
    return () => window.clearTimeout(timeout)
  }, [search, token])

  const linkBlocked = useMemo(() => isBlockedLink(form.supplierLink), [form.supplierLink])
  const selectedCostCenter = costCenters.find((center) => String(center.id) === form.costCenterId)

  function nextStep() {
    setError('')

    if (step === 1) {
      if (mode === 'catalog' && !selectedItem) {
        setError('Selecione um item do catálogo para continuar.')
        return
      }
      if (mode === 'new' && (!form.newItemName.trim() || !form.newItemDescription.trim() || !form.supplierLink.trim())) {
        setError('Preencha os dados do novo produto para continuar.')
        return
      }
      if (mode === 'new' && linkBlocked) {
        setError('Links de Amazon, Shopee e Mercado Livre não são permitidos.')
        return
      }
    }

    if (step === 2 && (!form.costCenterId || !form.justification.trim() || Number(form.quantity) < 1)) {
      setError('Preencha quantidade, centro de custo e justificativa para continuar.')
      return
    }

    setStep((current) => Math.min(3, current + 1))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')

    try {
      let requestId: number
      if (mode === 'catalog') {
        if (!selectedItem) throw new Error('Selecione um item do catalogo.')
        const response = await api<{ id: number; message: string }>(token, '/requests/catalog', {
          method: 'POST',
          body: JSON.stringify({
            catalogItemId: selectedItem.id,
            costCenterId: form.costCenterId,
            quantity: form.quantity,
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
        item: mode === 'catalog' ? `${selectedItem?.code} · ${selectedItem?.description}` : form.newItemName,
          quantity: form.quantity,
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
      setSelectedItem(null)
      setTechnicalFile(null)
      setPhoto(null)
      setStep(1)
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel enviar a solicitacao.')
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
    <section className="request-wizard page-section">
      <ol className="wizard-steps" aria-label="Etapas da solicitação">
        {['Escolher item', 'Informar detalhes', 'Revisar e enviar'].map((label, index) => {
          const number = index + 1
          return (
            <li className={step === number ? 'active' : step > number ? 'complete' : ''} key={label}>
              <span>{step > number ? <Check size={15} /> : number}</span>
              <strong>{label}</strong>
            </li>
          )
        })}
      </ol>

      <form className="wizard-form" onSubmit={submit}>
        <header className="wizard-heading">
          <span>Etapa {step} de 3</span>
          <h2>{step === 1 ? 'Qual item você precisa?' : step === 2 ? 'Detalhes da solicitação' : 'Revise antes de enviar'}</h2>
          <p>{step === 1 ? 'Consulte o catálogo ou sugira um produto novo.' : step === 2 ? 'Informe quantidade, destino e motivo da compra.' : 'Confira os dados e confirme o envio para a coordenação.'}</p>
        </header>

        <div className="wizard-body">
          {step === 1 && (
            <>
              <div className="segmented">
                <button className={mode === 'catalog' ? 'active' : ''} onClick={() => setMode('catalog')} type="button">Item do catálogo</button>
                <button className={mode === 'new' ? 'active' : ''} onClick={() => setMode('new')} type="button">Item novo</button>
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
                  {items.length > 0 && (
                    <div className="results-list">
                      {items.map((item) => (
                        <button className={selectedItem?.id === item.id ? 'result-row selected' : 'result-row'} key={item.id} onClick={() => setSelectedItem(item)} type="button">
                          <span className="selection-indicator" />
                          <span><strong>{item.code}</strong><small>{item.description}</small></span>
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
            </>
          )}

          {step === 2 && (
            <div className="step-fields">
              <div className="two-columns">
                <label>Quantidade<input min="1" value={form.quantity} onChange={(event) => setFormValue(setForm, 'quantity', event.target.value)} type="number" /></label>
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
          )}

          {step === 3 && (
            <div className="review-summary">
              <dl>
                <div><dt>Item</dt><dd>{mode === 'catalog' ? `${selectedItem?.code} · ${selectedItem?.description}` : form.newItemName}</dd></div>
                <div><dt>Quantidade</dt><dd>{form.quantity}</dd></div>
                <div><dt>Centro de custo</dt><dd>{selectedCostCenter ? `${selectedCostCenter.code} · ${selectedCostCenter.name}` : '-'}</dd></div>
                <div className="full"><dt>Justificativa</dt><dd>{form.justification}</dd></div>
                {mode === 'new' && <div className="full"><dt>Fornecedor</dt><dd>{form.supplierLink}</dd></div>}
              </dl>
              <p><CheckCircle2 size={17} /> A solicitação será encaminhada para análise da coordenação.</p>
            </div>
          )}

          {error && <p className="alert error">{error}</p>}
        </div>

        <footer className="wizard-actions">
          {step > 1 && <button className="secondary-action" onClick={() => { setError(''); setStep((current) => current - 1) }} type="button"><ChevronLeft size={17} /> Voltar</button>}
          {step < 3 ? (
            <button className="primary-action" onClick={nextStep} type="button">Continuar <ChevronRight size={17} /></button>
          ) : (
            <button className="primary-action" type="submit"><Send size={17} /> Enviar solicitação</button>
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
        <div><dt>Item solicitado</dt><dd>{ticket.item}</dd></div>
        <div><dt>Quantidade</dt><dd>{ticket.quantity}</dd></div>
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
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    api<PurchaseRequest[]>(token, '/requests').then(setRequests)
  }, [token, refreshKey])

  async function importCatalog(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const file = new FormData(event.currentTarget).get('file')
    if (!(file instanceof File) || !file.name) return

    const payload = new FormData()
    payload.append('file', file)
    const result = await api<{ imported: number }>(token, '/catalog/import', {
      method: 'POST',
      body: payload,
      isFormData: true,
    })
    setImportMessage(`${result.imported} itens importados. O catalogo anterior foi substituido.`)
    event.currentTarget.reset()
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
          <form className="form-stack catalog-import-form" onSubmit={importCatalog}>
            <input accept=".xlsx,.csv" name="file" required type="file" />
            {importMessage && <p className="alert success">{importMessage}</p>}
            <button className="primary-action" type="submit">
              <Upload size={18} />
              Substituir catálogo
            </button>
          </form>
        </section>
        <section className="workspace-section catalog-future-panel">
          <div className="section-heading">
            <Database size={22} />
            <div>
              <h2>Itens do catálogo</h2>
              <p className="muted">Espaço preparado para a futura gestão dos itens importados.</p>
            </div>
          </div>
          <div className="catalog-placeholder">
            <FileSpreadsheet size={28} />
            <strong>Catálogo centralizado</strong>
            <p>Após a importação, os itens ficam disponíveis para consulta nas solicitações dos professores.</p>
          </div>
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

function ReviewCard({ request, token, onReviewed }: { request: PurchaseRequest; token: string; onReviewed: () => void }) {
  const [response, setResponse] = useState(request.coordinator_response ?? '')
  const [error, setError] = useState('')

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
          <strong>#{request.id} - {request.item_type === 'catalogo' ? request.catalogCode : request.new_item_name}</strong>
          <span>{request.professorName} | {request.costCenterCode} - {request.costCenterName}</span>
        </div>
        <StatusBadge status={request.status} />
      </div>
      <p>{request.item_type === 'catalogo' ? request.catalogDescription : request.new_item_description}</p>
      <p className="muted">Quantidade: {request.quantity} | Justificativa: {request.justification}</p>
      {request.supplier_link && (
        <a href={request.supplier_link} rel="noreferrer" target="_blank">
          Link do fornecedor
        </a>
      )}
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
      const itemCode = request.item_type === 'catalogo' ? request.catalogCode : `NOVO-${request.id}`
      const itemName = request.item_type === 'catalogo' ? request.catalogDescription : request.new_item_name
      const matchesSearch = !normalizedSearch || [request.id, itemCode, itemName, request.costCenterCode]
        .some((value) => String(value ?? '').toLowerCase().includes(normalizedSearch))
      const createdAt = new Date(request.created_at)
      return matchesSearch
        && (status === 'all' || request.status === status)
        && (type === 'all' || request.item_type === type)
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
          const itemCode = request.item_type === 'catalogo' ? request.catalogCode ?? 'Sem código' : `NOVO-${request.id}`
          const itemName = request.item_type === 'catalogo' ? request.catalogDescription ?? 'Item removido do catálogo' : request.new_item_name
          return (
            <article className={expanded ? 'history-entry expanded' : 'history-entry'} key={request.id}>
              <button className="history-row" onClick={() => setExpandedId(expanded ? null : request.id)} type="button">
                <span className="history-date"><strong>{formatShortDate(request.created_at)}</strong><small>{formatShortTime(request.created_at)}</small></span>
                <strong className="history-protocol">{protocol}</strong>
                <span className="history-item"><strong>{itemCode}</strong><small>{itemName}</small></span>
                <StatusBadge status={request.status} />
                <ChevronRight className="history-chevron" size={18} />
              </button>
              {expanded && (
                <div className="history-details">
                  <dl>
                    <div><dt>Quantidade</dt><dd>{request.quantity}</dd></div>
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
  notifications,
  onMarkRead,
  onMarkAllRead,
}: {
  notifications: Notification[]
  onMarkRead: (id: number) => Promise<void>
  onMarkAllRead: () => Promise<void>
}) {
  const unread = notifications.filter((notification) => !notification.readAt).length

  return (
    <section className="notifications-dropdown" aria-label="Notificações">
      <header>
        <div>
          <strong>Notificações</strong>
          <span>{unread > 0 ? `${unread} não lida${unread > 1 ? 's' : ''}` : 'Tudo em dia'}</span>
        </div>
        <button disabled={unread === 0} onClick={onMarkAllRead} type="button">
          <CheckCheck size={16} /> Marcar todas como lidas
        </button>
      </header>
      <div className="notifications-scroll">
        {notifications.length === 0 && <p className="notifications-empty">Nenhuma notificação por enquanto.</p>}
        {notifications.map((notification) => (
          <button
            className={notification.readAt ? 'notification-row read' : 'notification-row'}
            key={notification.id}
            onClick={() => !notification.readAt && onMarkRead(notification.id)}
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
  }
  if (role === 'professor' && (view === 'catalog' || view === 'queue')) return 'Visão geral'
  if (role === 'coordenacao' && (view === 'new-request' || view === 'requests')) return 'Visão geral'
  return titles[view]
}

function formatNotificationDate(value: string) {
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
