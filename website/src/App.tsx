import { AppRoutes } from './routes/AppRoutes'
import { DialogHost } from './components/ui/dialogs'
import { ModelInstallProvider } from './contexts/ModelInstallContext'

export default function App() {
  return (
    <ModelInstallProvider>
      <AppRoutes />
      <DialogHost />
    </ModelInstallProvider>
  )
}
