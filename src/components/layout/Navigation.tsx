import type { Tab } from '@/App'

interface NavigationProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'classement', label: 'Classement', icon: '🏆' },
  { id: 'pronostics', label: 'Pronostics', icon: '🎯' },
  { id: 'matchs', label: 'Matchs', icon: '⚽' },
  { id: 'defis', label: 'Défis', icon: '🔥' },
  { id: 'ligues', label: 'Ligues', icon: '🌐' },
]

export default function Navigation({ activeTab, onTabChange }: NavigationProps) {
  return (
    <nav className="bg-dark border-b border-white/10">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex overflow-x-auto scrollbar-hide">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-3.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-white'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-white/20'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  )
}
