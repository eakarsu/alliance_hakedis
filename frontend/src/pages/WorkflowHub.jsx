import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import {
  Target, TrendingUp, Shield, Eye, DollarSign, BookOpen,
  ShieldCheck, CheckSquare, Receipt, Zap, ArrowRight,
  AlertCircle, Clock, CheckCircle, Play, Plus, Settings,
  XCircle, BarChart3
} from 'lucide-react'

const iconMap = {
  Target, Zap, TrendingUp, Shield, Eye, DollarSign,
  BookOpen, ShieldCheck, CheckSquare, Receipt,
}

export default function WorkflowHub() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [instances, setInstances] = useState([])
  const [myActions, setMyActions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('active')

  useEffect(() => {
    Promise.all([
      api.get('/workflows/stats'),
      api.get('/workflows/instances'),
      api.get('/workflows/my-actions'),
    ]).then(([statsRes, instRes, actionsRes]) => {
      setStats(statsRes.data)
      setInstances(instRes.data.data || [])
      setMyActions(actionsRes.data.data || [])
    }).catch(err => console.error('Failed to load workflow data:', err))
      .finally(() => setLoading(false))
  }, [])

  const filteredInstances = instances.filter(i => {
    if (filter === 'all') return true
    return i.status === filter
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  const templates = stats?.by_template || []
  const mySteps = stats?.my_steps || {}

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Workflow Hub</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage all business workflows — track progress, take actions, and configure templates.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/workflow-config')}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
            <Settings className="h-4 w-4" /> Configure
          </button>
          <button onClick={() => navigate('/workflow-new')}
            className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 transition-colors">
            <Plus className="h-4 w-4" /> New Workflow
          </button>
        </div>
      </div>

      {/* My Pending Actions */}
      {myActions.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-white">
              <AlertCircle className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-amber-800">My Pending Steps</h2>
              <p className="text-xs text-amber-600">
                {myActions.length} step{myActions.length !== 1 ? 's' : ''} need your action
                {parseInt(mySteps.my_overdue_steps) > 0 && (
                  <span className="ml-1 text-red-600 font-semibold">
                    ({mySteps.my_overdue_steps} overdue)
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {myActions.slice(0, 5).map(action => {
              const Icon = iconMap[action.icon] || CheckSquare
              const isOverdue = action.due_at && new Date(action.due_at) < new Date()
              return (
                <div key={action.id}
                  onClick={() => navigate(`/workflow-detail/${action.instance_id}`)}
                  className="flex items-center justify-between rounded-lg bg-white border border-amber-100 px-4 py-2.5 cursor-pointer hover:border-amber-300 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-7 w-7 items-center justify-center rounded bg-gradient-to-br ${action.color || 'from-slate-400 to-slate-500'} text-white`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">{action.name}</p>
                      <p className="text-xs text-slate-400">
                        {action.template_code} &middot; {action.entity_label || action.entity_type}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isOverdue && (
                      <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">OVERDUE</span>
                    )}
                    {action.due_at && !isOverdue && (
                      <span className="text-xs text-slate-400">
                        Due {new Date(action.due_at).toLocaleDateString()}
                      </span>
                    )}
                    <ArrowRight className="h-3.5 w-3.5 text-slate-300" />
                  </div>
                </div>
              )
            })}
            {myActions.length > 5 && (
              <p className="text-xs text-amber-600 text-center pt-1">
                +{myActions.length - 5} more actions
              </p>
            )}
          </div>
        </div>
      )}

      {/* Template Overview Cards */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Workflow Templates</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {templates.map(t => {
            const Icon = iconMap[t.icon] || CheckSquare
            return (
              <div key={t.id}
                onClick={() => navigate(`/workflows?template=${t.id}`)}
                className="rounded-xl border border-slate-200 bg-white p-4 hover:shadow-md hover:border-blue-200 cursor-pointer transition-all">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${t.color} text-white`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400">{t.code}</span>
                    <h3 className="text-xs font-semibold text-slate-700 leading-tight">{t.name}</h3>
                  </div>
                </div>
                <div className="flex gap-3 mt-2">
                  <div className="text-center">
                    <p className="text-lg font-bold text-blue-600">{t.active_count || 0}</p>
                    <p className="text-[10px] text-slate-400">Active</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-emerald-600">{t.completed_count || 0}</p>
                    <p className="text-[10px] text-slate-400">Done</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-slate-400">{t.total_count || 0}</p>
                    <p className="text-[10px] text-slate-400">Total</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Instance List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Workflow Instances</h2>
          <div className="flex gap-1.5">
            {['active', 'completed', 'cancelled', 'all'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  filter === f ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {filteredInstances.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <BarChart3 className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No {filter !== 'all' ? filter : ''} workflow instances</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredInstances.map(inst => {
              const Icon = iconMap[inst.icon] || CheckSquare
              const progress = inst.total_steps > 0
                ? Math.round((parseInt(inst.completed_steps) / parseInt(inst.total_steps)) * 100)
                : 0
              return (
                <div key={inst.id}
                  onClick={() => navigate(`/workflow-detail/${inst.id}`)}
                  className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 hover:shadow-md hover:border-blue-200 cursor-pointer transition-all">
                  {/* Icon */}
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${inst.color} text-white flex-shrink-0`}>
                    <Icon className="h-5 w-5" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-bold text-slate-400">{inst.template_code}</span>
                      <h4 className="text-sm font-semibold text-slate-700 truncate">
                        {inst.entity_label || inst.template_name}
                      </h4>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        inst.status === 'active' ? 'bg-blue-100 text-blue-700' :
                        inst.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {inst.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Step {inst.current_step_order}/{inst.total_steps}
                      {' '}&middot;{' '}Started by {inst.started_by_name}
                      {' '}&middot;{' '}{new Date(inst.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Progress bar */}
                  <div className="w-32 flex-shrink-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-slate-400">{progress}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          inst.status === 'completed' ? 'bg-emerald-500' :
                          inst.status === 'cancelled' ? 'bg-slate-300' : 'bg-blue-500'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <ArrowRight className="h-4 w-4 text-slate-300 flex-shrink-0" />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
