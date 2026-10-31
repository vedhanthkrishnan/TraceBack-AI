import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from './primitives'

interface Props {
  children: ReactNode
  resetKey?: string
  label?: string
}
interface State {
  failed: boolean
}

/** Contains rendering failures to one section so the rest of the app keeps working. No stack trace is shown to users. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }
  static getDerivedStateFromError(): State {
    return { failed: true }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[TraceBack] render error', error, info.componentStack)
  }
  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false })
  }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div role="alert" className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <AlertTriangle className="size-8 text-critical-fg" aria-hidden />
        <p className="text-sm font-medium">{this.props.label ?? 'This section'} hit an unexpected problem.</p>
        <p className="max-w-md text-xs text-muted">The rest of the application is unaffected. Details were written to the browser console.</p>
        <Button size="sm" onClick={() => this.setState({ failed: false })}>
          Try again
        </Button>
      </div>
    )
  }
}
