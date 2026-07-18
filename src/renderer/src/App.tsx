import { useEffect, useState } from 'react'
import { useStore } from './state/store'
import StatusBar from './components/StatusBar'
import ChatPanel from './components/ChatPanel'
import ActionStream from './components/ActionStream'
import CompPreview from './components/CompPreview'
import SettingsModal from './components/SettingsModal'

export default function App(): JSX.Element {
  const init = useStore((s) => s.init)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    void init()
  }, [init])

  return (
    <div className="app">
      <StatusBar onOpenSettings={() => setSettingsOpen(true)} />
      <div className="app-body">
        <div className="pane pane-left">
          <ChatPanel />
        </div>
        <div className="pane pane-right">
          <CompPreview />
          <ActionStream />
        </div>
      </div>
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
